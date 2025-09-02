import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { NextRequest } from "next/server"
import OpenAI from "openai"
import { z } from "zod"

export const runtime = "edge"

// Input validation schema
const requestSchema = z.object({
  input: z.string().min(1, "Input cannot be empty").max(4000, "Input too long"),
  conversationId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  systemPrompt: z.string().optional(),
  stream: z.boolean().optional()
})

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Simple rate limiting function
function checkRateLimit(identifier: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(identifier)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (userLimit.count >= limit) {
    return false
  }
  
  userLimit.count++
  return true
}

// Usage tracking function (implement based on your database)
async function trackUsage(userId: string, usage: {
  tokens: number
  model: string
  cost: number
  timestamp: Date
}) {
  // Implement your usage tracking logic here
  console.log(`Usage tracked for user ${userId}:`, usage)
}

// Calculate approximate cost
function calculateCost(usage: OpenAI.CompletionUsage | undefined, model: string): number {
  if (!usage) return 0
  
  const costs: Record<string, { input: number; output: number }> = {
    "gpt-4-1106-preview": { input: 0.01, output: 0.03 }, // per 1K tokens
    "gpt-3.5-turbo": { input: 0.0015, output: 0.002 }
  }
  
  const modelCost = costs[model] || costs["gpt-4-1106-preview"]
  return ((usage.prompt_tokens * modelCost.input) + (usage.completion_tokens * modelCost.output)) / 1000
}

// Streaming response handler
async function handleStreamingResponse(stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
  const encoder = new TextEncoder()
  
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            const data = JSON.stringify({ content, done: false })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
        }
        // Send completion signal
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse and validate input
    const json = await request.json()
    const validatedInput = requestSchema.parse(json)
    
    const { 
      input, 
      conversationId, 
      temperature = 0, 
      maxTokens, 
      systemPrompt = "You are a helpful AI assistant. Respond clearly and concisely.",
      stream = false 
    } = validatedInput

    // Get user identifier for rate limiting
    const userIP = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1"
    const profile = await getServerProfile()
    const rateLimitId = profile.id || userIP

    // Apply rate limiting
    if (!checkRateLimit(rateLimitId, 20, 60000)) { // 20 requests per minute
      return new Response(JSON.stringify({ 
        error: "Rate limit exceeded", 
        message: "Too many requests. Please try again in a minute.",
        retryAfter: 60 
      }), {
        status: 429,
        headers: { 'Retry-After': '60' }
      })
    }

    // Validate API key
    checkApiKey(profile.openai_api_key, "OpenAI")

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    // Prepare messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt
      }
    ]

    // Add conversation history if conversationId provided
    if (conversationId) {
      // In a real implementation, fetch from database
      // const history = await getConversationHistory(conversationId)
      // messages.push(...history)
    }

    // Add current user input
    messages.push({
      role: "user",
      content: input
    })

    // Determine max tokens
    const finalMaxTokens = maxTokens || 
      CHAT_SETTING_LIMITS["gpt-4-turbo-preview"]?.MAX_TOKEN_OUTPUT_LENGTH || 
      2000

    // Create completion request
    const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: "gpt-4-1106-preview",
      messages,
      temperature,
      max_tokens: finalMaxTokens,
      stream
    }

    const response = await openai.chat.completions.create(completionParams)

    // Handle streaming response
    if (stream) {
      return handleStreamingResponse(response as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>)
    }

    // Handle regular response
    const completion = response as OpenAI.Chat.Completions.ChatCompletion
    const content = completion.choices[0]?.message?.content || "No response generated"
    const usage = completion.usage

    // Track usage and performance
    const responseTime = Date.now() - startTime
    const cost = calculateCost(usage, "gpt-4-1106-preview")
    
    // Track usage asynchronously
    if (usage) {
      trackUsage(profile.id || "anonymous", {
        tokens: usage.total_tokens,
        model: "gpt-4-1106-preview",
        cost,
        timestamp: new Date()
      }).catch(console.error)
    }

    // Save conversation if conversationId provided
    if (conversationId && content) {
      // In real implementation: await saveConversationMessage(conversationId, input, content)
    }

    // Return enhanced response
    return new Response(JSON.stringify({
      content,
      metadata: {
        model: "gpt-4-1106-preview",
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          estimatedCost: cost
        } : null,
        responseTime,
        conversationId
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: any) {
    // Enhanced error handling with detailed logging
    const responseTime = Date.now() - startTime
    const errorDetails = {
      message: error.message,
      type: error.constructor.name,
      status: error.status || 500,
      responseTime,
      timestamp: new Date().toISOString()
    }

    // Log error (implement your logging solution)
    console.error("OpenAI API Error:", errorDetails)

    // Handle specific error types
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        error: "Validation Error",
        message: "Invalid input parameters",
        details: error.errors
      }), { status: 400 })
    }

    if (error.status === 429) {
      return new Response(JSON.stringify({
        error: "OpenAI Rate Limited",
        message: "OpenAI API rate limit exceeded. Please try again later.",
        retryAfter: 60
      }), { 
        status: 429,
        headers: { 'Retry-After': '60' }
      })
    }

    if (error.status === 401) {
      return new Response(JSON.stringify({
        error: "Authentication Error",
        message: "Invalid OpenAI API key configuration."
      }), { status: 401 })
    }

    if (error.status === 403) {
      return new Response(JSON.stringify({
        error: "Permission Error", 
        message: "Access denied to OpenAI API."
      }), { status: 403 })
    }

    // Generic error response
    const errorMessage = error.error?.message || error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    return new Response(JSON.stringify({
      error: "API Error",
      message: errorMessage,
      code: errorCode
    }), {
      status: errorCode
    })
  }
}

// Optional: Add OPTIONS handler for CORS
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { IconSparkles, IconTemplate, IconSearch } from "@tabler/icons-react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Label } from "../ui/label"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"

interface PromptPickerProps {}

export const PromptPicker: FC<PromptPickerProps> = ({}) => {
  const {
    prompts,
    isPromptPickerOpen,
    setIsPromptPickerOpen,
    focusPrompt,
    slashCommand
  } = useContext(ChatbotUIContext)

  const { handleSelectPrompt } = usePromptAndCommand()

  const itemsRef = useRef<(HTMLDivElement | null)[]>([])

  const [promptVariables, setPromptVariables] = useState<
    {
      promptId: string
      name: string
      value: string
    }[]
  >([])
  const [showPromptVariables, setShowPromptVariables] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1)

  useEffect(() => {
    if (focusPrompt && itemsRef.current[0]) {
      itemsRef.current[0].focus()
    }
  }, [focusPrompt])

  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(slashCommand.toLowerCase())
  )

  // Enhanced categorization
  const categorizedPrompts = filteredPrompts.reduce((acc, prompt) => {
    const category = prompt.folder_id || "general"
    if (!acc[category]) acc[category] = []
    acc[category].push(prompt)
    return acc
  }, {} as Record<string, Tables<"prompts">[]>)

  const categories = Object.keys(categorizedPrompts)
  const displayPrompts = selectedCategory === "all" 
    ? filteredPrompts 
    : categorizedPrompts[selectedCategory] || []

  const handleOpenChange = (isOpen: boolean) => {
    setIsPromptPickerOpen(isOpen)
  }

  // Enhanced search highlighting
  const highlightSearchText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 dark:bg-yellow-800 font-medium">
          {part}
        </span>
      ) : part
    )
  }

  const callSelectPrompt = (prompt: Tables<"prompts">) => {
    const regex = /\{\{.*?\}\}/g
    const matches = prompt.content.match(regex)

    if (matches) {
      const newPromptVariables = matches.map(match => ({
        promptId: prompt.id,
        name: match.replace(/\{\{|\}\}/g, ""),
        value: ""
      }))

      setPromptVariables(newPromptVariables)
      setShowPromptVariables(true)
    } else {
      handleSelectPrompt(prompt)
      handleOpenChange(false)
    }
  }

  const getKeyDownHandler =
    (index: number) => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault()
        handleOpenChange(false)
      } else if (e.key === "Enter") {
        e.preventDefault()
        callSelectPrompt(displayPrompts[index])
      } else if (
        (e.key === "Tab" || e.key === "ArrowDown") &&
        !e.shiftKey &&
        index === displayPrompts.length - 1
      ) {
        e.preventDefault()
        itemsRef.current[0]?.focus()
        setHoveredIndex(0)
      } else if (e.key === "ArrowUp" && !e.shiftKey && index === 0) {
        e.preventDefault()
        itemsRef.current[itemsRef.current.length - 1]?.focus()
        setHoveredIndex(itemsRef.current.length - 1)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const prevIndex = index - 1 >= 0 ? index - 1 : itemsRef.current.length - 1
        itemsRef.current[prevIndex]?.focus()
        setHoveredIndex(prevIndex)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        const nextIndex = index + 1 < itemsRef.current.length ? index + 1 : 0
        itemsRef.current[nextIndex]?.focus()
        setHoveredIndex(nextIndex)
      }
    }

  const handleSubmitPromptVariables = () => {
    const newPromptContent = promptVariables.reduce(
      (prevContent, variable) =>
        prevContent.replace(
          new RegExp(`\\{\\{${variable.name}\\}\\}`, "g"),
          variable.value
        ),
      prompts.find(prompt => prompt.id === promptVariables[0].promptId)
        ?.content || ""
    )

    const newPrompt: any = {
      ...prompts.find(prompt => prompt.id === promptVariables[0].promptId),
      content: newPromptContent
    }

    handleSelectPrompt(newPrompt)
    handleOpenChange(false)
    setShowPromptVariables(false)
    setPromptVariables([])
  }

  const handleCancelPromptVariables = () => {
    setShowPromptVariables(false)
    setPromptVariables([])
  }

  const handleKeydownPromptVariables = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (!isTyping && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmitPromptVariables()
    }
  }

  const getPromptPreview = (content: string) => {
    return content.length > 120 ? content.substring(0, 120) + "..." : content
  }

  return (
    <>
      {isPromptPickerOpen && (
        <div className="bg-background border-input max-h-96 overflow-hidden rounded-xl border-2 shadow-lg">
          {/* Header with categories */}
          {categories.length > 1 && (
            <div className="border-b border-border p-2">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    selectedCategory === "all"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  All ({filteredPrompts.length})
                </button>
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      selectedCategory === category
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {category} ({categorizedPrompts[category].length})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto p-2">
            {showPromptVariables ? (
              <Dialog
                open={showPromptVariables}
                onOpenChange={setShowPromptVariables}
              >
                <DialogContent onKeyDown={handleKeydownPromptVariables}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <IconSparkles size={20} />
                      Enter Prompt Variables
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-2 space-y-6">
                    {promptVariables.map((variable, index) => (
                      <div key={index} className="flex flex-col space-y-2">
                        <Label className="text-sm font-medium">
                          {variable.name}
                        </Label>

                        <TextareaAutosize
                          placeholder={`Enter a value for ${variable.name}...`}
                          value={variable.value}
                          onValueChange={value => {
                            const newPromptVariables = [...promptVariables]
                            newPromptVariables[index].value = value
                            setPromptVariables(newPromptVariables)
                          }}
                          minRows={3}
                          maxRows={5}
                          onCompositionStart={() => setIsTyping(true)}
                          onCompositionEnd={() => setIsTyping(false)}
                          className="border-input"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelPromptVariables}
                    >
                      Cancel
                    </Button>

                    <Button 
                      size="sm" 
                      onClick={handleSubmitPromptVariables}
                      disabled={promptVariables.some(v => !v.value.trim())}
                    >
                      Apply Prompt
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : displayPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <IconSearch 
                  size={48} 
                  className="text-muted-foreground mb-3 opacity-50" 
                />
                <div className="text-muted-foreground font-medium">
                  No matching prompts found
                </div>
                {slashCommand && (
                  <div className="text-muted-foreground mt-1 text-xs">
                    Try a different search term
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {displayPrompts.map((prompt, index) => {
                  const isHovered = hoveredIndex === index
                  const hasVariables = /\{\{.*?\}\}/.test(prompt.content)
                  
                  return (
                    <div
                      key={prompt.id}
                      ref={ref => {
                        itemsRef.current[index] = ref
                      }}
                      tabIndex={0}
                      className={`group relative cursor-pointer rounded-lg p-3 transition-all duration-150 hover:bg-accent focus:bg-accent focus:outline-none ${
                        isHovered ? 'bg-accent' : ''
                      }`}
                      onClick={() => callSelectPrompt(prompt)}
                      onKeyDown={getKeyDownHandler(index)}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(-1)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="bg-primary/10 text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded">
                          <IconTemplate size={16} />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="font-medium truncate">
                              {highlightSearchText(prompt.name, slashCommand)}
                            </div>
                            {hasVariables && (
                              <div className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ml-2 rounded px-2 py-0.5 text-xs">
                                Variables
                              </div>
                            )}
                          </div>

                          <div className="text-muted-foreground line-clamp-2 text-sm">
                            {getPromptPreview(prompt.content)}
                          </div>
                        </div>

                        {/* Hover indicator */}
                        <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
                          isHovered ? 'opacity-100' : 'opacity-0'
                        }`}>
                          <div className="bg-primary/20 text-primary rounded px-2 py-1 text-xs">
                            Enter
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

import { ChatbotUIContext } from "@/context/context"
import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, ModelProvider } from "@/types"
import { 
  IconAdjustmentsHorizontal, 
  IconDownload, 
  IconUpload,
  IconSettings,
  IconInfoCircle 
} from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { ChatSettingsForm } from "../ui/chat-settings-form"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

interface ChatSettingsProps {}

export const ChatSettings: FC<ChatSettingsProps> = ({}) => {
  useHotkey("i", () => handleClick())

  const {
    chatSettings,
    setChatSettings,
    models,
    availableHostedModels,
    availableLocalModels,
    availableOpenRouterModels
  } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [settingsHistory, setSettingsHistory] = useState<any[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleClick = () => {
    if (buttonRef.current) {
      buttonRef.current.click()
    }
  }

  // Save settings history for quick switching
  useEffect(() => {
    if (chatSettings && !settingsHistory.some(s => 
      JSON.stringify(s) === JSON.stringify(chatSettings)
    )) {
      setSettingsHistory(prev => [chatSettings, ...prev.slice(0, 4)])
    }
  }, [chatSettings])

  useEffect(() => {
    if (!chatSettings) return
    setChatSettings({
      ...chatSettings,
      temperature: Math.min(
        chatSettings.temperature,
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_TEMPERATURE || 1
      ),
      contextLength: Math.min(
        chatSettings.contextLength,
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_CONTEXT_LENGTH || 4096
      )
    })
  }, [chatSettings?.model])

  // Export settings to JSON
  const handleExportSettings = () => {
    if (!chatSettings) return
    
    const exportData = {
      ...chatSettings,
      exportedAt: new Date().toISOString(),
      version: "1.0"
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-settings-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success("Settings exported successfully!")
  }

  // Import settings from JSON
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string)
        
        // Validate required fields
        if (importedSettings.model && importedSettings.temperature !== undefined) {
          setChatSettings(importedSettings)
          toast.success("Settings imported successfully!")
        } else {
          toast.error("Invalid settings file format")
        }
      } catch (error) {
        toast.error("Failed to import settings")
      }
    }
    reader.readAsText(file)
    
    // Reset input
    event.target.value = ''
  }

  // Quick preset configurations
  const quickPresets = [
    {
      name: "Creative",
      settings: { temperature: 0.9, top_p: 0.9 },
      description: "High creativity for writing and brainstorming"
    },
    {
      name: "Balanced",
      settings: { temperature: 0.7, top_p: 0.8 },
      description: "Good balance for general conversations"
    },
    {
      name: "Precise",
      settings: { temperature: 0.1, top_p: 0.5 },
      description: "Low randomness for factual responses"
    }
  ]

  const applyPreset = (preset: typeof quickPresets[0]) => {
    if (!chatSettings) return
    
    setChatSettings({
      ...chatSettings,
      ...preset.settings
    })
    
    toast.success(`Applied ${preset.name} preset`)
  }

  if (!chatSettings) return null

  const allModels = [
    ...models.map(model => ({
      modelId: model.model_id as LLMID,
      modelName: model.name,
      provider: "custom" as ModelProvider,
      hostedId: model.id,
      platformLink: "",
      imageInput: false
    })),
    ...availableHostedModels,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ]

  const fullModel = allModels.find(llm => llm.modelId === chatSettings.model)

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportSettings}
        className="hidden"
      />
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger>
          <Button
            ref={buttonRef}
            className="flex items-center space-x-2"
            variant="ghost"
          >
            <div className="max-w-[120px] truncate text-lg sm:max-w-[300px] lg:max-w-[500px]">
              {fullModel?.modelName || chatSettings.model}
            </div>
            <IconAdjustmentsHorizontal size={28} />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent
          className="bg-background border-input relative flex max-h-[calc(100vh-60px)] w-[300px] flex-col space-y-4 overflow-auto rounded-lg border-2 p-6 sm:w-[350px] md:w-[400px] lg:w-[500px] dark:border-none"
          align="end"
        >
          {/* Header with actions */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center space-x-2">
              <IconSettings size={20} />
              <h3 className="font-semibold">Chat Settings</h3>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSettings}
                className="h-8"
              >
                <IconDownload size={16} />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8"
              >
                <IconUpload size={16} />
              </Button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium">Quick Presets</h4>
              <IconInfoCircle size={14} className="text-muted-foreground" />
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {quickPresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="h-auto flex-col items-start p-2 text-left"
                >
                  <div className="font-medium text-xs">{preset.name}</div>
                  <div className="text-muted-foreground text-xs mt-1 line-clamp-2">
                    {preset.description}
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Settings History */}
          {settingsHistory.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Settings</h4>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {settingsHistory.slice(1, 4).map((settings, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatSettings(settings)}
                    className="h-auto w-full justify-start p-2 text-left"
                  >
                    <div className="text-xs">
                      {settings.model} • T:{settings.temperature} • P:{settings.top_p}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Show Advanced Options</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Hide" : "Show"}
            </Button>
          </div>

          {/* Main Settings Form */}
          <ChatSettingsForm
            chatSettings={chatSettings}
            onChangeChatSettings={setChatSettings}
            showAdvanced={showAdvanced}
          />

          {/* Model Info */}
          {fullModel && (
            <div className="bg-accent/50 rounded-lg p-3 text-sm space-y-1">
              <div className="font-medium">Model Information</div>
              <div className="text-muted-foreground space-y-0.5">
                <div>Provider: {fullModel.provider}</div>
                <div>Image Support: {fullModel.imageInput ? "Yes" : "No"}</div>
                {CHAT_SETTING_LIMITS[chatSettings.model] && (
                  <div>
                    Max Context: {CHAT_SETTING_LIMITS[chatSettings.model].MAX_CONTEXT_LENGTH?.toLocaleString()} tokens
                  </div>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}

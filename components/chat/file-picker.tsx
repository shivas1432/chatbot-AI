import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { IconBooks, IconSearch, IconFileText } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { FileIcon } from "../ui/file-icon"

interface FilePickerProps {
  isOpen: boolean
  searchQuery: string
  onOpenChange: (isOpen: boolean) => void
  selectedFileIds: string[]
  selectedCollectionIds: string[]
  onSelectFile: (file: Tables<"files">) => void
  onSelectCollection: (collection: Tables<"collections">) => void
  isFocused: boolean
}

export const FilePicker: FC<FilePickerProps> = ({
  isOpen,
  searchQuery,
  onOpenChange,
  selectedFileIds,
  selectedCollectionIds,
  onSelectFile,
  onSelectCollection,
  isFocused
}) => {
  const { files, collections, setIsFilePickerOpen } =
    useContext(ChatbotUIContext)

  const itemsRef = useRef<(HTMLDivElement | null)[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1)

  useEffect(() => {
    if (isFocused && itemsRef.current[0]) {
      itemsRef.current[0].focus()
    }
  }, [isFocused])

  const filteredFiles = files.filter(
    file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedFileIds.includes(file.id)
  )

  const filteredCollections = collections.filter(
    collection =>
      collection.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedCollectionIds.includes(collection.id)
  )

  const allItems = [...filteredFiles, ...filteredCollections]

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
  }

  const handleSelectFile = (file: Tables<"files">) => {
    onSelectFile(file)
    handleOpenChange(false)
  }

  const handleSelectCollection = (collection: Tables<"collections">) => {
    onSelectCollection(collection)
    handleOpenChange(false)
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

  const getKeyDownHandler =
    (index: number, type: "file" | "collection", item: any) =>
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setIsFilePickerOpen(false)
      } else if (e.key === "Backspace") {
        e.preventDefault()
      } else if (e.key === "Enter") {
        e.preventDefault()

        if (type === "file") {
          handleSelectFile(item)
        } else {
          handleSelectCollection(item)
        }
      } else if (
        (e.key === "Tab" || e.key === "ArrowDown") &&
        !e.shiftKey &&
        index === allItems.length - 1
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

  const getFileTypeInfo = (file: Tables<"files">) => {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2)
    const typeMap: Record<string, string> = {
      'pdf': 'PDF Document',
      'txt': 'Text File',
      'docx': 'Word Document',
      'md': 'Markdown File'
    }
    return {
      typeLabel: typeMap[file.type] || file.type.toUpperCase(),
      size: `${sizeInMB} MB`
    }
  }

  return (
    <>
      {isOpen && (
        <div className="bg-background border-input max-h-80 overflow-y-auto rounded-xl border-2 p-3 text-sm shadow-lg">
          {allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <IconSearch 
                size={48} 
                className="text-muted-foreground mb-3 opacity-50" 
              />
              <div className="text-muted-foreground font-medium">
                No matching {searchQuery ? 'results' : 'files or collections'}
              </div>
              {searchQuery && (
                <div className="text-muted-foreground mt-1 text-xs">
                  Try a different search term
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Section headers */}
              {filteredFiles.length > 0 && (
                <div className="text-muted-foreground mb-2 flex items-center text-xs font-medium uppercase tracking-wide">
                  <IconFileText size={14} className="mr-1" />
                  Files ({filteredFiles.length})
                </div>
              )}
              
              {allItems.map((item, index) => {
                const isFile = "type" in item
                const isHovered = hoveredIndex === index
                const fileInfo = isFile ? getFileTypeInfo(item as Tables<"files">) : null
                
                return (
                  <div
                    key={item.id}
                    ref={ref => {
                      itemsRef.current[index] = ref
                    }}
                    tabIndex={0}
                    className={`group relative flex cursor-pointer items-start rounded-lg p-3 transition-all duration-150 hover:bg-accent focus:bg-accent focus:outline-none ${
                      isHovered ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      if (isFile) {
                        handleSelectFile(item as Tables<"files">)
                      } else {
                        handleSelectCollection(item)
                      }
                    }}
                    onKeyDown={e =>
                      getKeyDownHandler(
                        index,
                        isFile ? "file" : "collection",
                        item
                      )(e)
                    }
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(-1)}
                  >
                    <div className="mr-3 flex-shrink-0">
                      {isFile ? (
                        <FileIcon 
                          type={(item as Tables<"files">).type} 
                          size={32} 
                        />
                      ) : (
                        <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded">
                          <IconBooks size={20} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground mb-1 truncate">
                        {highlightSearchText(item.name, searchQuery)}
                      </div>

                      <div className="text-muted-foreground mb-1 line-clamp-2 text-sm">
                        {item.description || (isFile ? "No description" : "Collection")}
                      </div>

                      {isFile && fileInfo && (
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>{fileInfo.typeLabel}</span>
                          <span>•</span>
                          <span>{fileInfo.size}</span>
                        </div>
                      )}
                    </div>

                    {/* Hover indicator */}
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
                      isHovered || isFile ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <div className="bg-primary/20 text-primary rounded px-2 py-1 text-xs">
                        Press Enter
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Collections section */}
              {filteredCollections.length > 0 && filteredFiles.length > 0 && (
                <div className="text-muted-foreground mb-2 mt-4 flex items-center text-xs font-medium uppercase tracking-wide">
                  <IconBooks size={14} className="mr-1" />
                  Collections ({filteredCollections.length})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

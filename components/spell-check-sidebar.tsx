"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  Users,
  Mic,
} from "lucide-react"
import { MisspelledWord, ErrorCategory } from "./spell-check-extension"

interface SpellCheckSidebarProps {
  isLoading: boolean
  error: string | null
  misspelledWords: MisspelledWord[]
  categorizedErrors: {
    correctness: MisspelledWord[]
    clarity: MisspelledWord[]
  }
  isOpen: boolean
  onToggle: () => void
  onWordReplace: (from: number, to: number, replacement: string) => void
  onIgnoreWord: (word: string) => void
  onToggleCategory?: (category: ErrorCategory) => void
  categoryStates?: {
    correctness: boolean
    clarity: boolean
  }
  focusedWordId?: string | null
  onFocusWord?: (wordData: MisspelledWord) => void
  onFocusChange?: (wordId: string | null) => void
}

const categoryConfig = {
  correctness: {
    label: "Correctness",
    icon: CheckCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    description: "Spelling, punctuation & grammar"
  },
  clarity: {
    label: "Clarity", 
    icon: AlertTriangle,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description: "Conciseness, readability & style"
  }
}

export function SpellCheckSidebar({
  isLoading,
  error,
  misspelledWords,
  categorizedErrors,
  isOpen,
  onToggle,
  onWordReplace,
  onIgnoreWord,
  onToggleCategory,
  categoryStates = {
    correctness: true,
    clarity: true,
  },
  focusedWordId,
  onFocusWord,
  onFocusChange
}: SpellCheckSidebarProps) {
  const [replacementWords, setReplacementWords] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<ErrorCategory>("correctness")
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  const getWordId = (wordData: MisspelledWord, index: number) => {
    return `${wordData.word}-${wordData.position.from}-${wordData.ruleId}-${index}`
  }

  useEffect(() => {
    if (focusedWordId) {
      let foundWord: MisspelledWord | null = null
      let foundIndex = -1
      
      for (let i = 0; i < misspelledWords.length; i++) {
        const wordId = getWordId(misspelledWords[i], i)
        if (wordId === focusedWordId) {
          foundWord = misspelledWords[i]
          foundIndex = i
          break
        }
      }

      if (foundWord) {
        const needsTabSwitch = activeTab !== foundWord.category
        
        if (needsTabSwitch) {
          setActiveTab(foundWord.category)
        }
        
        setExpandedItemId(focusedWordId)
        
        const scrollDelay = needsTabSwitch ? 200 : 100
        setTimeout(() => {
          const element = document.querySelector(`[data-word-id="${focusedWordId}"]`)
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            })
          }
        }, scrollDelay)
      }
    }
  }, [focusedWordId, misspelledWords])

  const handleTabChange = (category: ErrorCategory) => {
    setActiveTab(category)
    if (focusedWordId) {
      setExpandedItemId(null)
      onFocusChange?.(null)
    }
  }

  const handleItemClick = (wordData: MisspelledWord, index: number) => {
    const wordId = getWordId(wordData, index)
    
    if (expandedItemId === wordId) {
      setExpandedItemId(null)
      onFocusChange?.(null)
    } else {
      setExpandedItemId(wordId)
      onFocusChange?.(wordId)
      onFocusWord?.(wordData)
    }
  }

  const handleReplaceWord = (wordData: MisspelledWord, index: number) => {
    const wordId = getWordId(wordData, index)
    const replacement = replacementWords[wordId]
    if (replacement && replacement.trim()) {
      onWordReplace(wordData.position.from, wordData.position.to, replacement.trim())
      setReplacementWords(prev => ({ ...prev, [wordId]: '' }))
      setExpandedItemId(null)
      onFocusChange?.(null)
    }
  }

  const handleSuggestionReplace = (wordData: MisspelledWord, suggestion: string, index: number) => {
    onWordReplace(wordData.position.from, wordData.position.to, suggestion)
    setExpandedItemId(null)
    onFocusChange?.(null)
  }

  const handleIgnoreWord = (word: string, wordId: string) => {
    onIgnoreWord(word)
    setExpandedItemId(null)
    onFocusChange?.(null)
  }

  const updateReplacementWord = (wordKey: string, replacement: string) => {
    setReplacementWords(prev => ({ ...prev, [wordKey]: replacement }))
  }

  const getStatusColor = () => {
    if (error) return "text-red-400"
    if (isLoading) return "text-blue-400"
    if (misspelledWords.length > 0) return "text-yellow-400"
    return "text-green-400"
  }

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="h-4 w-4" />
    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />
    if (misspelledWords.length > 0) return <AlertCircle className="h-4 w-4" />
    return <Check className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (error) return "Analysis error"
    if (isLoading) return "Analyzing text..."
    if (misspelledWords.length > 0) return `${misspelledWords.length} issue${misspelledWords.length === 1 ? '' : 's'} found`
    return "No issues found"
  }

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-400" />
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-yellow-400" />
      case 'info':
        return <Info className="h-3 w-3 text-blue-400" />
    }
  }

  const renderWordCard = (wordData: MisspelledWord, index: number) => {
    const wordId = getWordId(wordData, index)
    const config = categoryConfig[wordData.category]
    const isExpanded = expandedItemId === wordId
    const isFocused = focusedWordId === wordId
    
    return (
      <div
        key={wordId}
        data-word-id={wordId}
        className={`${config.bgColor} rounded-md border ${config.borderColor} transition-all duration-200 cursor-pointer ${
          isFocused ? 'ring-2 ring-blue-400/50 bg-opacity-80' : ''
        }`}
        onClick={() => handleItemClick(wordData, index)}
      >
        {!isExpanded && (
          <div className="p-3 flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
              <span className={`${config.color} font-medium text-sm truncate`}>
                {wordData.word}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="outline" className="text-xs px-2 py-0 h-5 truncate max-w-24">
                {wordData.ruleId}
              </Badge>
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`${config.color} font-medium text-sm truncate`}>
                  {wordData.word}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className="text-xs px-2 py-0 h-5 truncate max-w-24">
                  {wordData.ruleId}
                </Badge>
                <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>

            {wordData.message && (
              <div className="mb-2 text-xs text-gray-400 break-words">
                {wordData.message}
              </div>
            )}

            {wordData.suggestions.length > 0 && (
              <div className="mb-2">
                <div className="flex flex-wrap gap-1">
                  {wordData.suggestions.slice(0, 4).map((suggestion, suggestionIndex) => (
                    <Button
                      key={suggestionIndex}
                      variant="outline"
                      size="sm"
                      className="text-xs h-5 px-2 py-0 bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white border-gray-600 truncate max-w-32"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSuggestionReplace(wordData, suggestion, index)
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2">
              <Input
                placeholder="Custom replacement..."
                value={replacementWords[wordId] || ''}
                onChange={(e) => updateReplacementWord(wordId, e.target.value)}
                className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 text-xs h-6 focus:bg-gray-700"
                onClick={(e) => e.stopPropagation()}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    handleReplaceWord(wordData, index)
                  }
                }}
              />
            </div>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-6 bg-blue-600/80 hover:bg-blue-600 text-white border-blue-600/50"
                onClick={(e) => {
                  e.stopPropagation()
                  handleReplaceWord(wordData, index)
                }}
                disabled={!replacementWords[wordId]?.trim()}
              >
                Replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-6 bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white border-gray-600"
                onClick={(e) => {
                  e.stopPropagation()
                  handleIgnoreWord(wordData.word, wordId)
                }}
              >
                Ignore
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`spell-check-sidebar bg-[#161616] border-l border-gray-800 transition-all duration-300 ease-in-out ${
      isOpen ? 'w-[32rem]' : 'w-0'
    } flex flex-col overflow-hidden h-screen`}>
      {isOpen && (
        <>
          <div className="flex-1 flex flex-col overflow-hidden">
            {error ? (
              <div className="p-4 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                {error}
              </div>
            ) : isLoading ? (
              <div className="p-4 text-blue-400 text-sm">
                <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                Analyzing text...
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Headers */}
                <div className="border-b border-gray-700 bg-gray-800/30 flex">
                  {Object.entries(categoryConfig).map(([key, config]) => {
                    const category = key as ErrorCategory
                    const count = categorizedErrors[category]?.length || 0
                    const isEnabled = categoryStates[category]
                    const isActive = activeTab === category
                    
                    return (
                      <button
                        key={key}
                        onClick={() => handleTabChange(category)}
                        disabled={!isEnabled}
                        className={`flex-1 px-4 py-3 text-sm font-medium relative transition-all duration-200 ${
                          isActive 
                            ? 'text-white bg-gray-700/50' 
                            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                        } ${!isEnabled ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <config.icon className="h-4 w-4" />
                          <span>{config.label}</span>
                          {count > 0 && (
                            <Badge variant="secondary" className="h-4 min-w-4 px-1.5 text-xs bg-gray-600 text-gray-200">
                              {count}
                            </Badge>
                          )}
                        </div>
                        
                        {isActive && (
                          <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                            category === 'correctness' ? 'bg-red-400' : 'bg-blue-400'
                          }`} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {(() => {
                    const category = activeTab
                    const words = categorizedErrors[category] || []
                    const config = categoryConfig[category]
                    const isEnabled = categoryStates[category]

                    if (!isEnabled) {
                      return (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <config.icon className={`h-8 w-8 mb-2 ${config.color}`} />
                          <p className="text-gray-400 text-sm mb-3">
                            {config.label} analysis is disabled
                          </p>
                          {onToggleCategory && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onToggleCategory(category)}
                              className="text-xs"
                            >
                              Enable {config.label}
                            </Button>
                          )}
                        </div>
                      )
                    }

                    if (words.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <Check className="h-8 w-8 mb-2 text-green-400" />
                          <p className="text-green-400 text-sm">
                            No {category} issues found!
                          </p>
                        </div>
                      )
                    }

                    return (
                      <div className="flex-1 overflow-y-auto">
                        <div className="flex flex-col gap-3 p-3">
                          {words.map((wordData, categoryIndex) => {
                            // Find the original index in the full misspelledWords array
                            const originalIndex = misspelledWords.findIndex(w => 
                              w.word === wordData.word && 
                              w.position.from === wordData.position.from && 
                              w.ruleId === wordData.ruleId
                            )
                            return renderWordCard(wordData, originalIndex)
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
} 
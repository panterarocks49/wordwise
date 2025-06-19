"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { MisspelledWord } from "./remirror-editor"

interface SpellCheckSidebarProps {
  isLoading: boolean
  error: string | null
  misspelledWords: MisspelledWord[]
  isOpen: boolean
  onToggle: () => void
  onWordReplace: (from: number, to: number, replacement: string) => void
  onIgnoreWord: (word: string) => void
}

export function SpellCheckSidebar({
  isLoading,
  error,
  misspelledWords,
  isOpen,
  onToggle,
  onWordReplace,
  onIgnoreWord,
}: SpellCheckSidebarProps) {
  const [replacementWords, setReplacementWords] = useState<Record<string, string>>({})

  const handleReplaceWord = (wordData: MisspelledWord) => {
    const replacement = replacementWords[wordData.word]
    if (replacement && replacement.trim()) {
      onWordReplace(wordData.position.from, wordData.position.to, replacement.trim())
      // Clear the replacement input
      setReplacementWords(prev => ({ ...prev, [wordData.word]: '' }))
    }
  }

  const handleSuggestionReplace = (wordData: MisspelledWord, suggestion: string) => {
    onWordReplace(wordData.position.from, wordData.position.to, suggestion)
  }

  const handleIgnoreWord = (word: string) => {
    onIgnoreWord(word)
  }

  const updateReplacementWord = (originalWord: string, replacement: string) => {
    setReplacementWords(prev => ({ ...prev, [originalWord]: replacement }))
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
    if (error) return "Spell check error"
    if (isLoading) return "Checking spelling..."
    if (misspelledWords.length > 0) return `${misspelledWords.length} issue${misspelledWords.length === 1 ? '' : 's'} found`
    return "No issues found"
  }

  return (
    <div className={`bg-[#161616] border-l border-gray-800 transition-all duration-300 ease-in-out ${
      isOpen ? 'w-80' : 'w-0'
    } flex flex-col overflow-hidden`}>
      {isOpen && (
        <>
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-2">Spell Check</h3>
            
            {/* Status */}
            <div className={`flex items-center text-sm ${getStatusColor()}`}>
              {getStatusIcon()}
              <span className="ml-2">{getStatusText()}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {error ? (
              <div className="p-4 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                {error}
              </div>
            ) : isLoading ? (
              <div className="p-4 text-blue-400 text-sm">
                <Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
                Checking spelling...
              </div>
            ) : misspelledWords.length === 0 ? (
              <div className="p-4 text-green-400 text-sm">
                <Check className="h-4 w-4 inline mr-2" />
                No spelling errors found!
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {misspelledWords.map((wordData, index) => (
                    <div
                      key={`${wordData.word}-${index}`}
                      className="bg-gray-800/50 rounded-md p-2 border border-gray-700"
                    >
                      {/* Word - more compact header */}
                      <div className="mb-2">
                        <span className="text-red-400 font-medium text-sm">
                          {wordData.word}
                        </span>
                      </div>

                      {/* Suggestions - more compact inline layout */}
                      {wordData.suggestions.length > 0 && (
                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1">
                            {wordData.suggestions.slice(0, 4).map((suggestion, suggestionIndex) => (
                              <Button
                                key={suggestionIndex}
                                variant="outline"
                                size="sm"
                                className="text-xs h-5 px-2 py-0 bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white border-gray-600"
                                onClick={() => handleSuggestionReplace(wordData, suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom replacement - smaller input */}
                      <div className="mb-2">
                        <Input
                          placeholder="Custom replacement..."
                          value={replacementWords[wordData.word] || ''}
                          onChange={(e) => updateReplacementWord(wordData.word, e.target.value)}
                          className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 text-xs h-6 focus:bg-gray-700"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleReplaceWord(wordData)
                            }
                          }}
                        />
                      </div>

                      {/* Actions - smaller buttons */}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-6 bg-blue-600/80 hover:bg-blue-600 text-white border-blue-600/50"
                          onClick={() => handleReplaceWord(wordData)}
                          disabled={!replacementWords[wordData.word]?.trim()}
                        >
                          Replace
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-6 bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white border-gray-600"
                          onClick={() => handleIgnoreWord(wordData.word)}
                        >
                          Ignore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </>
      )}
    </div>
  )
} 
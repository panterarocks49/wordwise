"use client"

import React, { useState, useEffect } from 'react'
import nspell from 'nspell'

interface SpellCheckWrapperProps {
  content: string
  onChange: (content: string) => void
  children: React.ReactNode
}

interface MisspelledWord {
  word: string
  suggestions: string[]
}

export const SpellCheckWrapper: React.FC<SpellCheckWrapperProps> = ({ 
  content, 
  onChange, 
  children 
}) => {
  const [dictionary, setDictionary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [misspelledWords, setMisspelledWords] = useState<MisspelledWord[]>([])

  useEffect(() => {
    loadDictionary()
  }, [])

  useEffect(() => {
    if (dictionary && content) {
      checkSpelling(content)
    }
  }, [content, dictionary])

  const loadDictionary = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Use a different CDN that provides raw dictionary files
      const [affResponse, dicResponse] = await Promise.all([
        fetch('https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.aff'),
        fetch('https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.dic')
      ])
      
      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error('Failed to fetch dictionary files')
      }
      
      const aff = await affResponse.text()
      const dic = await dicResponse.text()
      
      // Create nspell instance with the fetched dictionary files
      const spellChecker = nspell({ aff, dic })
      
      setDictionary(spellChecker)
      setIsLoading(false)
      console.log('Spell check dictionary loaded successfully from CDN')
    } catch (err) {
      console.error('Failed to load dictionary:', err)
      setError('Failed to load spell check dictionary')
      setIsLoading(false)
    }
  }

  const extractTextForSpellCheck = (markdown: string): string => {
    return markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Extract link text
      .replace(/[#*_~]/g, '') // Remove markdown formatting
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
  }

  const checkSpelling = (markdown: string) => {
    if (!dictionary) return

    const textContent = extractTextForSpellCheck(markdown)
    const words = textContent.match(/\b[a-zA-Z]+\b/g) || []
    const misspelledMap = new Map<string, string[]>()

    for (const word of words) {
      if (word.length > 2 && !dictionary.correct(word) && !misspelledMap.has(word.toLowerCase())) {
        misspelledMap.set(word.toLowerCase(), dictionary.suggest(word).slice(0, 5))
      }
    }

    const misspelled = Array.from(misspelledMap.entries()).map(([word, suggestions]) => ({
      word,
      suggestions
    }))

    setMisspelledWords(misspelled)
  }

  const SpellCheckStatus = () => {
    if (isLoading) {
      return (
        <div className="spell-check-status p-2 text-sm border-b bg-blue-50">
          <span className="text-blue-600">🔄 Loading spell check...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="spell-check-status p-2 text-sm border-b bg-red-50">
          <span className="text-red-600">❌ {error}</span>
        </div>
      )
    }

    const errorCount = misspelledWords.length

    return (
      <div className="spell-check-status p-2 text-sm border-b bg-green-50">
        <div className="flex items-center justify-between">
          <span className="text-green-600">✅ Spell check active</span>
          {errorCount > 0 && (
            <span className="text-orange-600 font-medium">
              {errorCount} spelling issue{errorCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {errorCount > 0 && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
            <div className="font-medium text-orange-800 mb-1">Issues found:</div>
            <div className="space-y-1">
              {misspelledWords.slice(0, 5).map((item, index) => (
                <div key={index} className="text-orange-700">
                  <span className="font-medium">"{item.word}"</span>
                  {item.suggestions.length > 0 && (
                    <span className="text-orange-600 ml-2">
                      → {item.suggestions.slice(0, 3).join(', ')}
                    </span>
                  )}
                </div>
              ))}
              {errorCount > 5 && (
                <div className="text-orange-600">
                  ... and {errorCount - 5} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="spell-check-wrapper">
      <SpellCheckStatus />
      {children}
    </div>
  )
}

// Simple plugin export for compatibility
export const spellCheckPlugin = () => {
  console.log('Spell check plugin loaded (using wrapper approach)')
  return {
    // Empty plugin - actual functionality is in the wrapper
  }
} 
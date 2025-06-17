"use client"

import React, { useState, useEffect, useCallback } from 'react'
import nspell from 'nspell'

interface SpellCheckWrapperProps {
  content: string
  onChange: (content: string) => void
  children: React.ReactNode
  onSpellCheckUpdate?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => void
  onIgnoreWord?: (word: string) => void
  onWordReplace?: (originalWord: string, replacement: string) => void
}

export interface MisspelledWord {
  word: string
  suggestions: string[]
  position?: number
}

export const SpellCheckWrapper: React.FC<SpellCheckWrapperProps> = ({ 
  content, 
  onChange, 
  children,
  onSpellCheckUpdate,
  onIgnoreWord,
  onWordReplace
}) => {
  const [dictionary, setDictionary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [misspelledWords, setMisspelledWords] = useState<MisspelledWord[]>([])
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set())

  const loadDictionary = useCallback(async () => {
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
  }, [])

  const extractTextForSpellCheck = useCallback((markdown: string): string => {
    return markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Extract link text
      .replace(/[#*_~]/g, '') // Remove markdown formatting
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
  }, [])

  const checkSpelling = useCallback((markdown: string) => {
    if (!dictionary) return

    const textContent = extractTextForSpellCheck(markdown)
    const words = textContent.match(/\b[a-zA-Z]+\b/g) || []
    const misspelledMap = new Map<string, string[]>()

    for (const word of words) {
      if (
        word.length > 2 && 
        !dictionary.correct(word) && 
        !misspelledMap.has(word.toLowerCase()) &&
        !ignoredWords.has(word.toLowerCase())
      ) {
        misspelledMap.set(word.toLowerCase(), dictionary.suggest(word).slice(0, 5))
      }
    }

    const misspelled = Array.from(misspelledMap.entries()).map(([word, suggestions]) => ({
      word,
      suggestions
    }))

    setMisspelledWords(misspelled)
  }, [dictionary, ignoredWords, extractTextForSpellCheck])

  useEffect(() => {
    loadDictionary()
  }, [loadDictionary])

  useEffect(() => {
    if (dictionary && content) {
      checkSpelling(content)
    }
  }, [content, dictionary, checkSpelling])

  // Notify parent component of spell check updates
  useEffect(() => {
    if (onSpellCheckUpdate) {
      onSpellCheckUpdate({
        isLoading,
        error,
        misspelledWords
      })
    }
  }, [isLoading, error, misspelledWords, onSpellCheckUpdate])

  const handleWordReplace = useCallback((originalWord: string, replacement: string) => {
    if (onWordReplace) {
      onWordReplace(originalWord, replacement)
    }
  }, [onWordReplace])

  const handleIgnoreWord = useCallback((word: string) => {
    const newIgnoredWords = new Set(ignoredWords)
    newIgnoredWords.add(word.toLowerCase())
    setIgnoredWords(newIgnoredWords)
    
    if (onIgnoreWord) {
      onIgnoreWord(word)
    }
  }, [ignoredWords, onIgnoreWord])

  return (
    <div className="spell-check-wrapper">
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
"use client"

import React from 'react'
import { PlainExtension } from 'remirror'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { debounce } from 'lodash'
import { retext } from 'retext'
import retextEnglish from 'retext-english'
import retextSpell from 'retext-spell'
import retextContractions from 'retext-contractions'
import retextIndefiniteArticle from 'retext-indefinite-article'
import retextQuotes from 'retext-quotes'
import retextSentenceSpacing from 'retext-sentence-spacing'
import retextSmartypants from 'retext-smartypants'
import retextSimplify from 'retext-simplify'
import retextRedundantAcronyms from 'retext-redundant-acronyms'
import retextRepeatedWords from 'retext-repeated-words'
import retextReadability from 'retext-readability'
import retextPassive from 'retext-passive'
import retextPos from 'retext-pos'
import retextSyntaxUrls from 'retext-syntax-urls'
import retextSyntaxMentions from 'retext-syntax-mentions'
import { checkGrammarWithAI } from '@/lib/grammar-actions'

export type ErrorCategory = 'correctness' | 'clarity'

export interface MisspelledWord {
  word: string
  suggestions: string[]
  position: { from: number, to: number }
  category: ErrorCategory
  ruleId: string
  message: string
  severity: 'error' | 'warning' | 'info'
  source?: 'retext' | 'ai' // Add source tracking
}

export interface SpellCheckOptions {
  enabled?: boolean
  debounceMs?: number
  maxSuggestions?: number
  language?: string
  categories?: {
    correctness?: boolean
    clarity?: boolean
  }
}

// Plugin key for the spell check plugin
const spellCheckPluginKey = new PluginKey('spellCheck')

// Category mappings for different rule sources
const categoryMappings: Record<string, { category: ErrorCategory; severity: 'error' | 'warning' | 'info' }> = {
  // Correctness - spelling, punctuation, basic grammar
  'retext-spell': { category: 'correctness', severity: 'error' },
  'retext-contractions': { category: 'correctness', severity: 'error' },
  'retext-indefinite-article': { category: 'correctness', severity: 'error' },
  'retext-quotes': { category: 'correctness', severity: 'warning' },
  'retext-sentence-spacing': { category: 'correctness', severity: 'warning' },
  'retext-smartypants': { category: 'correctness', severity: 'info' },
  
  // Clarity - conciseness, readability, style
  'retext-simplify': { category: 'clarity', severity: 'warning' },
  'retext-redundant-acronyms': { category: 'clarity', severity: 'warning' },
  'retext-repeated-words': { category: 'clarity', severity: 'warning' },
  'retext-readability': { category: 'clarity', severity: 'info' },
  'retext-passive': { category: 'clarity', severity: 'info' },
  'retext-pos': { category: 'clarity', severity: 'info' },
}

export class SpellCheckExtension extends PlainExtension<SpellCheckOptions> {
  private spellChecker: any = null
  private dictionary: any = null
  private ignoredWords = new Set<string>()
  private misspelledWords: MisspelledWord[] = []
  private aiSuggestions: MisspelledWord[] = [] // Track AI suggestions separately
  private paragraphCache = new Map<string, { hash: string, misspelledWords: MisspelledWord[], lastPos: number }>()
  private aiCache = new Map<string, { hash: string, suggestions: MisspelledWord[], timestamp: number }>() // Cache for AI suggestions
  private onUpdateCallback?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
    categorizedErrors: {
      correctness: MisspelledWord[]
      clarity: MisspelledWord[]
    }
  }) => void
  private onFocusChangeCallback?: (wordId: string | null) => void
  private focusedWordId: string | null = null
  private lastCursorPosition: number = 0 // Track cursor position for AI checking

  get name() {
    return 'spellCheck' as const
  }

  // Default options
  protected get defaultOptions(): SpellCheckOptions {
    return {
      enabled: true,
      debounceMs: 500,
      maxSuggestions: 5,
      language: 'en',
      categories: {
        correctness: true,
        clarity: true
      }
    }
  }

  // Load dictionary and initialize retext processor
  private async loadDictionary(): Promise<void> {
    try {
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: true,
          error: null,
          misspelledWords: [],
          categorizedErrors: {
            correctness: [],
            clarity: []
          }
        })
      }, 0)

      // Load dictionary files from CDN (browser-compatible)
      const [affResponse, dicResponse] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0/index.aff'),
        fetch('https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0/index.dic')
      ])

      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error(`Failed to load dictionary files: aff=${affResponse.status}, dic=${dicResponse.status}`)
      }

      const aff = await affResponse.text()
      const dic = await dicResponse.text()

      // Create dictionary object compatible with retext-spell
      this.dictionary = { aff, dic }

      // Create comprehensive retext processor with all plugins
      this.spellChecker = retext()
        .use(retextEnglish)
        .use(retextSyntaxUrls) // Handle URLs first
        .use(retextSyntaxMentions) // Handle @mentions
        .use(retextPos) // Add part-of-speech tags
        
        // Correctness plugins
        .use(retextSpell, this.dictionary)
        .use(retextContractions)
        .use(retextIndefiniteArticle)
        .use(retextQuotes)
        .use(retextSentenceSpacing)
        .use(retextSmartypants)
        
        // Clarity plugins
        .use(retextSimplify)
        .use(retextRedundantAcronyms)
        .use(retextRepeatedWords)
        .use(retextReadability)
        .use(retextPassive)

      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: null,
          misspelledWords: [],
          categorizedErrors: {
            correctness: [],
            clarity: []
          }
        })
      }, 0)

      // Trigger initial spell check on existing content
      setTimeout(() => {
        const view = this.store.view
        if (view && view.state.doc.content.size > 0) {
          this.debouncedSpellCheck(view.state.doc)
        }
      }, 100) // Small delay to ensure the view is ready

    } catch (error) {
      console.error('🔍 SpellCheck: Failed to initialize spell checker:', error)
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: `Failed to load spell check dictionary: ${error instanceof Error ? error.message : 'Unknown error'}`,
          misspelledWords: [],
          categorizedErrors: {
            correctness: [],
            clarity: []
          }
        })
      }, 0)
    }
  }

  // Categorize errors into the two main categories
  private categorizeErrors(misspelledWords: MisspelledWord[]) {
    const categorizedErrors = {
      correctness: [] as MisspelledWord[],
      clarity: [] as MisspelledWord[]
    }

    misspelledWords.forEach(word => {
      categorizedErrors[word.category].push(word)
    })

    return categorizedErrors
  }

  // New AI-powered grammar checking function (debounced by 300ms)
  private debouncedAiGrammarCheck = debounce(async (doc: any, cursorPos: number) => {
    const enabled = this.options.enabled ?? true

    if (!enabled) {
      return
    }

    try {
      const currentParagraph = this.getCurrentParagraph(doc, cursorPos)
      if (!currentParagraph) {
        return
      }

      console.log('🤖 AI Grammar: Processing paragraph:', currentParagraph.text.substring(0, 50) + '...')

      // Check cache first
      const textHash = this.hashText(currentParagraph.text)
      const cached = this.aiCache.get(currentParagraph.position.from.toString())
      const cacheExpiry = 5 * 60 * 1000 // 5 minutes
      
      if (cached && cached.hash === textHash && Date.now() - cached.timestamp < cacheExpiry) {
        console.log('🤖 AI Grammar: Cache hit!')
        await this.processAiSuggestions(cached.suggestions)
        return
      }

      console.log('🤖 AI Grammar: Cache miss')
      
      // Call OpenAI API
      const aiSuggestions = await this.callGptBackend(currentParagraph.text, currentParagraph.position)
      
      // Cache the results
      this.aiCache.set(currentParagraph.position.from.toString(), {
        hash: textHash,
        suggestions: aiSuggestions,
        timestamp: Date.now()
      })

      await this.processAiSuggestions(aiSuggestions)

    } catch (error) {
      console.error('🤖 AI Grammar: Pipeline error:', error)
    }
  }, 300) // 300ms debounce as requested

  // Get the current paragraph based on cursor position
  private getCurrentParagraph(doc: any, cursorPos: number): { text: string, position: { from: number, to: number } } | null {
    let currentParagraph: { text: string, position: { from: number, to: number } } | null = null
    
    doc.descendants((node: any, pos: number) => {
      // Skip if we already found the paragraph
      if (currentParagraph) return false
      
      // Skip code blocks and other non-text content
      if (node.type.name === 'codeMirror' || node.type.name === 'codeBlock') {
        return false
      }
      
      // Check if cursor is within this paragraph-level node
      if (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'blockquote') {
        const nodeStart = pos
        const nodeEnd = pos + node.nodeSize
        
        if (cursorPos >= nodeStart && cursorPos <= nodeEnd) {
          const text = node.textContent
          if (text.trim()) { // Only process non-empty paragraphs
            currentParagraph = {
              text,
              position: { from: nodeStart, to: nodeEnd }
            }
          }
          return false // Stop traversing
        }
      }
    })
    
    return currentParagraph
  }

  // Call OpenAI API for grammar checking
  private async callGptBackend(text: string, position: { from: number, to: number }): Promise<MisspelledWord[]> {
    try {
      console.log('🤖 AI Grammar: Checking text with OpenAI:', text.substring(0, 50) + '...')
      
      // Call the server action for AI grammar checking
      const grammarErrors = await checkGrammarWithAI(text)
      
      if (grammarErrors.length === 0) {
        console.log('🤖 AI Grammar: No errors found')
        return []
      }

      console.log('🤖 AI Grammar: Found errors:', grammarErrors)
      
      // Debug: Show the original text for position verification
      console.log('📝 Original text:', JSON.stringify(text))
      
      // Transform OpenAI response to MisspelledWord format
      const potentialWords = grammarErrors
        .map((error, index) => {
          // Debug: Show what we're extracting
          const extractedText = text.substring(error.start, error.end)
          console.log(`🔍 Error ${index + 1}: "${extractedText}" at positions ${error.start}-${error.end} (${error.type})`)
          
          // Validate that we extracted something reasonable
          if (!extractedText.trim()) {
            console.warn(`⚠️ Empty extraction for error at ${error.start}-${error.end}:`, error)
            return null
          }
          
          // Map character positions from paragraph to document positions
          const documentFrom = position.from + 1 + error.start // +1 for paragraph node
          const documentTo = position.from + 1 + error.end
          
          // Validate positions
          if (documentFrom < position.from || documentTo > position.to || documentFrom >= documentTo) {
            console.warn('🤖 AI Grammar: Invalid position for error:', error)
            return null
          }
          
          // Extract the actual word from the text
          const word = text.substring(error.start, error.end)
          
          // Determine category based on error type
          const category: ErrorCategory = this.categorizeAiError(error.type)
          
          // Determine severity based on error type
          const severity = this.getAiErrorSeverity(error.type)
          
          const misspelledWord: MisspelledWord = {
            word,
            suggestions: [error.suggestion], // OpenAI provides one suggestion per error
            position: { from: documentFrom, to: documentTo },
            category,
            ruleId: `ai-${error.type.toLowerCase().replace(/\s+/g, '-')}`,
            message: error.description,
            severity,
            source: 'ai'
          }
          
          return misspelledWord
        })
      
      // Filter out null entries and return valid MisspelledWord array
      const misspelledWords: MisspelledWord[] = potentialWords.filter((word): word is MisspelledWord => word !== null)
      
      return misspelledWords
      
    } catch (error) {
      console.error('🤖 AI Grammar: Error calling OpenAI API:', error)
      return []
    }
  }

  // Helper method to categorize AI errors
  private categorizeAiError(errorType: string): ErrorCategory {
    const correctnessTypes = [
      'spelling', 'punctuation', 'capitalization', 'grammar', 'subject-verb agreement',
      'verb form', 'tense', 'pronoun', 'article', 'preposition'
    ]
    
    const clarityTypes = [
      'word choice', 'clarity', 'conciseness', 'redundancy', 'passive voice',
      'readability', 'style', 'flow', 'coherence'
    ]
    
    const lowerType = errorType.toLowerCase()
    
    if (correctnessTypes.some(type => lowerType.includes(type))) {
      return 'correctness'
    }
    
    if (clarityTypes.some(type => lowerType.includes(type))) {
      return 'clarity'
    }
    
    // Default to correctness for unknown types
    return 'correctness'
  }

  // Helper method to determine severity of AI errors
  private getAiErrorSeverity(errorType: string): 'error' | 'warning' | 'info' {
    const errorTypes = ['spelling', 'grammar', 'subject-verb agreement', 'verb form']
    const warningTypes = ['punctuation', 'word choice', 'clarity', 'style']
    
    const lowerType = errorType.toLowerCase()
    
    if (errorTypes.some(type => lowerType.includes(type))) {
      return 'error'
    }
    
    if (warningTypes.some(type => lowerType.includes(type))) {
      return 'warning'
    }
    
    return 'info'
  }

  // Process AI suggestions and merge with existing decorations
  private async processAiSuggestions(aiSuggestions: MisspelledWord[]) {
    // Update our AI suggestions array
    this.aiSuggestions = aiSuggestions

    // Merge AI suggestions with existing retext-based misspelled words
    const allSuggestions = this.mergeAllSuggestions()
    
    // Update the main misspelled words array
    this.misspelledWords = allSuggestions
    const categorizedErrors = this.categorizeErrors(allSuggestions)
    
    // Update callback
    setTimeout(() => {
      this.onUpdateCallback?.({
        isLoading: false,
        error: null,
        misspelledWords: allSuggestions,
        categorizedErrors
      })
    }, 0)

    // Update decorations
    const view = this.store.view
    if (view) {
      const tr = view.state.tr
      tr.setMeta(spellCheckPluginKey, { updateDecorations: true })
      view.dispatch(tr)
    }
  }

  // Merge retext and AI suggestions, avoiding duplicates
  private mergeAllSuggestions(): MisspelledWord[] {
    const retextSuggestions = this.misspelledWords.filter(word => word.source !== 'ai')
    const combined = [...retextSuggestions, ...this.aiSuggestions]
    
    // Remove duplicates based on position and word
    const uniqueSuggestions = combined.filter((word, index, arr) => {
      return arr.findIndex(w => 
        w.position.from === word.position.from && 
        w.position.to === word.position.to && 
        w.word === word.word
      ) === index
    })
    
    return uniqueSuggestions
  }

  // Debounced spell check function - now with change tracking
  private debouncedSpellCheck = debounce(async (doc: any, changedRanges?: Array<{ from: number, to: number }>) => {
    const enabled = this.options.enabled ?? true

    if (!this.spellChecker || !enabled) {
      return
    }

    // Defer the callback to avoid React render phase issues
    setTimeout(() => {
      this.onUpdateCallback?.({
        isLoading: true,
        error: null,
        misspelledWords: [],
        categorizedErrors: {
          correctness: [],
          clarity: []
        }
      })
    }, 0)

    try {
      const misspelledWords = await this.performSpellCheck(doc, changedRanges)
      
      this.misspelledWords = misspelledWords
      const categorizedErrors = this.categorizeErrors(misspelledWords)
      
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: null,
          misspelledWords,
          categorizedErrors
        })
      }, 0)

      // Update decorations by dispatching an empty transaction
      const view = this.store.view
      if (view) {
        const tr = view.state.tr
        tr.setMeta(spellCheckPluginKey, { updateDecorations: true })
        view.dispatch(tr)
      }
    } catch (error) {
      console.error('🔍 SpellCheck: Spell check error:', error)
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: 'Spell check failed',
          misspelledWords: [],
          categorizedErrors: {
            correctness: [],
            clarity: []
          }
        })
      }, 0)
    }
  }, this.options.debounceMs)

  // Generate a simple hash for text content
  private hashText(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  // Update cached positions when document changes
  private updateCachedPositions(mapping: any) {
    const updatedCache = new Map<string, { hash: string, misspelledWords: MisspelledWord[], lastPos: number }>()
    
    for (const [key, cached] of this.paragraphCache.entries()) {
      const updatedWords = cached.misspelledWords.map(word => {
        const newFrom = mapping.map(word.position.from)
        const newTo = mapping.map(word.position.to)
        return {
          ...word,
          position: { from: newFrom, to: newTo }
        }
      }).filter(word => 
        // Filter out words that were deleted (mapped to -1)
        word.position.from !== -1 && word.position.to !== -1 && 
        word.position.from < word.position.to
      )
      
      if (updatedWords.length > 0 || cached.misspelledWords.length === 0) {
        updatedCache.set(key, {
          ...cached,
          misspelledWords: updatedWords
        })
      }
    }
    
    this.paragraphCache = updatedCache
    
    // Also update AI suggestions positions
    this.aiSuggestions = this.aiSuggestions.map(word => {
      const newFrom = mapping.map(word.position.from)
      const newTo = mapping.map(word.position.to)
      return {
        ...word,
        position: { from: newFrom, to: newTo }
      }
    }).filter(word => 
      word.position.from !== -1 && word.position.to !== -1 && 
      word.position.from < word.position.to
    )
    
    // Also update our main misspelled words array (filtering out retext-only words first)
    const retextWords = this.misspelledWords.filter(word => word.source !== 'ai').map(word => {
      const newFrom = mapping.map(word.position.from)
      const newTo = mapping.map(word.position.to)
      return {
        ...word,
        position: { from: newFrom, to: newTo }
      }
    }).filter(word => 
      word.position.from !== -1 && word.position.to !== -1 && 
      word.position.from < word.position.to
    )
    
    // Merge updated retext words with updated AI suggestions
    this.misspelledWords = this.mergeRetextAndAiWords(retextWords, this.aiSuggestions)
  }

  // Helper method to merge retext and AI words
  private mergeRetextAndAiWords(retextWords: MisspelledWord[], aiWords: MisspelledWord[]): MisspelledWord[] {
    const combined = [...retextWords, ...aiWords]
    
    // Remove duplicates based on position and word
    return combined.filter((word, index, arr) => {
      return arr.findIndex(w => 
        w.position.from === word.position.from && 
        w.position.to === word.position.to && 
        w.word === word.word
      ) === index
    })
  }

  // Perform spell check on text using retext - now optimized for changed content
  private async performSpellCheck(doc: any, changedRanges?: Array<{ from: number, to: number }>): Promise<MisspelledWord[]> {
    const allMisspelledWords: MisspelledWord[] = []
    const paragraphsToCheck: Array<{ node: any, pos: number, text: string }> = []
    const unchangedParagraphs: Array<{ pos: number, cached: MisspelledWord[] }> = []
    
    // Collect paragraphs that need checking
    doc.descendants((node: any, pos: number) => {
      // Skip code blocks and other non-text content
      if (node.type.name === 'codeMirror' || node.type.name === 'codeBlock') {
        return false
      }
      
      // Process paragraph-level nodes
      if (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'blockquote') {
        const text = node.textContent
        if (!text.trim()) return // Skip empty paragraphs
        
        const nodeEnd = pos + node.nodeSize
        const cacheKey = `${node.type.name}`
        
        // If we have changed ranges, only check paragraphs that intersect with changes
        if (changedRanges) {
          const intersectsChange = changedRanges.some(range => 
            !(range.to <= pos || range.from >= nodeEnd)
          )
          if (!intersectsChange) {
            // Check if we have cached results for this paragraph
            const textHash = this.hashText(text)
            const cached = this.paragraphCache.get(`${pos}-${cacheKey}`)
            if (cached && cached.hash === textHash) {
              // Use cached results - positions should already be correct from mapping
              unchangedParagraphs.push({ pos, cached: cached.misspelledWords })
              return
            }
          }
        }
        
        paragraphsToCheck.push({ node, pos, text })
      }
    })

    // Add unchanged paragraphs' cached results
    unchangedParagraphs.forEach(({ cached }) => {
      allMisspelledWords.push(...cached)
    })

    // Process paragraphs in batches to avoid blocking the UI
    const batchSize = 5
    for (let i = 0; i < paragraphsToCheck.length; i += batchSize) {
      const batch = paragraphsToCheck.slice(i, i + batchSize)
      
      // Process batch
      for (const { node, pos, text } of batch) {
        try {
          // Use the comprehensive processor
          const file = await this.spellChecker.process(text)
          const paragraphWords: MisspelledWord[] = []
          
          // Process retext messages from all plugins
          for (const message of file.messages) {
            const source = message.source || 'unknown'
            const ruleId = message.ruleId || source
            const categoryInfo = categoryMappings[source] || { category: 'correctness', severity: 'warning' }
            
            // Check if this category is enabled
            const categoryEnabled = this.options.categories?.[categoryInfo.category] ?? true
            if (!categoryEnabled) {
              continue
            }
            
            // Skip ignored words
            if (message.actual && this.ignoredWords.has(message.actual.toLowerCase())) {
              continue
            }
            
            // Calculate position in the original document
            const wordStart = pos + 1 + (message.column ? message.column - 1 : 0) // +1 for paragraph node
            const wordLength = message.actual ? message.actual.length : 1
            const wordEnd = wordStart + wordLength
            
            // Validate positions
            if (wordStart >= 0 && wordEnd <= doc.content.size && wordStart < wordEnd) {
              const suggestions = message.expected ? 
                (Array.isArray(message.expected) ? message.expected : [message.expected]) : 
                []
              
              const misspelledWord: MisspelledWord = {
                word: message.actual || '',
                suggestions: suggestions.slice(0, this.options.maxSuggestions || 5),
                position: { from: wordStart, to: wordEnd },
                category: categoryInfo.category,
                ruleId,
                message: message.message || '',
                severity: categoryInfo.severity,
                source: 'retext' // Mark as retext source
              }
              
              paragraphWords.push(misspelledWord)
              allMisspelledWords.push(misspelledWord)
            }
          }
          
          // Cache the results for this paragraph
          const textHash = this.hashText(text)
          const cacheKey = `${node.type.name}`
          this.paragraphCache.set(`${pos}-${cacheKey}`, {
            hash: textHash,
            misspelledWords: paragraphWords,
            lastPos: pos
          })
          
        } catch (error) {
          console.error('🔍 SpellCheck: Error processing paragraph:', error)
        }
      }
      
      // Yield control to prevent blocking
      if (i + batchSize < paragraphsToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    // Clean up old cache entries (keep only recent ones)
    if (this.paragraphCache.size > 100) {
      const entries = Array.from(this.paragraphCache.entries())
      const toKeep = entries.slice(-50) // Keep last 50 entries
      this.paragraphCache.clear()
      toKeep.forEach(([key, value]) => this.paragraphCache.set(key, value))
    }

    return allMisspelledWords
  }

  // Create decorations for misspelled words with category-specific styling
  private buildDecorations(doc: any): DecorationSet {
    const enabled = this.options.enabled ?? true

    if (!enabled || this.misspelledWords.length === 0) {
      return DecorationSet.empty
    }

    const decorations = this.misspelledWords.map(({ position, word, category, severity }, index) => {
      // Validate positions
      if (position.from < 0 || position.to > doc.content.size || position.from >= position.to) {
        return null
      }
      
      // Generate the same word ID that sidebar uses
      const wordId = `${word}-${position.from}-${this.misspelledWords[index].ruleId}-${index}`
      const isFocused = this.focusedWordId === wordId
      
      // Enhanced category-specific styling with hover effects
      const categoryStyles = {
        correctness: 'text-decoration: underline; text-decoration-color: #ef4444; text-decoration-style: solid; text-decoration-thickness: 2px; text-underline-offset: 3px; cursor: pointer;',
        clarity: 'text-decoration: underline; text-decoration-color: #3b82f6; text-decoration-style: solid; text-decoration-thickness: 2px; text-underline-offset: 3px; cursor: pointer;'
      }
      
      return Decoration.inline(position.from, position.to, {
        class: `spell-error spell-error-${category}${isFocused ? ' focused' : ''}`,
        style: categoryStyles[category],
        'data-word-id': wordId,
        title: `${category === 'correctness' ? 'Correctness' : 'Clarity'} issue: ${word}`
      })
    }).filter((decoration): decoration is Decoration => decoration !== null) // Remove null decorations
    
    const decorationSet = DecorationSet.create(doc, decorations)
    
    return decorationSet
  }

  createExternalPlugins() {
    return [new Plugin({
      key: spellCheckPluginKey,
      state: {
        init: () => {
          return DecorationSet.empty
        },
        apply: (tr, decorationSet, oldState) => {
          const enabled = this.options.enabled ?? true

          if (!enabled) {
            return DecorationSet.empty
          }
          
          // Handle selection changes for cursor tracking
          if (tr.selectionSet && !tr.selection.eq(oldState.selection)) {
            const pos = tr.selection.from
            this.handleCursorChange(pos)
            this.lastCursorPosition = pos
            
            // Remove AI grammar check trigger from cursor changes
            // AI grammar check will only be triggered by document changes below
          }
          
          // Map decorations through the transaction
          let mapped = decorationSet.map(tr.mapping, tr.doc)
          
          // If document changed, update cached positions and schedule spell check
          if (tr.docChanged) {
            // Update all cached positions to account for document changes
            this.updateCachedPositions(tr.mapping)
            
            const changedRanges: Array<{ from: number, to: number }> = []
            
            // Extract changed ranges from the transaction
            tr.steps.forEach(step => {
              // Check if this is a replace step by examining the step's structure
              const stepData = step as any
              if (stepData.from !== undefined && stepData.to !== undefined) {
                changedRanges.push({ from: stepData.from, to: stepData.to })
              }
            })
            
            this.debouncedSpellCheck(tr.doc, changedRanges.length > 0 ? changedRanges : undefined)
            
            // Trigger AI grammar check only when document content changes
            const cursorPos = tr.selection.from
            this.lastCursorPosition = cursorPos
            this.debouncedAiGrammarCheck(tr.doc, cursorPos)
          }
          
          // Check if we need to update decorations
          const meta = tr.getMeta(spellCheckPluginKey)
          if (meta?.updateDecorations) {
            mapped = this.buildDecorations(tr.doc)
          }
          
          return mapped
        }
      },
      props: {
        decorations: (state) => {
          const pluginState = spellCheckPluginKey.getState(state)
          return pluginState || DecorationSet.empty
        },
        handleClick: (view, pos, event) => {
          // Handle clicks on decorations
          const decorations = spellCheckPluginKey.getState(view.state)
          if (decorations) {
            const clickedDecorations = decorations.find(pos, pos)
            if (clickedDecorations.length > 0) {
              this.handleCursorChange(pos)
              return true
            }
          }
          return false
        },
        handleDOMEvents: {
          mouseover: (view, event) => {
            const target = event.target as HTMLElement
            // Check if we're hovering over a spell error decoration
            if (target.classList.contains('spell-error')) {
              // Just show the tooltip on hover, don't update sidebar focus
              // The browser will handle showing the title attribute as a tooltip
            }
            return false
          },
          mouseout: (view, event) => {
            // Remove the mouseout handler since we're not tracking hover focus anymore
            return false
          }
        }
      }
    })]
  }

  // Initialize the extension
  onCreate() {
    this.loadDictionary()
  }

  // Public methods for the sidebar
  ignoreWord(word: string) {
    this.ignoredWords.add(word.toLowerCase())
    // Remove from current misspelled words
    this.misspelledWords = this.misspelledWords.filter(mw => mw.word.toLowerCase() !== word.toLowerCase())
    
    // Update decorations
    const view = this.store.view
    if (view) {
      const tr = view.state.tr
      tr.setMeta(spellCheckPluginKey, { updateDecorations: true })
      view.dispatch(tr)
    }
  }

  replaceWord(from: number, to: number, replacement: string) {
    const view = this.store.view
    if (view) {
      const tr = view.state.tr.replaceWith(from, to, this.store.schema.text(replacement))
      view.dispatch(tr)
    }
  }

  toggleSpellCheck() {
    const enabled = !this.options.enabled
    this.setOptions({ enabled })
    
    if (!enabled) {
      this.misspelledWords = []
      this.onUpdateCallback?.({
        isLoading: false,
        error: null,
        misspelledWords: [],
        categorizedErrors: {
          correctness: [],
          clarity: []
        }
      })
    }
    
    // Update decorations
    const view = this.store.view
    if (view) {
      const tr = view.state.tr
      tr.setMeta(spellCheckPluginKey, { updateDecorations: true })
      view.dispatch(tr)
    }
  }

  toggleCategory(category: ErrorCategory) {
    const currentCategories = this.options.categories || {}
    const newCategories = {
      ...currentCategories,
      [category]: !currentCategories[category]
    }
    
    this.setOptions({ categories: newCategories })
    
    // Trigger re-analysis
    const view = this.store.view
    if (view) {
      this.debouncedSpellCheck(view.state.doc)
    }
  }

  // Helper methods
  setUpdateCallback(callback: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
    categorizedErrors: {
      correctness: MisspelledWord[]
      clarity: MisspelledWord[]
    }
  }) => void) {
    this.onUpdateCallback = callback
  }

  setFocusChangeCallback(callback: (wordId: string | null) => void) {
    this.onFocusChangeCallback = callback
  }

  // Focus on a specific word in the editor
  focusWord(from: number, to: number) {
    const view = this.store.view
    if (view) {
      // Create a selection at the word position using TextSelection
      const { TextSelection } = require('prosemirror-state')
      const selection = TextSelection.create(view.state.doc, from, to)
      const tr = view.state.tr.setSelection(selection)
      view.dispatch(tr)
      
      // Update focused word state
      this.handleCursorChange(from)
      
      // Scroll to the selection with better positioning
      view.focus()
      
      // Find the DOM element for the word and scroll it into view
      setTimeout(() => {
        const editorDOM = view.dom
        const rect = view.coordsAtPos(from)
        if (rect) {
          // Calculate the container to scroll (look for scrollable parent)
          let scrollContainer = editorDOM.parentElement
          while (scrollContainer && scrollContainer !== document.body) {
            const style = window.getComputedStyle(scrollContainer)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                scrollContainer.classList.contains('overflow-y-auto')) {
              break
            }
            scrollContainer = scrollContainer.parentElement
          }
          
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect()
            const wordTop = rect.top
            const containerTop = containerRect.top
            const containerHeight = containerRect.height
            
            // Scroll so the word is centered in the visible area
            const scrollOffset = wordTop - containerTop - (containerHeight / 2)
            scrollContainer.scrollBy({
              top: scrollOffset,
              behavior: 'smooth'
            })
          }
        }
      }, 50) // Small delay to ensure selection is set first
    }
  }

  // Find word ID by position (for reverse lookup from cursor position)
  findWordIdByPosition(pos: number): string | null {
    for (let i = 0; i < this.misspelledWords.length; i++) {
      const word = this.misspelledWords[i]
      if (pos >= word.position.from && pos <= word.position.to) {
        return `${word.word}-${word.position.from}-${word.ruleId}-${i}`
      }
    }
    return null
  }

  // Handle cursor position changes to update focused word
  handleCursorChange(pos: number) {
    let wordId: string | null = null
    
    if (pos >= 0) {
      wordId = this.findWordIdByPosition(pos)
    }
    // If pos is -1, wordId remains null (no focus)
    
    if (wordId !== this.focusedWordId) {
      this.focusedWordId = wordId
      this.onFocusChangeCallback?.(wordId)
      
      // Trigger decoration rebuild to update focused styling
      const view = this.store.view
      if (view) {
        const tr = view.state.tr
        tr.setMeta(spellCheckPluginKey, { updateDecorations: true })
        view.dispatch(tr)
      }
    }
  }

  getMisspelledWords(): MisspelledWord[] {
    return this.misspelledWords
  }

  getCategorizedErrors() {
    return this.categorizeErrors(this.misspelledWords)
  }

  isSpellCheckEnabled(): boolean {
    return this.options.enabled ?? true
  }

  isCategoryEnabled(category: ErrorCategory): boolean {
    return this.options.categories?.[category] ?? true
  }
} 
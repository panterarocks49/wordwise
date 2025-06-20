"use client"

import React from 'react'
import { PlainExtension } from 'remirror'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { debounce } from 'lodash'
import { checkGrammar, LTMatch, LTResponse } from '@/lib/language-tool'

export type ErrorCategory = 'correctness' | 'clarity'

export interface MisspelledWord {
  word: string
  suggestions: string[]
  position: { from: number, to: number }
  category: ErrorCategory
  ruleId: string
  message: string
  severity: 'error' | 'warning' | 'info'
  source?: 'languagetool' // Simplified to just LanguageTool
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

export class SpellCheckExtension extends PlainExtension<SpellCheckOptions> {
  private ignoredWords = new Set<string>()
  private misspelledWords: MisspelledWord[] = []
  private paragraphCache = new Map<string, { hash: string, misspelledWords: MisspelledWord[], lastPos: number }>()
  private languageToolCache = new Map<string, { hash: string, suggestions: MisspelledWord[], timestamp: number }>()
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
  private lastCursorPosition: number = 0
  private hasRunInitialCheck = false

  get name() {
    return 'spellCheck' as const
  }

  // Default options
  protected get defaultOptions(): SpellCheckOptions {
    return {
      enabled: true,
      debounceMs: 500,
      maxSuggestions: 5,
      language: 'en-US',
      categories: {
        correctness: true,
        clarity: true
      }
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

  // LanguageTool-powered checking function (debounced by 300ms)
  private debouncedLanguageToolCheck = debounce(async (doc: any, cursorPos: number) => {
    const enabled = this.options.enabled ?? true

    if (!enabled) {
      return
    }

    try {
      const currentParagraph = this.getCurrentParagraph(doc, cursorPos)
      if (!currentParagraph) {
        return
      }

      console.log('🔧 LanguageTool: Processing paragraph:', currentParagraph.text.substring(0, 50) + '...')

      // Check cache first
      const textHash = this.hashText(currentParagraph.text)
      const cached = this.languageToolCache.get(currentParagraph.position.from.toString())
      const cacheExpiry = 5 * 60 * 1000 // 5 minutes
      
      if (cached && cached.hash === textHash && Date.now() - cached.timestamp < cacheExpiry) {
        console.log('🔧 LanguageTool: Cache hit!')
        await this.processLanguageToolSuggestions(cached.suggestions, currentParagraph.position)
        return
      }

      console.log('🔧 LanguageTool: Cache miss')
      
      // Call LanguageTool API
      const languageToolSuggestions = await this.callLanguageToolBackend(currentParagraph.text, currentParagraph.position)
      
      // Cache the results
      this.languageToolCache.set(currentParagraph.position.from.toString(), {
        hash: textHash,
        suggestions: languageToolSuggestions,
        timestamp: Date.now()
      })

      await this.processLanguageToolSuggestions(languageToolSuggestions, currentParagraph.position)

    } catch (error) {
      console.error('🔧 LanguageTool: Pipeline error:', error)
    }
  }, 300) // 300ms debounce

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

  // Call LanguageTool API for grammar checking
  private async callLanguageToolBackend(text: string, position: { from: number, to: number }): Promise<MisspelledWord[]> {
    try {
      console.log('🔧 LanguageTool: Checking text:', text.substring(0, 50) + '...')
      
      // Call the LanguageTool API
      const response: LTResponse = await checkGrammar(text)
      
      if (response.matches.length === 0) {
        console.log('🔧 LanguageTool: No errors found')
        return []
      }

      console.log('🔧 LanguageTool: Found', response.matches)
      
      // Transform LanguageTool response to MisspelledWord format
      const potentialWords = response.matches
        .map((match: LTMatch, index: number) => {
          // Extract the actual word from the text
          const word = text.substring(match.offset, match.offset + match.length)
          
          // Validate that we extracted something reasonable
          if (!word.trim()) {
            console.warn(`⚠️ Empty extraction for match at ${match.offset}-${match.offset + match.length}`)
            return null
          }
          
          // Map character positions from paragraph to document positions
          const documentFrom = position.from + 1 + match.offset // +1 for paragraph node
          const documentTo = position.from + 1 + match.offset + match.length
          
          // Validate positions
          if (documentFrom < position.from || documentTo > position.to || documentFrom >= documentTo) {
            console.warn('🔧 LanguageTool: Invalid position for match:', match.rule.id)
            return null
          }
          
          // Determine category based on LanguageTool's own categorization
          const category: ErrorCategory = this.categorizeLanguageToolError(match.rule.category.id, match.rule.issueType, match.rule.description)
          
          // Determine severity based on rule type and category
          const severity = this.getLanguageToolErrorSeverity(match.rule.category.id, match.rule.issueType)
          
          // Extract suggestions from replacements
          const suggestions = match.replacements.map(r => r.value).slice(0, this.options.maxSuggestions || 5)
          
          // Generate a user-friendly rule ID
          const readableRuleId = this.generateReadableRuleId(match.rule.category.id, match.rule.issueType, match.shortMessage || match.message)
          
          const misspelledWord: MisspelledWord = {
            word,
            suggestions,
            position: { from: documentFrom, to: documentTo },
            category,
            ruleId: readableRuleId,
            message: match.shortMessage || match.message,
            severity,
            source: 'languagetool'
          }
          
          return misspelledWord
        })
      
      // Filter out null entries and return valid MisspelledWord array
      const misspelledWords: MisspelledWord[] = potentialWords.filter((word): word is MisspelledWord => word !== null)
      
      console.log('🔧 LanguageTool: Processed', misspelledWords.length, 'valid suggestions')
      
      return misspelledWords
      
    } catch (error) {
      console.error('🔧 LanguageTool: Error calling LanguageTool API:', error)
      return []
    }
  }

  // Helper method to categorize LanguageTool errors based on their actual categories
  private categorizeLanguageToolError(categoryId: string, issueType: string, ruleDescription: string): ErrorCategory {
    // LanguageTool's own categories that indicate correctness issues
    const correctnessCategories = [
      'GRAMMAR',        // Grammar errors
      'TYPOS',          // Spelling and typos
      'CASING',         // Capitalization
      'PUNCTUATION',    // Punctuation errors
      'COMPOUNDING',    // Compound word errors
      'CONFUSED_WORDS', // Word confusion (e.g., affect/effect)
      'TYPOGRAPHY',     // Typography and formatting
      'MISC',           // Miscellaneous correctness issues
    ]
    
    // LanguageTool's categories that indicate clarity/style issues
    const clarityCategories = [
      'STYLE',          // Style improvements
      'REDUNDANCY',     // Redundant words/phrases
      'PLAIN_ENGLISH',  // Plain English suggestions
      'COLLOQUIALISMS', // Informal language
      'SEMANTICS',      // Meaning and clarity
    ]
    
    // Check LanguageTool's category first
    if (correctnessCategories.includes(categoryId)) {
      return 'correctness'
    }
    
    if (clarityCategories.includes(categoryId)) {
      return 'clarity'
    }
    
    // Check issue type as fallback
    const correctnessIssueTypes = ['grammar', 'misspelling', 'typographical', 'non-conformance', 'duplication']
    const clarityIssueTypes = ['style', 'register', 'locale-violation', 'uncategorized']
    
    if (correctnessIssueTypes.includes(issueType.toLowerCase())) {
      return 'correctness'
    }
    
    if (clarityIssueTypes.includes(issueType.toLowerCase())) {
      return 'clarity'
    }
    
    // Check description for keywords as final fallback
    const lowerDescription = ruleDescription.toLowerCase()
    const correctnessKeywords = ['spelling', 'grammar', 'punctuation', 'capitalization', 'agreement', 'tense', 'confused', 'wrong word']
    const clarityKeywords = ['passive', 'redundant', 'wordy', 'style', 'clarity', 'concise', 'colloquial', 'informal']
    
    if (correctnessKeywords.some(keyword => lowerDescription.includes(keyword))) {
      return 'correctness'
    }
    
    if (clarityKeywords.some(keyword => lowerDescription.includes(keyword))) {
      return 'clarity'
    }
    
    // Default to correctness for unknown categories
    return 'correctness'
  }

  // Helper method to determine severity of LanguageTool errors
  private getLanguageToolErrorSeverity(categoryId: string, issueType: string): 'error' | 'warning' | 'info' {
    // High severity categories (errors that should be fixed)
    const errorCategories = ['GRAMMAR', 'TYPOS', 'CONFUSED_WORDS']
    const errorIssueTypes = ['grammar', 'misspelling', 'duplication']
    
    // Medium severity categories (warnings)
    const warningCategories = ['PUNCTUATION', 'CASING', 'COMPOUNDING', 'TYPOGRAPHY', 'MISC']
    const warningIssueTypes = ['typographical', 'non-conformance']
    
    // Low severity categories (info/suggestions)
    const infoCategories = ['STYLE', 'REDUNDANCY', 'PLAIN_ENGLISH', 'COLLOQUIALISMS', 'SEMANTICS']
    const infoIssueTypes = ['style', 'register', 'locale-violation', 'uncategorized']
    
    if (errorCategories.includes(categoryId) || errorIssueTypes.includes(issueType.toLowerCase())) {
      return 'error'
    }
    
    if (warningCategories.includes(categoryId) || warningIssueTypes.includes(issueType.toLowerCase())) {
      return 'warning'
    }
    
    if (infoCategories.includes(categoryId) || infoIssueTypes.includes(issueType.toLowerCase())) {
      return 'info'
    }
    
    // Default to warning for unknown types
    return 'warning'
  }

  // Process LanguageTool suggestions and merge with existing decorations
  private async processLanguageToolSuggestions(languageToolSuggestions: MisspelledWord[], paragraphPosition?: { from: number, to: number }) {
    if (paragraphPosition) {
      // For regular editing: replace suggestions only for the specific paragraph
      console.log('🔧 Updating suggestions for paragraph at position', paragraphPosition.from, '-', paragraphPosition.to)
      
      // Remove existing suggestions that fall within this paragraph's range
      this.misspelledWords = this.misspelledWords.filter(word => 
        !(word.position.from >= paragraphPosition.from && word.position.to <= paragraphPosition.to)
      )
      
      // Add new suggestions for this paragraph
      this.misspelledWords.push(...languageToolSuggestions)
    } else {
      // For initial load: replace all suggestions (this is called once with all paragraphs' results)
      console.log('🔧 Replacing all suggestions with', languageToolSuggestions.length, 'new suggestions')
      this.misspelledWords = languageToolSuggestions
    }
    
    const categorizedErrors = this.categorizeErrors(this.misspelledWords)
    
    // Update callback
    setTimeout(() => {
      this.onUpdateCallback?.({
        isLoading: false,
        error: null,
        misspelledWords: this.misspelledWords,
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
    
    // Update our main misspelled words array positions
    this.misspelledWords = this.misspelledWords.map(word => {
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
          }
          
          // Map decorations through the transaction
          let mapped = decorationSet.map(tr.mapping, tr.doc)
          
          // If document changed, update cached positions and schedule LanguageTool check
          if (tr.docChanged) {
            // Update all cached positions to account for document changes
            this.updateCachedPositions(tr.mapping)
            
            // Trigger LanguageTool check when document content changes
            const cursorPos = tr.selection.from
            this.lastCursorPosition = cursorPos
            this.debouncedLanguageToolCheck(tr.doc, cursorPos)
          }
          
          // Run initial spell check if we haven't done so yet and document has content
          if (!this.hasRunInitialCheck && tr.doc.content.size > 0) {
            this.hasRunInitialCheck = true
            const cursorPos = tr.selection.from
            this.lastCursorPosition = cursorPos
            // Use a short delay to ensure the editor is fully initialized
            setTimeout(() => {
              this.debouncedLanguageToolCheck(tr.doc, cursorPos)
            }, 100)
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
    // Reset the initial check flag when the extension is created
    this.hasRunInitialCheck = false
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
      this.debouncedLanguageToolCheck(view.state.doc, view.state.selection.from)
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

  // Public method to trigger initial spell check
  triggerInitialSpellCheck() {
    const view = this.store.view
    if (view && view.state.doc.content.size > 0) {
      console.log('🔧 Running initial spell check')
      console.log('🔧 Document size:', view.state.doc.content.size)
      console.log('🔧 Document content:', view.state.doc.textContent.substring(0, 100) + '...')
      
      this.hasRunInitialCheck = true
      
      // Check all paragraphs in the document on initial load
      this.checkAllParagraphsOnLoad(view.state.doc)
    }
  }

  // New method to check all paragraphs on initial load
  private async checkAllParagraphsOnLoad(doc: any) {
    console.log('🔧 Checking all paragraphs on initial load')
    
    const allSuggestions: MisspelledWord[] = []
    const paragraphPromises: Promise<MisspelledWord[]>[] = []
    
    doc.descendants((node: any, pos: number) => {
      // Check if this is a paragraph-level node with content
      if ((node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'blockquote') && node.textContent.trim()) {
        console.log('🔧 Found paragraph to check:', node.textContent.substring(0, 50) + '...')
        
        // Create a paragraph object like the existing method expects
        const paragraph = {
          text: node.textContent,
          position: { from: pos, to: pos + node.nodeSize }
        }
        
        // Add the promise to our array
        const promise = this.callLanguageToolBackend(paragraph.text, paragraph.position)
          .then(suggestions => {
            console.log('🔧 Found', suggestions.length, 'suggestions for paragraph')
            return suggestions
          })
          .catch(error => {
            console.error('🔧 Error checking paragraph:', error)
            return []
          })
        
        paragraphPromises.push(promise)
      }
    })
    
    // Wait for all paragraphs to be checked
    try {
      const allParagraphSuggestions = await Promise.all(paragraphPromises)
      
      // Flatten all suggestions into one array
      const flattenedSuggestions = allParagraphSuggestions.flat()
      
      console.log('🔧 Total suggestions from all paragraphs:', flattenedSuggestions.length)
      
      if (flattenedSuggestions.length > 0) {
        // Process all suggestions at once
        await this.processLanguageToolSuggestions(flattenedSuggestions)
      }
    } catch (error) {
      console.error('🔧 Error processing all paragraphs:', error)
    }
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

  // Helper method to generate a user-friendly rule ID
  private generateReadableRuleId(categoryId: string, issueType: string, shortMessage: string): string {
    // Extract key terms from the short message to make it more specific
    const lowerMessage = shortMessage.toLowerCase()
    
    // Common patterns to create specific rule names
    if (lowerMessage.includes('agreement')) {
      return 'Agreement Error'
    } else if (lowerMessage.includes('confusion') || lowerMessage.includes('confused')) {
      return 'Word Confusion'
    } else if (lowerMessage.includes('missing') || lowerMessage.includes('add')) {
      return 'Missing Word'
    } else if (lowerMessage.includes('unnecessary') || lowerMessage.includes('remove')) {
      return 'Unnecessary Word'
    } else if (lowerMessage.includes('wrong') || lowerMessage.includes('incorrect')) {
      return 'Wrong Word'
    } else if (lowerMessage.includes('passive')) {
      return 'Passive Voice'
    } else if (lowerMessage.includes('repetition') || lowerMessage.includes('repeated')) {
      return 'Repetition'
    } else if (lowerMessage.includes('comma')) {
      return 'Comma Usage'
    } else if (lowerMessage.includes('apostrophe')) {
      return 'Apostrophe Usage'
    } else if (lowerMessage.includes('capital') || lowerMessage.includes('uppercase')) {
      return 'Capitalization'
    } else if (lowerMessage.includes('tense')) {
      return 'Verb Tense'
    } else if (lowerMessage.includes('article')) {
      return 'Article Usage'
    } else if (lowerMessage.includes('preposition')) {
      return 'Preposition Usage'
    } else if (lowerMessage.includes('plural') || lowerMessage.includes('singular')) {
      return 'Number Agreement'
    } else if (lowerMessage.includes('space') || lowerMessage.includes('spacing')) {
      return 'Spacing Issue'
    } else if (lowerMessage.includes('hyphen')) {
      return 'Hyphenation'
    } else if (lowerMessage.includes('spelling')) {
      return 'Spelling Error'
    } else if (lowerMessage.includes('typo')) {
      return 'Typo'
    } else {
      // For generic cases, use a simplified version of the message
      // Take the first few meaningful words from the message
      const words = shortMessage.split(' ').slice(0, 2).join(' ')
      const cleanWords = words.replace(/[^\w\s]/g, '').trim()
      
      if (cleanWords.length > 0 && cleanWords.length < 20) {
        return cleanWords
      } else {
        // Final fallback based on category
        const categoryMap: Record<string, string> = {
          'GRAMMAR': 'Grammar Error',
          'TYPOS': 'Spelling Error',
          'PUNCTUATION': 'Punctuation Error',
          'CASING': 'Capitalization Error',
          'COMPOUNDING': 'Compound Word Error',
          'CONFUSED_WORDS': 'Word Choice Error',
          'TYPOGRAPHY': 'Typography Error',
          'STYLE': 'Style Issue',
          'REDUNDANCY': 'Redundancy',
          'PLAIN_ENGLISH': 'Plain English',
          'COLLOQUIALISMS': 'Informal Language',
          'SEMANTICS': 'Clarity Issue',
          'MISC': 'Other Error'
        }
        return categoryMap[categoryId] || 'Language Error'
      }
    }
  }
} 
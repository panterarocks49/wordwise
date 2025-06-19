"use client"

import React from 'react'
import { PlainExtension } from 'remirror'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { debounce } from 'lodash'
import { retext } from 'retext'
import retextEnglish from 'retext-english'
import retextSpell from 'retext-spell'

export interface MisspelledWord {
  word: string
  suggestions: string[]
  position: { from: number, to: number }
}

export interface SpellCheckOptions {
  enabled?: boolean
  debounceMs?: number
  maxSuggestions?: number
  language?: string
}

// Plugin key for the spell check plugin
const spellCheckPluginKey = new PluginKey('spellCheck')

export class SpellCheckExtension extends PlainExtension<SpellCheckOptions> {
  private spellChecker: any = null
  private dictionary: any = null
  private ignoredWords = new Set<string>()
  private misspelledWords: MisspelledWord[] = []
  private paragraphCache = new Map<string, { hash: string, misspelledWords: MisspelledWord[], lastPos: number }>()
  private onUpdateCallback?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => void

  get name() {
    return 'spellCheck' as const
  }

  // Default options
  protected get defaultOptions(): SpellCheckOptions {
    return {
      enabled: true,
      debounceMs: 500,
      maxSuggestions: 5,
      language: 'en'
    }
  }

  // Load dictionary and initialize retext processor
  private async loadDictionary(): Promise<void> {
    console.log('🔍 SpellCheck: Starting retext processor initialization...')
    try {
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: true,
          error: null,
          misspelledWords: []
        })
      }, 0)

      // Load dictionary files from CDN (browser-compatible)
      console.log('🔍 SpellCheck: Loading dictionary files from CDN...')
      const [affResponse, dicResponse] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0/index.aff'),
        fetch('https://cdn.jsdelivr.net/npm/dictionary-en@4.0.0/index.dic')
      ])

      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error(`Failed to load dictionary files: aff=${affResponse.status}, dic=${dicResponse.status}`)
      }

      const aff = await affResponse.text()
      const dic = await dicResponse.text()

      console.log('🔍 SpellCheck: Dictionary files loaded successfully')

      // Create dictionary object compatible with retext-spell
      this.dictionary = { aff, dic }

      // Create retext processor with English parser and spell checker
      console.log('🔍 SpellCheck: Creating retext processor...')
      this.spellChecker = retext()
        .use(retextEnglish)
        .use(retextSpell, this.dictionary)

      console.log('🔍 SpellCheck: Retext processor created successfully')
      
      // Test the spell checker
      await this.testSpellChecker()

      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: null,
          misspelledWords: []
        })
      }, 0)

      // Trigger initial spell check on existing content
      console.log('🔍 SpellCheck: Dictionary loaded, triggering initial spell check...')
      setTimeout(() => {
        const view = this.store.view
        if (view && view.state.doc.content.size > 0) {
          console.log('🔍 SpellCheck: Running initial spell check on existing content:', {
            docSize: view.state.doc.content.size,
            textContent: view.state.doc.textContent.substring(0, 100) + '...'
          })
          this.debouncedSpellCheck(view.state.doc)
        } else {
          console.log('🔍 SpellCheck: No content to spell check initially')
        }
      }, 100) // Small delay to ensure the view is ready

    } catch (error) {
      console.error('🔍 SpellCheck: Failed to initialize spell checker:', error)
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: `Failed to load spell check dictionary: ${error instanceof Error ? error.message : 'Unknown error'}`,
          misspelledWords: []
        })
      }, 0)
    }
  }

  // Test the spell checker with some sample words
  private async testSpellChecker() {
    try {
      const testText = 'This is a test with a mispelled word.'
      const file = await this.spellChecker.process(testText)
      
      console.log('🔍 SpellCheck: Testing spell checker:', {
        testText,
        messagesCount: file.messages.length,
        messages: file.messages.map((msg: any) => ({
          message: msg.message,
          actual: msg.actual,
          expected: msg.expected,
          line: msg.line,
          column: msg.column
        }))
      })
    } catch (error) {
      console.error('🔍 SpellCheck: Test failed:', error)
    }
  }

  // Debounced spell check function - now with change tracking
  private debouncedSpellCheck = debounce(async (doc: any, changedRanges?: Array<{ from: number, to: number }>) => {
    const enabled = this.options.enabled ?? true
    console.log('🔍 SpellCheck: Debounced spell check triggered:', {
      hasSpellChecker: !!this.spellChecker,
      enabled,
      docSize: doc.content.size,
      hasChangedRanges: !!changedRanges
    })

    if (!this.spellChecker || !enabled) {
      console.log('🔍 SpellCheck: Skipping - no spell checker or disabled')
      return
    }

    // Defer the callback to avoid React render phase issues
    setTimeout(() => {
      this.onUpdateCallback?.({
        isLoading: true,
        error: null,
        misspelledWords: []
      })
    }, 0)

    try {
      const misspelledWords = await this.performSpellCheck(doc, changedRanges)
      console.log('🔍 SpellCheck: Spell check completed:', {
        misspelledCount: misspelledWords.length,
        misspelledWords: misspelledWords.map(w => ({ word: w.word, position: w.position }))
      })
      
      this.misspelledWords = misspelledWords
      
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: null,
          misspelledWords
        })
      }, 0)

      // Update decorations by dispatching an empty transaction
      const view = this.store.view
      if (view) {
        console.log('🔍 SpellCheck: Updating decorations via transaction')
        const tr = view.state.tr
        tr.setMeta(spellCheckPluginKey, { updateDecorations: true })
        view.dispatch(tr)
      } else {
        console.log('🔍 SpellCheck: No view available for decoration update')
      }
    } catch (error) {
      console.error('🔍 SpellCheck: Spell check error:', error)
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: false,
          error: 'Spell check failed',
          misspelledWords: []
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
    
    // Also update our main misspelled words array
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

  // Perform spell check on text using retext - now optimized for changed content
  private async performSpellCheck(doc: any, changedRanges?: Array<{ from: number, to: number }>): Promise<MisspelledWord[]> {
    console.log('🔍 SpellCheck: Performing optimized spell check')

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
              console.log('🔍 SpellCheck: Using cached results for unchanged paragraph at', pos)
              return
            }
          }
        }
        
        paragraphsToCheck.push({ node, pos, text })
      }
    })

    console.log('🔍 SpellCheck: Checking', paragraphsToCheck.length, 'paragraphs, reusing', unchangedParagraphs.length, 'cached')

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
          // Use the shared processor (don't create a new one each time)
          const file = await this.spellChecker.process(text)
          const paragraphWords: MisspelledWord[] = []
          
          // Process retext messages (spell check errors)
          for (const message of file.messages) {
            if (message.source === 'retext-spell' && message.actual && message.expected) {
              // Calculate position in the original document
              const wordStart = pos + 1 + (message.column ? message.column - 1 : 0) // +1 for paragraph node
              const wordEnd = wordStart + message.actual.length
              
              // Validate positions
              if (wordStart >= 0 && wordEnd <= doc.content.size && wordStart < wordEnd) {
                const misspelledWord = {
                  word: message.actual,
                  suggestions: Array.isArray(message.expected) ? message.expected : [message.expected],
                  position: { from: wordStart, to: wordEnd }
                }
                
                paragraphWords.push(misspelledWord)
                allMisspelledWords.push(misspelledWord)
              }
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

    console.log('🔍 SpellCheck: Final misspelled words:', allMisspelledWords.length)
    return allMisspelledWords
  }

  // Create decorations for misspelled words
  private buildDecorations(doc: any): DecorationSet {
    const enabled = this.options.enabled ?? true
    console.log('🔍 SpellCheck: Building decorations:', {
      enabled,
      misspelledWordsCount: this.misspelledWords.length,
      misspelledWords: this.misspelledWords.map(w => ({ word: w.word, position: w.position }))
    })

    if (!enabled || this.misspelledWords.length === 0) {
      console.log('🔍 SpellCheck: Returning empty decoration set')
      return DecorationSet.empty
    }

    const decorations = this.misspelledWords.map(({ position, word }) => {
      console.log('🔍 SpellCheck: Creating decoration for word:', {
        word,
        from: position.from,
        to: position.to,
        docSize: doc.content.size
      })
      
      // Validate positions
      if (position.from < 0 || position.to > doc.content.size || position.from >= position.to) {
        console.warn('🔍 SpellCheck: Invalid position for word:', {
          word,
          from: position.from,
          to: position.to,
          docSize: doc.content.size
        })
        return null
      }
      
      return Decoration.inline(position.from, position.to, {
        class: 'spell-error',
        style: 'text-decoration: underline; text-decoration-color: red; text-decoration-style: wavy; text-decoration-thickness: 2px;'
      })
    }).filter((decoration): decoration is Decoration => decoration !== null) // Remove null decorations

    console.log('🔍 SpellCheck: Created decorations:', {
      count: decorations.length,
      decorations: decorations.map(d => ({ from: d.from, to: d.to }))
    })
    
    const decorationSet = DecorationSet.create(doc, decorations)
    console.log('🔍 SpellCheck: DecorationSet created:', {
      decorationSetSize: decorationSet.find().length
    })
    
    return decorationSet
  }

  createExternalPlugins() {
    console.log('🔍 SpellCheck: Creating external plugins')
    return [new Plugin({
      key: spellCheckPluginKey,
      state: {
        init: () => {
          console.log('🔍 SpellCheck: Plugin state initialized')
          return DecorationSet.empty
        },
        apply: (tr, decorationSet) => {
          const enabled = this.options.enabled ?? true
          console.log('🔍 SpellCheck: Plugin apply called:', {
            enabled,
            docChanged: tr.docChanged,
            hasMeta: !!tr.getMeta(spellCheckPluginKey)
          })

          if (!enabled) {
            console.log('🔍 SpellCheck: Disabled, returning empty set')
            return DecorationSet.empty
          }
          
          // Map decorations through the transaction
          let mapped = decorationSet.map(tr.mapping, tr.doc)
          console.log('🔍 SpellCheck: Mapped decorations through transaction')
          
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
            
            console.log('🔍 SpellCheck: Document changed, scheduling targeted spell check:', {
              changedRanges,
              textLength: tr.doc.textContent.length
            })
            
            this.debouncedSpellCheck(tr.doc, changedRanges.length > 0 ? changedRanges : undefined)
          }
          
          // Check if we need to update decorations
          const meta = tr.getMeta(spellCheckPluginKey)
          if (meta?.updateDecorations) {
            console.log('🔍 SpellCheck: Meta update decorations requested')
            mapped = this.buildDecorations(tr.doc)
          }
          
          return mapped
        }
      },
      props: {
        decorations: (state) => {
          const pluginState = spellCheckPluginKey.getState(state)
          console.log('🔍 SpellCheck: Getting decorations from plugin state:', {
            hasPluginState: !!pluginState,
            decorationCount: pluginState ? pluginState.find().length : 0
          })
          return pluginState || DecorationSet.empty
        }
      }
    })]
  }

  // Initialize the extension
  onCreate() {
    console.log('🔍 SpellCheck: Extension onCreate called')
    this.loadDictionary()
  }

  // Public methods for the sidebar
  ignoreWord(word: string) {
    console.log('🔍 SpellCheck: Ignoring word:', word)
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
    console.log('🔍 SpellCheck: Replacing word:', { from, to, replacement })
    const view = this.store.view
    if (view) {
      const tr = view.state.tr.replaceWith(from, to, this.store.schema.text(replacement))
      view.dispatch(tr)
    }
  }

  toggleSpellCheck() {
    const enabled = !this.options.enabled
    console.log('🔍 SpellCheck: Toggling spell check:', { enabled })
    this.setOptions({ enabled })
    
    if (!enabled) {
      this.misspelledWords = []
      this.onUpdateCallback?.({
        isLoading: false,
        error: null,
        misspelledWords: []
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

  // Helper methods
  setUpdateCallback(callback: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => void) {
    console.log('🔍 SpellCheck: Setting update callback')
    this.onUpdateCallback = callback
  }

  getMisspelledWords(): MisspelledWord[] {
    return this.misspelledWords
  }

  isSpellCheckEnabled(): boolean {
    return this.options.enabled ?? true
  }
} 
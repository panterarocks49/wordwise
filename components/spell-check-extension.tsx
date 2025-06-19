"use client"

import React from 'react'
import { PlainExtension } from 'remirror'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { debounce } from 'lodash'
import nspell from 'nspell'

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
  private ignoredWords = new Set<string>()
  private misspelledWords: MisspelledWord[] = []
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

  // Load dictionary
  private async loadDictionary(): Promise<void> {
    console.log('🔍 SpellCheck: Starting dictionary load...')
    try {
      // Defer the callback to avoid React render phase issues
      setTimeout(() => {
        this.onUpdateCallback?.({
          isLoading: true,
          error: null,
          misspelledWords: []
        })
      }, 0)

      // Load English dictionary from CDN
      console.log('🔍 SpellCheck: Fetching dictionary files from CDN...')
      const [affResponse, dicResponse] = await Promise.all([
        fetch('https://cdn.jsdelivr.net/npm/dictionary-en@3.2.0/index.aff'),
        fetch('https://cdn.jsdelivr.net/npm/dictionary-en@3.2.0/index.dic')
      ])

      console.log('🔍 SpellCheck: Dictionary fetch responses:', {
        affOk: affResponse.ok,
        affStatus: affResponse.status,
        dicOk: dicResponse.ok,
        dicStatus: dicResponse.status
      })

      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error(`Failed to load dictionary files: aff=${affResponse.status}, dic=${dicResponse.status}`)
      }

      const aff = await affResponse.text()
      const dic = await dicResponse.text()

      console.log('🔍 SpellCheck: Dictionary files loaded:', {
        affLength: aff.length,
        dicLength: dic.length
      })

      this.spellChecker = nspell({ aff, dic })
      console.log('🔍 SpellCheck: nspell instance created successfully')
      
      // Test the spell checker
      const testWord = 'hello'
      const testIncorrect = 'helo'
      console.log('🔍 SpellCheck: Testing spell checker:', {
        testWord: testWord,
        isCorrect: this.spellChecker.correct(testWord),
        testIncorrect: testIncorrect,
        isIncorrect: this.spellChecker.correct(testIncorrect),
        suggestions: this.spellChecker.suggest(testIncorrect)
      })

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
      console.error('🔍 SpellCheck: Failed to load dictionary:', error)
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

  // Debounced spell check function
  private debouncedSpellCheck = debounce(async (doc: any) => {
    const enabled = this.options.enabled ?? true
    console.log('🔍 SpellCheck: Debounced spell check triggered:', {
      hasSpellChecker: !!this.spellChecker,
      enabled,
      docSize: doc.content.size
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
      const misspelledWords = await this.performSpellCheck(doc)
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

  // Perform spell check on text
  private async performSpellCheck(doc: any): Promise<MisspelledWord[]> {
    console.log('🔍 SpellCheck: Performing spell check on document structure')

    const misspelledWords: MisspelledWord[] = []
    
    // Traverse the document structure instead of using raw text
    doc.descendants((node: any, pos: number) => {
      // Skip code blocks and other non-text content
      if (node.type.name === 'codeMirror' || node.type.name === 'codeBlock') {
        console.log('🔍 SpellCheck: Skipping code block at position:', pos)
        return false // Don't traverse into code blocks
      }
      
      // Only process text nodes
      if (node.isText && node.text) {
        const nodeText = node.text
        console.log('🔍 SpellCheck: Processing text node:', {
          position: pos,
          text: nodeText.substring(0, 50) + (nodeText.length > 50 ? '...' : ''),
          textLength: nodeText.length
        })
        
        // Extract words from this text node
        const words = nodeText.match(/\b[a-zA-Z]+\b/g) || []
        
        for (const word of words) {
          // Find the word's position within this text node
          let wordIndex = 0
          let searchStart = 0
          
          // Handle multiple occurrences of the same word
          while ((wordIndex = nodeText.indexOf(word, searchStart)) !== -1) {
            searchStart = wordIndex + word.length
            
            // Calculate absolute position in the document
            const absoluteFrom = pos + wordIndex // pos is already at the start of the node
            const absoluteTo = absoluteFrom + word.length
            
            console.log('🔍 SpellCheck: Checking word:', {
              word,
              wordIndex,
              absoluteFrom,
              absoluteTo,
              isCorrect: this.spellChecker.correct(word),
              isIgnored: this.ignoredWords.has(word.toLowerCase())
            })

            if (
              word.length > 1 &&
              !this.spellChecker.correct(word) &&
              !this.ignoredWords.has(word.toLowerCase())
            ) {
              const suggestions = this.spellChecker
                .suggest(word)
                .slice(0, this.options.maxSuggestions || 5)

              console.log('🔍 SpellCheck: Word is misspelled:', {
                word,
                suggestions,
                position: { from: absoluteFrom, to: absoluteTo }
              })

              misspelledWords.push({
                word,
                suggestions,
                position: { from: absoluteFrom, to: absoluteTo }
              })
            }
          }
        }
      }
    })

    console.log('🔍 SpellCheck: Final misspelled words:', misspelledWords)
    return misspelledWords
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
          
          // If document changed, schedule spell check
          if (tr.docChanged) {
            const text = tr.doc.textContent
            console.log('🔍 SpellCheck: Document changed, scheduling spell check:', {
              textLength: text.length,
              textPreview: text.substring(0, 100) + '...'
            })
            this.debouncedSpellCheck(tr.doc)
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
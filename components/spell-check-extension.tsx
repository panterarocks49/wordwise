"use client"

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import nspell from 'nspell'

export interface MisspelledWord {
  word: string
  suggestions: string[]
  position: { from: number, to: number }
}

interface SpellCheckOptions {
  onSpellCheckUpdate?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => void
}

interface SpellCheckStorage {
  dictionary: any | null
  isLoading: boolean
  error: string | null
  misspelledWords: MisspelledWord[]
  ignoredWords: Set<string>
}

const SpellCheckPluginKey = new PluginKey('spellCheck')

// Function to extract text content and word positions from ProseMirror document
function extractWordsWithPositions(doc: ProseMirrorNode): { word: string, from: number, to: number }[] {
  const words: { word: string, from: number, to: number }[] = []
  
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText && node.text) {
      const text = node.text
      const wordRegex = /\b[a-zA-Z]+\b/g
      let match
      
      while ((match = wordRegex.exec(text)) !== null) {
        words.push({
          word: match[0],
          from: pos + match.index,
          to: pos + match.index + match[0].length
        })
      }
    }
  })
  
  return words
}

// Function to check spelling and return decorations
function createSpellCheckDecorations(
  doc: ProseMirrorNode, 
  dictionary: any, 
  ignoredWords: Set<string>
): { decorations: DecorationSet, misspelledWords: MisspelledWord[] } {
  if (!dictionary) {
    return { decorations: DecorationSet.empty, misspelledWords: [] }
  }

  const words = extractWordsWithPositions(doc)
  const decorations: Decoration[] = []
  const misspelledWords: MisspelledWord[] = []
  const seenWords = new Set<string>()

  for (const { word, from, to } of words) {
    const lowerWord = word.toLowerCase()
    
    // Skip short words, already seen words, ignored words, and correctly spelled words
    if (
      word.length <= 2 || 
      seenWords.has(lowerWord) ||
      ignoredWords.has(lowerWord) ||
      dictionary.correct(word)
    ) {
      continue
    }

    seenWords.add(lowerWord)
    
    // Add decoration for misspelled word
    decorations.push(
      Decoration.inline(from, to, {
        class: 'spell-error',
        style: 'text-decoration-line: underline; text-decoration-style: solid; text-decoration-color: #ef4444; text-decoration-thickness: 1px; text-underline-offset: 4px;'
      })
    )

    // Add to misspelled words list
    misspelledWords.push({
      word: lowerWord,
      suggestions: dictionary.suggest(word).slice(0, 5),
      position: { from, to }
    })
  }

  return {
    decorations: DecorationSet.create(doc, decorations),
    misspelledWords
  }
}

export const SpellCheckExtension = Extension.create<SpellCheckOptions, SpellCheckStorage>({
  name: 'spellCheck',

  addOptions() {
    return {
      onSpellCheckUpdate: () => {},
    }
  },

  addStorage() {
    return {
      dictionary: null,
      isLoading: true,
      error: null,
      misspelledWords: [],
      ignoredWords: new Set<string>(),
    }
  },

  onCreate() {
    // Load dictionary when extension is created
    this.storage.isLoading = true
    this.storage.error = null
    
    // Notify initial loading state
    if (this.options.onSpellCheckUpdate) {
      this.options.onSpellCheckUpdate({
        isLoading: this.storage.isLoading,
        error: this.storage.error,
        misspelledWords: this.storage.misspelledWords
      })
    }

    Promise.all([
      fetch('https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.aff'),
      fetch('https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.dic')
    ])
    .then(async ([affResponse, dicResponse]) => {
      if (!affResponse.ok || !dicResponse.ok) {
        throw new Error('Failed to fetch dictionary files')
      }
      
      const aff = await affResponse.text()
      const dic = await dicResponse.text()
      
      this.storage.dictionary = nspell({ aff, dic })
      this.storage.isLoading = false
      this.storage.error = null
      
      console.log('Spell check dictionary loaded successfully')
      
      // Notify successful load
      if (this.options.onSpellCheckUpdate) {
        this.options.onSpellCheckUpdate({
          isLoading: this.storage.isLoading,
          error: this.storage.error,
          misspelledWords: this.storage.misspelledWords
        })
      }
      
      // Trigger initial spell check by dispatching a meta transaction
      if (this.editor.view) {
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(SpellCheckPluginKey, { type: 'dictionaryLoaded' })
        )
      }
    })
    .catch((err) => {
      console.error('Failed to load dictionary:', err)
      this.storage.error = 'Failed to load spell check dictionary'
      this.storage.isLoading = false
      
      // Notify error
      if (this.options.onSpellCheckUpdate) {
        this.options.onSpellCheckUpdate({
          isLoading: this.storage.isLoading,
          error: this.storage.error,
          misspelledWords: this.storage.misspelledWords
        })
      }
    })
  },

  addProseMirrorPlugins() {
    const extension = this
    
    return [
      new Plugin({
        key: SpellCheckPluginKey,
        
        state: {
          init: () => {
            return DecorationSet.empty
          },
          
          apply: (tr, oldState) => {
            // Handle meta commands
            const meta = tr.getMeta(SpellCheckPluginKey)
            if (meta) {
              if (meta.type === 'ignore') {
                // Recalculate decorations after ignoring a word
                if (extension.storage.dictionary) {
                  const { decorations, misspelledWords } = createSpellCheckDecorations(
                    tr.doc,
                    extension.storage.dictionary,
                    extension.storage.ignoredWords
                  )
                  
                  extension.storage.misspelledWords = misspelledWords
                  
                  // Notify update
                  if (extension.options.onSpellCheckUpdate) {
                    extension.options.onSpellCheckUpdate({
                      isLoading: extension.storage.isLoading,
                      error: extension.storage.error,
                      misspelledWords: extension.storage.misspelledWords
                    })
                  }
                  
                  return decorations
                }
              } else if (meta.type === 'dictionaryLoaded') {
                // Trigger initial spell check when dictionary loads
                if (extension.storage.dictionary) {
                  const { decorations, misspelledWords } = createSpellCheckDecorations(
                    tr.doc,
                    extension.storage.dictionary,
                    extension.storage.ignoredWords
                  )
                  
                  extension.storage.misspelledWords = misspelledWords
                  
                  // Notify update
                  if (extension.options.onSpellCheckUpdate) {
                    extension.options.onSpellCheckUpdate({
                      isLoading: extension.storage.isLoading,
                      error: extension.storage.error,
                      misspelledWords: extension.storage.misspelledWords
                    })
                  }
                  
                  return decorations
                }
              }
            }
            
            // If no dictionary is loaded, return empty decorations
            if (!extension.storage.dictionary) {
              return DecorationSet.empty
            }

            // If document changed, recalculate decorations
            if (tr.docChanged) {
              const { decorations, misspelledWords } = createSpellCheckDecorations(
                tr.doc,
                extension.storage.dictionary,
                extension.storage.ignoredWords
              )
              
              extension.storage.misspelledWords = misspelledWords
              
              // Notify update
              if (extension.options.onSpellCheckUpdate) {
                extension.options.onSpellCheckUpdate({
                  isLoading: extension.storage.isLoading,
                  error: extension.storage.error,
                  misspelledWords: extension.storage.misspelledWords
                })
              }
              
              return decorations
            }
            
            // Otherwise, map existing decorations to new positions
            return oldState.map(tr.mapping, tr.doc)
          }
        },
        
        props: {
          decorations: (state) => {
            return SpellCheckPluginKey.getState(state)
          }
        }
      })
    ]
  },
})

// Helper functions to interact with the spell check extension
export const ignoreWord = (editor: any, word: string) => {
  const extension = editor.extensionManager.extensions.find((ext: any) => ext.name === 'spellCheck')
  if (extension) {
    extension.storage.ignoredWords.add(word.toLowerCase())
    editor.view.dispatch(
      editor.state.tr.setMeta(SpellCheckPluginKey, { type: 'ignore', word })
    )
  }
}

export const replaceWord = (editor: any, originalWord: string, replacement: string) => {
  const { doc } = editor.state
  const words = extractWordsWithPositions(doc)
  
  // Replace from end to start to maintain position accuracy
  const replacements = words
    .filter(w => w.word.toLowerCase() === originalWord.toLowerCase())
    .reverse()
  
  for (const { from, to } of replacements) {
    editor.chain().focus().insertContentAt({ from, to }, replacement).run()
  }
}

export default SpellCheckExtension 
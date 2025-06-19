"use client"

import { useCallback, useState, useEffect, useRef, useImperativeHandle } from 'react'
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link,
  Undo,
  Redo,
  ChevronDown
} from 'lucide-react'

import 'remirror/styles/all.css'

import { 
  Remirror, 
  ThemeProvider, 
  useRemirror, 
  useRemirrorContext,
  EditorComponent
} from '@remirror/react'
import { languages } from '@codemirror/language-data'
import { 
  EditorView, 
  keymap, 
  highlightSpecialChars, 
  drawSelection,
  highlightActiveLine, 
  dropCursor, 
  lineNumbers, 
  highlightActiveLineGutter
} from '@codemirror/view'
import {
  defaultHighlightStyle, 
  syntaxHighlighting, 
  indentOnInput,
  bracketMatching, 
  foldGutter, 
  foldKeymap
} from '@codemirror/language'
import {
  defaultKeymap, 
  history, 
  historyKeymap
} from '@codemirror/commands'
import {
  closeBrackets,
  closeBracketsKeymap
} from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { dracula } from 'thememirror'
import { BoldExtension } from '@remirror/extension-bold'
import { ItalicExtension } from '@remirror/extension-italic'
import { UnderlineExtension } from '@remirror/extension-underline'
import { StrikeExtension } from '@remirror/extension-strike'
import { HeadingExtension } from '@remirror/extension-heading'
import { BlockquoteExtension } from '@remirror/extension-blockquote'
import { BulletListExtension, OrderedListExtension, ListItemExtension } from '@remirror/extension-list'
import { HardBreakExtension } from '@remirror/extension-hard-break'
import { LinkExtension } from '@remirror/extension-link'
import { CodeExtension } from '@remirror/extension-code'
import { CodeMirrorExtension } from '@remirror/extension-codemirror6'
import { HistoryExtension } from '@remirror/extension-history'
import { PlaceholderExtension } from '@remirror/extension-placeholder'
import { SpellCheckExtension, MisspelledWord, ErrorCategory } from './spell-check-extension'

interface RemirrorEditorProps {
  content: string
  onChange: (content: string) => void
  onSpellCheckUpdate?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
    categorizedErrors: {
      correctness: MisspelledWord[]
      clarity: MisspelledWord[]
    }
  }) => void
  onFocusChange?: (wordId: string | null) => void
  editorRef?: React.MutableRefObject<any>
}

// Toolbar Button Component
const ToolbarButton = ({ 
  icon: Icon, 
  isActive, 
  onClick, 
  title, 
  disabled = false 
}: {
  icon: any
  isActive?: boolean
  onClick: () => void
  title: string
  disabled?: boolean
}) => (
  <button
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <Icon size={16} />
  </button>
)

// Floating toolbar for code blocks
const CodeBlockToolbar = () => {
  const { commands, getState } = useRemirrorContext({ autoUpdate: true })
  const [isVisible, setIsVisible] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState('')
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const [isInteracting, setIsInteracting] = useState(false)
  
  const commonLanguages = [
    { value: '', label: 'Auto' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'csharp', label: 'C#' },
    { value: 'php', label: 'PHP' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'yaml', label: 'YAML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'sql', label: 'SQL' },
    { value: 'bash', label: 'Bash' }
  ]

  useEffect(() => {
    const updateToolbarVisibility = () => {
      const state = getState()
      const { selection } = state
      
      // Check if cursor is in a CodeMirror block
      let isInCodeBlock = false
      let language = ''
      
      const $pos = state.doc.resolve(selection.from)
      
      // Check if current node is codeMirror
      if ($pos.parent.type.name === 'codeMirror') {
        isInCodeBlock = true
        language = $pos.parent.attrs.language || ''
      }
      // Check if we're inside a codeMirror node at any level
      else {
        for (let i = $pos.depth; i >= 0; i--) {
          if ($pos.node(i).type.name === 'codeMirror') {
            isInCodeBlock = true
            language = $pos.node(i).attrs.language || ''
            break
          }
        }
      }
      
      // Only show if we're in a code block AND a CodeMirror editor has focus
      if (isInCodeBlock) {
        const focusedCodeMirror = document.querySelector('.cm-editor.cm-focused')
        if (focusedCodeMirror) {
          const editorContainer = document.querySelector('.ProseMirror')
          if (editorContainer) {
            const containerRect = editorContainer.getBoundingClientRect()
            const codeBlockRect = focusedCodeMirror.getBoundingClientRect()
            
            setPosition({
              top: codeBlockRect.top - containerRect.top - 12, // Position above the code block
              right: containerRect.right - codeBlockRect.right + 8 // 8px from right edge
            })
            setIsVisible(true)
            setCurrentLanguage(language)
          }
        } else if (!isInteracting) {
          setIsVisible(false)
        }
      } else if (!isInteracting) {
        setIsVisible(false)
      }
    }

    // Initial check
    updateToolbarVisibility()

    // Listen for focus and blur events on the entire document
    const handleFocusChange = () => {
      // Small delay to ensure focus state is updated
      setTimeout(updateToolbarVisibility, 10)
    }

    document.addEventListener('focusin', handleFocusChange)
    document.addEventListener('focusout', handleFocusChange)
    
    return () => {
      document.removeEventListener('focusin', handleFocusChange)
      document.removeEventListener('focusout', handleFocusChange)
    }
  }, [getState, isInteracting])

  const handleLanguageChange = (language: string) => {
    if (commands.updateCodeMirror.enabled()) {
      commands.updateCodeMirror({ language })
      setCurrentLanguage(language)
    }
    // Reset interaction state after selection
    setIsInteracting(false)
  }

  if (!isVisible) return null

  return (
    <div 
      className="absolute bg-card border border-border rounded-md shadow-sm px-2 py-1 flex items-center gap-2 text-xs z-20 pointer-events-auto"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`
      }}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
    >
      <Code2 size={12} className="text-muted-foreground" />
      <div className="relative">
        <select
          value={currentLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="border-0 bg-transparent text-xs focus:outline-none pr-4 cursor-pointer text-foreground"
          onFocus={() => setIsInteracting(true)}
          onBlur={() => {
            // Delay hiding to allow for option selection
            setTimeout(() => setIsInteracting(false), 200)
          }}
          onClick={(e) => {
            e.stopPropagation()
            setIsInteracting(true)
          }}
          style={{ appearance: 'none' }}
        >
          {commonLanguages.map(lang => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  )
}

// Floating Toolbar component that can be used outside Remirror context
const FloatingToolbar = ({ manager }: { manager: any }) => {
  const [active, setActive] = useState<any>({})
  const [commands, setCommands] = useState<any>({})

  useEffect(() => {
    if (!manager || !manager.view) return

    const updateState = () => {
      const view = manager.view
      if (!view) return

      const state = view.state
      const { $from } = state.selection

      // Get active states
      const activeStates = {
        bold: state.schema.marks.bold && state.schema.marks.bold.isInSet(state.storedMarks || $from.marks()),
        italic: state.schema.marks.italic && state.schema.marks.italic.isInSet(state.storedMarks || $from.marks()),
        underline: state.schema.marks.underline && state.schema.marks.underline.isInSet(state.storedMarks || $from.marks()),
        strike: state.schema.marks.strike && state.schema.marks.strike.isInSet(state.storedMarks || $from.marks()),
        heading: $from.parent.type.name === 'heading' ? { level: $from.parent.attrs.level } : null,
        bulletList: $from.parent.type.name === 'listItem' && $from.node(-1).type.name === 'bulletList',
        orderedList: $from.parent.type.name === 'listItem' && $from.node(-1).type.name === 'orderedList',
        blockquote: $from.parent.type.name === 'blockquote'
      }

      setActive(activeStates)

      // Get commands from manager
      const managerCommands = {
        toggleBold: () => manager.store.commands.toggleBold(),
        toggleItalic: () => manager.store.commands.toggleItalic(),
        toggleUnderline: () => manager.store.commands.toggleUnderline(),
        toggleStrike: () => manager.store.commands.toggleStrike(),
        toggleHeading: (attrs: any) => manager.store.commands.toggleHeading(attrs),
        toggleBulletList: () => manager.store.commands.toggleBulletList(),
        toggleOrderedList: () => manager.store.commands.toggleOrderedList(),
        toggleBlockquote: () => manager.store.commands.toggleBlockquote(),
        createCodeMirror: (attrs: any) => manager.store.commands.createCodeMirror(attrs),
        undo: () => manager.store.commands.undo(),
        redo: () => manager.store.commands.redo()
      }

      setCommands(managerCommands)
    }

    // Initial update
    updateState()

    // Listen to state changes
    const view = manager.view
    if (view) {
      const originalDispatch = view.dispatch
      view.dispatch = (tr: any) => {
        originalDispatch.call(view, tr)
        setTimeout(updateState, 0) // Update after transaction
      }

      return () => {
        view.dispatch = originalDispatch
      }
    }
  }, [manager])

  if (!manager || !commands.toggleBold) {
    return null
  }

  return (
    <div className="bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-1 justify-center">
        {/* Text Formatting */}
        <div className="flex items-center gap-1 mr-4">
          <ToolbarButton
            icon={Bold}
            isActive={active.bold}
            onClick={() => commands.toggleBold()}
            title="Bold (Ctrl+B)"
          />
          <ToolbarButton
            icon={Italic}
            isActive={active.italic}
            onClick={() => commands.toggleItalic()}
            title="Italic (Ctrl+I)"
          />
          <ToolbarButton
            icon={Underline}
            isActive={active.underline}
            onClick={() => commands.toggleUnderline()}
            title="Underline (Ctrl+U)"
          />
          <ToolbarButton
            icon={Strikethrough}
            isActive={active.strike}
            onClick={() => commands.toggleStrike()}
            title="Strikethrough"
          />
        </div>

        {/* Headings */}
        <div className="flex items-center gap-1 mr-4">
          <ToolbarButton
            icon={Heading1}
            isActive={active.heading?.level === 1}
            onClick={() => commands.toggleHeading({ level: 1 })}
            title="Heading 1"
          />
          <ToolbarButton
            icon={Heading2}
            isActive={active.heading?.level === 2}
            onClick={() => commands.toggleHeading({ level: 2 })}
            title="Heading 2"
          />
          <ToolbarButton
            icon={Heading3}
            isActive={active.heading?.level === 3}
            onClick={() => commands.toggleHeading({ level: 3 })}
            title="Heading 3"
          />
        </div>

        {/* Lists and Quote */}
        <div className="flex items-center gap-1 mr-4">
          <ToolbarButton
            icon={List}
            isActive={active.bulletList}
            onClick={() => commands.toggleBulletList()}
            title="Bullet List"
          />
          <ToolbarButton
            icon={ListOrdered}
            isActive={active.orderedList}
            onClick={() => commands.toggleOrderedList()}
            title="Numbered List"
          />
          <ToolbarButton
            icon={Quote}
            isActive={active.blockquote}
            onClick={() => commands.toggleBlockquote()}
            title="Quote"
          />
          <ToolbarButton
            icon={Code2}
            onClick={() => commands.createCodeMirror({ language: 'javascript' })}
            title="Code Block"
          />
        </div>

        {/* History */}
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={Undo}
            onClick={() => commands.undo()}
            title="Undo (Ctrl+Z)"
          />
          <ToolbarButton
            icon={Redo}
            onClick={() => commands.redo()}
            title="Redo (Ctrl+Y)"
          />
        </div>
      </div>
    </div>
  )
}

// Main editor component
function RemirrorEditor({ content, onChange, onSpellCheckUpdate, onFocusChange, editorRef }: RemirrorEditorProps) {
  const spellCheckExtensionRef = useRef<SpellCheckExtension | null>(null)

  const extensions = useCallback(() => {
    const spellCheckExtension = new SpellCheckExtension({})
    spellCheckExtensionRef.current = spellCheckExtension
    
    // Set up the spell check callback
    if (onSpellCheckUpdate) {
      spellCheckExtension.setUpdateCallback(onSpellCheckUpdate)
    }
    
    // Set up the focus change callback
    if (onFocusChange) {
      spellCheckExtension.setFocusChangeCallback(onFocusChange)
    }

    return [
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      new StrikeExtension({}),
      new HeadingExtension({}),
      new BlockquoteExtension({}),
      new BulletListExtension({}),
      new OrderedListExtension({}),
      new ListItemExtension({}),
      new HardBreakExtension({}),
      new LinkExtension({ autoLink: true }),
      new CodeExtension({}),
      new CodeMirrorExtension({
        languages: languages,
        extensions: [
          // Dark theme
          dracula,
          // Highlight special characters
          highlightSpecialChars(),
          // History (undo/redo)
          history(),
          // Drop cursor when dragging
          dropCursor(),
          // Allow multiple selections
          EditorState.allowMultipleSelections.of(true),
          // Auto-indent on input
          indentOnInput(),
          // Bracket matching
          bracketMatching(),
          // Auto-closing brackets
          closeBrackets(),
          // Custom theme overrides
          EditorView.theme({
            '&': {
              backgroundColor: 'hsl(var(--muted))',
            },
            '.cm-content': {
              padding: '16px',
              backgroundColor: 'hsl(var(--muted))',
            },
            '.cm-focused': {
              outline: 'none',
            },
            '.cm-editor': {
              fontSize: '14px',
              backgroundColor: 'hsl(var(--muted))',
            },
            '.cm-scroller': {
              fontFamily: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Consolas", monospace',
              backgroundColor: 'hsl(var(--muted))',
            },
            '.cm-gutters': {
              backgroundColor: 'hsl(var(--muted))',
              borderRight: '1px solid hsl(var(--border))',
            },
            '.cm-selectionBackground': {
              backgroundColor: '#3b82f6 !important',
              opacity: '0.3 !important',
            },
            '&.cm-focused .cm-selectionBackground': {
              backgroundColor: '#3b82f6 !important',
              opacity: '0.4 !important',
            },
          }),
          // Key bindings
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap
          ])
        ]
      }),
      new HistoryExtension({}),
      new PlaceholderExtension({ placeholder: 'Start writing your document...' }),
      spellCheckExtension
    ]
  }, [onSpellCheckUpdate, onFocusChange])

  const { manager, state } = useRemirror({ 
    extensions, 
    content: (() => {
      if (!content) return undefined
      
      // Try to parse as JSON first (for saved Remirror content)
      try {
        const parsed = JSON.parse(content)
        // Check if it looks like a Remirror JSON document
        if (parsed && typeof parsed === 'object' && parsed.type) {
          return parsed
        }
      } catch (e) {
        // Not JSON, continue to treat as string
      }
      
      // Fallback to treating as string content (markdown/HTML/plain text)
      return content
    })(),
    stringHandler: 'html', // Use HTML handler for string content
  })

  const handleChange = useCallback((parameter: any) => {
    const json = parameter.helpers.getJSON(parameter.state)
    onChange(JSON.stringify(json))
  }, [onChange])

  // Expose spell check methods through ref
  useImperativeHandle(editorRef, () => ({
    ignoreWord: (word: string) => {
      spellCheckExtensionRef.current?.ignoreWord(word)
    },
    replaceWord: (from: number, to: number, replacement: string) => {
      spellCheckExtensionRef.current?.replaceWord(from, to, replacement)
    },
    focusWord: (from: number, to: number) => {
      spellCheckExtensionRef.current?.focusWord(from, to)
    },
    toggleSpellCheck: () => {
      spellCheckExtensionRef.current?.toggleSpellCheck()
    },
    toggleCategory: (category: ErrorCategory) => {
      spellCheckExtensionRef.current?.toggleCategory(category)
    },
    getMisspelledWords: () => {
      const words = spellCheckExtensionRef.current?.getMisspelledWords() || []
      return words
    },
    getCategorizedErrors: () => {
      const categorized = spellCheckExtensionRef.current?.getCategorizedErrors() || {
        correctness: [],
        clarity: []
      }
      return categorized
    },
    isSpellCheckEnabled: () => {
      const enabled = spellCheckExtensionRef.current?.isSpellCheckEnabled() ?? true
      return enabled
    },
    isCategoryEnabled: (category: ErrorCategory) => {
      const enabled = spellCheckExtensionRef.current?.isCategoryEnabled(category) ?? true
      return enabled
    },
    getManager: () => manager // Expose manager for toolbar
  }), [manager])

  return (
    <ThemeProvider>
      <div className="text-card-foreground">
        <style jsx global>{`
          /* Remove padding from remirror-editor-wrapper */
          .remirror-editor-wrapper {
            padding-top: 0 !important;
          }
          
          .ProseMirror {
            color: hsl(var(--foreground)) !important;
            background-color: transparent !important;
            padding: 1.5rem;
            outline: none;
            font-size: 16px;
            line-height: 1.6;
            min-height: 0px;
            max-width: none;
            position: relative;
            spellcheck: false !important;
            box-shadow: none !important;
          }
          
          .remirror-theme .ProseMirror {
            box-shadow: none !important;
          }
          
          .ProseMirror p {
            margin: 0 0 1em 0;
            color: hsl(var(--foreground)) !important;
          }
          
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
            color: hsl(var(--foreground)) !important;
            font-weight: bold;
            margin: 1.5em 0 0.5em 0;
          }
          
          .ProseMirror h1 { font-size: 2em; }
          .ProseMirror h2 { font-size: 1.5em; }
          .ProseMirror h3 { font-size: 1.25em; }
          
          .ProseMirror strong {
            color: hsl(var(--foreground)) !important;
            font-weight: bold;
          }
          
          .ProseMirror em {
            color: hsl(var(--foreground)) !important;
            font-style: italic;
          }
          
          .ProseMirror ul, .ProseMirror ol {
            color: hsl(var(--foreground)) !important;
            padding-left: 1.5em;
            margin: 1em 0;
            list-style: revert !important;
          }
          
          .ProseMirror ul {
            list-style-type: disc !important;
          }
          
          .ProseMirror ol {
            list-style-type: decimal !important;
          }
          
          .ProseMirror li {
            color: hsl(var(--foreground)) !important;
            margin: 0.25em 0;
            display: list-item !important;
          }
          
          .ProseMirror blockquote {
            color: hsl(var(--muted-foreground)) !important;
            border-left: 4px solid hsl(var(--border));
            padding-left: 1em;
            margin: 1em 0;
            font-style: italic;
            background-color: hsl(var(--muted) / 0.3);
            padding: 1em;
            border-radius: 0.5em;
          }
          
          .ProseMirror code {
            background-color: hsl(var(--muted));
            color: hsl(var(--muted-foreground)) !important;
            padding: 0.125em 0.25em;
            border-radius: 0.25rem;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.875em;
            border: 1px solid hsl(var(--border));
          }
          
          .ProseMirror a {
            color: #2b725e !important;
            text-decoration: underline;
          }
          
          .ProseMirror a:hover {
            color: #235e4c !important;
          }

          .ProseMirror-focused {
            outline: none !important;
          }

          /* Spell check error styling */
          .spell-error {
            text-decoration: underline;
            text-decoration-color: #ef4444;
            text-decoration-style: wavy;
            text-decoration-thickness: 2px;
            text-underline-offset: 2px;
          }

          /* CodeMirror specific styles */
          .cm-editor {
            border-radius: 0.5rem;
            border: 1px solid hsl(var(--border));
            margin: 1.5em 0;
            position: relative;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .cm-editor.cm-focused {
            border-color: #2b725e;
            outline: none;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 1px #2b725e;
          }
          
          /* Hover effect for code blocks to make language selector more discoverable */
          .cm-editor:hover {
            border-color: #2b725e;
          }
        `}</style>
        
        <Remirror 
          manager={manager} 
          initialContent={state}
          onChange={handleChange}
          attributes={{
            spellcheck: 'false'
          }}
        >
          <div className="relative">
            <EditorComponent />
            <CodeBlockToolbar />
          </div>
        </Remirror>
      </div>
    </ThemeProvider>
  )
}

// Export both the editor and toolbar separately
export default RemirrorEditor
export { FloatingToolbar } 
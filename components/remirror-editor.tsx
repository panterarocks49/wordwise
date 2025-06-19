"use client"

import { useCallback, useState, useEffect } from 'react'
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

export interface MisspelledWord {
  word: string
  suggestions: string[]
  position: { from: number, to: number }
}

interface RemirrorEditorProps {
  content: string
  onChange: (content: string) => void
  onSpellCheckUpdate?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => void
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
    className={`p-2 rounded hover:bg-gray-100 transition-colors ${
      isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
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
      className="absolute bg-white border border-gray-200 rounded-md shadow-sm px-2 py-1 flex items-center gap-2 text-xs z-20 pointer-events-auto"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`
      }}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
    >
      <Code2 size={12} className="text-gray-500" />
      <div className="relative">
        <select
          value={currentLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="border-0 bg-transparent text-xs focus:outline-none pr-4 cursor-pointer"
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
        <ChevronDown size={10} className="absolute right-0 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}

// Toolbar component inside Remirror context
const Toolbar = () => {
  const { commands, active } = useRemirrorContext({ autoUpdate: true })
  
  return (
    <div className="border-b border-gray-200 bg-gray-50 p-3 flex flex-wrap items-center gap-1">
      {/* Text Formatting */}
      <div className="flex items-center gap-1 mr-4">
        <ToolbarButton
          icon={Bold}
          isActive={active.bold?.({})}
          onClick={() => commands.toggleBold()}
          title="Bold (Ctrl+B)"
        />
        <ToolbarButton
          icon={Italic}
          isActive={active.italic?.({})}
          onClick={() => commands.toggleItalic()}
          title="Italic (Ctrl+I)"
        />
        <ToolbarButton
          icon={Underline}
          isActive={active.underline?.({})}
          onClick={() => commands.toggleUnderline()}
          title="Underline (Ctrl+U)"
        />
        <ToolbarButton
          icon={Strikethrough}
          isActive={active.strike?.({})}
          onClick={() => commands.toggleStrike()}
          title="Strikethrough"
        />
      </div>

      {/* Headings */}
      <div className="flex items-center gap-1 mr-4">
        <ToolbarButton
          icon={Heading1}
          isActive={active.heading?.({ level: 1 })}
          onClick={() => commands.toggleHeading({ level: 1 })}
          title="Heading 1"
        />
        <ToolbarButton
          icon={Heading2}
          isActive={active.heading?.({ level: 2 })}
          onClick={() => commands.toggleHeading({ level: 2 })}
          title="Heading 2"
        />
        <ToolbarButton
          icon={Heading3}
          isActive={active.heading?.({ level: 3 })}
          onClick={() => commands.toggleHeading({ level: 3 })}
          title="Heading 3"
        />
      </div>

      {/* Lists and Quote */}
      <div className="flex items-center gap-1 mr-4">
        <ToolbarButton
          icon={List}
          isActive={active.bulletList?.({})}
          onClick={() => commands.toggleBulletList()}
          title="Bullet List"
        />
        <ToolbarButton
          icon={ListOrdered}
          isActive={active.orderedList?.({})}
          onClick={() => commands.toggleOrderedList()}
          title="Numbered List"
        />
        <ToolbarButton
          icon={Quote}
          isActive={active.blockquote?.({})}
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
          disabled={!commands.undo.enabled?.()}
        />
        <ToolbarButton
          icon={Redo}
          onClick={() => commands.redo()}
          title="Redo (Ctrl+Y)"
          disabled={!commands.redo.enabled?.()}
        />
      </div>
    </div>
  )
}

// Main editor component
function RemirrorEditor({ content, onChange }: RemirrorEditorProps) {
  const extensions = useCallback(() => [
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
        // Highlight special characters
        highlightSpecialChars(),
        // History (undo/redo)
        history(),
        // Custom selection drawing
        drawSelection(),
        // Drop cursor when dragging
        dropCursor(),
        // Allow multiple selections
        EditorState.allowMultipleSelections.of(true),
        // Auto-indent on input
        indentOnInput(),
        // Syntax highlighting
        syntaxHighlighting(defaultHighlightStyle),
        // Bracket matching
        bracketMatching(),
        // Highlight active line
        highlightActiveLine(),
        // Auto-closing brackets
        closeBrackets(),
        // Key bindings
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap
        ])
      ]
    }),
    new HistoryExtension({}),
    new PlaceholderExtension({ placeholder: 'Start writing your document...' })
  ], [])

  const { manager, state } = useRemirror({ 
    extensions, 
    content,
    stringHandler: 'html'
  })

  const handleChange = useCallback((parameter: any) => {
    const html = parameter.helpers.getHTML(parameter.state)
    console.log('RemirrorEditor - Content changed:', {
      htmlLength: html.length,
      htmlPreview: html.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    })
    onChange(html)
  }, [onChange])

  return (
    <ThemeProvider>
      <div className="border border-gray-300 rounded-lg bg-white text-black">
        <style jsx global>{`
          .ProseMirror {
            color: #000000 !important;
            padding: 1.5rem;
            outline: none;
            font-size: 16px;
            line-height: 1.6;
            min-height: 0px;
            max-width: none;
            position: relative;
          }
          
          .ProseMirror p {
            margin: 0 0 1em 0;
            color: #000000 !important;
          }
          
          .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
            color: #000000 !important;
            font-weight: bold;
            margin: 1.5em 0 0.5em 0;
          }
          
          .ProseMirror h1 { font-size: 2em; }
          .ProseMirror h2 { font-size: 1.5em; }
          .ProseMirror h3 { font-size: 1.25em; }
          
          .ProseMirror strong {
            color: #000000 !important;
            font-weight: bold;
          }
          
          .ProseMirror em {
            color: #000000 !important;
            font-style: italic;
          }
          
          .ProseMirror ul, .ProseMirror ol {
            color: #000000 !important;
            padding-left: 1.5em;
            margin: 1em 0;
          }
          
          .ProseMirror li {
            color: #000000 !important;
            margin: 0.25em 0;
          }
          
          .ProseMirror blockquote {
            color: #666666 !important;
            border-left: 4px solid #e5e7eb;
            padding-left: 1em;
            margin: 1em 0;
            font-style: italic;
          }
          
          .ProseMirror code {
            background-color: #f3f4f6;
            color: #1f2937 !important;
            padding: 0.125em 0.25em;
            border-radius: 0.25rem;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.875em;
          }
          
          .ProseMirror a {
            color: #2563eb !important;
            text-decoration: underline;
          }
          
          .ProseMirror a:hover {
            color: #1d4ed8 !important;
          }

          .ProseMirror-focused {
            outline: none;
          }

          /* CodeMirror specific styles */
          .cm-editor {
            border-radius: 0.5rem;
            border: 1px solid #d1d5db;
            margin: 1.5em 0;
            position: relative;
            background-color: #f6f8fa;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
          }
          
          .cm-editor.cm-focused {
            border-color: #3b82f6;
            outline: none;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05), 0 0 0 1px #3b82f6;
          }
          
          /* More specific selector to override CodeMirror defaults */
          .cm-editor .cm-content {
            padding: 16px !important;

          }

          .cm-scroller {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', monospace;
            font-size: 14px;
            line-height: 1.6;
          }

          .cm-line {
            padding: 0.125rem 0;
          }

          .cm-activeLine {
            background-color: transparent !important;
          }

          .cm-selectionBackground {
            background-color: #3b82f6 !important;
            opacity: 0.2;
          }

          /* Ensure floating toolbar is positioned correctly */
          .ProseMirror {
            position: relative;
          }
          
          /* Hover effect for code blocks to make language selector more discoverable */
          .cm-editor:hover {
            border-color: #9ca3af;
          }
        `}</style>
        
        <Remirror 
          manager={manager} 
          initialContent={state}
          onChange={handleChange}
        >
          <Toolbar />
          <div className="relative">
            <EditorComponent />
            <CodeBlockToolbar />
          </div>
        </Remirror>
      </div>
    </ThemeProvider>
  )
}

export default RemirrorEditor 
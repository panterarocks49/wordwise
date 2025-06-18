"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useDocumentStore } from '@/lib/stores/document-store'
import { Button } from '@/components/ui/button'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Quote, 
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Undo,
  Redo,
  CheckSquare,
  Braces
} from 'lucide-react'
import { CodeBlockExtension } from './code-block-extension'
import { SpellCheckExtension, MisspelledWord } from './spell-check-extension'

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  onSpellCheckUpdate?: (data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => void
  editorRef?: React.MutableRefObject<any>
}

export default function TiptapEditor({ content, onChange, onSpellCheckUpdate, editorRef }: TiptapEditorProps) {
  const isInternalChange = useRef(false)
  const lastExternalContent = useRef<string>('')
  const { currentContent, contentChangeCount } = useDocumentStore()

  // Memoize extensions to prevent recreation on every render
  const extensions = useMemo(() => [
    StarterKit.configure({
      codeBlock: false, // We'll use our custom CodeBlock with CodeMirror
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-blue-600 underline cursor-pointer',
      },
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto',
      },
    }),
    CodeBlockExtension,
    SpellCheckExtension.configure({
      onSpellCheckUpdate: onSpellCheckUpdate,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: 'Start writing your document...',
    }),
  ], [onSpellCheckUpdate])

  // Memoize editor props to prevent recreation
  const editorProps = useMemo(() => ({
    attributes: {
      class: 'prose prose-lg max-w-none min-h-[500px] p-6 focus:outline-none text-gray-900',
      spellcheck: 'false',
    },
  }), [])

  // Optimize the onChange callback
  const handleUpdate = useCallback(({ editor }: { editor: any }) => {
    isInternalChange.current = true
    const html = editor.getHTML()
    onChange(html)
  }, [onChange])

  const editor = useEditor({
    extensions,
    content,
    onUpdate: handleUpdate,
    editorProps,
  })

  // Expose editor to parent component via ref
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor
    }
  }, [editor, editorRef])

  // Optimize external content change detection
  useEffect(() => {
    if (!isInternalChange.current && 
        currentContent && 
        editor && 
        currentContent !== editor.getHTML() &&
        currentContent !== lastExternalContent.current) {
      console.log('External content change detected, updating editor')
      editor.commands.setContent(currentContent)
      lastExternalContent.current = currentContent
    }
    isInternalChange.current = false
  }, [currentContent, contentChangeCount, editor])

  // Initialize editor with content - only run once
  useEffect(() => {
    if (editor && content && !editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [editor, content])

  // Memoize button handlers to prevent recreation
  const addImage = useCallback(() => {
    const url = window.prompt('Enter image URL:')
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  const addLink = useCallback(() => {
    const url = window.prompt('Enter URL:')
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const addTable = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }
  }, [editor])

  if (!editor) {
    return <div className="p-6">Loading editor...</div>
  }

  return (
    <div className="border border-gray-300 rounded-lg bg-white">
      {/* Add spell check styles */}
      <style jsx>{`
        .spell-error {
          text-decoration: underline;
          text-decoration-color: #ef4444;
          text-decoration-style: wavy;
          text-underline-offset: 2px;
        }
      `}</style>
      
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 text-gray-700"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 text-gray-700"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <div className="w-px bg-gray-300 mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 text-gray-700 ${editor.isActive('bold') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 text-gray-700 ${editor.isActive('italic') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-2 text-gray-700 ${editor.isActive('strike') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px bg-gray-300 mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 text-gray-700 ${editor.isActive('bulletList') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 text-gray-700 ${editor.isActive('orderedList') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`p-2 text-gray-700 ${editor.isActive('taskList') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <div className="w-px bg-gray-300 mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 text-gray-700 ${editor.isActive('blockquote') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const result = editor.chain().focus().toggleCodeBlock().run()
            console.log('Toggle code block result:', result)
          }}
          className={`p-2 text-gray-700 ${editor.isActive('codeBlock') ? 'bg-blue-100 border-blue-300 text-blue-700' : ''}`}
        >
          <Braces className="h-4 w-4" />
        </Button>
        <div className="w-px bg-gray-300 mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={addLink}
          className="p-2 text-gray-700"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addImage}
          className="p-2 text-gray-700"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addTable}
          className="p-2 text-gray-700"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-[500px] p-4">
        <EditorContent 
          editor={editor} 
          className="prose prose-lg max-w-none focus:outline-none text-gray-900"
        />
      </div>
    </div>
  )
} 
"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  Save,
  Eye,
  Edit,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImageIcon,
} from "lucide-react"
import Link from "next/link"
import { updateDocument } from "@/lib/document-actions"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism"

interface DocumentEditorProps {
  document: {
    id: string
    title: string
    content: string
    created_at: string
    updated_at: string
  }
}

export default function DocumentEditor({ document }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState(document.content)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null)

  // Auto-save functionality
  const saveDocument = useCallback(async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      await updateDocument(document.id, title, content)
      setLastSaved(new Date())
    } catch (error) {
      console.error("Failed to save document:", error)
    } finally {
      setIsSaving(false)
    }
  }, [document.id, title, content, isSaving])

  // Auto-save every 3 seconds when content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== document.title || content !== document.content) {
        saveDocument()
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [title, content, document.title, document.content, saveDocument])

  // Helper function to insert text at cursor position
  const insertAtCursor = (insertText: string, wrapText = false) => {
    if (!textareaRef) return

    const start = textareaRef.selectionStart
    const end = textareaRef.selectionEnd
    const selectedText = content.substring(start, end)

    let newText
    if (wrapText && selectedText) {
      newText = content.substring(0, start) + insertText + selectedText + insertText + content.substring(end)
    } else {
      newText = content.substring(0, start) + insertText + content.substring(end)
    }

    setContent(newText)

    // Set cursor position after insert
    setTimeout(() => {
      if (textareaRef) {
        const newPosition = start + insertText.length + (wrapText && selectedText ? selectedText.length : 0)
        textareaRef.setSelectionRange(newPosition, newPosition)
        textareaRef.focus()
      }
    }, 0)
  }

  // Toolbar actions
  const makeBold = () => insertAtCursor("**", true)
  const makeItalic = () => insertAtCursor("*", true)
  const makeCode = () => insertAtCursor("`", true)
  const makeHeading = () => insertAtCursor("## ")
  const makeList = () => insertAtCursor("- ")
  const makeOrderedList = () => insertAtCursor("1. ")
  const makeQuote = () => insertAtCursor("> ")
  const makeLink = () => insertAtCursor("[link text](url)")
  const makeImage = () => insertAtCursor("![alt text](image-url)")
  const makeCodeBlock = () => insertAtCursor("\n```javascript\n\n```\n")

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <div className="flex items-center space-x-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-transparent border-none text-xl font-semibold text-white placeholder:text-gray-500 focus:ring-0 focus:border-none p-0"
                  placeholder="Document title..."
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => setIsPreview(!isPreview)}>
                {isPreview ? (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </>
                )}
              </Button>
              {lastSaved && <span className="text-sm text-gray-400">Saved {lastSaved.toLocaleTimeString()}</span>}
              {isSaving && (
                <span className="text-sm text-gray-400 flex items-center">
                  <Save className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </span>
              )}
              <Button onClick={saveDocument} disabled={isSaving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg overflow-hidden">
          {!isPreview && (
            <>
              {/* Toolbar */}
              <div className="border-b border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={makeBold} title="Bold">
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeItalic} title="Italic">
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeCode} title="Inline Code">
                    <Code className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button variant="ghost" size="sm" onClick={makeHeading} title="Heading">
                    H
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeList} title="Bullet List">
                    <List className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeOrderedList} title="Numbered List">
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeQuote} title="Quote">
                    <Quote className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-gray-300 mx-1" />
                  <Button variant="ghost" size="sm" onClick={makeLink} title="Link">
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeImage} title="Image">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={makeCodeBlock} title="Code Block">
                    {"{ }"}
                  </Button>
                </div>
              </div>

              {/* Editor Textarea */}
              <Textarea
                ref={setTextareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your API documentation here..."
                className="w-full min-h-[600px] border-none resize-none focus:ring-0 text-gray-900 p-6 font-mono text-sm rounded-none"
              />
            </>
          )}

          {isPreview && (
            <div className="p-6 prose prose-lg max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "")
                    return !inline && match ? (
                      <SyntaxHighlighter style={tomorrow} language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Eye, Edit } from "lucide-react"
import Link from "next/link"
import { updateDocument } from "@/lib/document-actions"
import ReactMarkdown from "react-markdown"

interface DocumentEditorProps {
  document: {
    id: string
    title: string
    content: string
    created_at: string
    updated_at: string
  }
}

export default function SimpleDocumentEditor({ document }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState(document.content)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isPreview, setIsPreview] = useState(false)

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

  // Auto-save every 2 seconds when content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== document.title || content !== document.content) {
        saveDocument()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [title, content, document.title, document.content, saveDocument])

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
        <div className="bg-white rounded-lg overflow-hidden min-h-[600px]">
          {isPreview ? (
            <div className="p-6 prose prose-lg max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your API documentation here..."
              className="w-full min-h-[600px] border-none resize-none focus:ring-0 text-gray-900 p-6 font-mono text-sm"
            />
          )}
        </div>
      </div>
    </div>
  )
}

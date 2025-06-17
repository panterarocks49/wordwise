"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Save,
  Eye,
  Edit,
} from "lucide-react"
import Link from "next/link"
import { updateDocument } from "@/lib/document-actions"
import { useDocumentStore } from "@/lib/stores/document-store"
import ReactMarkdown from "react-markdown"
import dynamic from 'next/dynamic'
import '@mdxeditor/editor/style.css'

// Dynamically import the editor component
const Editor = dynamic(() => import('./mdx-editor'), { ssr: false })

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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { updateDocumentInStore } = useDocumentStore()

  // Simple save function
  const saveDocument = useCallback(async () => {
    if (isSaving) return
    
    console.log('Attempting to save document:', { id: document.id, title, content: content.substring(0, 50) + '...' })
    
    setIsSaving(true)
    setSaveStatus('saving')
    
    try {
      await updateDocument(document.id, title, content)
      console.log('Document saved successfully')
      
      // Update the document store with the new values
      updateDocumentInStore(document.id, title, content)
      
      setSaveStatus('saved')
      
      // Clear saved status after 2 seconds
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error("Failed to save document:", error)
      setSaveStatus('error')
      // Clear error status after 5 seconds
      setTimeout(() => setSaveStatus(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }, [document.id, title, content, isSaving, updateDocumentInStore])

  // Debounced auto-save
  const scheduleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (title !== document.title || content !== document.content) {
        console.log('Auto-saving document due to changes')
        saveDocument()
      }
    }, 2000) // 2 second delay
  }, [title, content, document.title, document.content, saveDocument])

  // Auto-save when content changes
  useEffect(() => {
    scheduleAutoSave()
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [title, content, scheduleAutoSave])

  // Save on title blur
  const handleTitleBlur = () => {
    if (title !== document.title && !isSaving) {
      console.log('Saving due to title blur')
      saveDocument()
    }
  }

  // Manual save button
  const handleManualSave = () => {
    console.log('Manual save triggered')
    saveDocument()
  }

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'Saved'
      case 'error':
        return 'Error saving'
      default:
        return null
    }
  }

  const getSaveStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'text-blue-400'
      case 'saved':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

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
                  onBlur={handleTitleBlur}
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
              {saveStatus && (
                <span className={`text-sm flex items-center ${getSaveStatusColor()}`}>
                  {saveStatus === 'saving' && <Save className="h-3 w-3 mr-1 animate-spin" />}
                  {getSaveStatusText()}
                </span>
              )}
              <Button onClick={handleManualSave} disabled={isSaving} size="sm">
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
          {!isPreview ? (
            <div className="prose prose-lg max-w-none">
              <Editor content={content} onChange={setContent} />
            </div>
          ) : (
            <div className="p-6 prose prose-lg max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

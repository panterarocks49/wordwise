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
import { SpellCheckWrapper, MisspelledWord } from "./spell-check-plugin"
import { SpellCheckSidebar } from "./spell-check-sidebar"
import ReactMarkdown from "react-markdown"
import dynamic from 'next/dynamic'

// Dynamically import the tiptap editor component
const Editor = dynamic(() => import('./tiptap-editor'), { ssr: false })

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
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [spellCheckSidebarOpen, setSpellCheckSidebarOpen] = useState(true)
  const [spellCheckData, setSpellCheckData] = useState<{
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }>({
    isLoading: true,
    error: null,
    misspelledWords: []
  })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { 
    updateDocumentInStore,
    currentDocument,
    currentTitle,
    currentContent,
    contentChangeCount,
    setCurrentDocument,
    updateCurrentTitle,
    updateCurrentContent,
    replaceWordInContent
  } = useDocumentStore()

  // Initialize the current document in the store
  useEffect(() => {
    const docWithUserId = { ...document, user_id: '' } // Add missing user_id field
    setCurrentDocument(docWithUserId)
  }, [document, setCurrentDocument])

  // Use store values with fallbacks
  const title = currentTitle || document.title
  const content = currentContent || document.content

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
  const handleTitleBlur = useCallback(() => {
    if (title !== document.title && !isSaving) {
      console.log('Saving due to title blur')
      saveDocument()
    }
  }, [title, document.title, isSaving, saveDocument])

  // Manual save button
  const handleManualSave = () => {
    console.log('Manual save triggered')
    saveDocument()
  }

  // Handle spell check updates
  const handleSpellCheckUpdate = useCallback((data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => {
    setSpellCheckData(data)
  }, [])

  // Handle word replacement from sidebar
  const handleWordReplace = useCallback((originalWord: string, replacement: string) => {
    console.log('Replacing word:', originalWord, 'with:', replacement)
    replaceWordInContent(originalWord, replacement)
  }, [replaceWordInContent])

  // Handle ignoring words from sidebar
  const handleIgnoreWord = useCallback((word: string) => {
    console.log('Ignoring word:', word)
    // This will be handled by the SpellCheckWrapper internally
  }, [])

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
    <div className="min-h-screen bg-[#161616] text-white flex">
      <div className="flex-1 flex flex-col">
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
                    onChange={(e) => updateCurrentTitle(e.target.value)}
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
        <div className="flex-1 flex">
          <div className="flex-1 container mx-auto px-4 py-8">
            <SpellCheckWrapper 
              content={content} 
              onChange={updateCurrentContent}
              onSpellCheckUpdate={handleSpellCheckUpdate}
              onIgnoreWord={handleIgnoreWord}
              onWordReplace={handleWordReplace}
            >
              <div className="bg-white rounded-lg overflow-hidden">
                {!isPreview ? (
                  <div className="prose prose-lg max-w-none">
                    <Editor content={content} onChange={updateCurrentContent} />
                  </div>
                ) : (
                  <div className="p-6 prose prose-lg max-w-none">
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </SpellCheckWrapper>
          </div>
          
          {/* Inline Spell Check Sidebar */}
          <SpellCheckSidebar
            isLoading={spellCheckData.isLoading}
            error={spellCheckData.error}
            misspelledWords={spellCheckData.misspelledWords}
            isOpen={spellCheckSidebarOpen}
            onToggle={() => setSpellCheckSidebarOpen(!spellCheckSidebarOpen)}
            onWordReplace={handleWordReplace}
            onIgnoreWord={handleIgnoreWord}
          />
        </div>
      </div>
    </div>
  )
}

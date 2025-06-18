"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Save,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react"
import Link from "next/link"
import { updateDocument } from "@/lib/document-actions"
import { useDocumentStore } from "@/lib/stores/document-store"
import { MisspelledWord as TipTapMisspelledWord, ignoreWord, replaceWord } from "./spell-check-extension"
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
  const [isPreview, setIsPreview] = useState(false)
  const [spellCheckSidebarOpen, setSpellCheckSidebarOpen] = useState(true)
  const [lastSavedTitle, setLastSavedTitle] = useState(document.title)
  const [lastSavedContent, setLastSavedContent] = useState(document.content)
  const [spellCheckData, setSpellCheckData] = useState<{
    isLoading: boolean
    error: string | null
    misspelledWords: TipTapMisspelledWord[]
  }>({
    isLoading: true,
    error: null,
    misspelledWords: []
  })
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const editorRef = useRef<any>(null)
  
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

  // Initialize the current document in the store only once
  useEffect(() => {
    const docWithUserId = { ...document, user_id: '' } // Add missing user_id field
    setCurrentDocument(docWithUserId)
  }, [document.id, setCurrentDocument]) // Only re-run if document ID changes

  // Use store values with fallbacks
  const title = currentTitle || document.title
  const content = currentContent || document.content

  // Memoize the hasChanges function to compare against last saved values
  const hasChanges = useMemo(() => {
    return title !== lastSavedTitle || content !== lastSavedContent
  }, [title, content, lastSavedTitle, lastSavedContent])

  // Simple save function - memoized to prevent recreation
  const saveDocument = useCallback(async () => {
    if (isSaving || !hasChanges) {
      console.log('Skipping save - no changes or already saving')
      return
    }
    
    console.log('Attempting to save document:', { id: document.id, title, content: content.substring(0, 50) + '...' })
    
    setIsSaving(true)
    
    try {
      await updateDocument(document.id, title, content)
      console.log('Document saved successfully')
      
      // Update the document store with the new values
      updateDocumentInStore(document.id, title, content)
      
      // Update our last saved tracking
      setLastSavedTitle(title)
      setLastSavedContent(content)
    } catch (error) {
      console.error("Failed to save document:", error)
    } finally {
      setIsSaving(false)
    }
  }, [document.id, title, content, isSaving, updateDocumentInStore, hasChanges, lastSavedTitle, lastSavedContent])

  // Continuous auto-save loop - runs every 2 seconds and only saves if there are changes
  useEffect(() => {
    console.log('Setting up auto-save interval')
    autoSaveIntervalRef.current = setInterval(() => {
      if (hasChanges && !isSaving) {
        console.log('Auto-saving document due to changes detected in interval')
        saveDocument()
      }
    }, 2000) // Check every 2 seconds

    return () => {
      console.log('Cleaning up auto-save interval')
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [hasChanges, isSaving, saveDocument])

  // Memoize event handlers to prevent recreation on every render
  const handleTitleBlur = useCallback(() => {
    if (hasChanges && !isSaving) {
      console.log('Saving due to title blur')
      saveDocument()
    }
  }, [hasChanges, isSaving, saveDocument])

  const handleManualSave = useCallback(() => {
    console.log('Manual save triggered')
    saveDocument()
  }, [saveDocument])

  // Handle spell check updates - memoized
  const handleSpellCheckUpdate = useCallback((data: {
    isLoading: boolean
    error: string | null
    misspelledWords: TipTapMisspelledWord[]
  }) => {
    setSpellCheckData(data)
  }, [])

  // Handle word replacement from sidebar - memoized
  const handleWordReplace = useCallback((originalWord: string, replacement: string) => {
    console.log('Replacing word:', originalWord, 'with:', replacement)
    if (editorRef.current) {
      replaceWord(editorRef.current, originalWord, replacement)
    }
  }, [])

  // Handle ignoring words from sidebar - memoized
  const handleIgnoreWord = useCallback((word: string) => {
    console.log('Ignoring word:', word)
    if (editorRef.current) {
      ignoreWord(editorRef.current, word)
    }
  }, [])

  // Memoize preview toggle
  const togglePreview = useCallback(() => {
    setIsPreview(!isPreview)
  }, [isPreview])

  // Memoize sidebar toggle
  const toggleSpellCheckSidebar = useCallback(() => {
    setSpellCheckSidebarOpen(!spellCheckSidebarOpen)
  }, [spellCheckSidebarOpen])

  return (
    <div className="h-screen bg-[#161616] text-white flex">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Fixed Header */}
        <header className="flex-shrink-0 border-b border-gray-800 pr-12">
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
                <Button onClick={handleManualSave} disabled={isSaving} size="sm">
                  {isSaving ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : !hasChanges ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Editor Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-white rounded-lg overflow-hidden">
              {!isPreview ? (
                <div className="prose prose-lg max-w-none">
                  <Editor 
                    content={content} 
                    onChange={updateCurrentContent}
                    onSpellCheckUpdate={handleSpellCheckUpdate}
                    editorRef={editorRef}
                  />
                </div>
              ) : (
                <div className="p-6 prose prose-lg max-w-none">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Sidebar - Full height, separate column */}
      <SpellCheckSidebar
        isLoading={spellCheckData.isLoading}
        error={spellCheckData.error}
        misspelledWords={spellCheckData.misspelledWords}
        isOpen={spellCheckSidebarOpen}
        onToggle={toggleSpellCheckSidebar}
        onWordReplace={handleWordReplace}
        onIgnoreWord={handleIgnoreWord}
      />
      
      {/* Floating Sidebar Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSpellCheckSidebar}
        className={`fixed top-4 z-50 h-10 w-8 rounded-l-lg rounded-r-none bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 border-r-0 transition-all duration-300 ${
          spellCheckSidebarOpen ? 'right-80' : 'right-0'
        }`}
      >
        {spellCheckSidebarOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

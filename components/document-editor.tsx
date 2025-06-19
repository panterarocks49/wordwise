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
import { MisspelledWord } from "./remirror-editor"
import { SpellCheckSidebar } from "./spell-check-sidebar"
import ReactMarkdown from "react-markdown"
import RemirrorEditor from './remirror-editor'

interface DocumentEditorProps {
  document: {
    id: string
    title: string
    content: string
    created_at: string
    updated_at: string
    user_id?: string
  }
}

export default function DocumentEditor({ document }: DocumentEditorProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [spellCheckSidebarOpen, setSpellCheckSidebarOpen] = useState(true)
  const [saveCount, setSaveCount] = useState(0)
  const [spellCheckData, setSpellCheckData] = useState<{
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }>({
    isLoading: true,
    error: null,
    misspelledWords: []
  })
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorRef = useRef<any>(null)
  const lastSavedTitleRef = useRef(document.title)
  const lastSavedContentRef = useRef(document.content)
  
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
    // Don't add empty user_id, just use the document as-is
    setCurrentDocument({ ...document, user_id: document.user_id || '' })
    // Initialize refs with document values
    lastSavedTitleRef.current = document.title
    lastSavedContentRef.current = document.content
  }, [document.id, setCurrentDocument]) // Only re-run if document ID changes

  // Use store values with fallbacks, but ensure we initialize properly
  const title = currentDocument ? currentTitle : document.title
  const content = currentDocument ? currentContent : document.content

  // Memoize the hasChanges function to compare against last saved values using refs
  const hasChanges = useMemo(() => {
    const currentHasChanges = title !== lastSavedTitleRef.current || content !== lastSavedContentRef.current
    console.log('hasChanges calculation:', {
      title,
      lastSavedTitle: lastSavedTitleRef.current,
      content: content?.substring(0, 50) + '...',
      lastSavedContent: lastSavedContentRef.current?.substring(0, 50) + '...',
      titleChanged: title !== lastSavedTitleRef.current,
      contentChanged: content !== lastSavedContentRef.current,
      hasChanges: currentHasChanges,
      saveCount // Include saveCount to trigger recalculation
    })
    return currentHasChanges
  }, [title, content, saveCount]) // saveCount forces recalculation after saves

  // Add debugging to see what's happening
  useEffect(() => {
    console.log('Document Editor - Current state:', {
      documentId: document.id,
      hasCurrentDocument: !!currentDocument,
      currentTitle,
      currentContent: currentContent?.substring(0, 100) + '...',
      title,
      content: content?.substring(0, 100) + '...',
      hasChanges,
      isSaving
    })
  }, [document.id, currentDocument, currentTitle, currentContent, title, content, hasChanges, isSaving])

  // Auto-save functionality - memoized
  const autoSave = useCallback(async () => {
    // Check hasChanges inside the function rather than in dependencies
    const currentHasChanges = title !== lastSavedTitleRef.current || content !== lastSavedContentRef.current
    
    console.log('Auto-save triggered:', {
      currentHasChanges,
      title,
      lastSavedTitle: lastSavedTitleRef.current,
      contentLength: content.length,
      lastSavedContentLength: lastSavedContentRef.current.length
    })
    
    if (!currentHasChanges) {
      console.log('Auto-save: No changes detected, skipping')
      return
    }

    try {
      console.log('Auto-save: Starting save...')
      setIsSaving(true)
      await updateDocument(document.id, title, content)
      // Update refs instead of state
      lastSavedTitleRef.current = title
      lastSavedContentRef.current = content
      updateDocumentInStore(document.id, title, content)
      console.log('Auto-save: Completed successfully')
      
      // Increment saveCount to force hasChanges recalculation
      setSaveCount(prev => prev + 1)
      
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }, [document.id, title, content, updateDocumentInStore])

  // Manual save function - memoized
  const handleManualSave = useCallback(async () => {
    console.log('Manual save triggered')
    await autoSave()
  }, [autoSave])

  // Title blur handler - memoized
  const handleTitleBlur = useCallback(() => {
    console.log('Title blur - checking for changes')
    const currentHasChanges = title !== lastSavedTitleRef.current || content !== lastSavedContentRef.current
    if (currentHasChanges) {
      console.log('Title blur - changes detected, auto-saving')
      autoSave()
    }
  }, [autoSave, title, content])

  // Set up auto-save with debounced approach
  useEffect(() => {
    console.log('Setting up debounced auto-save')
    
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    // Check if there are changes
    const { currentTitle, currentContent } = useDocumentStore.getState()
    const currentHasChanges = (currentTitle || document.title) !== lastSavedTitleRef.current || 
                             (currentContent || document.content) !== lastSavedContentRef.current
    
    if (currentHasChanges && !isSaving) {
      console.log('Changes detected, setting up auto-save in 2 seconds')
      // Set up auto-save to trigger in 2 seconds
      autoSaveTimeoutRef.current = setTimeout(() => {
        console.log('Auto-save timeout triggered')
        autoSave()
      }, 2000) // 2 seconds after change
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        console.log('Clearing auto-save timeout')
        clearTimeout(autoSaveTimeoutRef.current)
        autoSaveTimeoutRef.current = null
      }
    }
  }, [title, content, isSaving, autoSave]) // Trigger when content changes

  // Keep a backup interval for safety (every 30 seconds)
  useEffect(() => {
    console.log('Setting up backup auto-save interval')
    
    const interval = setInterval(() => {
      const { currentTitle, currentContent } = useDocumentStore.getState()
      const currentHasChanges = (currentTitle || document.title) !== lastSavedTitleRef.current || 
                               (currentContent || document.content) !== lastSavedContentRef.current
      
      console.log('Backup auto-save interval check:', {
        currentHasChanges,
        isSaving
      })
      
      if (currentHasChanges && !isSaving) {
        console.log('Backup auto-save: Changes detected, triggering save')
        autoSave()
      }
    }, 30000) // Backup every 30 seconds

    autoSaveIntervalRef.current = interval

    return () => {
      console.log('Cleaning up backup auto-save interval')
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
      }
    }
  }, [document.id]) // Only depend on document.id, not changing values

  // Handle spell check updates - memoized
  const handleSpellCheckUpdate = useCallback((data: {
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
  }) => {
    setSpellCheckData(data)
  }, [])

  // Handle word replacement from sidebar - memoized
  const handleWordReplace = useCallback((originalWord: string, replacement: string) => {
    console.log('Replacing word:', originalWord, 'with:', replacement)
    if (editorRef.current) {
      // For now, we'll do a simple text replacement
      const currentContent = editorRef.current.getHTML()
      const newContent = currentContent.replace(new RegExp(`\\b${originalWord}\\b`, 'gi'), replacement)
      updateCurrentContent(newContent)
    }
  }, [updateCurrentContent])

  // Handle ignoring words from sidebar - memoized
  const handleIgnoreWord = useCallback((word: string) => {
    console.log('Ignoring word:', word)
    // For now, we'll just remove it from the misspelled words list
    setSpellCheckData(prev => ({
      ...prev,
      misspelledWords: prev.misspelledWords.filter(w => w.word !== word)
    }))
  }, [])

  // Memoize preview toggle
  const togglePreview = useCallback(() => {
    setIsPreview(!isPreview)
  }, [isPreview])

  // Memoize sidebar toggle
  const toggleSpellCheckSidebar = useCallback(() => {
    setSpellCheckSidebarOpen(!spellCheckSidebarOpen)
  }, [spellCheckSidebarOpen])

  // Memoize editor props to prevent unnecessary re-renders
  const editorProps = useMemo(() => ({
    content,
    onChange: updateCurrentContent,
    onSpellCheckUpdate: handleSpellCheckUpdate,
    editorRef
  }), [content, updateCurrentContent, handleSpellCheckUpdate])

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
                  <RemirrorEditor 
                    key={`editor-${document.id}`}
                    {...editorProps}
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

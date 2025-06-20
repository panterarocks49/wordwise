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
import { MisspelledWord, ErrorCategory } from "./spell-check-extension"
import { SpellCheckSidebar } from "./spell-check-sidebar"
import ReactMarkdown from "react-markdown"
import RemirrorEditor, { FloatingToolbar } from './remirror-editor'
import { useRouter } from "next/navigation"

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
  const router = useRouter()
  const editorRef = useRef<any>(null)
  const mountedRef = useRef(false)
  const [editorManager, setEditorManager] = useState<any>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [spellCheckSidebarOpen, setSpellCheckSidebarOpen] = useState(true)
  const [saveCount, setSaveCount] = useState(0)

  // Spell check state
  const [spellCheckData, setSpellCheckData] = useState<{
    isLoading: boolean
    error: string | null
    misspelledWords: MisspelledWord[]
    categorizedErrors: {
      correctness: MisspelledWord[]
      clarity: MisspelledWord[]
    }
  }>({
    isLoading: false,
    error: null,
    misspelledWords: [],
    categorizedErrors: {
      correctness: [],
      clarity: []
    }
  })

  // Category states
  const [categoryStates, setCategoryStates] = useState({
    correctness: true,
    clarity: true
  })

  // Focus state for sidebar/editor coordination
  const [focusedWordId, setFocusedWordId] = useState<string | null>(null)

  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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
    replaceWordInContent,
    clearCurrentDocument
  } = useDocumentStore()

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Clear current document state when component unmounts
      clearCurrentDocument()
    }
  }, [])

  // Initialize the current document in the store only once
  useEffect(() => {
    // Clear any pending auto-save operations when switching documents
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }
    
    // Set the current document in the store (this will clear any stale state)
    setCurrentDocument({ ...document, user_id: document.user_id || '' })
    
    // Initialize refs with fresh document values
    lastSavedTitleRef.current = document.title
    lastSavedContentRef.current = document.content
    
    // Reset save state
    setIsSaving(false)
    setSaveCount(0)
    
  }, [document.id, setCurrentDocument]) // Only re-run if document ID changes

  // Use store values with fallbacks, but ensure we initialize properly
  const title = currentDocument ? currentTitle : document.title
  const content = currentDocument ? currentContent : document.content

  // Memoize the hasChanges function to compare against last saved values using refs
  const hasChanges = useMemo(() => {
    const currentHasChanges = title !== lastSavedTitleRef.current || content !== lastSavedContentRef.current
    return currentHasChanges
  }, [title, content, saveCount]) // saveCount forces recalculation after saves

  // Auto-save functionality - memoized
  const autoSave = useCallback(async () => {
    // Check hasChanges inside the function rather than in dependencies
    const currentHasChanges = title !== lastSavedTitleRef.current || content !== lastSavedContentRef.current
    
    if (!currentHasChanges) {
      return
    }

    try {
      setIsSaving(true)
      await updateDocument(document.id, title, content)
      // Update refs instead of state
      lastSavedTitleRef.current = title
      lastSavedContentRef.current = content
      updateDocumentInStore(document.id, title, content)
      
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
    await autoSave()
  }, [autoSave])

  // Title blur handler - memoized
  const handleTitleBlur = useCallback(() => {
    const currentHasChanges = title !== lastSavedTitleRef.current || content !== lastSavedContentRef.current
    if (currentHasChanges) {
      autoSave()
    }
  }, [autoSave, title, content])

  // Set up auto-save with debounced approach
  useEffect(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }
    
    // Check if there are changes
    const { currentTitle, currentContent } = useDocumentStore.getState()
    const currentHasChanges = (currentTitle || document.title) !== lastSavedTitleRef.current || 
                             (currentContent || document.content) !== lastSavedContentRef.current
    
    if (currentHasChanges && !isSaving) {
      // Set up auto-save to trigger in 2 seconds
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSave()
      }, 2000) // 2 seconds after change
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
        autoSaveTimeoutRef.current = null
      }
    }
  }, [title, content, isSaving, autoSave]) // Trigger when content changes

  // Keep a backup interval for safety (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const { currentTitle, currentContent } = useDocumentStore.getState()
      const currentHasChanges = (currentTitle || document.title) !== lastSavedTitleRef.current || 
                               (currentContent || document.content) !== lastSavedContentRef.current
      
      if (currentHasChanges && !isSaving) {
        autoSave()
      }
    }, 30000) // Backup every 30 seconds

    autoSaveIntervalRef.current = interval

    return () => {
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
    categorizedErrors: {
      correctness: MisspelledWord[]
      clarity: MisspelledWord[]
    }
  }) => {
    // Defer state update to avoid updating unmounted component
    if (mountedRef.current) {
      setSpellCheckData(data)
    } else {
      // If component isn't mounted, defer the update
      setTimeout(() => {
        if (mountedRef.current) {
          setSpellCheckData(data)
        }
      }, 0)
    }
  }, [])

  // Handle category toggle
  const handleToggleCategory = useCallback((category: ErrorCategory) => {
    setCategoryStates(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
    
    // Also toggle in the editor extension
    if (editorRef.current) {
      editorRef.current.toggleCategory(category)
    }
  }, [])

  // Handle word replacement from sidebar - memoized
  const handleWordReplace = useCallback((from: number, to: number, replacement: string) => {
    if (editorRef.current) {
      editorRef.current.replaceWord(from, to, replacement)
    }
  }, [])

  // Handle ignoring words from sidebar - memoized
  const handleIgnoreWord = useCallback((word: string) => {
    if (editorRef.current) {
      editorRef.current.ignoreWord(word)
    }
  }, [])

  // Handle focusing on a word from sidebar - memoized
  const handleFocusWord = useCallback((wordData: MisspelledWord) => {
    if (editorRef.current) {
      // Scroll to and highlight the word in the editor
      editorRef.current.focusWord(wordData.position.from, wordData.position.to)
    }
  }, [])

  // Handle focus changes from sidebar - memoized
  const handleFocusChange = useCallback((wordId: string | null) => {
    setFocusedWordId(wordId)
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
    onFocusChange: handleFocusChange,
    editorRef
  }), [content, updateCurrentContent, handleSpellCheckUpdate, handleFocusChange])

  // Get the manager from the editor when it's ready
  useEffect(() => {
    const checkForManager = () => {
      if (editorRef.current && editorRef.current.getManager) {
        const manager = editorRef.current.getManager()
        if (manager && manager !== editorManager) {
          setEditorManager(manager)
          return true
        }
      }
      return false
    }

    // Try immediately
    if (checkForManager()) return

    // If not found, poll every 100ms for up to 3 seconds
    let attempts = 0
    const maxAttempts = 30
    const interval = setInterval(() => {
      attempts++
      if (checkForManager() || attempts >= maxAttempts) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [content, editorManager]) // Re-run when content changes (editor re-mounts)

  return (
    <div className="h-screen bg-[#161616] text-white flex">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Fixed Header */}
        <header className="flex-shrink-0 pr-12">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
              <Input
                value={title}
                onChange={(e) => updateCurrentTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="bg-transparent border-none text-xl font-semibold text-white placeholder:text-gray-500 focus:ring-0 focus:border-none p-0"
                placeholder="Document title..."
              />
            </div>
            <Button onClick={handleManualSave} disabled={isSaving} size="sm" className="bg-muted/30 text-white hover:bg-muted/40">
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
        </header>

        {/* Editor Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {!isPreview ? (
              <RemirrorEditor 
                key={`editor-${document.id}`}
                {...editorProps}
              />
            ) : (
              <div className="p-6 prose prose-lg max-w-none prose-invert">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Toolbar */}
        {editorManager && !isPreview && (
          <FloatingToolbar manager={editorManager} />
        )}
      </div>
      
      {/* Sidebar - Full height, separate column */}
      <SpellCheckSidebar
        isLoading={spellCheckData.isLoading}
        error={spellCheckData.error}
        misspelledWords={spellCheckData.misspelledWords}
        categorizedErrors={spellCheckData.categorizedErrors}
        isOpen={spellCheckSidebarOpen}
        onToggle={toggleSpellCheckSidebar}
        onWordReplace={handleWordReplace}
        onIgnoreWord={handleIgnoreWord}
        onToggleCategory={handleToggleCategory}
        categoryStates={categoryStates}
        focusedWordId={focusedWordId}
        onFocusWord={handleFocusWord}
        onFocusChange={handleFocusChange}
      />
      
      {/* Floating Sidebar Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSpellCheckSidebar}
        className={`fixed top-4 z-50 h-10 w-8 rounded-l-lg rounded-r-none bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 border-r-0 transition-all duration-300 ${
          spellCheckSidebarOpen ? 'right-[32rem]' : 'right-0'
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

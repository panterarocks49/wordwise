import { create } from 'zustand'
import { getUserDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/document-actions'

export interface Document {
  id: string
  title: string
  content: string
  user_id: string
  created_at: string
  updated_at: string
}

interface DocumentStore {
  documents: Document[]
  loading: boolean
  error: string | null
  currentUserId: string | null
  
  // Current document state
  currentDocument: Document | null
  currentTitle: string
  currentContent: string
  contentChangeCount: number // Track external content changes
  
  // Actions
  fetchDocuments: () => Promise<void>
  addDocument: () => Promise<void>
  removeDocument: (documentId: string) => Promise<void>
  updateDocumentInStore: (documentId: string, title: string, content: string) => void
  setDocuments: (documents: Document[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearStore: () => void
  setCurrentUserId: (userId: string | null) => void
  
  // Current document actions
  setCurrentDocument: (document: Document) => void
  updateCurrentTitle: (title: string) => void
  updateCurrentContent: (content: string) => void
  replaceWordInContent: (originalWord: string, replacement: string) => void
  clearCurrentDocument: () => void
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loading: false,
  error: null,
  currentUserId: null,

  currentDocument: null,
  currentTitle: '',
  currentContent: '',
  contentChangeCount: 0,

  fetchDocuments: async () => {
    const { loading } = get()
    if (loading) return // Prevent concurrent fetches
    
    try {
      set({ loading: true, error: null })
      const documents = await getUserDocuments()
      const { currentUserId } = get() // Check if user changed during fetch
      if (currentUserId) { // Only update if we still have a user
        set({ documents, loading: false })
      }
    } catch (error) {
      const { currentUserId } = get()
      if (currentUserId) { // Only update if we still have a user
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch documents',
          loading: false 
        })
      }
    }
  },

  addDocument: async () => {
    const { loading } = get()
    if (loading) return // Prevent concurrent operations
    
    try {
      set({ loading: true, error: null })
      await createDocument()
      // createDocument redirects, so we don't need to update state here
    } catch (error) {
      const { currentUserId } = get()
      if (currentUserId) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to create document',
          loading: false 
        })
      }
    }
  },

  removeDocument: async (documentId: string) => {
    const { loading } = get()
    if (loading) return // Prevent concurrent operations
    
    try {
      set({ loading: true, error: null })
      await deleteDocument(documentId)
      // Remove from local state immediately
      const { documents, currentUserId } = get()
      if (currentUserId) { // Only update if we still have a user
        set({ 
          documents: documents.filter(doc => doc.id !== documentId),
          loading: false 
        })
      }
    } catch (error) {
      const { currentUserId } = get()
      if (currentUserId) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to delete document',
          loading: false 
        })
      }
    }
  },

  updateDocumentInStore: (documentId: string, title: string, content: string) => {
    // This function is called after the document has already been saved to the database
    // So we just need to update the local store state
    const { documents, currentUserId } = get()
    if (currentUserId) { // Only update if we still have a user
      console.log('Updating document in store:', { documentId, title, content: content.substring(0, 50) + '...' })
      set({
        documents: documents.map(doc => 
          doc.id === documentId 
            ? { ...doc, title, content, updated_at: new Date().toISOString() }
            : doc
        )
      })
    }
  },

  setDocuments: (documents: Document[]) => {
    const { currentUserId } = get()
    // Allow setting documents if no user is set yet (initial load) or if user matches
    if (currentUserId === null || currentUserId) {
      set({ documents })
    }
  },
  
  setLoading: (loading: boolean) => {
    const { currentUserId } = get()
    // Allow setting loading state during initial load or when user is set
    if (currentUserId === null || currentUserId) {
      set({ loading })
    }
  },
  
  setError: (error: string | null) => {
    const { currentUserId } = get()
    // Allow setting error state during initial load or when user is set
    if (currentUserId === null || currentUserId) {
      set({ error })
    }
  },
  
  clearStore: () => set({ 
    documents: [], 
    loading: false, 
    error: null, 
    currentUserId: null 
  }),
  
  setCurrentUserId: (userId: string | null) => {
    const { currentUserId } = get()
    // If user changed, clear the store
    if (currentUserId && currentUserId !== userId) {
      set({ 
        documents: [], 
        loading: false, 
        error: null, 
        currentUserId: userId 
      })
    } else {
      set({ currentUserId: userId })
    }
  },

  setCurrentDocument: (document: Document) => {
    set({ currentDocument: document, currentTitle: document.title, currentContent: document.content })
  },

  updateCurrentTitle: (title: string) => {
    set({ currentTitle: title })
  },

  updateCurrentContent: (content: string) => {
    set({ currentContent: content })
  },

  replaceWordInContent: (originalWord: string, replacement: string) => {
    const { currentContent, contentChangeCount } = get()
    if (!currentContent) return
    
    console.log('Store: Replacing word:', originalWord, 'with:', replacement)
    
    // Create a regex to find the word with word boundaries
    const regex = new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const updatedContent = currentContent.replace(regex, replacement)
    
    if (updatedContent !== currentContent) {
      console.log('Store: Content updated with replacement')
      set({ 
        currentContent: updatedContent,
        contentChangeCount: contentChangeCount + 1 // Increment to trigger reactivity
      })
    } else {
      console.log('Store: No changes made - word not found')
    }
  },

  clearCurrentDocument: () => {
    set({ currentDocument: null, currentTitle: '', currentContent: '' })
  },
})) 
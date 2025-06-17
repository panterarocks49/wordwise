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
  
  // Actions
  fetchDocuments: () => Promise<void>
  addDocument: () => Promise<void>
  removeDocument: (documentId: string) => Promise<void>
  updateDocumentInStore: (documentId: string, title: string, content: string) => Promise<void>
  setDocuments: (documents: Document[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearStore: () => void
  setCurrentUserId: (userId: string | null) => void
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loading: false,
  error: null,
  currentUserId: null,

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

  updateDocumentInStore: async (documentId: string, title: string, content: string) => {
    try {
      await updateDocument(documentId, title, content)
      // Update local state
      const { documents, currentUserId } = get()
      if (currentUserId) { // Only update if we still have a user
        set({
          documents: documents.map(doc => 
            doc.id === documentId 
              ? { ...doc, title, content, updated_at: new Date().toISOString() }
              : doc
          )
        })
      }
    } catch (error) {
      const { currentUserId } = get()
      if (currentUserId) {
        set({ 
          error: error instanceof Error ? error.message : 'Failed to update document'
        })
      }
    }
  },

  setDocuments: (documents: Document[]) => {
    const { currentUserId } = get()
    if (currentUserId) {
      set({ documents })
    }
  },
  
  setLoading: (loading: boolean) => {
    const { currentUserId } = get()
    if (currentUserId) {
      set({ loading })
    }
  },
  
  setError: (error: string | null) => {
    const { currentUserId } = get()
    if (currentUserId) {
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
})) 
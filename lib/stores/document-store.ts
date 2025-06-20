import { create } from 'zustand'
import { getUserDocuments, createDocument, updateDocument, deleteDocument } from '@/lib/document-actions'
import { getUserDocumentsClient } from '@/lib/document-client-actions'

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

  currentDocument: null,
  currentTitle: '',
  currentContent: '',
  contentChangeCount: 0,

  fetchDocuments: async () => {
    const { loading } = get()
    if (loading) return
    
    try {
      set({ loading: true, error: null })
      const documents = await getUserDocumentsClient()
      set({ documents, loading: false })
    } catch (error) {
      let errorMessage = 'Failed to fetch documents'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      set({ error: errorMessage, loading: false })
    }
  },

  addDocument: async () => {
    const { loading, documents } = get()
    if (loading) return
    
    try {
      set({ loading: true, error: null })
      console.log("Creating document");
      const newDocument = await createDocument()
      
      // Add the new document to the store immediately
      set({ 
        documents: [newDocument, ...documents],
        loading: false 
      })
      
      // Redirect to the new document on the client side
      window.location.href = `/dashboard/documents/${newDocument.id}`
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create document',
        loading: false 
      })
    }
  },

  removeDocument: async (documentId: string) => {
    const { loading } = get()
    if (loading) return
    
    try {
      set({ loading: true, error: null })
      const result = await deleteDocument(documentId)
      
      if (result.success) {
        const { documents } = get()
        set({ 
          documents: documents.filter(doc => doc.id !== documentId),
          loading: false 
        })
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete document',
        loading: false 
      })
      throw error
    }
  },

  updateDocumentInStore: (documentId: string, title: string, content: string) => {
    const { documents } = get()
    set({
      documents: documents.map(doc => 
        doc.id === documentId 
          ? { ...doc, title, content, updated_at: new Date().toISOString() }
          : doc
      )
    })
  },

  setDocuments: (documents: Document[]) => {
    set({ documents })
  },
  
  setLoading: (loading: boolean) => {
    set({ loading })
  },
  
  setError: (error: string | null) => {
    set({ error })
  },

  setCurrentDocument: (document: Document) => {
    set({ 
      currentDocument: document, 
      currentTitle: document.title, 
      currentContent: document.content,
      contentChangeCount: 0
    })
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
    
    const regex = new RegExp(`\\b${originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const updatedContent = currentContent.replace(regex, replacement)
    
    if (updatedContent !== currentContent) {
      set({ 
        currentContent: updatedContent,
        contentChangeCount: contentChangeCount + 1
      })
    }
  },

  clearCurrentDocument: () => {
    set({ currentDocument: null, currentTitle: '', currentContent: '' })
  },
})) 
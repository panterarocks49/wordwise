"use client"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { useDocumentStore } from "@/lib/stores/document-store"

interface DeleteDocumentButtonProps {
  documentId: string
}

export function DeleteDocumentButton({ documentId }: DeleteDocumentButtonProps) {
  const { removeDocument, loading, error } = useDocumentStore()
  const isMountedRef = useRef(true)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  const handleDelete = async () => {
    if (!isMountedRef.current) return
    
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }
    
    try {
      await removeDocument(documentId)
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to delete document:', error)
        alert('Failed to delete document. Please try again.')
      }
    }
  }

  return (
    <Button 
      onClick={handleDelete}
      disabled={loading}
      size="sm" 
      variant="ghost" 
      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
} 
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import { useDocumentStore } from "@/lib/stores/document-store"

interface DeleteDocumentButtonProps {
  documentId: string
}

export function DeleteDocumentButton({ documentId }: DeleteDocumentButtonProps) {
  const { removeDocument, loading } = useDocumentStore()
  const [isDeleting, setIsDeleting] = useState(false)
  
  const handleDelete = async () => {
    console.log('handleDelete called, isDeleting:', isDeleting);
    if (isDeleting) return
    
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }
    
    try {
      setIsDeleting(true)
      console.log('Starting delete operation for document:', documentId);
      await removeDocument(documentId)
      console.log('Delete operation completed successfully');
    } catch (error) {
      console.error('Failed to delete document:', error)
      alert('Failed to delete document. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button 
      onClick={handleDelete}
      disabled={loading || isDeleting}
      size="sm" 
      variant="ghost" 
      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 disabled:opacity-50"
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  )
} 
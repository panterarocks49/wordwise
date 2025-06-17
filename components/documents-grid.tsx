"use client"

import { useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Edit, Plus } from "lucide-react"
import { useDocumentStore, Document } from '@/lib/stores/document-store'
import { DeleteDocumentButton } from './delete-document-button'
import Link from "next/link"

interface DocumentsGridProps {
  initialDocuments: Document[]
  userId: string
}

export function DocumentsGrid({ initialDocuments, userId }: DocumentsGridProps) {
  const { 
    documents, 
    loading, 
    error, 
    fetchDocuments, 
    addDocument, 
    setDocuments,
    setCurrentUserId
  } = useDocumentStore()
  const isMountedRef = useRef(true)
  const initializedRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Handle user changes
  useEffect(() => {
    if (userId && isMountedRef.current) {
      setCurrentUserId(userId)
    }
  }, [userId, setCurrentUserId])

  // Initialize store with server-side data - only once per user
  useEffect(() => {
    if (
      isMountedRef.current && 
      !initializedRef.current && 
      initialDocuments.length >= 0 && 
      documents.length === 0
    ) {
      setDocuments(initialDocuments)
      initializedRef.current = true
    }
  }, [initialDocuments, documents.length, setDocuments])

  // Reset initialization flag when user changes
  useEffect(() => {
    initializedRef.current = false
  }, [userId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPreview = (content: string) => {
    // Remove markdown formatting and get first 100 characters
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*([^*]*)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]*)\*/g, '$1') // Remove italic
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Remove links
      .replace(/```[\s\S]*?```/g, '[Code Block]') // Replace code blocks
      .replace(/`([^`]*)`/g, '$1') // Remove inline code
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
    
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText
  }

  const handleCreateDocument = async () => {
    if (!isMountedRef.current) return
    await addDocument()
  }

  const handleTryAgain = async () => {
    if (!isMountedRef.current) return
    await fetchDocuments()
  }

  if (error) {
    return (
      <Card className="bg-[#222] border-gray-700">
        <CardContent className="p-12">
          <div className="text-center text-red-400">
            <p className="text-xl mb-3">Error loading documents</p>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={handleTryAgain} className="bg-[#2b725e] hover:bg-[#235e4c]">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Header with Create Button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold">Your Documents</h2>
          <p className="text-gray-400 mt-1">
            {loading ? 'Loading...' : documents.length === 0 ? 'No documents yet' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button 
          onClick={handleCreateDocument}
          disabled={loading}
          size="lg" 
          className="bg-[#2b725e] hover:bg-[#235e4c]"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Document
        </Button>
      </div>

      {/* Documents Grid */}
      {documents.length === 0 && !loading ? (
        <Card className="bg-[#222] border-gray-700">
          <CardContent className="p-12">
            <div className="text-center text-gray-400">
              <FileText className="h-20 w-20 mx-auto mb-6 opacity-50" />
              <p className="text-xl mb-3">No documents yet</p>
              <p className="text-gray-500 mb-6">Create your first API documentation to get started</p>
              <Button 
                onClick={handleCreateDocument}
                disabled={loading}
                size="lg" 
                className="bg-[#2b725e] hover:bg-[#235e4c] px-8 py-3"
              >
                <FileText className="h-5 w-5 mr-2" />
                Create New Document
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <Card key={doc.id} className="bg-[#222] border-gray-700 hover:border-gray-600 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle 
                  className="text-lg text-white"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {doc.title || 'Untitled Document'}
                </CardTitle>
                <div className="flex items-center text-xs text-gray-400 space-x-4">
                  <span>Updated {formatDate(doc.updated_at)}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p 
                  className="text-gray-300 text-sm mb-4"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {getPreview(doc.content)}
                </p>
                <div className="flex items-center justify-between">
                  <Link href={`/dashboard/documents/${doc.id}`}>
                    <Button size="sm" className="bg-[#2b725e] hover:bg-[#235e4c]">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  <DeleteDocumentButton documentId={doc.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
} 
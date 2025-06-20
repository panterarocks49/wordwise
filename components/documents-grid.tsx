"use client"

import { useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Edit, Plus, RefreshCw } from "lucide-react"
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
    setDocuments
  } = useDocumentStore()
  
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Initialize with server data if we don't have any documents
  useEffect(() => {
    if (documents.length === 0 && initialDocuments.length > 0) {
      setDocuments(initialDocuments)
    } else if (documents.length === 0 && !loading) {
      fetchDocuments()
    }
  }, [documents.length, initialDocuments, setDocuments, fetchDocuments, loading])

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
    if (!content) return 'Empty document'
    
    try {
      // Try to parse as JSON (Remirror document)
      const doc = JSON.parse(content)
      
      if (doc && typeof doc === 'object') {
        // Extract text from Remirror/ProseMirror JSON document
        const extractTextFromNode = (node: any): string => {
          if (!node) return ''
          
          let text = ''
          
          // If it's a text node, return the text
          if (node.type === 'text' && node.text) {
            return node.text
          }
          
          // If the node has direct text property (some node types)
          if (node.text && typeof node.text === 'string') {
            return node.text
          }
          
          // If it has content (array of child nodes), process them recursively
          if (node.content && Array.isArray(node.content)) {
            const childTexts = node.content.map(extractTextFromNode).filter((t: string) => t.length > 0)
            
            // Add spacing for block elements
            if (node.type && ['paragraph', 'heading', 'blockquote', 'listItem'].includes(node.type)) {
              return childTexts.join('') + (childTexts.length > 0 ? '\n' : '')
            } else {
              return childTexts.join('')
            }
          }
          
          // Handle case where content might be at the root level
          if (Array.isArray(node)) {
            return node.map(extractTextFromNode).join('')
          }
          
          return text
        }
        
        // Start extraction from the document
        let plainText = ''
        
        // Handle different possible document structures
        if (doc.content) {
          plainText = extractTextFromNode(doc)
        } else if (doc.type) {
          plainText = extractTextFromNode(doc)
        } else if (Array.isArray(doc)) {
          plainText = doc.map(extractTextFromNode).join('')
        } else {
          // Try to extract from any property that might contain content
          for (const key of Object.keys(doc)) {
            const value = doc[key]
            if (value && (Array.isArray(value) || (typeof value === 'object' && value.type))) {
              plainText += extractTextFromNode(value)
            }
          }
        }
        
        plainText = plainText.trim()
        
        // If we successfully parsed JSON but got no meaningful text, it's an empty document
        if (plainText.length > 0) {
          return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText
        } else {
          // This handles cases like {"type":"doc","content":[{"type":"paragraph"}]}
          return 'Empty document'
        }
      }
    } catch (e) {
      // If JSON parsing fails, treat as plain text (fallback)
      console.warn('Failed to parse document content as JSON:', e)
    }
    
    // Fallback for non-JSON content
    const plainText = content.trim()
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText || 'Empty document'
  }

  const handleCreateDocument = async () => {
    if (!isMountedRef.current) return
    await addDocument()
  }

  const handleTryAgain = async () => {
    if (!isMountedRef.current) return
    await fetchDocuments()
  }

  // Show loading state only if we're loading and have no documents
  const isLoading = loading && documents.length === 0

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
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Your Documents</h2>
            <p className="text-gray-400 mt-1">
              {isLoading ? 'Loading...' : documents.length === 0 ? 'No documents yet' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            onClick={handleTryAgain}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="border-gray-600 hover:bg-gray-700"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button 
          onClick={handleCreateDocument}
          disabled={isLoading}
          size="lg" 
          className="bg-[#2b725e] hover:bg-[#235e4c]"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Document
        </Button>
      </div>

      {/* Documents Grid */}
      {documents.length === 0 && !isLoading ? (
        <Card className="bg-[#222] border-gray-700">
          <CardContent className="p-12">
            <div className="text-center text-gray-400">
              <FileText className="h-20 w-20 mx-auto mb-6 opacity-50" />
              <p className="text-xl mb-3">No documents yet</p>
              <p className="text-gray-500 mb-6">Create your first API documentation to get started</p>
              <Button 
                onClick={handleCreateDocument}
                disabled={isLoading}
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
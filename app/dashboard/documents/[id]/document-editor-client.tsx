"use client"

import dynamic from "next/dynamic"

// Import DocumentEditor with SSR disabled
const DocumentEditor = dynamic(() => import("@/components/document-editor"), {
  ssr: false
})

interface DocumentEditorClientProps {
  document: {
    id: string
    title: string
    content: string
    created_at: string
    updated_at: string
  }
}

export default function DocumentEditorClient({ document }: DocumentEditorClientProps) {
  return <DocumentEditor document={document} />
} 
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import DocumentEditor from "@/components/document-editor"

interface DocumentPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  // Await params for Next.js 15 compatibility
  const { id } = await params
  
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch the document
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user owns the document
    .single()

  if (error || !document) {
    notFound()
  }

  return <DocumentEditor document={document} />
}

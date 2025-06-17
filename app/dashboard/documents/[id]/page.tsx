import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import DocumentEditor from "@/components/document-editor"

interface DocumentPageProps {
  params: {
    id: string
  }
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const supabase = createClient()

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
    .eq("id", params.id)
    .eq("user_id", user.id) // Ensure user owns the document
    .single()

  if (error || !document) {
    notFound()
  }

  return <DocumentEditor document={document} />
}

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function NewDocumentPage() {
  const supabase = createClient()

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Create a new document directly in the page
  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      title: "Untitled Document",
      content: "# Welcome to Lucid Docs\n\nStart writing your API documentation here...",
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating document:", error)
    redirect("/dashboard?error=failed-to-create-document")
  }

  // Redirect to the new document
  redirect(`/dashboard/documents/${document.id}`)
}

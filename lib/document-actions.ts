"use server"

import { createServerActionClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function createDocument() {
  const cookieStore = cookies()
  const supabase = createServerActionClient({ cookies: () => cookieStore })

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Create a new document
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
    throw new Error("Failed to create document")
  }

  // Redirect to the new document
  redirect(`/dashboard/documents/${document.id}`)
}

export async function updateDocument(documentId: string, title: string, content: string) {
  const cookieStore = cookies()
  const supabase = createServerActionClient({ cookies: () => cookieStore })

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  // Update the document
  const { error } = await supabase
    .from("documents")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("user_id", user.id) // Ensure user owns the document

  if (error) {
    console.error("Error updating document:", error)
    throw new Error("Failed to update document")
  }
}

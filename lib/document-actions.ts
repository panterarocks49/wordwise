"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function createDocument() {
  const supabase = await createClient()

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
  const supabase = await createClient()

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

export async function getUserDocuments() {
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  // Fetch all documents for the current user
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error fetching documents:", error)
    throw new Error("Failed to fetch documents")
  }

  return documents || []
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("User not authenticated")
  }

  // Delete the document
  const { count, error } = await supabase
    .from("documents")
    .delete({ count: "exact" })
    .eq("id", documentId)
    .eq("user_id", user.id) // Ensure user owns the document

  if (error) {
    console.error("Error deleting document:", error)
    throw new Error("Failed to delete document")
  }

  if (count === 0) {
    throw new Error("Failed to delete document. It may have already been deleted.")
  }

  // Revalidate the dashboard path to ensure the document list is updated
  revalidatePath("/dashboard", "layout")
  
  // Don't redirect here - let the client handle the UI update
  return { success: true }
}

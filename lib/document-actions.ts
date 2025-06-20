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
      content: "",
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating document:", error)
    throw new Error("Failed to create document")
  }

  // Return the document instead of redirecting
  return document
}

export async function updateDocument(documentId: string, title: string, content: string) {
  console.log('Server Action - updateDocument called:', {
    documentId,
    title,
    contentLength: content.length,
    contentPreview: content.substring(0, 100) + '...',
    timestamp: new Date().toISOString()
  })
  
  const supabase = await createClient()

  // Get the current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('Server Action - User not authenticated:', userError)
    throw new Error("User not authenticated")
  }

  console.log('Server Action - User authenticated:', user.id)

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
    console.error("Server Action - Error updating document:", error)
    throw new Error("Failed to update document")
  }

  console.log('Server Action - Document updated successfully')
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

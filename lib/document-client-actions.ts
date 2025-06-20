"use client"

import { createClient } from "@/lib/supabase/client"
import { Document } from "@/lib/stores/document-store"

// Client-safe version that doesn't cause NEXT_REDIRECT errors
export async function getUserDocumentsClient(): Promise<Document[]> {
  try {
    const supabase = createClient()

    // Get the current user - this won't redirect on client-side
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error("Authentication error:", userError)
      throw new Error("Authentication failed. Please refresh the page and try again.")
    }

    if (!user) {
      throw new Error("Please log in to view your documents.")
    }

    // Fetch all documents for the current user
    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Error fetching documents:", error)
      throw new Error("Failed to load documents. Please try again.")
    }

    return documents || []
  } catch (error) {
    // Handle any authentication or fetch errors gracefully
    console.error("Client-side document fetch error:", error)
    
    // Re-throw with a user-friendly message if it's not already user-friendly
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error("An unexpected error occurred while loading documents.")
    }
  }
} 
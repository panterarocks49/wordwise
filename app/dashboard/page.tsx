import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { signOut } from "@/lib/actions"
import { getUserDocuments } from "@/lib/document-actions"
import { DocumentsGrid } from "@/components/documents-grid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, FileText, Clock } from "lucide-react"

export default async function Dashboard() {
  const supabase = createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect("/auth/login")
  }

  let documents = []
  let error = null

  try {
    documents = await getUserDocuments()
  } catch (err) {
    console.error("Failed to fetch documents:", err)
    error = "Failed to load documents. Please try refreshing the page."
  }

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Lucid Docs Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Welcome, {user.email?.split("@")[0]}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <DocumentsGrid initialDocuments={documents} userId={user.id} />
      </div>
    </div>
  )
}

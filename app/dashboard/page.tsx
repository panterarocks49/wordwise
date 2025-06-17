import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LogOut, FileText } from "lucide-react"
import { signOut } from "@/lib/actions"
import { createDocument } from "@/lib/document-actions"

export default async function Dashboard() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
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
        {/* Recent Documents */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Documents</h2>
          <Card className="bg-[#222] border-gray-700">
            <CardContent className="p-6">
              <div className="text-center text-gray-400 py-12">
                <FileText className="h-20 w-20 mx-auto mb-6 opacity-50" />
                <p className="text-xl mb-3">No documents yet</p>
                <p className="text-gray-500 mb-6">Create your first API documentation to get started</p>
                <form action={createDocument}>
                  <Button type="submit" size="lg" className="bg-[#2b725e] hover:bg-[#235e4c] px-8 py-3">
                    <FileText className="h-5 w-5 mr-2" />
                    Create New Document
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

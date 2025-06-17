import { Button } from "@/components/ui/button"
import { FileX, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function DocumentNotFound() {
  return (
    <div className="min-h-screen bg-[#161616] text-white flex items-center justify-center">
      <div className="text-center">
        <FileX className="h-24 w-24 mx-auto mb-6 text-gray-500" />
        <h1 className="text-3xl font-bold mb-4">Document Not Found</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          The document you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <Button asChild className="bg-[#2b725e] hover:bg-[#235e4c]">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}

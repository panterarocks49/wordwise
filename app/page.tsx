import { createClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Zap, Shield, ArrowRight, BookOpen, AlertTriangle, Clock, Target, Star } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function LandingPage() {
  // If Supabase is not configured, show setup message
  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616]">
        <h1 className="text-2xl font-bold mb-4 text-white">Connect Supabase to get started</h1>
      </div>
    )
  }

  // Check if user is already logged in
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is logged in, redirect directly to dashboard
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#161616] text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-8 w-8 text-[#2b725e]" />
            <span className="text-2xl font-bold">Lucid Docs</span>
          </div>
          <div className="space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-[#2b725e] hover:bg-[#235e4c]">
              <Link href="/auth/sign-up">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="mb-6">
            <span className="bg-[#2b725e]/20 text-[#2b725e] px-4 py-2 rounded-full text-sm font-medium">
              ✨ The Grammarly for API Documentation
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Stop Writing <span className="text-red-400">Incomplete</span>
            <br />
            API Documentation
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-4xl mx-auto leading-relaxed">
            Lucid Docs is the first writing assistant built specifically for API documentation writers. Get real-time
            suggestions for completeness, consistency, and clarity—so your developers never have to guess how your API
            works.
          </p>
          <div className="space-x-4 mb-12">
            <Button size="lg" asChild className="bg-[#2b725e] hover:bg-[#235e4c] text-white px-8 py-4 text-lg">
              <Link href="/auth/sign-up">
                Start Writing Better Docs
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <div className="text-sm text-gray-500">
            ✓ Free 14-day trial • ✓ No credit card required • ✓ Cancel anytime
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-[#1a1a1a]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">The Hidden Cost of Poor API Documentation</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Every incomplete endpoint description, inconsistent parameter name, and missing example costs your team
              hours of support tickets and frustrated developers.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-[#222] border-red-900/50">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-12 w-12 text-red-400 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-3 text-white">73% of Developers</h3>
                <p className="text-gray-400">
                  abandon APIs due to poor documentation, according to SmartBear's 2023 State of API report.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#222] border-orange-900/50">
              <CardContent className="p-6 text-center">
                <Clock className="h-12 w-12 text-orange-400 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-3 text-white">8+ Hours Weekly</h3>
                <p className="text-gray-400">
                  spent by engineering teams answering questions that should be in your API docs.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#222] border-yellow-900/50">
              <CardContent className="p-6 text-center">
                <Target className="h-12 w-12 text-yellow-400 mb-4 mx-auto" />
                <h3 className="text-xl font-semibold mb-3 text-white">45% Slower</h3>
                <p className="text-gray-400">
                  developer onboarding when API documentation lacks completeness and consistency.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">Lucid Docs Solves This</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Like Grammarly for regular writing, Lucid Docs provides intelligent, real-time suggestions specifically
              designed for API documentation challenges.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-[#222] border-gray-700 hover:border-[#2b725e]/50 transition-colors">
              <CardContent className="p-6">
                <Zap className="h-12 w-12 text-[#2b725e] mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-white">Smart Completeness Checking</h3>
                <p className="text-gray-400 mb-4">
                  AI analyzes your endpoint docs and flags missing sections like error codes, authentication
                  requirements, and request/response examples.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• Missing parameter descriptions</li>
                  <li>• Incomplete error handling</li>
                  <li>• Missing code examples</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="bg-[#222] border-gray-700 hover:border-[#2b725e]/50 transition-colors">
              <CardContent className="p-6">
                <CheckCircle className="h-12 w-12 text-[#2b725e] mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-white">Consistency Validation</h3>
                <p className="text-gray-400 mb-4">
                  Automatically detect inconsistent terminology, parameter naming, and response formats across all your
                  API endpoints.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• Parameter naming conflicts</li>
                  <li>• Inconsistent response formats</li>
                  <li>• Terminology variations</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="bg-[#222] border-gray-700 hover:border-[#2b725e]/50 transition-colors">
              <CardContent className="p-6">
                <Shield className="h-12 w-12 text-[#2b725e] mb-4" />
                <h3 className="text-xl font-semibold mb-3 text-white">OpenAPI Sync</h3>
                <p className="text-gray-400 mb-4">
                  Connect your OpenAPI specifications to catch discrepancies between your prose documentation and actual
                  API implementation.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li>• Schema drift detection</li>
                  <li>• Endpoint documentation gaps</li>
                  <li>• Version synchronization</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-[#1a1a1a]">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">How Lucid Docs Works</h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="bg-[#2b725e] rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Write Naturally</h3>
              <p className="text-gray-400 leading-relaxed">
                Use our intuitive editor to write your API documentation. No special formatting required—just write like
                you normally would.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-[#2b725e] rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Get Smart Suggestions</h3>
              <p className="text-gray-400 leading-relaxed">
                Lucid Docs analyzes your content in real-time, suggesting improvements for completeness, consistency,
                and clarity specific to API docs.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-[#2b725e] rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-4">Ship with Confidence</h3>
              <p className="text-gray-400 leading-relaxed">
                Publish documentation that developers actually want to use, reducing support tickets and accelerating
                API adoption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-12">Trusted by API Teams</h2>
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <Card className="bg-[#222] border-gray-700">
              <CardContent className="p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Lucid Docs caught 12 missing parameter descriptions in our payment API docs. Our developer support
                  tickets dropped by 60% after fixing them."
                </p>
                <div className="text-sm text-gray-400">
                  <div className="font-semibold">Sarah Chen</div>
                  <div>API Product Manager, FinTech Startup</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#222] border-gray-700">
              <CardContent className="p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "The consistency checking is incredible. It found parameter naming conflicts across 15 endpoints that
                  we never would have caught manually."
                </p>
                <div className="text-sm text-gray-400">
                  <div className="font-semibold">Marcus Rodriguez</div>
                  <div>Senior Technical Writer, SaaS Platform</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#222] border-gray-700">
              <CardContent className="p-6">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Our developer onboarding time went from 2 weeks to 3 days after improving our API docs with Lucid
                  Docs' suggestions."
                </p>
                <div className="text-sm text-gray-400">
                  <div className="font-semibold">Alex Thompson</div>
                  <div>Engineering Manager, E-commerce API</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="py-20 px-4 bg-[#1a1a1a]">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Everything You Need for Better API Docs</h2>
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h3 className="text-2xl font-bold mb-4">Real-time Grammar & Style</h3>
              <p className="text-gray-400 mb-6">
                Built on proven grammar checking libraries with custom rules for technical writing. Catch typos, improve
                clarity, and maintain professional tone.
              </p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#2b725e] mr-2" /> Advanced spell checking with technical terms
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#2b725e] mr-2" /> Style suggestions for technical writing
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#2b725e] mr-2" /> Custom terminology dictionaries
                </li>
              </ul>
            </div>
            <div className="bg-[#222] p-6 rounded-lg border border-gray-700">
              <div className="text-sm text-gray-400 mb-2">Lucid Docs Suggestion</div>
              <div className="bg-[#1a1a1a] p-4 rounded border-l-4 border-[#2b725e]">
                <p className="text-white">
                  Consider adding an example request body for the POST /users endpoint. Developers need to see the
                  expected JSON structure.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-[#222] p-6 rounded-lg border border-gray-700 order-2 md:order-1">
              <div className="text-sm text-gray-400 mb-2">Completeness Score</div>
              <div className="bg-[#1a1a1a] p-4 rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">GET /api/users</span>
                  <span className="text-[#2b725e] font-bold">85%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-[#2b725e] h-2 rounded-full" style={{ width: "85%" }}></div>
                </div>
                <p className="text-sm text-gray-400 mt-2">Missing: Error codes, Rate limiting info</p>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-2xl font-bold mb-4">AI-Powered Completeness Analysis</h3>
              <p className="text-gray-400 mb-6">
                Our AI analyzes each endpoint against best practices for API documentation, scoring completeness and
                suggesting specific improvements.
              </p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#2b725e] mr-2" /> Missing section detection
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#2b725e] mr-2" /> Completeness scoring per endpoint
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-[#2b725e] mr-2" /> Best practice recommendations
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Write Documentation Developers Actually Use?</h2>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Join hundreds of API teams who've reduced support tickets and accelerated developer adoption with better
            documentation.
          </p>
          <div className="space-x-4 mb-8">
            <Button size="lg" asChild className="bg-[#2b725e] hover:bg-[#235e4c] text-white px-8 py-4 text-lg">
              <Link href="/auth/sign-up">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <div className="text-sm text-gray-500">✓ 14-day free trial • ✓ No setup required • ✓ Cancel anytime</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <BookOpen className="h-6 w-6 text-[#2b725e]" />
                <span className="text-xl font-bold">Lucid Docs</span>
              </div>
              <p className="text-gray-400 text-sm">
                The writing assistant built specifically for API documentation writers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Integrations
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    API Reference
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Best Practices
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="#" className="hover:text-white">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2024 Lucid Docs. Built for API documentation writers who care about quality.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

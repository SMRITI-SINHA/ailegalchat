import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  FileText,
  MessageSquare,
  FileEdit,
  Shield,
  Zap,
  Brain,
  IndianRupee,
  CheckCircle2,
  ArrowRight,
  Upload,
  Search,
  BookOpen,
} from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Document Processing",
    description: "Upload PDFs, scanned documents, and Word files. Our AI processes up to 600+ pages with 95%+ OCR accuracy.",
  },
  {
    icon: MessageSquare,
    title: "Intelligent Chat",
    description: "Ask questions about your legal documents. Get answers with inline citations and confidence scores.",
  },
  {
    icon: FileEdit,
    title: "Legal Drafting",
    description: "Generate petitions, notices, contracts, and more. AI-powered drafting with proper legal formatting.",
  },
  {
    icon: Search,
    title: "Case Research",
    description: "Search through precedents and case law. Find relevant judgments with similarity scoring.",
  },
  {
    icon: Brain,
    title: "Multi-Layer RAG",
    description: "Smart model routing: fast answers for simple queries, deep reasoning for complex legal matters.",
  },
  {
    icon: Shield,
    title: "Hallucination Prevention",
    description: "Every claim is verified against source documents. Citations are checked for accuracy.",
  },
];

const pricingHighlights = [
  { label: "Average query cost", value: "0.40", currency: true },
  { label: "Document processing", value: "1.00", currency: true },
  { label: "Pages supported", value: "600+", currency: false },
  { label: "Uptime guarantee", value: "99%", currency: false },
];

const trustedBy = [
  "Leading Law Firms",
  "Corporate Legal Teams",
  "Legal Researchers",
  "Law Students",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">Chakshi</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/hub">
              <Button data-testid="button-get-started">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 relative">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4">
              AI-Powered Legal Assistant
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight">
              Your Intelligent{" "}
              <span className="text-primary">Legal Assistant</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Draft faster, research smarter. Chakshi helps lawyers and legal professionals 
              process documents, conduct research, and draft legal documents with AI precision.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/hub">
                <Button size="lg" data-testid="button-start-free">
                  Start Free Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button size="lg" variant="outline">
                  See How It Works
                </Button>
              </a>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-6">
              <p className="text-sm text-muted-foreground">Trusted by:</p>
              {trustedBy.map((name) => (
                <span key={name} className="text-sm font-medium text-muted-foreground">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">
              Everything You Need for Legal Work
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Powerful features built to enhance your drafting and research capabilities
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="hover-elevate">
                <CardHeader>
                  <div className="p-2 rounded-md bg-primary/10 w-fit mb-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">
              Simple, Powerful Workflow
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-semibold text-primary">1</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
              <p className="text-muted-foreground">
                Drag and drop your legal documents. PDFs, Word files, and scanned images are all supported.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-semibold text-primary">2</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Ask Questions</h3>
              <p className="text-muted-foreground">
                Chat with your documents. Get accurate answers with citations and confidence scores.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-semibold text-primary">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Draft & Export</h3>
              <p className="text-muted-foreground">
                Generate legal documents with proper formatting. Export to Word or PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">
              Cost-Optimized for Real Use
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Pay only for what you use. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {pricingHighlights.map((item) => (
              <Card key={item.label} className="text-center">
                <CardContent className="pt-6">
                  <p className="text-3xl font-semibold">
                    {item.currency && <IndianRupee className="inline h-6 w-6" />}
                    {item.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 max-w-2xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Ready to get started?</h3>
                    <p className="text-muted-foreground">
                      Start processing documents and asking questions today.
                    </p>
                  </div>
                  <Link href="/hub">
                    <Button size="lg" data-testid="button-try-free">
                      Try Free Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Badge variant="outline" className="mb-4">Security</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold">
              Enterprise-Grade Security
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Shield, title: "End-to-End Encryption", desc: "All documents are encrypted in transit and at rest" },
              { icon: BookOpen, title: "Audit Trail", desc: "Complete logging of all AI operations for compliance" },
              { icon: Zap, title: "Auto-Delete", desc: "Documents auto-delete after 7 days for privacy" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <span className="font-semibold">Chakshi</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built for legal professionals. Powered by AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

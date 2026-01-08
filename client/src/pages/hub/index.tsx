import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSignature,
  File,
  Palette,
  GraduationCap,
  Bot,
  FileText,
  Scale,
  Search,
  Scroll,
  ClipboardCheck,
  ArrowRight,
  Sparkles,
  Play,
} from "lucide-react";

const draftingCards = [
  {
    title: "AI Legal Drafting",
    description: "Start by drafting and do legal research side by side",
    icon: FileSignature,
    url: "/hub/drafting/ai",
    tags: ["Research", "Citations"],
  },
  {
    title: "Empty Document",
    description: "Start with an empty document without a prompt",
    icon: File,
    url: "/hub/drafting/empty",
    tags: ["Quick Start"],
  },
  {
    title: "Review Your Draft",
    description: "Upload your own draft and edit with AI assistance",
    icon: Palette,
    url: "/hub/drafting/custom",
    tags: ["Upload", "Edit"],
  },
  {
    title: "Upload your Draft",
    description: "Upload your own draft and start using drafting and legal research on Draft Bot Pro",
    icon: FileText,
    url: "/hub/drafting/custom",
    tags: ["Import"],
  },
];

const researchCards = [
  {
    title: "AI Legal Research",
    description: "Do accurate legal research by talking to our AI. Get sources and cases for each answer",
    icon: Search,
    url: "/hub/research/assistant",
    tags: ["Indian Kanoon", "Citations"],
  },
  {
    title: "Legal Memo",
    description: "Prepare comprehensive Legal Memo with citations",
    icon: Scroll,
    url: "/hub/research/memo",
    tags: ["IRAC", "Formal"],
  },
  {
    title: "Chat with PDF",
    description: "Upload a PDF and prepare list of dates, summarize it, ask questions about it etc.",
    icon: FileText,
    url: "/hub/chat/pdf",
    tags: ["Documents", "Analysis"],
  },
  {
    title: "Generate Arguments",
    description: "Tell Draft Bot Pro about the case or upload a PDF and generate arguments for your case",
    icon: Scale,
    url: "/hub/chat/nyaya",
    tags: ["Strategy", "Counter-Args"],
  },
];

const tutorialVideos = [
  { title: "Prepare List of Dates and Chat with PDF", description: "Chat with PDF / Document Review", icon: Play },
  { title: "Upload Your Draft", description: "Upload your Draft", icon: Play },
  { title: "Generate Arguments and Counter-Arguments", description: "Generate Arguments", icon: Play },
];

export default function HubPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-md bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Chakshi AI Hub</h1>
          <p className="text-muted-foreground">Your complete legal AI workspace</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Draft</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {draftingCards.map((card) => (
            <Link key={card.url + card.title} href={card.url}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-hub-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <card.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{card.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Research</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {researchCards.map((card) => (
            <Link key={card.url + card.title} href={card.url}>
              <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-hub-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <card.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{card.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">How to use Chakshi</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tutorialVideos.map((video, i) => (
            <Card key={i} className="hover-elevate cursor-pointer bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center h-40">
                <div className="p-3 rounded-full bg-primary/20 mb-3">
                  <video.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">{video.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{video.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="pt-4">
        <Card className="bg-muted/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="font-semibold">Train Your Drafts</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload your firm's SOPs, playbooks, and past drafts to help Chakshi understand your preferred style
                </p>
              </div>
              <Link href="/hub/drafting/train">
                <Button data-testid="button-train-drafts">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Setup Training
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

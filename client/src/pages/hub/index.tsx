import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
  Brain,
  Swords,
  FlaskConical,
  MessageSquare,
  StickyNote,
} from "lucide-react";

const draftingCards = [
  {
    title: "AI Legal Drafting",
    description: "Draft with AI research panel integration",
    icon: FileSignature,
    url: "/hub/drafting/ai",
  },
  {
    title: "Empty Document",
    description: "Start with an empty document",
    icon: File,
    url: "/hub/drafting/empty",
  },
  {
    title: "Custom Drafting",
    description: "Upload your own format/template",
    icon: Palette,
    url: "/hub/drafting/custom",
  },
  {
    title: "Train Your Drafts",
    description: "Upload firm SOPs to train AI",
    icon: GraduationCap,
    url: "/hub/drafting/train",
  },
];

const chatCards = [
  {
    title: "CNR Chatbot",
    description: "Case status lookup",
    icon: Bot,
    url: "/hub/chat/cnr",
  },
  {
    title: "Chat with PDF",
    description: "Upload documents (800+ pages), generate timelines",
    icon: FileText,
    url: "/hub/chat/pdf",
  },
  {
    title: "Nyaya AI",
    description: "General legal assistant trained on 1000+ documents",
    icon: Scale,
    url: "/hub/chat/nyaya",
  },
];

const researchCards = [
  {
    title: "AI Research Assistant",
    description: "Indian Kanoon API for statute/case law search",
    icon: Search,
    url: "/hub/research/assistant",
  },
  {
    title: "Legal Memo Generator",
    description: "IRAC structured memos with hallucination guard",
    icon: Scroll,
    url: "/hub/research/memo",
  },
  {
    title: "Compliance Checklist",
    description: "Industry-specific checklists with legal references",
    icon: ClipboardCheck,
    url: "/hub/research/compliance",
  },
  {
    title: "Saved Notes",
    description: "View and manage all your research notes",
    icon: StickyNote,
    url: "/hub/research/notes",
  },
];

const studyBuddyCards = [
  {
    title: "Case Predict AI",
    description: "Predict case outcomes with detailed reasoning",
    icon: Brain,
    url: "/hub/study/case-predict",
    isBeta: true,
  },
  {
    title: "Counter Arguments",
    description: "Develop opposing viewpoints and rebuttals",
    icon: Swords,
    url: "/hub/study/counter-args",
    isBeta: true,
  },
  {
    title: "Legal Sandbox",
    description: "Moot courts, entrance prep, legal simulations",
    icon: FlaskConical,
    url: "/hub/study/sandbox",
    isBeta: true,
  },
];

const tutorialVideos = [
  { title: "Prepare List of Dates", description: "Chat with PDF / Document Review", icon: Play },
  { title: "Upload Your Draft", description: "Upload your Draft", icon: Play },
  { title: "Generate Arguments", description: "Generate Arguments", icon: Play },
];

function FeatureCard({ card, isBeta = false }: { card: any; isBeta?: boolean }) {
  return (
    <Link href={card.url}>
      <Card
        className="hover-elevate cursor-pointer h-full relative"
        data-testid={`card-hub-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {isBeta && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
            Beta
          </Badge>
        )}
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
  );
}

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
        <h2 className="text-lg font-semibold mb-4">Drafting</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {draftingCards.map((card) => (
            <FeatureCard key={card.url} card={card} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">AI Chat</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chatCards.map((card) => (
            <FeatureCard key={card.url} card={card} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Research</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {researchCards.map((card) => (
            <FeatureCard key={card.url} card={card} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Study Buddy</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studyBuddyCards.map((card) => (
            <FeatureCard key={card.url} card={card} isBeta={card.isBeta} />
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
    </div>
  );
}

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import HubPage from "@/pages/hub";
import AIDraftingPage from "@/pages/hub/drafting-ai";
import EmptyDraftPage from "@/pages/hub/drafting-empty";
import CustomDraftPage from "@/pages/hub/drafting-custom";
import TrainDraftsPage from "@/pages/hub/drafting-train";
import CNRChatPage from "@/pages/hub/chat-cnr";
import ChatWithPDFPage from "@/pages/hub/chat-pdf";
import NyayaAIPage from "@/pages/hub/chat-nyaya";
import ResearchAssistantPage from "@/pages/hub/research-assistant";
import LegalMemoPage from "@/pages/hub/research-memo";
import ComplianceChecklistPage from "@/pages/hub/research-compliance";
import ResearchNotesPage from "@/pages/hub/research-notes";
import CasePredictPage from "@/pages/hub/study-case-predict";
import CounterArgsPage from "@/pages/hub/study-counter-args";
import LegalSandboxPage from "@/pages/hub/study-sandbox";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-full">
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={HubPage} />
        <Route path="/hub" component={HubPage} />
        <Route path="/hub/drafting/ai" component={AIDraftingPage} />
        <Route path="/hub/drafting/empty" component={EmptyDraftPage} />
        <Route path="/hub/drafting/custom" component={CustomDraftPage} />
        <Route path="/hub/drafting/train" component={TrainDraftsPage} />
        <Route path="/hub/chat/cnr" component={CNRChatPage} />
        <Route path="/hub/chat/pdf" component={ChatWithPDFPage} />
        <Route path="/hub/chat/nyaya" component={NyayaAIPage} />
        <Route path="/hub/research/assistant" component={ResearchAssistantPage} />
        <Route path="/hub/research/memo" component={LegalMemoPage} />
        <Route path="/hub/research/compliance" component={ComplianceChecklistPage} />
        <Route path="/hub/research/notes" component={ResearchNotesPage} />
        <Route path="/hub/study/case-predict" component={CasePredictPage} />
        <Route path="/hub/study/counter-args" component={CounterArgsPage} />
        <Route path="/hub/study/sandbox" component={LegalSandboxPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

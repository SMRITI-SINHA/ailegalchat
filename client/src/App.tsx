import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
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
import LegalCalendarPage from "@/pages/hub/calendar";

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const [location] = useLocation();
  
  if (location === "/") {
    return <LandingPage />;
  }

  return (
    <AppLayout>
      <Switch>
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
        <Route path="/hub/calendar" component={LegalCalendarPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="chakshi-ui-theme">
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

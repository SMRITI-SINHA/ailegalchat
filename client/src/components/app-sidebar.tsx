import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { CostDisplay } from "@/components/cost-display";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  FileEdit,
  Settings,
  Scale,
  Sparkles,
  Search,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  FileSignature,
  File,
  Palette,
  Bot,
  Scroll,
  Shield,
  IndianRupee,
  FolderOpen,
  Brain,
  Swords,
  FlaskConical,
} from "lucide-react";

const draftingItems = [
  { title: "AI Legal Drafting", url: "/hub/drafting/ai", icon: FileSignature },
  { title: "Empty Document", url: "/hub/drafting/empty", icon: File },
  { title: "Custom Drafting", url: "/hub/drafting/custom", icon: Palette },
  { title: "Train Your Drafts", url: "/hub/drafting/train", icon: GraduationCap },
];

const chatItems = [
  { title: "CNR Chatbot", url: "/hub/chat/cnr", icon: Bot },
  { title: "Chat with PDF", url: "/hub/chat/pdf", icon: FileText },
  { title: "Nyaya AI", url: "/hub/chat/nyaya", icon: Scale },
];

const researchItems = [
  { title: "AI Research", url: "/hub/research/assistant", icon: Search },
  { title: "Legal Memo", url: "/hub/research/memo", icon: Scroll },
  { title: "Compliance Checklist", url: "/hub/research/compliance", icon: ClipboardCheck },
];

const studyBuddyItems = [
  { title: "Case Predict AI", url: "/hub/study/case-predict", icon: Brain, isBeta: true },
  { title: "Counter Arguments", url: "/hub/study/counter-args", icon: Swords, isBeta: true },
  { title: "Legal Sandbox", url: "/hub/study/sandbox", icon: FlaskConical, isBeta: true },
];

const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

interface AppSidebarProps {
  totalSpend?: number;
}

export function AppSidebar({ totalSpend = 0 }: AppSidebarProps) {
  const [location] = useLocation();

  const isActive = (url: string) => location === url || location.startsWith(url + "/");

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="p-1.5 rounded-md bg-primary">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Chakshi</h1>
              <p className="text-xs text-muted-foreground">Legal AI Platform</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            Chakshi AI Hub
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/hub"}>
                  <Link href="/hub" data-testid="nav-hub">
                    <Sparkles className="h-4 w-4" />
                    <span>Hub Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground">Drafting</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {draftingItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url} data-testid={`nav-${item.url.split("/").pop()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground">AI Chat</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chatItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url} data-testid={`nav-${item.url.split("/").pop()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground">Research</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {researchItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url} data-testid={`nav-${item.url.split("/").pop()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground">Study Buddy</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studyBuddyItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url} data-testid={`nav-${item.url.split("/").pop()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.isBeta && (
                        <Badge variant="outline" className="ml-auto text-[9px] py-0 px-1">
                          Beta
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-xs text-muted-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link href={item.url} data-testid={`nav-${item.url.split("/").pop()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="p-3 rounded-md bg-muted/50 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Session spend:</span>
          </div>
          <p className="text-xl font-semibold mt-1">
            <CostDisplay amount={totalSpend} size="lg" />
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>SOC 2 Compliant</span>
          <Badge variant="outline" className="text-[10px] py-0">Zero Data Retention</Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

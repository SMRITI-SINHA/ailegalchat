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
import {
  Scale,
  Sparkles,
  Shield,
  CalendarDays,
} from "lucide-react";

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <Link href="/hub">
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
                <SidebarMenuButton asChild isActive={location === "/hub" || (location.startsWith("/hub/") && !location.startsWith("/hub/calendar"))}>
                  <Link href="/hub" data-testid="nav-hub">
                    <Sparkles className="h-4 w-4" />
                    <span>AI Hub</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/hub/calendar"}>
                  <Link href="/hub/calendar" data-testid="nav-calendar">
                    <CalendarDays className="h-4 w-4" />
                    <span>Calendar</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>SOC 2 Compliant</span>
          <Badge variant="outline" className="text-[10px] py-0">Zero Data Retention</Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

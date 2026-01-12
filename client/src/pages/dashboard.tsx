import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  FileText,
  MessageSquare,
  FileEdit,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
  FolderOpen,
  BookOpen,
} from "lucide-react";

const stats = [
  {
    title: "Documents",
    value: "12",
    description: "3 processing",
    icon: FileText,
    trend: "+4 this week",
  },
  {
    title: "Chat Sessions",
    value: "28",
    description: "5 active",
    icon: MessageSquare,
    trend: "+12 this week",
  },
  {
    title: "Drafts",
    value: "8",
    description: "2 in progress",
    icon: FileEdit,
    trend: "+3 this week",
  },
  {
    title: "Research Notes",
    value: "15",
    description: "Saved notes",
    icon: BookOpen,
    trend: "+5 this week",
  },
];

const recentActivity = [
  {
    type: "document",
    title: "Contract_Agreement_2024.pdf",
    action: "Uploaded and processed",
    time: "10 minutes ago",
  },
  {
    type: "chat",
    title: "Analysis of Section 420 IPC",
    action: "15 messages exchanged",
    time: "1 hour ago",
  },
  {
    type: "draft",
    title: "Written Statement - Civil Suit",
    action: "Draft completed",
    time: "3 hours ago",
  },
  {
    type: "chat",
    title: "Precedent comparison for property dispute",
    action: "Deep analysis completed",
    time: "Yesterday",
  },
];

const quickActions = [
  {
    title: "Upload Documents",
    description: "Process new legal documents",
    icon: Plus,
    href: "/documents",
    variant: "default" as const,
  },
  {
    title: "Start Chat",
    description: "Ask questions about your documents",
    icon: MessageSquare,
    href: "/chat",
    variant: "outline" as const,
  },
  {
    title: "Create Draft",
    description: "Generate legal documents",
    icon: FileEdit,
    href: "/drafting",
    variant: "outline" as const,
  },
];


export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back. Here's your legal workspace overview.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link key={action.title} href={action.href}>
              <Button variant={action.variant} size="sm" data-testid={`button-quick-${action.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <action.icon className="mr-2 h-4 w-4" />
                {action.title}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {stat.value}
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-muted-foreground">{stat.description}</p>
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {stat.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover-elevate"
                  data-testid={`activity-item-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-background">
                      {activity.type === "document" && <FileText className="h-4 w-4 text-muted-foreground" />}
                      {activity.type === "chat" && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                      {activity.type === "draft" && <FileEdit className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.action}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/documents">
              <Button variant="ghost" className="w-full mt-4" data-testid="button-view-all-activity">
                View All Activity
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <Link key={action.title} href={action.href}>
                <div className="p-4 rounded-md border hover-elevate cursor-pointer" data-testid={`card-action-${action.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="p-2 rounded-md bg-primary/10 w-fit mb-3">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-medium">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

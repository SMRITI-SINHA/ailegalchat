import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Bell,
  Shield,
  CreditCard,
  Brain,
  Download,
  Trash2,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Preferences
          </CardTitle>
          <CardDescription>Configure how the AI assistant works for you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-escalate">Auto-escalate Complex Queries</Label>
              <p className="text-sm text-muted-foreground">
                Automatically use advanced models for complex legal questions
              </p>
            </div>
            <Switch id="auto-escalate" defaultChecked data-testid="switch-auto-escalate" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show-citations">Always Show Citations</Label>
              <p className="text-sm text-muted-foreground">
                Display source citations for all AI responses
              </p>
            </div>
            <Switch id="show-citations" defaultChecked data-testid="switch-show-citations" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="confidence">Show Confidence Scores</Label>
              <p className="text-sm text-muted-foreground">
                Display confidence levels for AI responses
              </p>
            </div>
            <Switch id="confidence" defaultChecked data-testid="switch-confidence" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Default Model Tier</Label>
              <p className="text-sm text-muted-foreground">
                Choose the default AI model for queries
              </p>
            </div>
            <Select defaultValue="auto">
              <SelectTrigger className="w-[180px]" data-testid="select-default-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Recommended)</SelectItem>
                <SelectItem value="mini">Fast (GPT-4o-mini)</SelectItem>
                <SelectItem value="standard">Standard (GPT-4.1)</SelectItem>
                <SelectItem value="pro">Pro (o3)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="processing-complete">Document Processing Complete</Label>
              <p className="text-sm text-muted-foreground">
                Notify when document processing is finished
              </p>
            </div>
            <Switch id="processing-complete" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="draft-ready">Draft Generation Ready</Label>
              <p className="text-sm text-muted-foreground">
                Notify when a draft has been generated
              </p>
            </div>
            <Switch id="draft-ready" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="cost-alerts">Cost Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Alert when spending exceeds threshold
              </p>
            </div>
            <Switch id="cost-alerts" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy & Security
          </CardTitle>
          <CardDescription>Manage your data and security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-delete">Auto-delete Documents</Label>
              <p className="text-sm text-muted-foreground">
                Automatically delete documents after 7 days
              </p>
            </div>
            <Switch id="auto-delete" defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="audit-log">Audit Logging</Label>
              <p className="text-sm text-muted-foreground">
                Keep detailed logs of all AI operations
              </p>
            </div>
            <Switch id="audit-log" defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing & Usage
          </CardTitle>
          <CardDescription>View your usage and billing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-semibold">₹156.40</p>
            </div>
            <div className="p-4 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">Avg. Per Query</p>
              <p className="text-2xl font-semibold">₹0.38</p>
            </div>
            <div className="p-4 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">Total Queries</p>
              <p className="text-2xl font-semibold">412</p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Usage Report
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete All Documents</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete all uploaded documents
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete All
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Clear Chat History</p>
              <p className="text-sm text-muted-foreground">
                Remove all conversation history
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Clear History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

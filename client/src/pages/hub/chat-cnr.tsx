import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, ExternalLink } from "lucide-react";

export default function CNRChatPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-md bg-primary/10">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">CNR Chatbot</h1>
          <p className="text-muted-foreground">Case status lookup using CNR number</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            CNR Chatbot Integration
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
          <CardDescription>
            This space is reserved for your pre-built CNR chatbot integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-2">CNR Chatbot Embed Area</p>
              <p className="text-sm text-muted-foreground">
                Your pre-built CNR chatbot will be embedded here
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

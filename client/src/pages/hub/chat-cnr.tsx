import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";

export default function CNRChatPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-md bg-primary/10">
          <Bot className="h-6 w-6 text-primary" data-testid="icon-cnr-bot" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">CNR Chatbot</h1>
          <p className="text-muted-foreground">Case status lookup using CNR number</p>
        </div>
        <Badge variant="secondary" className="ml-auto">Live</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            eCourts CNR Search
          </CardTitle>
          <CardDescription>
            Enter your CNR number to check case status from eCourts database
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex justify-center p-4">
            <iframe 
              src="https://cnr-chatbot--smritiseema1022.replit.app" 
              width="100%"
              height="600" 
              style={{ border: "none", borderRadius: "12px", maxWidth: "500px" }}
              title="eCourts CNR Search"
              data-testid="iframe-cnr-chatbot"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

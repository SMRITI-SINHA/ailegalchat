import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  FileText,
  Send,
  Upload,
  Calendar,
  ListChecks,
  Lightbulb,
  Clock,
  Scale,
  Search,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UploadedDoc {
  id: string;
  name: string;
  pages: number;
  status: "processing" | "ready";
}

export default function ChatWithPDFPage() {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    const newDocs: UploadedDoc[] = files.map((file, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name: file.name,
      pages: Math.floor(Math.random() * 100) + 20,
      status: "processing" as const,
    }));
    setUploadedDocs((prev) => [...prev, ...newDocs]);

    setTimeout(() => {
      setUploadedDocs((prev) =>
        prev.map((doc) =>
          newDocs.some((n) => n.id === doc.id) ? { ...doc, status: "ready" as const } : doc
        )
      );
    }, 2000);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Based on the uploaded documents, I found the following relevant information:\n\n**Key Points:**\n- The contract was executed on January 15, 2024\n- The parties involved are ABC Corp and XYZ Ltd\n- The agreement term is 24 months\n\n**Timeline:**\n1. Contract signing - Jan 15, 2024\n2. First payment due - Feb 15, 2024\n3. Review period - July 15, 2024\n\nWould you like me to analyze any specific aspect in more detail?`,
      };
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
    }, 1500);
  };

  const quickActions = [
    { label: "Prepare List of Dates", icon: Calendar },
    { label: "Generate Timeline", icon: Clock },
    { label: "Find Key Evidence", icon: Lightbulb },
    { label: "Identify Contradictions", icon: Search },
  ];

  if (uploadedDocs.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-md bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Chat with PDF</h1>
            <p className="text-muted-foreground">Upload documents and analyze with AI</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Documents</CardTitle>
            <CardDescription>
              Upload PDFs, case files, emails, or evidence folders (up to 800 pages per document)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadDropzone
              onUpload={async (files) => handleFilesSelected(files)}
              maxFiles={20}
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover-elevate cursor-pointer" onClick={() => {}}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Prepare List of Dates</h3>
                <p className="text-xs text-muted-foreground">Extract chronological events</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => {}}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                <ListChecks className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Issue Tagging</h3>
                <p className="text-xs text-muted-foreground">Auto-tag legal issues</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => {}}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                <Lightbulb className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Key Evidence ID</h3>
                <p className="text-xs text-muted-foreground">Find important evidence</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => {}}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Find Contradictions</h3>
                <p className="text-xs text-muted-foreground">Spot inconsistencies</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold">Chat with PDF</h1>
          <Badge variant="secondary">{uploadedDocs.length} documents</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ArrowRight className="mr-2 h-4 w-4" />
            Send to Drafting
          </Button>
          <Button variant="outline" size="sm">
            <Scale className="mr-2 h-4 w-4" />
            Ask Nyaya AI
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r p-4 overflow-auto">
          <h3 className="font-medium text-sm mb-3">Uploaded Documents</h3>
          <div className="space-y-2">
            {uploadedDocs.map((doc) => (
              <div key={doc.id} className="p-2 border rounded-md text-sm">
                <p className="font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{doc.pages} pages</span>
                  <Badge variant={doc.status === "ready" ? "outline" : "secondary"} className="text-[10px]">
                    {doc.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-3">
            <Upload className="mr-2 h-4 w-4" />
            Add More
          </Button>

          <div className="mt-6">
            <h3 className="font-medium text-sm mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {quickActions.map((action) => (
                <Button key={action.label} variant="ghost" size="sm" className="w-full justify-start">
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-medium mb-2">Start a Conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Ask questions about your documents, request summaries, or use quick actions
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your documents..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                data-testid="input-chat"
              />
              <Button onClick={handleSend} disabled={isLoading} data-testid="button-send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

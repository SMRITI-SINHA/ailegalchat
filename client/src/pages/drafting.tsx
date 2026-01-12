import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ModelBadge } from "@/components/model-badge";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  Plus,
  FileEdit,
  FileText,
  Download,
  Copy,
  Wand2,
  Save,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Scale,
  Briefcase,
  FileSignature,
  ScrollText,
  Gavel,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Draft, DraftType, ModelTier } from "@shared/schema";

const draftTemplates = [
  {
    type: "petition" as DraftType,
    title: "Petition",
    description: "File a formal request to the court",
    icon: ScrollText,
    tier: "standard" as ModelTier,
  },
  {
    type: "written_statement" as DraftType,
    title: "Written Statement",
    description: "Response to a civil suit plaint",
    icon: FileText,
    tier: "standard" as ModelTier,
  },
  {
    type: "notice" as DraftType,
    title: "Legal Notice",
    description: "Formal legal communication",
    icon: FileSignature,
    tier: "mini" as ModelTier,
  },
  {
    type: "contract" as DraftType,
    title: "Contract",
    description: "Legal agreement between parties",
    icon: Briefcase,
    tier: "standard" as ModelTier,
  },
  {
    type: "brief" as DraftType,
    title: "Legal Brief",
    description: "Arguments for court proceedings",
    icon: BookOpen,
    tier: "pro" as ModelTier,
  },
  {
    type: "application" as DraftType,
    title: "Application",
    description: "Formal request or application",
    icon: FileEdit,
    tier: "mini" as ModelTier,
  },
  {
    type: "reply" as DraftType,
    title: "Reply/Rejoinder",
    description: "Response to opponent's statement",
    icon: Scale,
    tier: "standard" as ModelTier,
  },
  {
    type: "affidavit" as DraftType,
    title: "Affidavit",
    description: "Sworn written statement",
    icon: Gavel,
    tier: "mini" as ModelTier,
  },
];

interface DraftFormData {
  type: DraftType;
  title: string;
  facts: string;
  parties: string;
  jurisdiction: string;
  additionalInfo: string;
}

export default function DraftingPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof draftTemplates[0] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<DraftFormData>({
    type: "notice",
    title: "",
    facts: "",
    parties: "",
    jurisdiction: "Delhi High Court",
    additionalInfo: "",
  });

  const { data: drafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: DraftFormData) => {
      const res = await apiRequest("POST", "/api/drafts/generate", data);
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentDraft(data);
      setDraftContent(data.content || "");
      setIsGenerating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      await apiRequest("PATCH", `/api/drafts/${id}`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const handleGenerate = async () => {
    if (!formData.title || !formData.facts) return;
    setIsGenerating(true);
    setIsCreating(false);
    generateMutation.mutate(formData);
  };

  const handleSave = () => {
    if (currentDraft && draftContent) {
      saveMutation.mutate({ id: currentDraft.id, content: draftContent });
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(draftContent);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Legal Drafting</h1>
          <p className="text-muted-foreground">Generate professional legal documents with AI</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-draft">
              <Plus className="mr-2 h-4 w-4" />
              New Draft
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Draft</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {draftTemplates.map((template) => (
                  <Card
                    key={template.type}
                    className={`cursor-pointer hover-elevate ${
                      selectedTemplate?.type === template.type
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setFormData((prev) => ({ ...prev, type: template.type }));
                    }}
                    data-testid={`card-template-${template.type}`}
                  >
                    <CardContent className="p-3 text-center">
                      <div className="p-2 rounded-md bg-muted mx-auto w-fit mb-2">
                        <template.icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">{template.title}</p>
                      <ModelBadge tier={template.tier} className="mt-2 scale-90" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedTemplate && (
                <>
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="title">Document Title</Label>
                        <Input
                          id="title"
                          placeholder={`${selectedTemplate.title} - [Case/Matter Name]`}
                          value={formData.title}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, title: e.target.value }))
                          }
                          data-testid="input-draft-title"
                        />
                      </div>

                      <div>
                        <Label htmlFor="parties">Parties Involved</Label>
                        <Input
                          id="parties"
                          placeholder="e.g., ABC Pvt Ltd vs XYZ Corp"
                          value={formData.parties}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, parties: e.target.value }))
                          }
                          data-testid="input-draft-parties"
                        />
                      </div>

                      <div>
                        <Label htmlFor="jurisdiction">Jurisdiction</Label>
                        <Select
                          value={formData.jurisdiction}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, jurisdiction: value }))
                          }
                        >
                          <SelectTrigger data-testid="select-jurisdiction">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Supreme Court of India">Supreme Court of India</SelectItem>
                            <SelectItem value="Delhi High Court">Delhi High Court</SelectItem>
                            <SelectItem value="Bombay High Court">Bombay High Court</SelectItem>
                            <SelectItem value="Madras High Court">Madras High Court</SelectItem>
                            <SelectItem value="Calcutta High Court">Calcutta High Court</SelectItem>
                            <SelectItem value="District Court">District Court</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="facts">Facts of the Case</Label>
                        <Textarea
                          id="facts"
                          placeholder="Describe the relevant facts, background, and circumstances..."
                          rows={6}
                          value={formData.facts}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, facts: e.target.value }))
                          }
                          data-testid="textarea-draft-facts"
                        />
                      </div>

                      <div>
                        <Label htmlFor="additionalInfo">Additional Instructions (Optional)</Label>
                        <Textarea
                          id="additionalInfo"
                          placeholder="Any specific clauses, tone, or requirements..."
                          rows={3}
                          value={formData.additionalInfo}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              additionalInfo: e.target.value,
                            }))
                          }
                          data-testid="textarea-draft-additional"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!selectedTemplate || !formData.title || !formData.facts}
                data-testid="button-generate-draft"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="library">My Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          {isGenerating ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <StreamingIndicator className="mb-4" />
                <p className="text-muted-foreground">Generating your legal document...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This may take a moment for complex documents
                </p>
              </CardContent>
            </Card>
          ) : currentDraft ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>{currentDraft.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{currentDraft.type}</Badge>
                    {currentDraft.modelUsed && (
                      <ModelBadge tier={currentDraft.modelUsed as ModelTier} />
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button size="sm" onClick={handleSave} data-testid="button-save-draft">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm leading-relaxed"
                  data-testid="textarea-draft-content"
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FileEdit className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Draft Open</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Create a new draft or select one from your library to start editing.
                </p>
                <Button onClick={() => setIsCreating(true)} data-testid="button-create-first-draft">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Draft
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="library">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No Drafts Yet</h3>
                <p className="text-muted-foreground text-center max-w-sm mb-4">
                  Start creating your first legal draft with AI assistance.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Draft
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="hover-elevate cursor-pointer"
                  onClick={() => {
                    setCurrentDraft(draft);
                    setDraftContent(draft.content || "");
                  }}
                  data-testid={`card-draft-${draft.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-md bg-muted">
                        <FileEdit className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Badge
                        variant={draft.status === "completed" ? "default" : "secondary"}
                      >
                        {draft.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        )}
                        {draft.status}
                      </Badge>
                    </div>
                    <h3 className="font-medium mt-3 truncate">{draft.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{draft.type}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                      <Clock className="h-3 w-3" />
                      {formatDate(draft.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

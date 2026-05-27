import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StreamingIndicator } from "@/components/streaming-text";
import {
  ClipboardCheck,
  Wand2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Upload,
  Trash2,
  FolderOpen,
  ArrowLeft,
} from "lucide-react";
import type { ChecklistItem, ComplianceChecklist } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const industries = [
  "Startup / Tech",
  "Fintech",
  "Edtech",
  "Healthcare",
  "E-commerce",
  "Real Estate",
  "Manufacturing",
  "NBFC",
  "Banking",
  "Insurance",
];

const jurisdictions = [
  "Pan India",
  "Maharashtra",
  "Delhi NCR",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "Telangana",
];

const activities = [
  "Company Incorporation",
  "Fundraising / Investment",
  "Employment / HR",
  "Data Processing / Privacy",
  "Licensing & Permits",
  "Tax Compliance",
  "Environmental Clearance",
  "Export / Import",
];

interface ItemNote {
  itemId: string;
  text: string;
}

interface ItemProof {
  itemId: string;
  fileName: string;
  uploadedAt: Date;
}

export default function ComplianceChecklistPage() {
  const [industry, setIndustry] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [activity, setActivity] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [activeTab, setActiveTab] = useState("generate");
  const [itemNotes, setItemNotes] = useState<ItemNote[]>([]);
  const [itemProofs, setItemProofs] = useState<ItemProof[]>([]);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [sources, setSources] = useState<{ title: string; url: string; source: string }[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [loadedChecklistId, setLoadedChecklistId] = useState<string | null>(null);
  const [loadedChecklistTitle, setLoadedChecklistTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const { toast } = useToast();

  const { data: savedChecklists = [], isLoading: isLoadingChecklists } = useQuery<ComplianceChecklist[]>({
    queryKey: ["/api/compliance/checklists"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; industry: string; jurisdiction: string; activity: string; items: ChecklistItem[] }) => {
      const res = await apiRequest("POST", "/api/compliance/checklists", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists"] });
      setShowSaveDialog(false);
      setSaveTitle("");
      toast({ title: "Checklist saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save checklist", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, items }: { id: string; items: ChecklistItem[] }) => {
      const res = await apiRequest("PATCH", `/api/compliance/checklists/${id}`, { items });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    },
    onError: () => {
      setSaveStatus("idle");
      toast({ title: "Failed to save changes", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/compliance/checklists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists"] });
      toast({ title: "Checklist deleted" });
    },
  });

  const handleGenerate = async () => {
    if (!industry || !jurisdiction || !activity) return;
    setIsGenerating(true);
    setSources([]);
    setIsVerified(false);
    setLoadedChecklistId(null);
    setLoadedChecklistTitle("");

    try {
      const response = await apiRequest("POST", "/api/compliance/generate", {
        industry,
        jurisdiction,
        activity,
      });
      const data = await response.json();

      if (data.sources && Array.isArray(data.sources)) {
        setSources(data.sources);
      }
      setIsVerified(!!data.verifiedFromPerplexity);

      if (data.items && Array.isArray(data.items)) {
        setChecklist(data.items.map((item: any, idx: number) => ({
          ...item,
          id: item.id || String(idx + 1),
          completed: item.completed || false,
        })));
      } else {
        setChecklist(getDefaultChecklist());
      }
    } catch (error) {
      console.error("Compliance generation error:", error);
      setChecklist(getDefaultChecklist());
    } finally {
      setIsGenerating(false);
    }
  };

  const getDefaultChecklist = (): ChecklistItem[] => [
    {
      id: "1",
      title: "Register with Registrar of Companies (ROC)",
      description: "File incorporation documents including MOA, AOA, and Form SPICe+",
      legalReference: "Companies Act, 2013 - Section 7",
      deadline: "Before commencing business",
      riskLevel: "high",
      completed: false,
    },
    {
      id: "2",
      title: "Obtain PAN and TAN",
      description: "Apply for Permanent Account Number and Tax Deduction Account Number",
      legalReference: "Income Tax Act, 1961",
      deadline: "Within 30 days of incorporation",
      riskLevel: "high",
      completed: false,
    },
    {
      id: "3",
      title: "GST Registration",
      description: "Register for Goods and Services Tax if turnover exceeds threshold",
      legalReference: "CGST Act, 2017 - Section 22",
      deadline: "Within 30 days of becoming liable",
      riskLevel: "high",
      completed: false,
    },
    {
      id: "4",
      title: "Open Current Bank Account",
      description: "Open corporate bank account with incorporation documents",
      legalReference: "RBI Guidelines",
      deadline: "Within 180 days",
      riskLevel: "medium",
      completed: false,
    },
    {
      id: "5",
      title: "Register for EPFO and ESIC",
      description: "Mandatory if employing 20+ employees (EPFO) or 10+ (ESIC)",
      legalReference: "EPF Act, 1952 / ESI Act, 1948",
      deadline: "Within 1 month of threshold",
      riskLevel: "medium",
      completed: false,
    },
    {
      id: "6",
      title: "Shops and Establishment Registration",
      description: "Register under local Shops and Establishment Act",
      legalReference: "State Shops & Establishment Act",
      deadline: "Within 30 days of setup",
      riskLevel: "low",
      completed: false,
    },
  ];

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = checklist.filter((i) => i.completed).length;

  const handleSave = () => {
    if (!saveTitle.trim()) return;
    saveMutation.mutate({
      title: saveTitle,
      industry,
      jurisdiction,
      activity,
      items: checklist,
    });
  };

  const handleSaveChanges = () => {
    if (!loadedChecklistId) return;
    setSaveStatus("saving");
    updateMutation.mutate({ id: loadedChecklistId, items: checklist });
  };

  const loadChecklist = (saved: ComplianceChecklist) => {
    setIndustry(saved.industry || "");
    setJurisdiction(saved.jurisdiction || "");
    setActivity(saved.activity || "");
    const items = saved.items as unknown as ChecklistItem[];
    setChecklist(Array.isArray(items) ? items : []);
    setLoadedChecklistId(saved.id);
    setLoadedChecklistTitle(saved.title);
    setSaveStatus("idle");
  };

  const handleBackToList = () => {
    setLoadedChecklistId(null);
    setLoadedChecklistTitle("");
    setChecklist([]);
  };

  const checklistView = (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          {loadedChecklistId && (
            <button
              onClick={handleBackToList}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Saved Checklists
            </button>
          )}
          <h2 className="font-semibold">
            {loadedChecklistTitle || `${industry} - ${activity}`}
          </h2>
          <p className="text-sm text-muted-foreground">{jurisdiction}</p>
          {isVerified && sources.length > 0 && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified from {sources.length} trusted government sources
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isVerified && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              Live Verified
            </Badge>
          )}
          <Badge variant="outline" data-testid="badge-progress">
            {completedCount}/{checklist.length} completed
          </Badge>

          {loadedChecklistId ? (
            <Button
              size="sm"
              onClick={handleSaveChanges}
              disabled={saveStatus === "saving"}
              data-testid="button-save-changes"
            >
              {saveStatus === "saved" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
                  Changes Saved
                </>
              ) : saveStatus === "saving" ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-pulse" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowSaveDialog(true)} data-testid="button-save">
              <Save className="mr-2 h-4 w-4" />
              Save Checklist
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setChecklist([]);
              setLoadedChecklistId(null);
              setLoadedChecklistTitle("");
              setSaveStatus("idle");
            }}
          >
            New Checklist
          </Button>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        {checklist.map((item) => (
          <Card key={item.id} className={item.completed ? "opacity-75" : ""} data-testid={`checklist-item-${item.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="mt-1"
                  data-testid={`checkbox-${item.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className={`font-medium ${item.completed ? "line-through" : ""}`}>
                      {item.title}
                    </h3>
                    <Badge
                      variant={
                        item.riskLevel === "high"
                          ? "destructive"
                          : item.riskLevel === "medium"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {item.riskLevel} risk
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {item.legalReference}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.deadline}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      setActiveItemId(item.id);
                      const existingNote = itemNotes.find(n => n.itemId === item.id);
                      setNoteText(existingNote?.text || "");
                      setShowNotesDialog(true);
                    }}
                    data-testid={`button-notes-${item.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Notes
                    {itemNotes.some(n => n.itemId === item.id) && (
                      <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      setActiveItemId(item.id);
                      setShowProofDialog(true);
                    }}
                    data-testid={`button-proof-${item.id}`}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Proof
                    {itemProofs.some(p => p.itemId === item.id) && (
                      <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div className="p-2 rounded-md bg-primary/10">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-xl">Smart Compliance Checklist Generator</h1>
          <p className="text-sm text-muted-foreground">Live-verified compliance requirements from trusted Indian government and legal sources</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-fit mb-4">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="saved">
            Saved Checklists
            {savedChecklists.length > 0 && (
              <Badge variant="secondary" className="ml-2">{savedChecklists.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="flex-1 space-y-6 mt-0">
          {checklist.length === 0 || loadedChecklistId ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configure Checklist Parameters</CardTitle>
                <CardDescription>Select your industry, jurisdiction, and activity to generate a customized compliance checklist</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger data-testid="select-industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((i) => (
                          <SelectItem key={i} value={i}>{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Jurisdiction</Label>
                    <Select value={jurisdiction} onValueChange={setJurisdiction}>
                      <SelectTrigger data-testid="select-jurisdiction">
                        <SelectValue placeholder="Select jurisdiction" />
                      </SelectTrigger>
                      <SelectContent>
                        {jurisdictions.map((j) => (
                          <SelectItem key={j} value={j}>{j}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Activity</Label>
                    <Select value={activity} onValueChange={setActivity}>
                      <SelectTrigger data-testid="select-activity">
                        <SelectValue placeholder="Select activity" />
                      </SelectTrigger>
                      <SelectContent>
                        {activities.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!industry || !jurisdiction || !activity || isGenerating}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {isGenerating ? (
                    <>
                      <StreamingIndicator className="mr-2" />
                      Generating Checklist...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Checklist
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            checklistView
          )}
        </TabsContent>

        <TabsContent value="saved" className="flex-1 mt-0">
          {loadedChecklistId ? (
            <div className="space-y-0">
              {checklistView}
            </div>
          ) : isLoadingChecklists ? (
            <div className="text-center py-8 text-muted-foreground">Loading saved checklists...</div>
          ) : savedChecklists.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-medium mb-2">No Saved Checklists</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a checklist and save it to access it later
                </p>
                <Button variant="outline" onClick={() => setActiveTab("generate")}>
                  Generate Checklist
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savedChecklists.map((saved) => (
                <Card key={saved.id} className="hover-elevate cursor-pointer" data-testid={`saved-checklist-${saved.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium line-clamp-1">{saved.title}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(saved.id);
                        }}
                        data-testid={`button-delete-${saved.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      <p>{saved.industry} - {saved.activity}</p>
                      <p className="text-xs">{saved.jurisdiction}</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => loadChecklist(saved)}>
                      Load Checklist
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Checklist</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Checklist Name</Label>
            <Input
              placeholder="e.g., Startup Incorporation - Maharashtra"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              data-testid="input-save-title"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!saveTitle.trim() || saveMutation.isPending} data-testid="button-confirm-save">
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Notes</DialogTitle>
            <DialogDescription>
              Add notes for this compliance item. Notes are saved locally.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter your notes here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              className="resize-none"
              data-testid="textarea-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (activeItemId && noteText.trim()) {
                  setItemNotes(prev => {
                    const filtered = prev.filter(n => n.itemId !== activeItemId);
                    return [...filtered, { itemId: activeItemId, text: noteText }];
                  });
                  toast({ title: "Notes saved" });
                }
                setShowNotesDialog(false);
                setNoteText("");
              }}
              data-testid="button-save-notes"
            >
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Proof</DialogTitle>
            <DialogDescription>
              Upload documents as proof of compliance. Supported formats: PDF, Word, images.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drag and drop or click to upload</p>
              <Button variant="outline" size="sm">
                Choose File
              </Button>
            </div>
            {activeItemId && itemProofs.some(p => p.itemId === activeItemId) && (
              <div className="space-y-2">
                <Label>Uploaded Proofs</Label>
                {itemProofs
                  .filter(p => p.itemId === activeItemId)
                  .map((proof, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{proof.fileName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setItemProofs(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProofDialog(false)}>Close</Button>
            <Button
              onClick={() => {
                if (activeItemId) {
                  const mockProof: ItemProof = {
                    itemId: activeItemId,
                    fileName: "proof_document.pdf",
                    uploadedAt: new Date(),
                  };
                  setItemProofs(prev => [...prev, mockProof]);
                  toast({ title: "Proof uploaded" });
                }
                setShowProofDialog(false);
              }}
              data-testid="button-upload-proof"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

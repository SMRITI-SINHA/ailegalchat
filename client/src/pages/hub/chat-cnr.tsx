import { useState } from "react";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot, Plus, Save, Trash2, FileText, Clock, List, Edit3,
  BookmarkCheck, Scale, Building2, Users, Info, Calendar,
  Gavel, ArrowLeft, Hash, FileCheck, AlertCircle, ArrowRightLeft,
  History, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CnrNote {
  id: string;
  title: string;
  content: string;
  cnrNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SavedCase {
  id: string;
  cnrNumber: string;
  caseType: string | null;
  filingNumber: string | null;
  filingDate: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  caseStatus: string | null;
  firstHearingDate: string | null;
  nextHearingDate: string | null;
  caseStage: string | null;
  courtNumberAndJudge: string | null;
  petitioners: string | null;
  respondents: string | null;
  actsAndSections: string | null;
  caseTransferDetails: string | null;
  caseHistory: string | null;
  savedAt: string;
}

export default function CNRChatPage() {
  const { toast } = useToast();
  const [selectedNote, setSelectedNote] = useState<CnrNote | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [cnrNumber, setCnrNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [rightTab, setRightTab] = useState("editor");
  const [selectedCase, setSelectedCase] = useState<SavedCase | null>(null);
  const [expandedHistory, setExpandedHistory] = useState(false);

  const { data: notes = [], isLoading: notesLoading } = useQuery<CnrNote[]>({
    queryKey: ["/api/cnr/notes"],
  });

  const { data: apiCases = [], isLoading: casesLoading } = useQuery<SavedCase[]>({
    queryKey: ["/api/cnr/saved-cases"],
  });

  const allCases = apiCases;

  const createNoteMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; cnrNumber?: string }) => {
      const res = await apiRequest("POST", "/api/cnr/notes", data);
      return res.json();
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cnr/notes"] });
      setSelectedNote(newNote);
      toast({ title: "Note saved" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to save note", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CnrNote> }) => {
      const res = await apiRequest("PATCH", `/api/cnr/notes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cnr/notes"] });
      toast({ title: "Note updated" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cnr/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cnr/notes"] });
      setSelectedNote(null);
      setNoteTitle("");
      setNoteContent("");
      setCnrNumber("");
      setIsEditing(false);
      toast({ title: "Note deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cnr/saved-cases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cnr/saved-cases"] });
      setSelectedCase(null);
      toast({ title: "Case removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove case", variant: "destructive" });
    },
  });

  const handleNewNote = () => {
    setSelectedNote(null);
    setNoteTitle("");
    setNoteContent("");
    setCnrNumber("");
    setIsEditing(true);
    setRightTab("editor");
  };

  const handleSaveNote = () => {
    if (!noteTitle.trim() && !noteContent.trim()) {
      toast({ title: "Please add a title or content", variant: "destructive" });
      return;
    }
    if (selectedNote) {
      updateNoteMutation.mutate({
        id: selectedNote.id,
        data: { title: noteTitle, content: noteContent, cnrNumber: cnrNumber || null },
      });
    } else {
      createNoteMutation.mutate({
        title: noteTitle || "Untitled Note",
        content: noteContent,
        cnrNumber: cnrNumber || undefined,
      });
    }
  };

  const handleSelectNote = (note: CnrNote) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setCnrNumber(note.cnrNumber || "");
    setIsEditing(false);
    setRightTab("editor");
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSaving = createNoteMutation.isPending || updateNoteMutation.isPending;

  const getStatusColor = (status: string | null): "default" | "secondary" | "outline" | "destructive" => {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("pending") || s.includes("progress")) return "default";
    if (s.includes("disposed") || s.includes("closed") || s.includes("decided") || s.includes("acquit")) return "secondary";
    return "outline";
  };


  const parseHistoryEntries = (history: string | null) => {
    if (!history) return [];
    return history.split("\n").filter(Boolean).map((line) => {
      const parts = line.split(" | ");
      return { date: parts[0]?.trim() || "", event: parts.slice(1).join(" | ").trim() || line };
    });
  };

  const renderDetailSection = (icon: React.ReactNode, label: string, value: string | null, testId?: string) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2">
        <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-sm mt-0.5 whitespace-pre-wrap" data-testid={testId}>{value}</p>
        </div>
      </div>
    );
  };

  const renderCaseDetail = (c: SavedCase) => {
    const historyEntries = parseHistoryEntries(c.caseHistory);
    const showHistoryLimit = expandedHistory ? historyEntries.length : 5;

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedCase(null); setExpandedHistory(false); }}
            data-testid="button-back-to-cases"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to list
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteCaseMutation.mutate(c.id)}
            disabled={deleteCaseMutation.isPending}
            data-testid="button-delete-case"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Remove
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 pr-2">
            <div className="pb-3 border-b mb-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.caseType && <Badge variant="outline" data-testid="badge-case-type">{c.caseType}</Badge>}
                    {c.caseStatus && <Badge variant={getStatusColor(c.caseStatus)} data-testid="badge-case-status">{c.caseStatus}</Badge>}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground mt-2" data-testid="text-case-cnr">
                    CNR: {c.cnrNumber}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <FileCheck className="h-3 w-3" />
                Case Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                {renderDetailSection(<Hash className="h-4 w-4" />, "Filing Number", c.filingNumber, "text-filing-number")}
                {renderDetailSection(<Calendar className="h-4 w-4" />, "Filing Date", c.filingDate, "text-filing-date")}
                {renderDetailSection(<Hash className="h-4 w-4" />, "Registration Number", c.registrationNumber, "text-reg-number")}
                {renderDetailSection(<Calendar className="h-4 w-4" />, "Registration Date", c.registrationDate, "text-reg-date")}
                {renderDetailSection(<Calendar className="h-4 w-4" />, "First Hearing Date", c.firstHearingDate, "text-first-hearing")}
                {renderDetailSection(<Calendar className="h-4 w-4" />, "Next Hearing Date", c.nextHearingDate, "text-next-hearing")}
                {renderDetailSection(<Scale className="h-4 w-4" />, "Case Stage", c.caseStage, "text-case-stage")}
              </div>
              {renderDetailSection(<Gavel className="h-4 w-4" />, "Court Number & Judge", c.courtNumberAndJudge, "text-court-judge")}
            </div>

            <div className="border-t pt-3 mt-3 space-y-0.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Users className="h-3 w-3" />
                Parties Involved
              </h4>
              {renderDetailSection(<Users className="h-4 w-4" />, "Petitioner(s) with Advocate(s)", c.petitioners, "text-petitioners")}
              {renderDetailSection(<Users className="h-4 w-4" />, "Respondent(s) with Advocate(s)", c.respondents, "text-respondents")}
            </div>

            <div className="border-t pt-3 mt-3 space-y-0.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Info className="h-3 w-3" />
                Additional Details
              </h4>
              {renderDetailSection(<AlertCircle className="h-4 w-4" />, "Acts & Sections", c.actsAndSections, "text-acts-sections")}
              {renderDetailSection(<ArrowRightLeft className="h-4 w-4" />, "Case Transfer Details", c.caseTransferDetails, "text-transfer-details")}
            </div>

            {historyEntries.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <History className="h-3 w-3" />
                  Case History ({historyEntries.length} hearings)
                </h4>
                <div className="space-y-0">
                  {historyEntries.slice(0, showHistoryLimit).map((entry, i) => (
                    <div key={i} className="flex gap-3 pb-3 relative" data-testid={`history-entry-${i}`}>
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        {i < Math.min(showHistoryLimit, historyEntries.length) - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <p className="text-xs font-mono text-muted-foreground">{entry.date}</p>
                        <p className="text-sm mt-0.5">{entry.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {historyEntries.length > 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setExpandedHistory(!expandedHistory)}
                    data-testid="button-toggle-history"
                  >
                    {expandedHistory ? (
                      <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
                    ) : (
                      <><ChevronDown className="h-3 w-3 mr-1" /> Show all {historyEntries.length} entries</>
                    )}
                  </Button>
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground flex items-center gap-1 pt-3 border-t mt-3">
              <Clock className="h-3 w-3" />
              Saved on {formatDate(c.savedAt)}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="p-6 h-full">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <BackButton />
        <div className="p-2 rounded-md bg-primary/10">
          <Bot className="h-6 w-6 text-primary" data-testid="icon-cnr-bot" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">CNR Chatbot</h1>
          <p className="text-muted-foreground">Case status lookup using CNR number</p>
        </div>
        <Badge variant="secondary" className="ml-auto">Live</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedCase(null); setExpandedHistory(false); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="search" className="text-xs" data-testid="tab-cnr-search">
                    <Bot className="h-3 w-3 mr-1" />
                    CNR Search
                  </TabsTrigger>
                  <TabsTrigger value="saved-cases" className="text-xs" data-testid="tab-saved-cases">
                    <BookmarkCheck className="h-3 w-3 mr-1" />
                    Saved Cases ({allCases.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {activeTab === "search" && (
                <div className="flex justify-center p-4 h-full relative">
                  {!iframeLoaded && (
                    <div className="absolute inset-4 flex items-center justify-center">
                      <div className="w-full max-w-[500px] space-y-4">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                      </div>
                    </div>
                  )}
                  <iframe
                    src="https://cnr-chatbot--smritiseema1022.replit.app"
                    width="100%"
                    height="100%"
                    style={{
                      border: "none",
                      borderRadius: "12px",
                      maxWidth: "500px",
                      minHeight: "550px",
                      opacity: iframeLoaded ? 1 : 0,
                      transition: "opacity 0.3s ease-in-out"
                    }}
                    title="eCourts CNR Search"
                    data-testid="iframe-cnr-chatbot"
                    onLoad={() => setIframeLoaded(true)}
                    loading="eager"
                  />
                </div>
              )}

              {activeTab === "saved-cases" && (
                <div className="p-4 h-full overflow-hidden flex flex-col">
                  {casesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : selectedCase ? (
                    renderCaseDetail(selectedCase)
                  ) : allCases.length > 0 ? (
                    <ScrollArea className="flex-1">
                      <div className="space-y-3 pr-2">
                        {allCases.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCase(c)}
                            className="p-4 rounded-md border hover-elevate cursor-pointer"
                            data-testid={`saved-case-${c.id}`}
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {c.caseType && (
                                    <span className="text-sm font-medium">{c.caseType}</span>
                                  )}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground mt-1">
                                  CNR: {c.cnrNumber}
                                </div>
                                {c.filingNumber && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Filing: {c.filingNumber}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                {c.caseStatus && (
                                  <Badge variant={getStatusColor(c.caseStatus)} className="text-xs">
                                    {c.caseStatus}
                                  </Badge>
                                )}
                                {c.caseStage && (
                                  <span className="text-xs text-muted-foreground">{c.caseStage}</span>
                                )}
                              </div>
                            </div>
                            {c.courtNumberAndJudge && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <Gavel className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{c.courtNumberAndJudge}</span>
                              </div>
                            )}
                            {c.nextHearingDate && (
                              <div className="flex items-center gap-1 text-xs mt-1">
                                <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground">Next hearing:</span>
                                <span className="font-medium">{c.nextHearingDate}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDate(c.savedAt)}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCaseMutation.mutate(c.id);
                                }}
                                disabled={deleteCaseMutation.isPending}
                                data-testid={`button-remove-case-${c.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-4 h-full">
                      <div>
                        <BookmarkCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium mb-1">No saved cases yet</p>
                        <p className="text-xs text-muted-foreground">
                          Search for a case using CNR number and click "Save this case" to save it here
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Case Notes
                </CardTitle>
                <Button size="sm" onClick={handleNewNote} data-testid="button-new-note">
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
              <Tabs value={rightTab} onValueChange={setRightTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mb-3">
                  <TabsTrigger value="editor" className="text-xs" data-testid="tab-editor">
                    <Edit3 className="h-3 w-3 mr-1" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="text-xs" data-testid="tab-saved">
                    <List className="h-3 w-3 mr-1" />
                    Saved ({notes.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
                  <div className="flex flex-col h-full gap-3">
                    <Input
                      placeholder="Note title..."
                      value={noteTitle}
                      onChange={(e) => { setNoteTitle(e.target.value); setIsEditing(true); }}
                      className="text-sm"
                      data-testid="input-note-title"
                    />
                    <Input
                      placeholder="CNR Number (optional)..."
                      value={cnrNumber}
                      onChange={(e) => { setCnrNumber(e.target.value); setIsEditing(true); }}
                      className="text-sm font-mono"
                      data-testid="input-cnr-number"
                    />
                    <Textarea
                      placeholder="Write your notes here..."
                      value={noteContent}
                      onChange={(e) => { setNoteContent(e.target.value); setIsEditing(true); }}
                      className="flex-1 min-h-[200px] resize-none text-sm"
                      data-testid="textarea-note-content"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveNote}
                        className="flex-1"
                        disabled={isSaving}
                        data-testid="button-save-note"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      {selectedNote && (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteNoteMutation.mutate(selectedNote.id)}
                          disabled={deleteNoteMutation.isPending}
                          data-testid="button-delete-note"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="saved" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
                  {notesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : notes.length > 0 ? (
                    <ScrollArea className="h-full">
                      <div className="space-y-2 pr-2">
                        {notes.map((note) => (
                          <div
                            key={note.id}
                            onClick={() => handleSelectNote(note)}
                            className={`p-3 rounded-md border hover-elevate cursor-pointer ${
                              selectedNote?.id === note.id ? "border-primary bg-primary/5" : ""
                            }`}
                            data-testid={`note-item-${note.id}`}
                          >
                            <div className="font-medium text-sm truncate">{note.title}</div>
                            {note.cnrNumber && (
                              <div className="text-xs font-mono text-muted-foreground mt-1">
                                CNR: {note.cnrNumber}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {note.content || "No content"}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                              <Clock className="h-3 w-3" />
                              {formatDate(note.updatedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-4 h-full">
                      <div>
                        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          No saved notes yet. Click "New" to create your first note.
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

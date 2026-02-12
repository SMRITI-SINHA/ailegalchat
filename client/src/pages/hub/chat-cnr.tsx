import { useState } from "react";
import { BackButton } from "@/components/back-button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Plus, Save, Trash2, FileText, Clock, List, Edit3, Bookmark, BookmarkCheck, Scale, Building2, Users, Info } from "lucide-react";
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
  caseTitle: string;
  court: string | null;
  caseStatus: string | null;
  parties: string | null;
  caseDetails: string | null;
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

  const [saveCnr, setSaveCnr] = useState("");
  const [saveCaseTitle, setSaveCaseTitle] = useState("");
  const [saveCourt, setSaveCourt] = useState("");
  const [saveCaseStatus, setSaveCaseStatus] = useState("");
  const [saveParties, setSaveParties] = useState("");
  const [saveCaseDetails, setSaveCaseDetails] = useState("");
  const [selectedCase, setSelectedCase] = useState<SavedCase | null>(null);

  const { data: notes = [], isLoading: notesLoading } = useQuery<CnrNote[]>({
    queryKey: ["/api/cnr/notes"],
  });

  const { data: savedCases = [], isLoading: casesLoading } = useQuery<SavedCase[]>({
    queryKey: ["/api/cnr/saved-cases"],
  });

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

  const saveCaseMutation = useMutation({
    mutationFn: async (data: { cnrNumber: string; caseTitle: string; court?: string; caseStatus?: string; parties?: string; caseDetails?: string }) => {
      const res = await apiRequest("POST", "/api/cnr/saved-cases", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cnr/saved-cases"] });
      toast({ title: "Case saved successfully" });
      setSaveCnr("");
      setSaveCaseTitle("");
      setSaveCourt("");
      setSaveCaseStatus("");
      setSaveParties("");
      setSaveCaseDetails("");
      setActiveTab("saved-cases");
    },
    onError: (error: Error) => {
      const msg = error.message || "";
      if (msg.startsWith("409")) {
        toast({ title: "This case is already saved", variant: "destructive" });
      } else {
        toast({ title: "Failed to save case", variant: "destructive" });
      }
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

  const handleDeleteNote = (noteId: string) => {
    deleteNoteMutation.mutate(noteId);
  };

  const handleSaveCase = () => {
    if (!saveCnr.trim() || !saveCaseTitle.trim()) {
      toast({ title: "CNR number and case title are required", variant: "destructive" });
      return;
    }
    saveCaseMutation.mutate({
      cnrNumber: saveCnr.trim(),
      caseTitle: saveCaseTitle.trim(),
      court: saveCourt.trim() || undefined,
      caseStatus: saveCaseStatus.trim() || undefined,
      parties: saveParties.trim() || undefined,
      caseDetails: saveCaseDetails.trim() || undefined,
    });
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

  const getStatusColor = (status: string | null) => {
    if (!status) return "secondary";
    const s = status.toLowerCase();
    if (s.includes("pending") || s.includes("progress")) return "default";
    if (s.includes("disposed") || s.includes("closed") || s.includes("decided")) return "secondary";
    return "outline";
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
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="search" className="text-xs" data-testid="tab-cnr-search">
                    <Bot className="h-3 w-3 mr-1" />
                    CNR Search
                  </TabsTrigger>
                  <TabsTrigger value="save-case" className="text-xs" data-testid="tab-save-case">
                    <Bookmark className="h-3 w-3 mr-1" />
                    Save Case
                  </TabsTrigger>
                  <TabsTrigger value="saved-cases" className="text-xs" data-testid="tab-saved-cases">
                    <BookmarkCheck className="h-3 w-3 mr-1" />
                    Saved Cases ({savedCases.length})
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

              {activeTab === "save-case" && (
                <div className="p-4 h-full overflow-auto">
                  <div className="max-w-lg mx-auto space-y-4">
                    <div className="text-center mb-6">
                      <Bookmark className="h-10 w-10 text-primary mx-auto mb-2" />
                      <h3 className="font-semibold text-lg" data-testid="text-save-case-heading">Save a Case</h3>
                      <p className="text-sm text-muted-foreground">
                        Save case details from your CNR search for quick reference later
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">CNR Number *</label>
                        <Input
                          placeholder="e.g., DLHC010012345672024"
                          value={saveCnr}
                          onChange={(e) => setSaveCnr(e.target.value)}
                          className="font-mono"
                          data-testid="input-save-cnr"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Case Title *</label>
                        <Input
                          placeholder="e.g., State vs. John Doe"
                          value={saveCaseTitle}
                          onChange={(e) => setSaveCaseTitle(e.target.value)}
                          data-testid="input-save-case-title"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Court</label>
                          <Input
                            placeholder="e.g., Delhi High Court"
                            value={saveCourt}
                            onChange={(e) => setSaveCourt(e.target.value)}
                            data-testid="input-save-court"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Case Status</label>
                          <Input
                            placeholder="e.g., Pending, Disposed"
                            value={saveCaseStatus}
                            onChange={(e) => setSaveCaseStatus(e.target.value)}
                            data-testid="input-save-status"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Parties</label>
                        <Input
                          placeholder="e.g., Petitioner: ABC, Respondent: XYZ"
                          value={saveParties}
                          onChange={(e) => setSaveParties(e.target.value)}
                          data-testid="input-save-parties"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Case Details / Notes</label>
                        <Textarea
                          placeholder="Any additional details about this case..."
                          value={saveCaseDetails}
                          onChange={(e) => setSaveCaseDetails(e.target.value)}
                          className="min-h-[100px] resize-none"
                          data-testid="textarea-save-details"
                        />
                      </div>

                      <Button
                        onClick={handleSaveCase}
                        className="w-full"
                        disabled={saveCaseMutation.isPending}
                        data-testid="button-save-case"
                      >
                        <Bookmark className="h-4 w-4 mr-2" />
                        {saveCaseMutation.isPending ? "Saving..." : "Save Case"}
                      </Button>
                    </div>
                  </div>
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
                  ) : savedCases.length > 0 ? (
                    selectedCase ? (
                      <div className="flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCase(null)}
                            data-testid="button-back-to-cases"
                          >
                            Back to list
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteCaseMutation.mutate(selectedCase.id)}
                            disabled={deleteCaseMutation.isPending}
                            data-testid="button-delete-case"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                        <ScrollArea className="flex-1">
                          <div className="space-y-4 pr-2">
                            <div>
                              <h3 className="text-lg font-semibold" data-testid="text-case-title">{selectedCase.caseTitle}</h3>
                              <p className="font-mono text-sm text-muted-foreground mt-1" data-testid="text-case-cnr">
                                CNR: {selectedCase.cnrNumber}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              {selectedCase.court && (
                                <div className="flex items-start gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Court</p>
                                    <p className="text-sm font-medium" data-testid="text-case-court">{selectedCase.court}</p>
                                  </div>
                                </div>
                              )}
                              {selectedCase.caseStatus && (
                                <div className="flex items-start gap-2">
                                  <Scale className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <Badge variant={getStatusColor(selectedCase.caseStatus)} data-testid="badge-case-status">
                                      {selectedCase.caseStatus}
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </div>

                            {selectedCase.parties && (
                              <div className="flex items-start gap-2">
                                <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Parties</p>
                                  <p className="text-sm" data-testid="text-case-parties">{selectedCase.parties}</p>
                                </div>
                              </div>
                            )}

                            {selectedCase.caseDetails && (
                              <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">Details</p>
                                  <p className="text-sm whitespace-pre-wrap" data-testid="text-case-details">{selectedCase.caseDetails}</p>
                                </div>
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground flex items-center gap-1 pt-2 border-t">
                              <Clock className="h-3 w-3" />
                              Saved on {formatDate(selectedCase.savedAt)}
                            </div>
                          </div>
                        </ScrollArea>
                      </div>
                    ) : (
                      <ScrollArea className="flex-1">
                        <div className="space-y-3 pr-2">
                          {savedCases.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCase(c)}
                              className="p-4 rounded-md border hover-elevate cursor-pointer"
                              data-testid={`saved-case-${c.id}`}
                            >
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{c.caseTitle}</div>
                                  <div className="text-xs font-mono text-muted-foreground mt-1">
                                    CNR: {c.cnrNumber}
                                  </div>
                                </div>
                                {c.caseStatus && (
                                  <Badge variant={getStatusColor(c.caseStatus)} className="text-xs flex-shrink-0">
                                    {c.caseStatus}
                                  </Badge>
                                )}
                              </div>
                              {c.court && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                  <Building2 className="h-3 w-3" />
                                  {c.court}
                                </div>
                              )}
                              {c.parties && (
                                <div className="text-xs text-muted-foreground mt-1 truncate">
                                  {c.parties}
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
                    )
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-4 h-full">
                      <div>
                        <BookmarkCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium mb-1">No saved cases yet</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Search for a case using CNR number and save it for quick reference
                        </p>
                        <Button size="sm" variant="outline" onClick={() => setActiveTab("save-case")} data-testid="button-go-save-case">
                          <Bookmark className="h-3 w-3 mr-1" />
                          Save your first case
                        </Button>
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
                          onClick={() => handleDeleteNote(selectedNote.id)}
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

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Save, Plus, FileText, Trash2, Sparkles, Zap, Clock, AlertTriangle, ChevronDown, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { stripHtmlTags, isNewLaw } from "@/lib/utils";
import type { ResearchNote } from "@shared/schema";
import { jsPDF } from "jspdf";

interface SearchResult {
  tid: string;
  title: string;
  headline?: string;
  docId?: string;
}

interface AdvancedSearchResult {
  answer: string;
  sources: { title: string; url: string; source: string }[];
  extractedParagraphs: { text: string; citation: string; sections: string[]; acts: string[]; court: string }[];
  timeline: { date: string; event: string; source: string }[];
  conflicts: { issue: string; sources: string[] }[];
  tags: { sections: string[]; acts: string[]; courts: string[] };
  domainCount: number;
  disclaimer: string;
}

interface ResearchSidebarProps {
  isOpen: boolean;
  onAddToDocument?: (text: string) => void;
  draftId?: string;
}

export function ResearchSidebar({ isOpen, onAddToDocument, draftId }: ResearchSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [advancedResults, setAdvancedResults] = useState<AdvancedSearchResult | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [lawFilter, setLawFilter] = useState<"new" | "old">("new");
  const [notes, setNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [noteName, setNoteName] = useState("");
  const [activeTab, setActiveTab] = useState("research");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [notesSubTab, setNotesSubTab] = useState<"write" | "saved">("write");

  const { data: savedNotes = [], isLoading: notesLoading } = useQuery<ResearchNote[]>({
    queryKey: ["/api/research/notes", draftId],
    queryFn: async () => {
      const url = draftId ? `/api/research/notes?draftId=${draftId}` : "/api/research/notes";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch notes");
      return response.json();
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/research/search", { query });
      return response.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.results || []);
      setAdvancedResults(null);
    },
  });

  const advancedSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/research/advanced", { query });
      return response.json();
    },
    onSuccess: (data) => {
      setAdvancedResults(data);
      setSearchResults([]);
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ name, content, noteId }: { name: string; content: string; noteId?: string }) => {
      if (noteId) {
        const response = await apiRequest("PATCH", `/api/research/notes/${noteId}`, { name, content });
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/research/notes", { name, content, draftId });
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes", draftId] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes"] });
      setNotes("");
      setNoteName("");
      setEditingNoteId(null);
      setShowSaveDialog(false);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/research/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes", draftId] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes"] });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      if (isAdvancedMode) {
        advancedSearchMutation.mutate(searchQuery);
      } else {
        searchMutation.mutate(searchQuery);
      }
    }
  };

  const handleSaveNote = () => {
    if (noteName.trim() && notes.trim()) {
      saveNoteMutation.mutate({ name: noteName, content: notes, noteId: editingNoteId || undefined });
    }
  };

  const handleNewNote = () => {
    setEditingNoteId(null);
    setNotes("");
    setNoteName("");
  };

  const handleDownloadNote = (format: "txt" | "docx" | "pdf") => {
    const noteTitle = editingNoteId 
      ? savedNotes.find(n => n.id === editingNoteId)?.name || "note"
      : "note";
    
    if (format === "txt") {
      const blob = new Blob([notes], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${noteTitle}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "docx") {
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${noteTitle}</title></head>
        <body style="font-family: Arial; font-size: 12pt;">
          <h1>${noteTitle}</h1>
          <div>${notes.replace(/\n/g, '<br>')}</div>
        </body>
        </html>`;
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${noteTitle}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(noteTitle, margin, margin);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      
      const lines = doc.splitTextToSize(notes, maxWidth);
      let yPosition = margin + 15;
      const pageHeight = doc.internal.pageSize.getHeight();
      const lineHeight = 7;
      
      for (const line of lines) {
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
      }
      
      doc.save(`${noteTitle}.pdf`);
    }
  };

  const filteredResults = searchResults.filter((result) => {
    const isNew = isNewLaw(result.title);
    return lawFilter === "new" ? isNew : !isNew;
  });

  if (!isOpen) return null;

  return (
    <div className="w-[400px] min-w-[360px] flex flex-col bg-muted/30 border-l h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b px-4 h-10 shrink-0">
          <TabsTrigger value="research" className="text-xs">AI Legal Research</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="research" className="flex-1 p-4 mt-0 overflow-hidden relative" data-state={activeTab === "research" ? "active" : "inactive"}>
          <div className="absolute inset-0 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Switch
                  id="advanced-mode"
                  checked={isAdvancedMode}
                  onCheckedChange={setIsAdvancedMode}
                  data-testid="switch-advanced-mode"
                />
                <Label htmlFor="advanced-mode" className="text-xs flex items-center gap-1">
                  {isAdvancedMode && <Sparkles className="h-3 w-3 text-primary" />}
                  Advanced
                </Label>
              </div>
              {isAdvancedMode && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  <Zap className="h-2.5 w-2.5 mr-1" />
                  Live Search
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2 mb-4 shrink-0">
              <Input
                placeholder={isAdvancedMode ? "Advanced legal search..." : "Search legal provisions..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                data-testid="input-research-search"
              />
              <Button
                size="icon"
                onClick={handleSearch}
                disabled={searchMutation.isPending || advancedSearchMutation.isPending}
                data-testid="button-search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
            {(searchMutation.isPending || advancedSearchMutation.isPending) ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : advancedResults ? (
              <div className="space-y-3 pb-4">
                <p className="text-xs text-muted-foreground italic mb-2">
                  {advancedResults.disclaimer}
                </p>
                
                {advancedResults.answer && (
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {(() => {
                        let cleanAnswer = advancedResults.answer;
                        if (cleanAnswer.startsWith("```json") || cleanAnswer.startsWith("{")) {
                          try {
                            const jsonMatch = cleanAnswer.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                              const parsed = JSON.parse(jsonMatch[0]);
                              cleanAnswer = parsed.analysis || cleanAnswer;
                            }
                          } catch (e) {
                          }
                        }
                        return cleanAnswer.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                      })()}
                    </p>
                  </div>
                )}

                {advancedResults.extractedParagraphs.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium w-full p-2 rounded hover-elevate">
                      <ChevronDown className="h-3 w-3" />
                      Extracted Paragraphs ({advancedResults.extractedParagraphs.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {advancedResults.extractedParagraphs.map((p, i) => (
                        <div key={i} className="p-2 border rounded text-xs bg-muted/30">
                          <p className="italic">"{p.text}"</p>
                          <p className="text-muted-foreground mt-1">— {p.citation}</p>
                          {p.acts.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.acts.map((act, j) => (
                                <Badge key={j} variant="outline" className="text-[9px]">{act}</Badge>
                              ))}
                            </div>
                          )}
                          {onAddToDocument && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-6 mt-1"
                              onClick={() => onAddToDocument(`"${p.text}" — ${p.citation}`)}
                            >
                              <Plus className="h-2.5 w-2.5 mr-1" />
                              Add
                            </Button>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {advancedResults.timeline.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium w-full p-2 rounded hover-elevate">
                      <Clock className="h-3 w-3" />
                      Timeline ({advancedResults.timeline.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-2">
                      {advancedResults.timeline.map((t, i) => (
                        <div key={i} className="flex gap-2 text-xs p-1">
                          <span className="font-mono text-muted-foreground">{t.date}</span>
                          <span>{t.event}</span>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {advancedResults.conflicts.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium w-full p-2 rounded hover-elevate text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Conflicts ({advancedResults.conflicts.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {advancedResults.conflicts.map((c, i) => (
                        <div key={i} className="p-2 border border-amber-500/30 rounded text-xs bg-amber-500/5">
                          <p className="font-medium">{c.issue}</p>
                          <p className="text-muted-foreground mt-1">Sources: {c.sources.join(", ")}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {advancedResults.sources.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium mb-2">Sources ({advancedResults.sources.length})</p>
                    <div className="space-y-1">
                      {advancedResults.sources.slice(0, 5).map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-primary hover:underline truncate"
                        >
                          {s.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant={lawFilter === "new" ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setLawFilter("new")}
                    data-testid="button-filter-new"
                  >
                    New Laws
                  </Button>
                  <Button
                    variant={lawFilter === "old" ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setLawFilter("old")}
                    data-testid="button-filter-old"
                  >
                    Old Laws
                  </Button>
                </div>

                {filteredResults.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No {lawFilter === "new" ? "new" : "old"} law results found
                  </div>
                ) : (
                  filteredResults.map((result) => (
                    <div key={result.tid} className="p-3 border rounded-md bg-background">
                      <h4 className="font-medium text-sm break-words" title={stripHtmlTags(result.title)}>{stripHtmlTags(result.title)}</h4>
                      {result.headline && (
                        <p className="text-xs text-muted-foreground mt-1 break-words whitespace-pre-wrap">
                          {stripHtmlTags(result.headline)}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setNotes((prev) => prev + "\n\n" + stripHtmlTags(result.title))}
                          data-testid={`button-add-notes-${result.tid}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add to Notes
                        </Button>
                        {onAddToDocument && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => onAddToDocument(stripHtmlTags(result.title))}
                            data-testid={`button-add-doc-${result.tid}`}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Add to Document
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Search for legal provisions, case law, or statutes</p>
              </div>
            )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="flex-1 flex flex-col mt-0 overflow-hidden min-h-0">
          <Tabs value={notesSubTab} onValueChange={(v) => setNotesSubTab(v as "write" | "saved")} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full h-9 mx-4 mt-2" style={{ width: 'calc(100% - 32px)' }}>
              <TabsTrigger value="write" className="text-xs flex-1">Write</TabsTrigger>
              <TabsTrigger value="saved" className="text-xs flex-1">
                Saved ({savedNotes.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="write" className="flex-1 flex flex-col px-4 pb-4 mt-2 overflow-hidden">
              <div className="flex-1 flex flex-col min-h-0">
                <Textarea
                  placeholder="Write your notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex-1 resize-none text-sm border rounded-md bg-background"
                  style={{ minHeight: '100%' }}
                  data-testid="textarea-notes"
                />
              </div>
              <div className="flex gap-2 mt-3 shrink-0">
                {editingNoteId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleNewNote}
                    data-testid="button-new-note"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={editingNoteId ? "" : "w-10"}
                      disabled={!notes.trim()}
                      data-testid="button-download-note"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleDownloadNote("txt")} data-testid="download-txt">
                      <FileText className="h-4 w-4 mr-2" />
                      Download as TXT
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadNote("docx")} data-testid="download-docx">
                      <FileText className="h-4 w-4 mr-2" />
                      Download as DOC
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownloadNote("pdf")} data-testid="download-pdf">
                      <FileText className="h-4 w-4 mr-2" />
                      Download as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  className="flex-1 bg-[#c4a67c] hover:bg-[#b39669] text-white"
                  size="sm"
                  onClick={() => {
                    if (editingNoteId) {
                      const existingNote = savedNotes.find(n => n.id === editingNoteId);
                      setNoteName(existingNote?.name || "");
                    }
                    setShowSaveDialog(true);
                  }}
                  disabled={!notes.trim()}
                  data-testid="button-save-note"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingNoteId ? "Update" : "Save Note"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="saved" className="flex-1 px-4 pb-4 mt-2 overflow-hidden">
              <ScrollArea className="h-full">
                {notesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : savedNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No saved notes yet
                  </div>
                ) : (
                  <div className="space-y-2 pb-4">
                    {savedNotes.map((note) => (
                      <div 
                        key={note.id} 
                        className="p-3 border rounded-md bg-background cursor-pointer hover-elevate transition-colors"
                        onClick={() => {
                          setNotes(note.content || "");
                          setNoteName(note.name || "");
                          setEditingNoteId(note.id);
                          setNotesSubTab("write");
                        }}
                        data-testid={`note-card-${note.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium text-sm truncate">{note.name || "Untitled Note"}</h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNoteMutation.mutate(note.id);
                            }}
                            disabled={deleteNoteMutation.isPending}
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNoteId ? "Update Note" : "Save Note"}</DialogTitle>
            <DialogDescription>
              Enter a name for your note to save it for later.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Note name..."
            value={noteName}
            onChange={(e) => setNoteName(e.target.value)}
            data-testid="input-note-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNote}
              disabled={!noteName.trim() || saveNoteMutation.isPending}
              className="bg-[#c4a67c] hover:bg-[#b39669]"
            >
              {saveNoteMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

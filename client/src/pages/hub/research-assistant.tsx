import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Sparkles,
  BookOpen,
  Scale,
  FileText,
  ExternalLink,
  Plus,
  Clock,
  Save,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResearchQuery } from "@shared/schema";

interface SearchResult {
  id: string;
  title: string;
  headline?: string;
  source: string;
  court?: string;
  date?: string;
  isNewLaw?: boolean;
}

export default function ResearchAssistantPage() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [lawFilter, setLawFilter] = useState<"new" | "old">("new");
  const [notes, setNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [noteName, setNoteName] = useState("");
  const { toast } = useToast();

  const { data: savedNotes = [] } = useQuery<ResearchQuery[]>({
    queryKey: ["/api/research/notes"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; query: string }) => {
      const res = await apiRequest("POST", "/api/research/notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes"] });
      setShowSaveDialog(false);
      setNoteName("");
      toast({ title: "Notes saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save notes", variant: "destructive" });
    },
  });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);

    try {
      const response = await apiRequest("POST", "/api/research/search", { query });
      const data = await response.json();
      
      const mappedResults: SearchResult[] = (data.results || []).map((r: any, idx: number) => ({
        id: r.docId || String(idx + 1),
        title: r.title || "Untitled",
        headline: r.headline,
        source: r.court || "Indian Kanoon",
        court: r.court,
        date: r.date,
        isNewLaw: r.title?.toLowerCase().includes("bns") || 
                  r.title?.toLowerCase().includes("bnss") || 
                  r.title?.toLowerCase().includes("bharatiya"),
      }));
      
      setResults(mappedResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredResults = results.filter((r) =>
    lawFilter === "new" ? r.isNewLaw !== false : r.isNewLaw === false
  );

  const addToNotes = (result: SearchResult) => {
    const newNote = `\n\n---\n${result.title}\n${result.headline || ""}\nSource: ${result.source}\n`;
    setNotes((prev) => prev + newNote);
    toast({ title: "Added to notes" });
  };

  const handleSaveNotes = () => {
    if (!noteName.trim() || !notes.trim()) return;
    saveMutation.mutate({
      title: noteName,
      content: notes,
      query: query || "Research Notes",
    });
  };

  const loadSavedNotes = (saved: ResearchQuery) => {
    // Results are already parsed by the API
    const parsed = saved.results as unknown as { title: string; content: string; savedAt: string };
    if (parsed && parsed.content) {
      setNotes(parsed.content);
    }
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-md bg-primary/10">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">AI Legal Research</h1>
              <p className="text-xs text-muted-foreground">Powered by Indian Kanoon</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Search statutes, case law, legal provisions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
              data-testid="input-search"
            />
            <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search">
              {isSearching ? <Sparkles className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {results.length > 0 && (
            <div className="p-4 border-b">
              <div className="flex gap-2">
                <Button
                  variant={lawFilter === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLawFilter("new")}
                  data-testid="button-filter-new"
                >
                  New Laws
                </Button>
                <Button
                  variant={lawFilter === "old" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLawFilter("old")}
                  data-testid="button-filter-old"
                >
                  Old Laws
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {results.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="font-medium mb-2">Search Indian Legal Database</h3>
                  <p className="text-sm">
                    Enter a query to search statutes, case law, and legal provisions from Indian Kanoon
                  </p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No results for this filter. Try switching to {lawFilter === "new" ? "Old Laws" : "New Laws"}.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{filteredResults.length} results found</p>
                  {filteredResults.map((result) => (
                    <Card key={result.id} data-testid={`result-${result.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded bg-muted flex-shrink-0">
                            <Scale className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-medium">{result.title}</h3>
                              {result.isNewLaw && (
                                <Badge variant="secondary" className="text-[10px]">New Law</Badge>
                              )}
                            </div>
                            {result.headline && (
                              <p className="text-sm text-muted-foreground mb-3">{result.headline}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {result.source}
                              </span>
                              {result.court && (
                                <span className="flex items-center gap-1">
                                  <Scale className="h-3 w-3" />
                                  {result.court}
                                </span>
                              )}
                              {result.date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {result.date}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs" 
                            onClick={() => addToNotes(result)}
                            data-testid={`button-add-notes-${result.id}`}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Notes
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-add-doc-${result.id}`}>
                            <FileText className="h-3 w-3 mr-1" />
                            Add to Document
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-view-${result.id}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Full
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="w-80 border-l flex flex-col bg-muted/30">
        <Tabs defaultValue="notes" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="saved">
              Saved
              {savedNotes.length > 0 && (
                <Badge variant="secondary" className="ml-2">{savedNotes.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="flex-1 flex flex-col p-4 mt-0 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              <Textarea
                placeholder="Your research notes...

Save important findings, citations, and analysis here."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 resize-none"
                data-testid="textarea-notes"
              />
              <Button 
                className="w-full mt-3" 
                onClick={() => setShowSaveDialog(true)}
                disabled={!notes.trim()}
                data-testid="button-save-notes"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Notes
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="saved" className="flex-1 p-4 mt-0 overflow-auto">
            {savedNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No saved notes yet</p>
                <p className="text-xs mt-1">Save your research notes to access them later</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedNotes.map((saved) => (
                  <Card key={saved.id} className="hover-elevate cursor-pointer" onClick={() => loadSavedNotes(saved)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm line-clamp-1">{saved.query}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(saved.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Research Notes</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Note Name</Label>
            <Input
              placeholder="e.g., Criminal Law Research - BNS Sections"
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              data-testid="input-note-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveNotes} 
              disabled={!noteName.trim() || saveMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

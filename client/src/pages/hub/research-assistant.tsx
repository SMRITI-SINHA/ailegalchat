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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  AlertTriangle,
  Quote,
  Calendar,
  Tag,
  Globe,
  Zap,
  Shield,
  Building2,
  Gavel,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { stripHtmlTags, isNewLaw } from "@/lib/utils";
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

interface ExtractedParagraph {
  text: string;
  citation: string;
  sections?: string[];
  acts?: string[];
  court?: string;
}

interface TimelineEvent {
  date: string;
  event: string;
  source: string;
}

interface Conflict {
  issue: string;
  sources: string[];
}

interface AdvancedSearchResult {
  query: string;
  disclaimer: string;
  answer: string;
  sources: Array<{ title: string; url: string; source: string }>;
  extractedParagraphs: ExtractedParagraph[];
  timeline: TimelineEvent[];
  conflicts: Conflict[];
  tags: {
    sections: string[];
    acts: string[];
    courts: string[];
  };
  domainCount: number;
  kanoonResults: any[];
}

export default function ResearchAssistantPage() {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"standard" | "advanced">("standard");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [advancedResults, setAdvancedResults] = useState<AdvancedSearchResult | null>(null);
  const [lawFilter, setLawFilter] = useState<"all" | "new" | "old">("all");
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
      if (searchMode === "advanced") {
        const response = await apiRequest("POST", "/api/research/advanced", { query });
        const data = await response.json();
        setAdvancedResults(data);
        setResults([]);
      } else {
        const response = await apiRequest("POST", "/api/research/search", { query });
        const data = await response.json();
        
        const mappedResults: SearchResult[] = (data.results || []).map((r: any, idx: number) => ({
          id: r.docId || String(idx + 1),
          title: stripHtmlTags(r.title) || "Untitled",
          headline: stripHtmlTags(r.headline),
          source: r.court || "Indian Kanoon",
          court: r.court,
          date: r.date,
          isNewLaw: isNewLaw(r.title),
        }));
        
        setResults(mappedResults);
        setAdvancedResults(null);
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
      setAdvancedResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredResults = results.filter((r) => {
    if (lawFilter === "all") return true;
    return lawFilter === "new" ? r.isNewLaw !== false : r.isNewLaw === false;
  });

  const addToNotes = (text: string, citation?: string) => {
    const newNote = citation 
      ? `\n\n---\n"${text}"\n— ${citation}\n`
      : `\n\n---\n${text}\n`;
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
    const parsed = saved.results as unknown as { title: string; content: string; savedAt: string };
    if (parsed && parsed.content) {
      setNotes(parsed.content);
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="font-semibold text-lg">AI Legal Research</h1>
              <p className="text-xs text-muted-foreground">Expert-grade AI legal research across authoritative Indian law</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={searchMode === "standard" ? "default" : "outline"}
                size="sm"
                onClick={() => setSearchMode("standard")}
                data-testid="button-mode-standard"
              >
                <Search className="h-3 w-3 mr-1" />
                Standard
              </Button>
              <Button
                variant={searchMode === "advanced" ? "default" : "outline"}
                size="sm"
                onClick={() => setSearchMode("advanced")}
                className={searchMode === "advanced" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0" : ""}
                data-testid="button-mode-advanced"
              >
                <Zap className="h-3 w-3 mr-1" />
                Advanced
              </Button>
            </div>
          </div>

          {searchMode === "advanced" && (
            <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-medium">Advanced Mode Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Live legal research across authoritative Indian law sources with extracted paragraphs, chronological timelines, and conflict detection.
              </p>
            </div>
          )}

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
          {advancedResults ? (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">Research Scope Summary</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                      {advancedResults.disclaimer}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {advancedResults.domainCount}+ Indian legal sources
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {advancedResults.sources.length} citations found
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {advancedResults.tags && (advancedResults.tags.sections.length > 0 || advancedResults.tags.acts.length > 0 || advancedResults.tags.courts.length > 0) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Tags & References</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {advancedResults.tags.sections.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Sections</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {advancedResults.tags.sections.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{truncateText(s, 30)}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {advancedResults.tags.acts.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Acts & Statutes</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {advancedResults.tags.acts.map((a, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{truncateText(a, 40)}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {advancedResults.tags.courts.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Courts</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {advancedResults.tags.courts.map((c, i) => (
                              <Badge key={i} className="text-xs bg-primary/10 text-primary border-0">
                                <Gavel className="h-2.5 w-2.5 mr-1" />
                                {truncateText(c, 30)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">Analysis</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{advancedResults.answer}</p>
                  </CardContent>
                </Card>

                {advancedResults.extractedParagraphs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Quote className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Extracted Paragraphs (Verbatim)</CardTitle>
                      </div>
                      <CardDescription>Direct quotes from legal sources</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {advancedResults.extractedParagraphs.map((para, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
                          <p className="text-sm italic">"{para.text}"</p>
                          <p className="text-xs text-muted-foreground mt-2 font-medium">— {para.citation}</p>
                          {(para.sections?.length || para.acts?.length || para.court) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {para.sections?.map((s, j) => (
                                <Badge key={j} variant="outline" className="text-[10px]">{truncateText(s, 20)}</Badge>
                              ))}
                              {para.acts?.map((a, j) => (
                                <Badge key={j} variant="secondary" className="text-[10px]">{truncateText(a, 25)}</Badge>
                              ))}
                              {para.court && (
                                <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                                  <Gavel className="h-2 w-2 mr-0.5" />
                                  {truncateText(para.court, 20)}
                                </Badge>
                              )}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={() => addToNotes(para.text, para.citation)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Notes
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {advancedResults.timeline.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Chronological Timeline</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {advancedResults.timeline.map((event, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-primary">{event.date}</span>
                              </div>
                              <p className="text-sm">{event.event}</p>
                              <p className="text-xs text-muted-foreground">Source: {truncateText(event.source, 50)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {advancedResults.conflicts.length > 0 && (
                  <Card className="border-amber-500/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">Conflicts Between Sources</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {advancedResults.conflicts.map((conflict, i) => (
                        <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <p className="text-sm font-medium">{conflict.issue}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {conflict.sources.map((s, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{truncateText(s, 30)}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {advancedResults.sources.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">Sources</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {advancedResults.sources.map((source, i) => (
                          <a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded hover-elevate text-sm"
                          >
                            <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{source.source}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          ) : (
            <>
              {results.length > 0 && (
                <div className="p-4 border-b">
                  <div className="flex gap-2">
                    <Button
                      variant={lawFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLawFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      variant={lawFilter === "new" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLawFilter("new")}
                    >
                      New Laws
                    </Button>
                    <Button
                      variant={lawFilter === "old" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLawFilter("old")}
                    >
                      Old Laws
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {isSearching ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Skeleton className="h-10 w-10 rounded" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-3 w-1/2" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="font-medium mb-2">Search Indian Legal Database</h3>
                      <p className="text-sm">
                        Enter a query to search statutes, case law, and legal provisions
                      </p>
                    </div>
                  ) : filteredResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No results for this filter.</p>
                    </div>
                  ) : (
                    <>
                      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <p className="text-xs text-muted-foreground italic">
                              This research compiles judicial decisions and statutory provisions. No legal opinion or advice is provided.
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <p className="text-sm text-muted-foreground">{filteredResults.length} results found</p>
                      {filteredResults.map((result) => (
                        <Card key={result.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded bg-muted flex-shrink-0">
                                <Scale className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-medium truncate max-w-[300px]" title={result.title}>
                                    {truncateText(result.title, 50)}
                                  </h3>
                                  {result.isNewLaw && (
                                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">New Law</Badge>
                                  )}
                                </div>
                                {result.headline && (
                                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{result.headline}</p>
                                )}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {truncateText(result.source, 20)}
                                  </span>
                                  {result.court && (
                                    <span className="flex items-center gap-1">
                                      <Scale className="h-3 w-3" />
                                      {truncateText(result.court, 20)}
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
                                onClick={() => addToNotes(`${result.title}\n${result.headline || ""}`, result.source)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add to Notes
                              </Button>
                              <Button variant="ghost" size="sm" className="text-xs">
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
            </>
          )}
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
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm truncate" title={saved.query}>
                            {truncateText(saved.query, 25)}
                          </h4>
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

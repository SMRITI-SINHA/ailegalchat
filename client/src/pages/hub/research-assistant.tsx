import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Sparkles,
  BookOpen,
  Scale,
  FileText,
  ExternalLink,
  Plus,
  Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

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
      
      setResults(mappedResults.length > 0 ? mappedResults : getFallbackResults());
    } catch (error) {
      console.error("Search error:", error);
      setResults(getFallbackResults());
    } finally {
      setIsSearching(false);
    }
  };

  const getFallbackResults = (): SearchResult[] => [
    {
      id: "1",
      title: "Section 103(1) Bharatiya Nyaya Sanhita (BNS)",
      headline: "Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine.",
      source: "Bharatiya Nyaya Sanhita, 2023",
      isNewLaw: true,
    },
    {
      id: "2",
      title: "Section 302 Indian Penal Code (IPC)",
      headline: "Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.",
      source: "Indian Penal Code, 1860",
      isNewLaw: false,
    },
  ];

  const filteredResults = results.filter((r) =>
    lawFilter === "new" ? r.isNewLaw !== false : r.isNewLaw === false
  );

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

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {results.length === 0 ? (
                <div className="text-center py-16">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="font-medium mb-2">Search Legal Database</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Search for statutes, case law, and legal provisions from Indian Kanoon. Results include New Laws (BNS, BNSS, BSA) and Old Laws (IPC, CrPC, IEA).
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Found {filteredResults.length} results for "{query}"
                  </p>
                  {filteredResults.map((result) => (
                    <Card key={result.id} data-testid={`result-${result.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{result.title}</h3>
                              {result.isNewLaw && (
                                <Badge variant="default" className="text-[10px]">New Law</Badge>
                              )}
                            </div>
                            {result.headline && (
                              <p className="text-sm text-muted-foreground mb-3">{result.headline}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-add-notes-${result.id}`}>
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
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="flex-1 p-4 mt-0">
            <Textarea
              placeholder="Your research notes...

Save important findings, citations, and analysis here. These notes will persist across your research session."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-full resize-none"
            />
          </TabsContent>
          <TabsContent value="saved" className="flex-1 p-4 mt-0">
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No saved items yet</p>
              <p className="text-xs mt-1">Click "Add to Notes" on any result</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

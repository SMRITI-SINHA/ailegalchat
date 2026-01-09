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
} from "@/components/ui/dialog";
import { Search, Save, Plus, FileText, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { stripHtmlTags, isNewLaw } from "@/lib/utils";
import type { ResearchNote } from "@shared/schema";

interface SearchResult {
  tid: string;
  title: string;
  headline?: string;
  docId?: string;
}

interface ResearchSidebarProps {
  isOpen: boolean;
  onAddToDocument?: (text: string) => void;
  draftId?: string;
}

export function ResearchSidebar({ isOpen, onAddToDocument, draftId }: ResearchSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [lawFilter, setLawFilter] = useState<"new" | "old">("new");
  const [notes, setNotes] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [noteName, setNoteName] = useState("");
  const [activeTab, setActiveTab] = useState("research");

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
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const response = await apiRequest("POST", "/api/research/notes", { name, content, draftId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes", draftId] });
      setNotes("");
      setNoteName("");
      setShowSaveDialog(false);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/research/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes", draftId] });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleSaveNote = () => {
    if (noteName.trim() && notes.trim()) {
      saveNoteMutation.mutate({ name: noteName, content: notes });
    }
  };

  const filteredResults = searchResults.filter((result) => {
    const isNew = isNewLaw(result.title);
    return lawFilter === "new" ? isNew : !isNew;
  });

  if (!isOpen) return null;

  return (
    <div className="w-80 flex flex-col overflow-hidden bg-muted/30 border-l">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b px-4 h-10">
          <TabsTrigger value="research" className="text-xs">AI Legal Research</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="research" className="flex-1 flex flex-col p-4 mt-0 overflow-hidden">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search legal provisions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-research-search"
            />
            <Button
              size="icon"
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              data-testid="button-search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {searchMutation.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
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
                      <h4 className="font-medium text-sm line-clamp-2">{stripHtmlTags(result.title)}</h4>
                      {result.headline && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
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
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notes" className="flex-1 flex flex-col p-4 mt-0 overflow-hidden">
          <Tabs defaultValue="write" className="flex-1 flex flex-col">
            <TabsList className="w-full h-8">
              <TabsTrigger value="write" className="text-xs flex-1">Write</TabsTrigger>
              <TabsTrigger value="saved" className="text-xs flex-1">
                Saved ({savedNotes.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="write" className="flex-1 flex flex-col mt-2">
              <Textarea
                placeholder="Your research notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 resize-none text-sm"
                data-testid="textarea-notes"
              />
              <Button
                className="mt-2 w-full"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={!notes.trim()}
                data-testid="button-save-note"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Note
              </Button>
            </TabsContent>

            <TabsContent value="saved" className="flex-1 mt-2">
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
                  <div className="space-y-2">
                    {savedNotes.map((note) => (
                      <div key={note.id} className="p-3 border rounded-md bg-background">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium text-sm truncate">{note.name}</h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
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
            <DialogTitle>Save Note</DialogTitle>
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
            >
              {saveNoteMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

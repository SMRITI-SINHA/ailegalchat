import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResearchNote } from "@shared/schema";
import { ArrowLeft, StickyNote, Search, MoreVertical, Trash2, FileText, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function ResearchNotesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<ResearchNote | null>(null);

  const { data: notes = [], isLoading } = useQuery<ResearchNote[]>({
    queryKey: ["/api/research/notes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/research/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/notes"] });
      toast({ title: "Note deleted successfully" });
      setShowDeleteDialog(false);
      setNoteToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    },
  });

  const filteredNotes = notes.filter(
    (note) =>
      note.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewNote = (note: ResearchNote) => {
    setSelectedNote(note);
    setShowViewDialog(true);
  };

  const handleDeleteClick = (note: ResearchNote) => {
    setNoteToDelete(note);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (noteToDelete) {
      deleteMutation.mutate(noteToDelete.id);
    }
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/hub")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <StickyNote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Saved Notes</h1>
              <p className="text-sm text-muted-foreground">
                View and manage all your research notes
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-notes"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
            </span>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">
                Loading notes...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {searchQuery ? "No notes match your search" : "No saved notes yet"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleViewNote(note)}
                    data-testid={`note-item-${note.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-md bg-muted shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{note.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {note.content.slice(0, 150)}
                            {note.content.length > 150 ? "..." : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(note.createdAt), "MMM d, yyyy")}
                            </span>
                            {note.draftId && (
                              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                                Linked to draft
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(note);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedNote?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
              {selectedNote?.content}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{noteToDelete?.name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

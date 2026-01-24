import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ResearchNote } from "@shared/schema";
import { ArrowLeft, StickyNote, Search, MoreVertical, Trash2, FileText, Calendar, Plus, Edit, Download } from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";

export default function ResearchNotesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<ResearchNote | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<ResearchNote | null>(null);
  const [newNoteName, setNewNoteName] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editNoteName, setEditNoteName] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");

  const { data: notes = [], isLoading } = useQuery<ResearchNote[]>({
    queryKey: ["/api/research/notes"],
  });

  const invalidateAllNotesQueries = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === "/api/research/notes";
      },
    });
  };

  const createMutation = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const response = await apiRequest("POST", "/api/research/notes", { name, content });
      return response.json();
    },
    onSuccess: () => {
      invalidateAllNotesQueries();
      toast({ title: "Note created successfully" });
      setShowCreateDialog(false);
      setNewNoteName("");
      setNewNoteContent("");
    },
    onError: () => {
      toast({ title: "Failed to create note", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, content }: { id: string; name: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/research/notes/${id}`, { name, content });
      return response.json();
    },
    onSuccess: () => {
      invalidateAllNotesQueries();
      toast({ title: "Note updated successfully" });
      setShowEditDialog(false);
      setSelectedNote(null);
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/research/notes/${id}`);
    },
    onSuccess: () => {
      invalidateAllNotesQueries();
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
      (note.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.content || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewNote = (note: ResearchNote) => {
    setSelectedNote(note);
    setShowViewDialog(true);
  };

  const handleEditNote = (note: ResearchNote) => {
    setSelectedNote(note);
    setEditNoteName(note.name || "");
    setEditNoteContent(note.content || "");
    setShowEditDialog(true);
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

  const handleCreateNote = () => {
    if (newNoteName.trim() && newNoteContent.trim()) {
      createMutation.mutate({ name: newNoteName, content: newNoteContent });
    }
  };

  const handleUpdateNote = () => {
    if (selectedNote && editNoteName.trim() && editNoteContent.trim()) {
      updateMutation.mutate({ id: selectedNote.id, name: editNoteName, content: editNoteContent });
    }
  };

  const handleDownloadNote = (note: ResearchNote, format: "txt" | "docx" | "pdf") => {
    const noteTitle = note.name || "note";
    const noteContent = note.content || "";
    
    if (format === "txt") {
      const blob = new Blob([noteContent], { type: "text/plain" });
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
          <div>${noteContent.replace(/\n/g, '<br>')}</div>
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
      
      const lines = doc.splitTextToSize(noteContent, maxWidth);
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

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <BackButton />
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
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-[#c4a67c] hover:bg-[#b39669]"
          data-testid="button-create-note"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Note
        </Button>
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
                            {(note.content || "").slice(0, 150)}
                            {(note.content || "").length > 150 ? "..." : ""}
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
                              handleEditNote(note);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadNote(note, "txt");
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download TXT
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadNote(note, "docx");
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download DOC
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadNote(note, "pdf");
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </DropdownMenuItem>
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
            <Button 
              onClick={() => {
                setShowViewDialog(false);
                if (selectedNote) handleEditNote(selectedNote);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>
              Add a new research note to save your findings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Note title..."
                value={newNoteName}
                onChange={(e) => setNewNoteName(e.target.value)}
                data-testid="input-new-note-name"
              />
            </div>
            <div>
              <Textarea
                placeholder="Write your note content here..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="min-h-[200px] resize-none"
                data-testid="textarea-new-note-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={!newNoteName.trim() || !newNoteContent.trim() || createMutation.isPending}
              className="bg-[#c4a67c] hover:bg-[#b39669]"
            >
              {createMutation.isPending ? "Creating..." : "Create Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update your research note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Note title..."
                value={editNoteName}
                onChange={(e) => setEditNoteName(e.target.value)}
                data-testid="input-edit-note-name"
              />
            </div>
            <div>
              <Textarea
                placeholder="Write your note content here..."
                value={editNoteContent}
                onChange={(e) => setEditNoteContent(e.target.value)}
                className="min-h-[200px] resize-none"
                data-testid="textarea-edit-note-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateNote}
              disabled={!editNoteName.trim() || !editNoteContent.trim() || updateMutation.isPending}
              className="bg-[#c4a67c] hover:bg-[#b39669]"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{noteToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
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

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Plus, Save, Trash2, FileText, Clock, List, Edit3 } from "lucide-react";
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

export default function CNRChatPage() {
  const { toast } = useToast();
  const [selectedNote, setSelectedNote] = useState<CnrNote | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [cnrNumber, setCnrNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("editor");

  const { data: notes = [], isLoading: notesLoading } = useQuery<CnrNote[]>({
    queryKey: ["/api/cnr/notes"],
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

  const handleNewNote = () => {
    setSelectedNote(null);
    setNoteTitle("");
    setNoteContent("");
    setCnrNumber("");
    setIsEditing(true);
    setActiveTab("editor");
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
    setActiveTab("editor");
  };

  const handleDeleteNote = (noteId: string) => {
    deleteNoteMutation.mutate(noteId);
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

  return (
    <div className="p-6 h-full">
      <div className="flex items-center gap-3 mb-6">
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
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                eCourts CNR Search
              </CardTitle>
              <CardDescription>
                Enter your CNR number to check case status from eCourts database
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-80px)]">
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
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
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

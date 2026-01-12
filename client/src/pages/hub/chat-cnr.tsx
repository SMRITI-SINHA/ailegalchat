import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Plus, Save, Trash2, FileText, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CNRNote {
  id: string;
  title: string;
  content: string;
  cnrNumber?: string;
  createdAt: string;
  updatedAt: string;
}

const CNR_NOTES_KEY = "chakshi_cnr_notes";

function loadNotes(): CNRNote[] {
  try {
    const stored = localStorage.getItem(CNR_NOTES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotesToStorage(notes: CNRNote[]) {
  localStorage.setItem(CNR_NOTES_KEY, JSON.stringify(notes));
}

export default function CNRChatPage() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<CNRNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<CNRNote | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [cnrNumber, setCnrNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const handleNewNote = () => {
    setSelectedNote(null);
    setNoteTitle("");
    setNoteContent("");
    setCnrNumber("");
    setIsEditing(true);
  };

  const handleSaveNote = () => {
    if (!noteTitle.trim() && !noteContent.trim()) {
      toast({ title: "Please add a title or content", variant: "destructive" });
      return;
    }

    const now = new Date().toISOString();
    
    if (selectedNote) {
      const updatedNotes = notes.map(n => 
        n.id === selectedNote.id 
          ? { ...n, title: noteTitle, content: noteContent, cnrNumber, updatedAt: now }
          : n
      );
      setNotes(updatedNotes);
      saveNotesToStorage(updatedNotes);
      toast({ title: "Note updated" });
    } else {
      const newNote: CNRNote = {
        id: `cnr-note-${Date.now()}`,
        title: noteTitle || "Untitled Note",
        content: noteContent,
        cnrNumber: cnrNumber || undefined,
        createdAt: now,
        updatedAt: now,
      };
      const updatedNotes = [newNote, ...notes];
      setNotes(updatedNotes);
      saveNotesToStorage(updatedNotes);
      setSelectedNote(newNote);
      toast({ title: "Note saved" });
    }
    setIsEditing(false);
  };

  const handleSelectNote = (note: CNRNote) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setCnrNumber(note.cnrNumber || "");
    setIsEditing(false);
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    saveNotesToStorage(updatedNotes);
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setNoteTitle("");
      setNoteContent("");
      setCnrNumber("");
      setIsEditing(false);
    }
    toast({ title: "Note deleted" });
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
              <div className="flex justify-center p-4 h-full">
                <iframe 
                  src="https://cnr-chatbot--smritiseema1022.replit.app" 
                  width="100%"
                  height="100%" 
                  style={{ border: "none", borderRadius: "12px", maxWidth: "500px", minHeight: "550px" }}
                  title="eCourts CNR Search"
                  data-testid="iframe-cnr-chatbot"
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
              <CardDescription>
                Save notes while researching cases
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
              {isEditing || selectedNote ? (
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
                    <Button onClick={handleSaveNote} className="flex-1" data-testid="button-save-note">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    {selectedNote && (
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => handleDeleteNote(selectedNote.id)}
                        data-testid="button-delete-note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : notes.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-2 pr-2">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => handleSelectNote(note)}
                        className="p-3 rounded-md border hover-elevate cursor-pointer"
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
                <div className="flex-1 flex items-center justify-center text-center p-4">
                  <div>
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No notes yet. Click "New" to create your first note.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

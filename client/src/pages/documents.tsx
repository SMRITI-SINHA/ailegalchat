import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadDropzone } from "@/components/upload-dropzone";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import {
  Plus,
  Search,
  FileText,
  MoreVertical,
  Trash2,
  MessageSquare,
  Download,
  Eye,
  Filter,
  SortAsc,
  Clock,
  FileType,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Document, DocumentStatus } from "@shared/schema";
import { Link } from "wouter";

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsUploadOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-muted-foreground">Upload and manage your legal documents</p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-document">
              <Plus className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Documents</DialogTitle>
            </DialogHeader>
            <UploadDropzone
              onUpload={async (files) => {
                await uploadMutation.mutateAsync(files);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-documents"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <SortAsc className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-12 mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No documents yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Upload your first legal document to get started with AI-powered analysis.
            </p>
            <Button onClick={() => setIsUploadOpen(true)} data-testid="button-upload-first">
              <Plus className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDocs.map((doc) => (
            <Card
              key={doc.id}
              className="hover-elevate cursor-pointer group"
              onClick={() => setSelectedDoc(doc)}
              data-testid={`card-document-${doc.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-3 rounded-md bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <Link href={`/chat?doc=${doc.id}`}>
                        <DropdownMenuItem>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Chat
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(doc.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-3">
                  <h3 className="font-medium truncate">{doc.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <DocumentStatusBadge status={doc.status as DocumentStatus} />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex items-center text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <FileType className="h-3 w-3" />
                    {formatFileSize(doc.size)}
                    {doc.pages && doc.pages > 0 && ` | ${doc.pages} pages`}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  {formatDate(doc.uploadedAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          {selectedDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedDoc.name}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-md bg-muted">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <DocumentStatusBadge status={selectedDoc.status as DocumentStatus} className="mt-1" />
                    </div>
                    <div className="p-3 rounded-md bg-muted">
                      <p className="text-xs text-muted-foreground">Size</p>
                      <p className="text-sm font-medium mt-1">{formatFileSize(selectedDoc.size)}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted">
                      <p className="text-xs text-muted-foreground">Pages</p>
                      <p className="text-sm font-medium mt-1">{selectedDoc.pages || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-md bg-muted">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium mt-1">{selectedDoc.type || "Document"}</p>
                    </div>
                  </div>

                  {selectedDoc.summary && (
                    <div>
                      <h4 className="font-medium mb-2">AI Summary</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedDoc.summary}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link href={`/chat?doc=${selectedDoc.id}`}>
                      <Button data-testid="button-chat-with-doc">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Chat with Document
                      </Button>
                    </Link>
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

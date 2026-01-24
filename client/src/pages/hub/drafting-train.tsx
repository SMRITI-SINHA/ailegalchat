import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  GraduationCap,
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingDoc } from "@shared/schema";

export default function TrainDraftsPage() {
  const [isUploading, setIsUploading] = useState(false);

  const { data: trainingDocs = [], isLoading } = useQuery<TrainingDoc[]>({
    queryKey: ["/api/training-docs"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("userId", "default-user");
      
      const response = await fetch("/api/training-docs/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-docs"] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/training-docs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-docs"] });
    },
  });

  const handleFilesSelected = async (files: File[]) => {
    setIsUploading(true);
    uploadMutation.mutate(files);
  };

  const handleRemove = (id: string) => {
    deleteMutation.mutate(id);
  };

  const completedCount = trainingDocs.filter((d) => d.status === "completed").length;
  const processingCount = trainingDocs.filter((d) => d.status === "processing" || d.status === "pending").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <BackButton />
        <div className="p-2 rounded-md bg-primary/10">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Train Your Drafts</h1>
          <p className="text-muted-foreground">Teach Chakshi how your firm drafts documents</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Training Documents</CardTitle>
          <CardDescription>
            Upload your firm's SOPs, playbooks, and past drafts to help Chakshi understand your preferred structure, language, clauses, and tone. (Max 10 docs, 20 pages each)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>Processing documents...</p>
              <p className="text-xs">Extracting structure and formatting patterns</p>
            </div>
          ) : (
            <UploadDropzone
              onUpload={handleFilesSelected}
              maxFiles={10}
              maxSize={15 * 1024 * 1024}
              maxPages={20}
              description="Max 10 docs, 20 pages each, 100 pages total, 15MB. PDF, Word supported."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Training Documents</CardTitle>
            <CardDescription>
              These documents help Chakshi learn your firm's drafting style, structure, and tone. This training is applied automatically to future drafts.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {completedCount} Trained
            </Badge>
            {processingCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {processingCount} Processing
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trainingDocs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No training documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trainingDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border rounded-md"
                  data-testid={`training-doc-${doc.id}`}
                >
                  <div className="p-2 rounded-md bg-muted">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(doc.size / 1024).toFixed(1)} KB
                      {doc.extractedHtml && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          Structure preserved
                        </span>
                      )}
                    </p>
                  </div>
                  {doc.status === "completed" ? (
                    <Badge variant="outline" className="text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Trained
                    </Badge>
                  ) : doc.status === "processing" ? (
                    <Badge variant="secondary">
                      <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
                      Processing
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(doc.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-remove-${doc.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">How Training Works</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Chakshi analyzes your documents to understand formatting, structure, and language patterns</li>
                <li>Document structure (numbering, headings, clause formatting) is preserved and learned</li>
                <li>Your training data is stored securely and never shared with other users</li>
                <li>Toggle "Use trained firm style" when drafting to apply your preferences</li>
                <li>You can update your training anytime by adding or removing documents</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

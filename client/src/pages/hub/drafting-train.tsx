import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  GraduationCap,
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TrainingDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  status: "pending" | "processing" | "completed";
  uploadedAt: Date;
}

export default function TrainDraftsPage() {
  const [uploadedFiles, setUploadedFiles] = useState<TrainingDocument[]>([
    { id: "1", name: "Firm_SOP_Contracts.pdf", type: "application/pdf", size: 245000, status: "completed", uploadedAt: new Date() },
    { id: "2", name: "Drafting_Playbook_2024.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 189000, status: "completed", uploadedAt: new Date() },
    { id: "3", name: "Sample_Petition_Format.pdf", type: "application/pdf", size: 78000, status: "processing", uploadedAt: new Date() },
  ]);

  const handleFilesSelected = (files: File[]) => {
    const newDocs: TrainingDocument[] = files.map((file, i) => ({
      id: `new-${Date.now()}-${i}`,
      name: file.name,
      type: file.type,
      size: file.size,
      status: "pending" as const,
      uploadedAt: new Date(),
    }));
    setUploadedFiles((prev) => [...prev, ...newDocs]);
    
    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((doc) =>
          newDocs.some((n) => n.id === doc.id) ? { ...doc, status: "completed" as const } : doc
        )
      );
    }, 3000);
  };

  const handleRemove = (id: string) => {
    setUploadedFiles((prev) => prev.filter((doc) => doc.id !== id));
  };

  const completedCount = uploadedFiles.filter((d) => d.status === "completed").length;
  const processingCount = uploadedFiles.filter((d) => d.status === "processing" || d.status === "pending").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
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
            Upload your firm's SOPs, playbooks, and past drafts to help Chakshi understand your preferred structure, language, clauses, and tone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadDropzone
            onFilesSelected={handleFilesSelected}
            acceptedTypes={[".pdf", ".docx", ".doc", ".txt"]}
            maxFiles={20}
          />
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
          {uploadedFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No training documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map((doc) => (
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

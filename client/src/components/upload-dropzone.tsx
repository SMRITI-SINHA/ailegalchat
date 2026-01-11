import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "complete" | "error";
}

export function UploadDropzone({ 
  onUpload, 
  accept = {
    "application/pdf": [".pdf"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "image/*": [".png", ".jpg", ".jpeg"],
  },
  maxFiles = 10,
  className 
}: UploadDropzoneProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    setUploadingFiles(
      acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "uploading" as const,
      }))
    );

    const interval = setInterval(() => {
      setUploadingFiles((prev) =>
        prev.map((f) => ({
          ...f,
          progress: Math.min(f.progress + Math.random() * 30, 90),
        }))
      );
    }, 500);

    try {
      await onUpload(acceptedFiles);
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, progress: 100, status: "complete" as const }))
      );
    } catch (error) {
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
    } finally {
      clearInterval(interval);
      setIsUploading(false);
      setTimeout(() => setUploadingFiles([]), 2000);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    disabled: isUploading,
  });

  const removeFile = (index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "pointer-events-none opacity-50"
        )}
        data-testid="dropzone-upload"
      >
        <input {...getInputProps()} data-testid="input-file-upload" />
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 rounded-full bg-muted">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-medium">
              {isDragActive ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse. PDF, Word, and images supported (up to 800 pages)
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Select Files"
            )}
          </Button>
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadingFiles.map((upload, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-md"
            >
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium truncate" title={upload.file.name}>
                  {upload.file.name.length > 35 ? upload.file.name.slice(0, 35) + "..." : upload.file.name}
                </p>
                <Progress value={upload.progress} className="h-1 mt-1" />
              </div>
              {upload.status === "uploading" && (
                <span className="text-xs text-muted-foreground">
                  {Math.round(upload.progress)}%
                </span>
              )}
              {upload.status === "complete" && (
                <span className="text-xs text-chart-2">Complete</span>
              )}
              {upload.status === "error" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

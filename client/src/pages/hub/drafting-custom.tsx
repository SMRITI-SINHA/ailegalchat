import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  Search,
  Save,
  Copy,
  Download,
  RefreshCw,
  Upload,
  FileEdit,
} from "lucide-react";
import type { IndianLanguage } from "@shared/schema";
import { indianLanguages } from "@shared/schema";

export default function CustomDraftPage() {
  const [draftContent, setDraftContent] = useState("");
  const [useFirmStyle, setUseFirmStyle] = useState(false);
  const [language, setLanguage] = useState<IndianLanguage>("English");
  const [researchQuery, setResearchQuery] = useState("");
  const [hasUploaded, setHasUploaded] = useState(false);
  const [draftTitle, setDraftTitle] = useState("Custom Draft");

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setDraftTitle(files[0].name.replace(/\.[^/.]+$/, ""));
      setHasUploaded(true);
      setDraftContent("// Your uploaded document content will appear here\n// Edit as needed with AI assistance");
    }
  };

  if (!hasUploaded) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Your Draft Format
            </CardTitle>
            <CardDescription>
              Upload a specific draft format to generate drafts matching your structure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UploadDropzone
              onFilesSelected={handleFilesSelected}
              acceptedTypes={[".pdf", ".docx", ".doc", ".txt"]}
              maxFiles={1}
            />
            <p className="text-sm text-muted-foreground">
              After uploading, you can edit the draft with AI assistance and use the research panel for legal references.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden border-r">
          <div className="p-4 border-b flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <FileEdit className="h-5 w-5 text-muted-foreground" />
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="font-semibold border-0 p-0 h-auto text-lg focus-visible:ring-0"
                data-testid="input-draft-title"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="firm-style"
                  checked={useFirmStyle}
                  onCheckedChange={setUseFirmStyle}
                  data-testid="switch-firm-style"
                />
                <Label htmlFor="firm-style" className="text-sm">Use trained firm style</Label>
              </div>
              <Select value={language} onValueChange={(v) => setLanguage(v as IndianLanguage)}>
                <SelectTrigger className="w-32" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {indianLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 border-b flex items-center gap-2">
            <Button variant="outline" size="sm" data-testid="button-review">
              <RefreshCw className="mr-2 h-4 w-4" />
              Review Draft
            </Button>
            <Button variant="outline" size="sm">
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" data-testid="button-save">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>

          <div className="flex-1 p-4 overflow-hidden">
            <Textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Your document content..."
              className="h-full resize-none font-mono text-sm leading-relaxed"
              data-testid="textarea-draft"
            />
          </div>
        </div>

        <div className="w-80 flex flex-col overflow-hidden bg-muted/30">
          <Tabs defaultValue="research" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b px-4">
              <TabsTrigger value="research">AI Legal Research</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="research" className="flex-1 flex flex-col p-4 mt-0 overflow-hidden">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search legal provisions..."
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  data-testid="input-research"
                />
                <Button size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Search for legal provisions, case law, or statutes</p>
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="notes" className="flex-1 p-4 mt-0">
              <Textarea
                placeholder="Your research notes..."
                className="h-full resize-none"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Strikethrough,
  ArrowLeft,
  Plus,
  Save,
  Loader2,
  File,
  FileDown,
  FolderOpen,
  Copy,
  Edit3,
  Languages,
  Sparkles,
} from "lucide-react";
import { indianLanguages, type IndianLanguage } from "@shared/schema";
import type { Draft } from "@shared/schema";
import { markdownToHtml } from "@/lib/utils";

interface PremiumEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  onBack?: () => void;
  showAiHelper?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  currentLanguage?: IndianLanguage;
  onLanguageChange?: (language: IndianLanguage) => void;
  onTranslate?: (targetLanguage: IndianLanguage) => Promise<void>;
  isTranslating?: boolean;
  drafts?: Draft[];
  onOpenDraft?: (draft: Draft) => void;
  onMakeCopy?: () => void;
  onAiAssist?: (prompt: string) => Promise<string>;
  isGenerating?: boolean;
}

const fontFamilies = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
const headingStyles = ["Normal text", "Heading 1", "Heading 2", "Heading 3", "Heading 4"];

const legalExamples = [
  "Draft a Non-Disclosure Agreement",
  "Write a Legal Notice for breach of contract",
  "Create a Power of Attorney document",
  "Generate a Sale Deed template",
  "Draft an Employment Contract clause",
  "Write a Bail Application for Section 498A",
  "Create a Partnership Deed",
  "Draft a Writ Petition under Article 226",
  "Write a Reply to Legal Notice",
  "Generate a Leave and License Agreement",
  "Draft Written Arguments for Civil Suit",
  "Create a Rent Agreement template",
];

export function PremiumEditor({
  title,
  onTitleChange,
  content,
  onContentChange,
  onBack,
  showAiHelper = true,
  onSave,
  isSaving = false,
  currentLanguage = "English",
  onLanguageChange,
  onTranslate,
  isTranslating = false,
  drafts = [],
  onOpenDraft,
  onMakeCopy,
  onAiAssist,
  isGenerating = false,
}: PremiumEditorProps) {
  const [zoom, setZoom] = useState(100);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(11);
  const [headingStyle, setHeadingStyle] = useState("Normal text");
  const [selectedLanguage, setSelectedLanguage] = useState<IndianLanguage>(currentLanguage);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [exampleFading, setExampleFading] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [localGenerating, setLocalGenerating] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const lastKnownCursorPosition = useRef<number>(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const savedSelectionRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEditableRef.current) {
      const range = selection.getRangeAt(0);
      if (contentEditableRef.current.contains(range.startContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current && contentEditableRef.current) {
      contentEditableRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        try {
          selection.addRange(savedSelectionRef.current);
        } catch {
          // Range may be invalid if DOM changed, just focus
        }
      }
    }
  };

  const isInHeading = (): boolean => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    let node: Node | null = selection.getRangeAt(0).startContainer;
    while (node && node !== contentEditableRef.current) {
      if (node.nodeName.match(/^H[1-6]$/)) return true;
      node = node.parentNode;
    }
    return false;
  };

  const normalizeToP = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !contentEditableRef.current) return;
    
    let node: Node | null = selection.getRangeAt(0).startContainer;
    let headingEl: HTMLElement | null = null;
    
    while (node && node !== contentEditableRef.current) {
      if (node.nodeName.match(/^H[1-6]$/)) {
        headingEl = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }
    
    if (headingEl) {
      // Create paragraph with same content
      const p = document.createElement('p');
      p.innerHTML = headingEl.innerHTML;
      headingEl.parentNode?.replaceChild(p, headingEl);
      
      // Move cursor into new paragraph
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      setHeadingStyle('Normal text');
      isInternalUpdate.current = true;
      if (contentEditableRef.current) {
        onContentChange(contentEditableRef.current.innerHTML || "");
      }
    }
  };

  const getCursorPositionInEditor = (): number | null => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !contentEditableRef.current) {
      return null;
    }
    const range = selection.getRangeAt(0);
    if (!contentEditableRef.current.contains(range.startContainer)) {
      return null;
    }
    try {
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(contentEditableRef.current);
      preCaretRange.setEnd(range.startContainer, range.startOffset);
      return preCaretRange.toString().length;
    } catch {
      return null;
    }
  };

  const updateLastKnownCursorPosition = () => {
    const pos = getCursorPositionInEditor();
    if (pos !== null) {
      lastKnownCursorPosition.current = pos;
    }
  };

  const getCurrentHeadingFromDOM = (): string => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !contentEditableRef.current) {
      return 'Normal text';
    }
    let node: Node | null = selection.getRangeAt(0).startContainer;
    while (node && node !== contentEditableRef.current) {
      const name = node.nodeName.toUpperCase();
      if (name === 'H1') return 'Heading 1';
      if (name === 'H2') return 'Heading 2';
      if (name === 'H3') return 'Heading 3';
      if (name === 'H4') return 'Heading 4';
      node = node.parentNode;
    }
    return 'Normal text';
  };

  const syncHeadingState = () => {
    const currentHeading = getCurrentHeadingFromDOM();
    if (currentHeading !== headingStyle) {
      setHeadingStyle(currentHeading);
    }
  };

  const openAiDialog = useCallback(() => {
    const currentPos = getCursorPositionInEditor();
    const posToUse = currentPos !== null ? currentPos : lastKnownCursorPosition.current;
    setCursorPosition(posToUse);
    setShowAiDialog(true);
  }, []);

  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  useEffect(() => {
    setRenameValue(title);
  }, [title]);

  useEffect(() => {
    if (contentEditableRef.current && !isInternalUpdate.current) {
      if (contentEditableRef.current.innerHTML !== content) {
        contentEditableRef.current.innerHTML = content;
      }
    }
    isInternalUpdate.current = false;
  }, [content]);

  useEffect(() => {
    if (!showAiDialog) return;
    
    const interval = setInterval(() => {
      setExampleFading(true);
      setTimeout(() => {
        setCurrentExampleIndex((prev) => (prev + 1) % legalExamples.length);
        setExampleFading(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [showAiDialog]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.altKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      openAiDialog();
    }
  }, [content]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const canTranslate = selectedLanguage !== currentLanguage && onTranslate;

  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const handleDownload = (format: "txt" | "docx" | "pdf") => {
    if (format === "txt") {
      const plainText = stripHtml(content);
      const blob = new Blob([plainText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "document"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "docx") {
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title></head>
        <body style="font-family: ${fontFamily}; font-size: ${fontSize}pt;">
          <h1>${title}</h1>
          <div>${content}</div>
        </body>
        </html>`;
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "document"}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === "pdf") {
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);
      
      const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title || "Document"}</title>
              <style>
                @media print {
                  @page { margin: 1in; }
                  body { 
                    font-family: ${fontFamily}, sans-serif; 
                    font-size: ${fontSize}pt;
                    line-height: 1.6;
                    color: #000;
                  }
                  h1 { margin-bottom: 1em; }
                }
              </style>
            </head>
            <body>
              <h1>${title || "Document"}</h1>
              <div>${content}</div>
            </body>
          </html>
        `);
        frameDoc.close();
        
        setTimeout(() => {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 1000);
        }, 250);
      }
    }
  };

  const handleMakeCopy = () => {
    if (onMakeCopy) {
      onMakeCopy();
    } else {
      onTitleChange(`${title} (Copy)`);
    }
  };

  const handleRename = () => {
    setRenameValue(title);
    setShowRenameDialog(true);
  };

  const confirmRename = () => {
    onTitleChange(renameValue);
    setShowRenameDialog(false);
  };

  const handleTranslate = async () => {
    if (onTranslate && canTranslate) {
      await onTranslate(selectedLanguage);
    }
  };

  const insertTextAtCursor = (text: string) => {
    const before = content.slice(0, cursorPosition);
    const after = content.slice(cursorPosition);
    const separator = before && !before.endsWith('\n') && !before.endsWith(' ') ? '<br><br>' : '';
    // Convert markdown to properly formatted HTML
    const formattedText = markdownToHtml(text);
    const newContent = before + separator + formattedText + after;
    onContentChange(newContent);
  };

  const handleAiCreate = async () => {
    if (!aiPrompt.trim()) return;
    
    if (onAiAssist) {
      setLocalGenerating(true);
      try {
        const generatedText = await onAiAssist(aiPrompt);
        insertTextAtCursor(generatedText);
        setShowAiDialog(false);
        setAiPrompt("");
      } finally {
        setLocalGenerating(false);
      }
    } else {
      insertTextAtCursor(`[AI Generated: ${aiPrompt}]`);
      setShowAiDialog(false);
      setAiPrompt("");
    }
  };

  const handleEditorClick = () => {
    setEditorFocused(true);
    if (contentEditableRef.current) {
      contentEditableRef.current.focus();
    }
  };

  const handlePlaceholderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCursorPosition(0);
    setShowAiDialog(true);
  };

  const showPlaceholder = showAiHelper && !content && !editorFocused;

  const execFormatCommand = (command: string, value?: string) => {
    if (contentEditableRef.current) {
      restoreSelection();
      document.execCommand(command, false, value);
      isInternalUpdate.current = true;
      const newContent = contentEditableRef.current.innerHTML || "";
      onContentChange(newContent);
    }
  };

  const handleUndo = () => execFormatCommand('undo');
  const handleRedo = () => execFormatCommand('redo');
  const handleBold = () => execFormatCommand('bold');
  const handleItalic = () => execFormatCommand('italic');
  const handleUnderline = () => execFormatCommand('underline');
  const handleStrikethrough = () => execFormatCommand('strikeThrough');
  const handleHighlight = () => {
    if (contentEditableRef.current) {
      restoreSelection();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const parentEl = range.commonAncestorContainer.parentElement;
        
        // Check if already highlighted using computed style (handles rgb format too)
        if (parentEl) {
          const computedBg = window.getComputedStyle(parentEl).backgroundColor;
          const isYellow = computedBg === 'yellow' || 
                          computedBg === 'rgb(255, 255, 0)' || 
                          computedBg === '#ffff00' ||
                          parentEl.style.backgroundColor === 'yellow';
          
          if (isYellow && parentEl.tagName.toLowerCase() === 'span') {
            // Remove highlight by unwrapping the span
            const parent = parentEl.parentNode;
            while (parentEl.firstChild) {
              parent?.insertBefore(parentEl.firstChild, parentEl);
            }
            parent?.removeChild(parentEl);
          } else {
            // Apply highlight
            document.execCommand('backColor', false, 'yellow');
          }
        } else {
          // Apply highlight
          document.execCommand('backColor', false, 'yellow');
        }
        isInternalUpdate.current = true;
        onContentChange(contentEditableRef.current.innerHTML || "");
      }
    }
  };
  const handleAlignLeft = () => execFormatCommand('justifyLeft');
  const handleAlignCenter = () => execFormatCommand('justifyCenter');
  const handleAlignRight = () => execFormatCommand('justifyRight');
  const handleAlignJustify = () => execFormatCommand('justifyFull');
  const handleBulletedList = () => {
    if (contentEditableRef.current) {
      restoreSelection();
      normalizeToP();
      document.execCommand('insertUnorderedList', false);
      isInternalUpdate.current = true;
      onContentChange(contentEditableRef.current.innerHTML || "");
    }
  };
  const handleNumberedList = () => {
    if (contentEditableRef.current) {
      restoreSelection();
      normalizeToP();
      document.execCommand('insertOrderedList', false);
      isInternalUpdate.current = true;
      onContentChange(contentEditableRef.current.innerHTML || "");
    }
  };
  const handleIndent = () => execFormatCommand('indent');
  const handleOutdent = () => execFormatCommand('outdent');

  const handleFontChange = (font: string) => {
    setFontFamily(font);
    execFormatCommand('fontName', font);
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    if (contentEditableRef.current) {
      contentEditableRef.current.style.fontSize = `${size}pt`;
    }
  };

  const handleHeadingChange = (heading: string) => {
    setHeadingStyle(heading);
    if (contentEditableRef.current) {
      restoreSelection();
      let tag = 'p';
      if (heading === "Heading 1") tag = 'h1';
      else if (heading === "Heading 2") tag = 'h2';
      else if (heading === "Heading 3") tag = 'h3';
      else if (heading === "Heading 4") tag = 'h4';
      
      document.execCommand('formatBlock', false, `<${tag}>`);
      isInternalUpdate.current = true;
      onContentChange(contentEditableRef.current.innerHTML || "");
    }
  };

  const ToolbarButton = ({ icon: Icon, tooltip, onClick, active }: { icon: any; tooltip: string; onClick?: () => void; active?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${active ? 'bg-accent' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            saveSelection();
          }}
          onClick={onClick}
          data-testid={`toolbar-${tooltip.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-2 flex-1">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="h-7 w-auto max-w-xs border-0 bg-transparent font-medium focus-visible:ring-0 focus-visible:bg-muted/50"
            placeholder="Untitled document"
            data-testid="input-doc-title"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={selectedLanguage} 
            onValueChange={(v) => setSelectedLanguage(v as IndianLanguage)}
          >
            <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-editor-language">
              <Languages className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-64">
                {indianLanguages.map((lang) => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
          {canTranslate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTranslate}
              disabled={isTranslating}
              data-testid="button-translate"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Translating...
                </>
              ) : (
                "Translate"
              )}
            </Button>
          )}
        </div>
        {onSave && (
          <Button
            variant="default"
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            data-testid="button-save"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        )}
      </div>

      <Dialog open={showOpenDialog} onOpenChange={setShowOpenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open Draft</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No saved drafts available</p>
            ) : (
              <div className="space-y-2">
                {drafts.map((draft) => (
                  <Button
                    key={draft.id}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => {
                      if (onOpenDraft) {
                        onOpenDraft(draft);
                      }
                      setShowOpenDialog(false);
                    }}
                    data-testid={`draft-item-${draft.id}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{draft.title}</span>
                      <span className="text-xs text-muted-foreground">{draft.type}</span>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Document title"
            data-testid="input-rename"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={confirmRename} data-testid="button-confirm-rename">Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-lg p-0 overflow-hidden [&>button]:hidden">
          <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 p-4">
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium">Help me write</span>
            </div>
            <div className="mt-3 min-h-[24px]">
              <p 
                className={`text-white/90 text-sm transition-opacity duration-300 ${exampleFading ? 'opacity-0' : 'opacity-100'}`}
              >
                {legalExamples[currentExampleIndex]}
              </p>
            </div>
          </div>
          <div className="p-4">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe what you want to write... AI will generate the complete document based on your prompt."
              className="min-h-[120px] resize-none"
              data-testid="input-ai-prompt"
            />
            <p className="text-xs text-muted-foreground mt-2">
              AI will generate the complete legal document based on your description.
            </p>
            <div className="flex justify-end mt-4 gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowAiDialog(false)}
                data-testid="button-ai-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAiCreate}
                disabled={!aiPrompt.trim() || localGenerating || isGenerating}
                data-testid="button-ai-create"
              >
                {localGenerating || isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Document
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-file-menu">
              <File className="h-4 w-4 mr-1" />
              File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setShowOpenDialog(true)} data-testid="menu-open">
              <FolderOpen className="h-4 w-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleMakeCopy} data-testid="menu-copy">
              <Copy className="h-4 w-4 mr-2" />
              Make a Copy
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FileDown className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleDownload("txt")} data-testid="menu-download-txt">
                  Text (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("docx")} data-testid="menu-download-docx">
                  Word (.doc)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("pdf")} data-testid="menu-download-pdf">
                  PDF (Print to PDF)
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleRename} data-testid="menu-rename">
              <Edit3 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={Undo2} tooltip="Undo" onClick={handleUndo} />
        <ToolbarButton icon={Redo2} tooltip="Redo" onClick={handleRedo} />

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Select value={`${zoom}`} onValueChange={(v) => setZoom(Number(v))}>
          <SelectTrigger className="h-7 w-20 text-xs" data-testid="select-zoom">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50%</SelectItem>
            <SelectItem value="75">75%</SelectItem>
            <SelectItem value="100">100%</SelectItem>
            <SelectItem value="125">125%</SelectItem>
            <SelectItem value="150">150%</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Select value={headingStyle} onValueChange={handleHeadingChange}>
          <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-heading" onMouseDown={() => saveSelection()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {headingStyles.map((style) => (
              <SelectItem key={style} value={style}>{style}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Select value={fontFamily} onValueChange={handleFontChange}>
          <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-font" onMouseDown={() => saveSelection()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((font) => (
              <SelectItem key={font} value={font}>{font}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <div className="flex items-center border rounded h-7">
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => handleFontSizeChange(Math.max(8, fontSize - 1))}>
            <span className="text-xs">-</span>
          </Button>
          <Input
            value={fontSize}
            onChange={(e) => handleFontSizeChange(Number(e.target.value) || 11)}
            className="h-6 w-8 border-0 text-center text-xs p-0 focus-visible:ring-0"
            data-testid="input-font-size"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => handleFontSizeChange(Math.min(72, fontSize + 1))}>
            <span className="text-xs">+</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={Bold} tooltip="Bold" onClick={handleBold} />
        <ToolbarButton icon={Italic} tooltip="Italic" onClick={handleItalic} />
        <ToolbarButton icon={Underline} tooltip="Underline" onClick={handleUnderline} />
        <ToolbarButton icon={Highlighter} tooltip="Highlight" onClick={handleHighlight} />
        <ToolbarButton icon={Strikethrough} tooltip="Strikethrough" onClick={handleStrikethrough} />

        <Separator orientation="vertical" className="h-5 mx-1" />


        <ToolbarButton icon={AlignLeft} tooltip="Align left" onClick={handleAlignLeft} />
        <ToolbarButton icon={AlignCenter} tooltip="Align center" onClick={handleAlignCenter} />
        <ToolbarButton icon={AlignRight} tooltip="Align right" onClick={handleAlignRight} />
        <ToolbarButton icon={AlignJustify} tooltip="Justify" onClick={handleAlignJustify} />

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={List} tooltip="Bulleted list" onClick={handleBulletedList} />
        <ToolbarButton icon={ListOrdered} tooltip="Numbered list" onClick={handleNumberedList} />
        <ToolbarButton icon={Outdent} tooltip="Decrease indent" onClick={handleOutdent} />
        <ToolbarButton icon={Indent} tooltip="Increase indent" onClick={handleIndent} />

        <Separator orientation="vertical" className="h-5 mx-1" />

        {showAiHelper && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={openAiDialog}
                data-testid="button-ai-assistance"
              >
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span className="text-muted-foreground">AI Assistance</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Help me write (Alt+W)
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="flex">
          <div className="flex-1 flex justify-center py-8 px-4">
            <div
              ref={editorRef}
              className="bg-background shadow-lg border min-h-[800px] w-full max-w-[816px] p-16 cursor-text"
              style={{
                fontFamily: fontFamily,
                fontSize: `${fontSize}pt`,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
              onClick={handleEditorClick}
            >
              {showPlaceholder && (
                <div 
                  className="flex items-center gap-2 text-muted-foreground cursor-pointer hover:text-muted-foreground/80 transition-colors"
                  onClick={handlePlaceholderClick}
                  data-testid="placeholder-help-me-write"
                >
                  <span className="w-0.5 h-5 bg-foreground animate-pulse" />
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">Help me write</span>
                  <span className="text-xs text-muted-foreground/60 ml-2">Alt + W</span>
                </div>
              )}
              <div
                ref={contentEditableRef}
                contentEditable
                suppressContentEditableWarning
                className="outline-none min-h-[600px] leading-relaxed"
                onInput={(e) => {
                  isInternalUpdate.current = true;
                  onContentChange(e.currentTarget.innerHTML || "");
                  updateLastKnownCursorPosition();
                }}
                onClick={updateLastKnownCursorPosition}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && isInHeading()) {
                    e.preventDefault();
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      // Insert a new paragraph after current heading
                      const range = selection.getRangeAt(0);
                      let node: Node | null = range.startContainer;
                      let headingEl: HTMLElement | null = null;
                      
                      while (node && node !== contentEditableRef.current) {
                        if (node.nodeName.match(/^H[1-6]$/)) {
                          headingEl = node as HTMLElement;
                          break;
                        }
                        node = node.parentNode;
                      }
                      
                      if (headingEl) {
                        // Create new paragraph
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';
                        headingEl.parentNode?.insertBefore(p, headingEl.nextSibling);
                        
                        // Move cursor to new paragraph
                        const newRange = document.createRange();
                        newRange.selectNodeContents(p);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        
                        setHeadingStyle('Normal text');
                        isInternalUpdate.current = true;
                        onContentChange(contentEditableRef.current?.innerHTML || "");
                      }
                    }
                  }
                }}
                onKeyUp={() => {
                  updateLastKnownCursorPosition();
                  syncHeadingState();
                }}
                onSelect={() => {
                  updateLastKnownCursorPosition();
                  syncHeadingState();
                }}
                onFocus={() => {
                  setEditorFocused(true);
                  updateLastKnownCursorPosition();
                }}
                onBlur={() => {
                  updateLastKnownCursorPosition();
                  if (!content) {
                    setEditorFocused(false);
                  }
                }}
                data-testid="editor-content"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
} from "@/components/ui/dropdown-menu";
import {
  Undo2,
  Redo2,
  Printer,
  ZoomIn,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Link,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Strikethrough,
  Wand2,
  ChevronDown,
  ArrowLeft,
  Plus,
} from "lucide-react";

interface PremiumEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  onBack?: () => void;
  showAiHelper?: boolean;
}

const fontFamilies = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
const headingStyles = ["Normal text", "Heading 1", "Heading 2", "Heading 3", "Heading 4"];

export function PremiumEditor({
  title,
  onTitleChange,
  content,
  onContentChange,
  onBack,
  showAiHelper = true,
}: PremiumEditorProps) {
  const [zoom, setZoom] = useState(100);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(11);
  const [headingStyle, setHeadingStyle] = useState("Normal text");
  const editorRef = useRef<HTMLDivElement>(null);

  const ToolbarButton = ({ icon: Icon, tooltip, onClick, active }: { icon: any; tooltip: string; onClick?: () => void; active?: boolean }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${active ? 'bg-accent' : ''}`}
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
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
          <span>Insert</span>
          <span>Format</span>
          <span>Tools</span>
          <span>Extensions</span>
          <span>Help</span>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20 flex-wrap">
        <ToolbarButton icon={Undo2} tooltip="Undo" />
        <ToolbarButton icon={Redo2} tooltip="Redo" />
        <ToolbarButton icon={Printer} tooltip="Print" />

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

        <Select value={headingStyle} onValueChange={setHeadingStyle}>
          <SelectTrigger className="h-7 w-28 text-xs" data-testid="select-heading">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {headingStyles.map((style) => (
              <SelectItem key={style} value={style}>{style}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Select value={fontFamily} onValueChange={setFontFamily}>
          <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-font">
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
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => setFontSize(Math.max(8, fontSize - 1))}>
            <span className="text-xs">-</span>
          </Button>
          <Input
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value) || 11)}
            className="h-6 w-8 border-0 text-center text-xs p-0 focus-visible:ring-0"
            data-testid="input-font-size"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => setFontSize(Math.min(72, fontSize + 1))}>
            <span className="text-xs">+</span>
          </Button>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={Bold} tooltip="Bold" />
        <ToolbarButton icon={Italic} tooltip="Italic" />
        <ToolbarButton icon={Underline} tooltip="Underline" />
        <ToolbarButton icon={Highlighter} tooltip="Highlight" />
        <ToolbarButton icon={Strikethrough} tooltip="Strikethrough" />

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={Link} tooltip="Insert link" />
        <ToolbarButton icon={Image} tooltip="Insert image" />

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={AlignLeft} tooltip="Align left" />
        <ToolbarButton icon={AlignCenter} tooltip="Align center" />
        <ToolbarButton icon={AlignRight} tooltip="Align right" />
        <ToolbarButton icon={AlignJustify} tooltip="Justify" />

        <Separator orientation="vertical" className="h-5 mx-1" />

        <ToolbarButton icon={List} tooltip="Bulleted list" />
        <ToolbarButton icon={ListOrdered} tooltip="Numbered list" />
        <ToolbarButton icon={Outdent} tooltip="Decrease indent" />
        <ToolbarButton icon={Indent} tooltip="Increase indent" />
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="flex">
          <div className="w-24 flex-shrink-0 flex flex-col items-center py-4 border-r bg-background/50">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              <ArrowLeft className="h-3 w-3 mr-1" />
            </Button>
            <div className="mt-2 text-xs text-muted-foreground">Document tabs</div>
            <Button variant="ghost" size="icon" className="mt-1 h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex-1 flex justify-center py-8 px-4">
            <div
              ref={editorRef}
              className="bg-background shadow-lg border min-h-[800px] w-full max-w-[816px] p-16"
              style={{
                fontFamily: fontFamily,
                fontSize: `${fontSize}pt`,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              {showAiHelper && !content && (
                <div className="flex items-center gap-2 text-muted-foreground mb-4">
                  <Wand2 className="h-4 w-4" />
                  <span className="text-sm">Help me write</span>
                  <span className="text-xs text-muted-foreground/70">Alt + W</span>
                </div>
              )}
              <div
                contentEditable
                suppressContentEditableWarning
                className="outline-none min-h-[600px] leading-relaxed"
                onInput={(e) => onContentChange(e.currentTarget.textContent || "")}
                data-testid="editor-content"
              >
                {content}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

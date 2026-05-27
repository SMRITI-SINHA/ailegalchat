import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Citation {
  id: string;
  source: string;
  text: string;
  page?: number;
  paragraph?: number;
  url?: string;
}

interface CitationCardProps {
  citation: Citation;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function CitationCard({
  citation,
  isExpanded = false,
  onToggle,
  className,
}: CitationCardProps) {
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (citation.url) {
      window.open(citation.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card
      className={cn(
        "transition-all hover-elevate",
        citation.url ? "cursor-pointer" : "cursor-default",
        isExpanded && "ring-1 ring-primary",
        className
      )}
      onClick={citation.url ? handleOpen : onToggle}
      data-testid={`card-citation-${citation.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 rounded bg-muted flex-shrink-0">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium break-words" title={citation.source}>
              {citation.source}
            </p>
            {citation.page && (
              <p className="text-xs text-muted-foreground font-mono">
                Page {citation.page}
                {citation.paragraph && `, Para ${citation.paragraph}`}
              </p>
            )}
            {citation.url && (
              <p className="text-xs text-primary/70 truncate mt-0.5 flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                {citation.url.replace(/^https?:\/\//, "")}
              </p>
            )}
          </div>
          {citation.url && (
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>

        {isExpanded && citation.text && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground leading-relaxed">
              "{citation.text}"
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CitationInlineProps {
  number: number;
  onClick?: () => void;
}

export function CitationInline({ number, onClick }: CitationInlineProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-medium bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
      data-testid={`button-citation-${number}`}
    >
      {number}
    </button>
  );
}

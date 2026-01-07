import { FileText, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Citation {
  id: string;
  source: string;
  text: string;
  page?: number;
  paragraph?: number;
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
  className 
}: CitationCardProps) {
  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover-elevate",
        isExpanded && "ring-1 ring-primary",
        className
      )}
      onClick={onToggle}
      data-testid={`card-citation-${citation.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="p-1.5 rounded bg-muted flex-shrink-0">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{citation.source}</p>
            {citation.page && (
              <p className="text-xs text-muted-foreground font-mono">
                Page {citation.page}
                {citation.paragraph && `, Para ${citation.paragraph}`}
              </p>
            )}
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground leading-relaxed">
              "{citation.text}"
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View in document
            </Button>
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

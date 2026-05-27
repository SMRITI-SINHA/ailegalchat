import { useState } from "react";
import { Scale, ExternalLink, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationData {
  id: string;
  source: string;
  text: string;
  page?: number;
  url?: string;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function FaviconImg({ domain, className }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Globe className={cn("h-4 w-4 text-muted-foreground", className)} />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className={cn("h-4 w-4 rounded-sm object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}

function IKCitationCard({ citation }: { citation: CitationData }) {
  const handleOpen = () => {
    if (citation.url) window.open(citation.url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleOpen}
      className="w-full text-left flex items-start gap-2 p-2 rounded-md bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/30 transition-colors group"
      data-testid={`card-citation-${citation.id}`}
    >
      <div className="p-1 rounded bg-amber-100 dark:bg-amber-900/40 shrink-0 mt-0.5">
        <Scale className="h-3 w-3 text-amber-700 dark:text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium leading-snug text-foreground break-words line-clamp-2">
          {citation.source}
        </p>
        {citation.text && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {citation.text}
          </p>
        )}
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5 group-hover:text-primary/60 transition-colors" />
    </button>
  );
}

function WebCitationCard({ citation }: { citation: CitationData }) {
  const [expanded, setExpanded] = useState(false);
  const domain = citation.url ? getDomain(citation.url) : citation.source;

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (citation.url) window.open(citation.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="rounded-md border border-border/50 overflow-hidden"
      data-testid={`card-citation-${citation.id}`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/40 hover:bg-muted/70 transition-colors"
      >
        <FaviconImg domain={domain} />
        <span className="flex-1 text-[11px] font-medium text-left truncate text-foreground">
          {domain}
        </span>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-2 py-2 bg-background border-t border-border/40">
          <button
            onClick={handleLinkClick}
            className="w-full text-left group flex items-start gap-1.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-primary group-hover:underline leading-snug break-words">
                {citation.text || citation.source}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {citation.url}
              </p>
            </div>
            <ExternalLink className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}

interface CitationCardProps {
  citation: CitationData;
}

export function CitationCard({ citation }: CitationCardProps) {
  const isIK = citation.url?.includes("indiankanoon.org");
  return isIK
    ? <IKCitationCard citation={citation} />
    : <WebCitationCard citation={citation} />;
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

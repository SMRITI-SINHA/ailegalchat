import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { DocumentStatus } from "@shared/schema";
import { cn } from "@/lib/utils";

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    className: "bg-chart-4/20 text-chart-4",
  },
  completed: {
    label: "Ready",
    icon: CheckCircle2,
    className: "bg-chart-2/20 text-chart-2",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive",
  },
};

export function DocumentStatusBadge({ status, className }: DocumentStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isAnimated = status === "processing";

  return (
    <Badge variant="outline" className={cn(config.className, "border-0", className)}>
      <Icon className={cn("h-3 w-3 mr-1", isAnimated && "animate-spin")} />
      {config.label}
    </Badge>
  );
}

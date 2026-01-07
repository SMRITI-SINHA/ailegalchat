import { Badge } from "@/components/ui/badge";
import { Zap, Brain, Sparkles } from "lucide-react";
import type { ModelTier } from "@shared/schema";

interface ModelBadgeProps {
  tier: ModelTier;
  className?: string;
}

const tierConfig = {
  mini: {
    label: "Fast",
    icon: Zap,
    variant: "secondary" as const,
  },
  standard: {
    label: "Standard",
    icon: Brain,
    variant: "default" as const,
  },
  pro: {
    label: "Pro",
    icon: Sparkles,
    variant: "default" as const,
  },
};

export function ModelBadge({ tier, className }: ModelBadgeProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

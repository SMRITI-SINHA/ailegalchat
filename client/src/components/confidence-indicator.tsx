import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceIndicator({ 
  value, 
  showLabel = true, 
  className 
}: ConfidenceIndicatorProps) {
  const percentage = Math.round(value * 100);
  
  const getColor = () => {
    if (percentage >= 80) return "bg-chart-2";
    if (percentage >= 60) return "bg-chart-4";
    return "bg-chart-5";
  };

  const getLabel = () => {
    if (percentage >= 80) return "High confidence";
    if (percentage >= 60) return "Medium confidence";
    return "Low confidence";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 relative">
        <Progress value={percentage} className="h-2" />
        <div 
          className={cn("absolute top-0 left-0 h-full rounded-full transition-all", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {getLabel()} ({percentage}%)
        </span>
      )}
    </div>
  );
}

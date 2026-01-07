import { IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostDisplayProps {
  amount: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CostDisplay({ amount, className, size = "md" }: CostDisplayProps) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-medium",
  };

  return (
    <span className={cn("inline-flex items-center text-muted-foreground", sizeClasses[size], className)}>
      <IndianRupee className={cn("mr-0.5", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} />
      {amount.toFixed(2)}
    </span>
  );
}

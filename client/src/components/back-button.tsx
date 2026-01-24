import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export function BackButton({ to = "/", label }: BackButtonProps) {
  const [, setLocation] = useLocation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLocation(to)}
      className="rounded-md border bg-card"
      data-testid="button-back"
    >
      <ArrowLeft className="h-4 w-4 text-primary" />
    </Button>
  );
}

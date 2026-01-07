import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  speed?: number;
  className?: string;
}

export function StreamingText({
  text,
  isStreaming = false,
  speed = 20,
  className,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return;
    }

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [text, currentIndex, isStreaming, speed]);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText("");
      setCurrentIndex(0);
    }
  }, [text, isStreaming]);

  return (
    <span className={className}>
      {displayedText}
      {isStreaming && currentIndex < text.length && (
        <span className="inline-block w-2 h-4 bg-foreground/80 animate-pulse ml-0.5" />
      )}
    </span>
  );
}

export function StreamingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/queryClient";
import { Scale, Send, Sparkles, Lightbulb, AlertCircle } from "lucide-react";

interface Citation {
  id: string;
  source: string;
  text: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  citations?: Citation[];
}

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
}

function generateFingerprint(): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("fingerprint", 2, 2);
  }
  const components = [
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    canvas.toDataURL().slice(-50),
  ];
  let hash = 0;
  const str = components.join("|");
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return "fp_" + Math.abs(hash).toString(36);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToSimpleHtml(markdown: string): string {
  if (!markdown) return "";
  let safe = escapeHtml(markdown);
  safe = safe.replace(/\r\n/g, "\n");
  safe = safe.replace(/^###\s+(.+)$/gm, '<h3 style="margin:1em 0 0.5em;font-size:1.1em;font-weight:bold;">$1</h3>');
  safe = safe.replace(/^##\s+(.+)$/gm, '<h2 style="margin:1em 0 0.5em;font-size:1.2em;font-weight:bold;">$1</h2>');
  safe = safe.replace(/^#\s+(.+)$/gm, '<h1 style="margin:1em 0 0.5em;font-size:1.3em;font-weight:bold;">$1</h1>');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const lines = safe.split("\n");
  const processed: string[] = [];
  let inList = false;

  for (const line of lines) {
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (olMatch || ulMatch) {
      if (!inList) {
        processed.push(olMatch ? "<ol style='margin:0.5em 0;padding-left:1.5em;'>" : "<ul style='margin:0.5em 0;padding-left:1.5em;'>");
        inList = true;
      }
      processed.push(`<li style="margin:0.3em 0;">${olMatch ? olMatch[2] : ulMatch![1]}</li>`);
    } else {
      if (inList) {
        processed.push("</ol>");
        inList = false;
      }
      if (line.trim() === "") {
        processed.push("<br>");
      } else if (!line.startsWith("<h")) {
        processed.push(`<p style="margin:0.4em 0;line-height:1.6;">${line}</p>`);
      } else {
        processed.push(line);
      }
    }
  }
  if (inList) processed.push("</ol>");
  return processed.join("\n");
}

const sampleQuestions = [
  "What are the essentials of a valid contract under the Indian Contract Act?",
  "Explain the grounds for filing a writ petition under Article 226",
  "What is the limitation period for filing a civil suit?",
  "What are the grounds for anticipatory bail?",
];

export default function EmbedNyayaPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<UsageInfo>({ used: 0, limit: 5, remaining: 5 });
  const [fingerprint, setFingerprint] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fp = generateFingerprint();
    setFingerprint(fp);
    fetch("/api/embed/usage", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUsage(data))
      .catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (message?: string) => {
    const query = message || input.trim();
    if (!query || isLoading) return;

    if (usage.remaining <= 0) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await authFetch("/api/embed/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      if (response.status === 429) {
        const data = await response.json();
        setUsage({ used: data.used, limit: data.limit, remaining: 0 });
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.message || "Daily usage limit reached. Please try again tomorrow.",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Partial<Message> = {};

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
                );
              }
              if (data.done) {
                metadata = {
                  confidence: data.confidence || 0.85,
                  citations: data.citations || [],
                };
                if (data.usage) {
                  setUsage(data.usage);
                }
              }
              if (data.error) {
                fullContent = data.error;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m))
                );
              }
            } catch {
              // skip invalid JSON
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...metadata } : m))
      );
    } catch (error) {
      console.error("Embed chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, an error occurred. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const limitReached = usage.remaining <= 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#faf8f5",
        color: "#2d2520",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e8e0d4",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "linear-gradient(135deg, #b69d74, #d4b896)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Scale size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#6b4f2e" }}>Nyaya AI</div>
            <div style={{ fontSize: 11, color: "#9a8a74" }}>Indian Legal Research Assistant</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 12,
              background: limitReached ? "#fef2f2" : "#f0fdf4",
              color: limitReached ? "#dc2626" : "#16a34a",
              fontWeight: 500,
            }}
            data-testid="text-usage-counter"
          >
            {usage.remaining}/{usage.limit} queries left today
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
            }}
          >
            <Scale size={48} color="#d4b896" style={{ marginBottom: 16, opacity: 0.5 }} />
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Welcome to Nyaya AI</h2>
            <p style={{ fontSize: 14, color: "#7a7060", maxWidth: 400, marginBottom: 8, lineHeight: 1.5 }}>
              Ask any legal question and get accurate, citation-backed answers instantly. Trained on Indian law, statutes, case precedents and live trusted legal sources.
            </p>
            <div
              style={{
                fontSize: 11,
                color: "#9a8a74",
                fontStyle: "italic",
                maxWidth: 380,
                marginBottom: 20,
                padding: "8px 12px",
                background: "#fdf8f0",
                borderRadius: 8,
                borderLeft: "3px solid #d4b896",
              }}
            >
              This AI provides legal research and information only. No legal opinion or advice is provided. Always consult a qualified legal professional.
            </div>
            <div style={{ width: "100%", maxWidth: 500 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#9a8a74", marginBottom: 8, textAlign: "left" }}>
                Try these questions:
              </div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                {sampleQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    disabled={limitReached}
                    data-testid={`button-sample-${i}`}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #e8e0d4",
                      borderRadius: 8,
                      background: "white",
                      cursor: limitReached ? "not-allowed" : "pointer",
                      textAlign: "left",
                      fontSize: 13,
                      color: "#4a3f35",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      transition: "all 0.15s",
                      opacity: limitReached ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!limitReached) {
                        (e.target as HTMLElement).style.borderColor = "#d4b896";
                        (e.target as HTMLElement).style.boxShadow = "0 2px 8px rgba(182,157,116,0.15)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = "#e8e0d4";
                      (e.target as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <Lightbulb size={14} style={{ marginTop: 2, flexShrink: 0, color: "#b69d74" }} />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}
              >
                {msg.role === "user" ? (
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "10px 14px",
                      borderRadius: "14px 14px 4px 14px",
                      background: "#b69d74",
                      color: "white",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                    data-testid={`text-user-message-${msg.id}`}
                  >
                    {msg.content}
                  </div>
                ) : (
                  <div
                    style={{
                      maxWidth: "90%",
                      padding: "12px 16px",
                      borderRadius: "14px 14px 14px 4px",
                      background: "white",
                      border: "1px solid #e8e0d4",
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                    data-testid={`text-assistant-message-${msg.id}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Scale size={14} color="#b69d74" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#6b4f2e" }}>Nyaya AI</span>
                      {msg.confidence && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 8,
                            background: msg.confidence >= 0.8 ? "#f0fdf4" : "#fefce8",
                            color: msg.confidence >= 0.8 ? "#16a34a" : "#ca8a04",
                          }}
                        >
                          {Math.round(msg.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#9a8a74",
                        fontStyle: "italic",
                        marginBottom: 10,
                        padding: "4px 8px",
                        borderLeft: "2px solid #d4b896",
                        background: "#fdf8f0",
                      }}
                    >
                      This is legal research information only. No legal opinion or advice is provided.
                    </div>
                    <div
                      dangerouslySetInnerHTML={{ __html: markdownToSimpleHtml(msg.content) }}
                      style={{ color: "#2d2520" }}
                    />
                    {msg.citations && msg.citations.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e8e0d4" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#9a8a74", marginBottom: 6 }}>Sources</div>
                        {msg.citations.map((cite) => (
                          <div
                            key={cite.id}
                            style={{
                              fontSize: 12,
                              padding: "6px 8px",
                              marginBottom: 4,
                              background: "#faf8f5",
                              borderRadius: 6,
                              border: "1px solid #ede5d8",
                            }}
                          >
                            <div style={{ fontWeight: 500, color: "#4a3f35" }}>{cite.source}</div>
                            {cite.text && (
                              <div style={{ color: "#7a7060", fontSize: 11, marginTop: 2 }}>
                                {cite.text.substring(0, 120)}...
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  background: "white",
                  border: "1px solid #e8e0d4",
                  borderRadius: "14px 14px 14px 4px",
                  maxWidth: "90%",
                }}
              >
                <Sparkles size={14} color="#b69d74" style={{ animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: 13, color: "#9a8a74" }}>Researching Indian law...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {limitReached && (
        <div
          style={{
            padding: "10px 16px",
            background: "#fef2f2",
            borderTop: "1px solid #fecaca",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
          }}
          data-testid="text-limit-reached"
        >
          <AlertCircle size={16} color="#dc2626" />
          <span style={{ fontSize: 13, color: "#dc2626" }}>
            You've used all {usage.limit} free queries for today. Come back tomorrow for more.
          </span>
        </div>
      )}

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #e8e0d4",
          background: "white",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={limitReached ? "Daily limit reached. Try again tomorrow." : "Ask any legal question..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading || limitReached}
            data-testid="input-embed-query"
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid #e8e0d4",
              borderRadius: 10,
              fontSize: 14,
              outline: "none",
              background: limitReached ? "#f5f5f5" : "white",
              color: "#2d2520",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              if (!limitReached) e.target.style.borderColor = "#b69d74";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e8e0d4";
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || limitReached || !input.trim()}
            data-testid="button-embed-send"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: isLoading || limitReached || !input.trim() ? "#d4c9b8" : "#b69d74",
              color: "white",
              cursor: isLoading || limitReached || !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#b5a99a" }}>
            Powered by Chakshi Legal AI
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #d4c9b8; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale, X, Mic, MicOff, Volume2 } from "lucide-react";
import { markdownToHtml } from "@/lib/utils";
import robotAvatarImg from "@assets/745581637a60f880fb59e4553200f179_1770803349370.jpg";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface VoiceAssistantProps {
  onClose: () => void;
}

function GlowingOrb({ amplitude, state }: { amplitude: number; state: VoiceState }) {
  const scale = 1 + amplitude * 0.3;
  const glowIntensity = 20 + amplitude * 60;
  const ringScale1 = 1.3 + amplitude * 0.4;
  const ringScale2 = 1.6 + amplitude * 0.6;
  const ringScale3 = 1.9 + amplitude * 0.8;

  return (
    <div className="relative flex items-center justify-center" data-testid="voice-orb">
      <div
        className="voice-orb-ring voice-orb-ring-3"
        style={{
          transform: `scale(${ringScale3})`,
          opacity: 0.08 + amplitude * 0.12,
        }}
      />
      <div
        className="voice-orb-ring voice-orb-ring-2"
        style={{
          transform: `scale(${ringScale2})`,
          opacity: 0.12 + amplitude * 0.18,
        }}
      />
      <div
        className="voice-orb-ring voice-orb-ring-1"
        style={{
          transform: `scale(${ringScale1})`,
          opacity: 0.2 + amplitude * 0.25,
        }}
      />
      <div
        className="voice-orb-core"
        style={{
          transform: `scale(${scale})`,
          boxShadow: `0 0 ${glowIntensity}px ${glowIntensity / 2}px rgba(182, 157, 116, 0.4), 0 0 ${glowIntensity * 2}px ${glowIntensity}px rgba(182, 157, 116, 0.2)`,
        }}
      />
      <div className="absolute bottom-[-60px] text-center">
        <p className="text-sm text-muted-foreground">
          {state === "idle" && "Click the microphone to start"}
          {state === "listening" && "Listening..."}
          {state === "processing" && "Processing your speech..."}
        </p>
      </div>
    </div>
  );
}

function RobotAvatar({ speakingAmplitude }: { speakingAmplitude: number }) {
  const barCount = 5;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const baseHeight = 8;
    const center = Math.floor(barCount / 2);
    const distFromCenter = Math.abs(i - center);
    const factor = 1 - distFromCenter * 0.2;
    const height = baseHeight + speakingAmplitude * 40 * factor;
    return height;
  });

  return (
    <div className="flex flex-col items-center gap-6" data-testid="voice-robot-avatar">
      <div className="voice-robot-container">
        <img
          src={robotAvatarImg}
          alt="Nyaya AI Assistant"
          className="voice-robot-image"
        />
        <div
          className="voice-robot-glow"
          style={{
            opacity: 0.3 + speakingAmplitude * 0.5,
            transform: `scale(${1 + speakingAmplitude * 0.1})`,
          }}
        />
      </div>
      <div className="flex items-end gap-1 h-12" data-testid="voice-activity-bars">
        {bars.map((h, i) => (
          <div
            key={i}
            className="voice-activity-bar"
            style={{
              height: `${h}px`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function VoiceAssistant({ onClose }: VoiceAssistantProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [amplitude, setAmplitude] = useState(0);
  const [speakingAmplitude, setSpeakingAmplitude] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const speakAnimFrameRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      cancelAnimationFrame(speakAnimFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      playbackContextRef.current?.close();
    };
  }, []);

  const monitorAmplitude = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAmplitude(avg / 255);
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const startListening = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setState("listening");
      monitorAmplitude();
    } catch (err) {
      console.error("Mic access denied:", err);
      setError("Microphone access is required for voice assistant. Please allow microphone access.");
    }
  };

  const stopListening = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    cancelAnimationFrame(animFrameRef.current);
    setAmplitude(0);

    await new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        setState("processing");

        streamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
        audioContextRef.current = null;
        analyserRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        if (blob.size < 1000) {
          setState("idle");
          resolve();
          return;
        }

        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        try {
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error("Transcription failed");

          const data = await res.json();
          const text = (data.text || "").trim();

          if (!text) {
            setState("idle");
            resolve();
            return;
          }

          setCurrentTranscript(text);
          const userMsg: VoiceMessage = { id: Date.now().toString(), role: "user", content: text };
          setMessages(prev => [...prev, userMsg]);

          await getAIResponse(text);
        } catch (err) {
          console.error("Transcription error:", err);
          setError("Failed to transcribe audio. Please try again.");
          setState("idle");
        }
        resolve();
      };
      recorder.stop();
    });
  };

  const getAIResponse = async (query: string) => {
    try {
      const response = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

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
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
                );
              }
            } catch {}
          }
        }
      }

      setState("speaking");
      await speakResponse(fullContent);
    } catch (err) {
      console.error("AI response error:", err);
      setError("Failed to get AI response. Please try again.");
      setState("idle");
    }
  };

  const speakResponse = async (text: string) => {
    try {
      const plainText = text
        .replace(/#{1,6}\s/g, "")
        .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
        .replace(/`{1,3}[^`]*`{1,3}/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[-*]\s/g, "")
        .replace(/\n{2,}/g, ". ")
        .replace(/\n/g, " ")
        .trim();

      if (!plainText) {
        setState("idle");
        return;
      }

      const speakText = plainText.length > 3000 ? plainText.substring(0, 3000) + "..." : plainText;

      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speakText }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = new AudioContext();
      playbackContextRef.current = audioCtx;

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;

      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      playbackSourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateSpeakingAmplitude = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setSpeakingAmplitude(avg / 255);
        speakAnimFrameRef.current = requestAnimationFrame(updateSpeakingAmplitude);
      };

      source.onended = () => {
        cancelAnimationFrame(speakAnimFrameRef.current);
        setSpeakingAmplitude(0);
        setState("idle");
        setCurrentTranscript("");
        audioCtx.close();
        playbackContextRef.current = null;
      };

      source.start();
      speakAnimFrameRef.current = requestAnimationFrame(updateSpeakingAmplitude);
    } catch (err) {
      console.error("TTS error:", err);
      setState("idle");
    }
  };

  const handleMicToggle = () => {
    if (state === "listening") {
      stopListening();
    } else if (state === "idle") {
      startListening();
    }
  };

  const handleClose = () => {
    cancelAnimationFrame(animFrameRef.current);
    cancelAnimationFrame(speakAnimFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    if (playbackSourceRef.current) {
      try { playbackSourceRef.current.stop(); } catch {}
    }
    playbackContextRef.current?.close();
    onClose();
  };

  return (
    <div className="voice-assistant-container" data-testid="voice-assistant">
      <div className="voice-assistant-header">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-500 shadow-sm shadow-amber-400/30">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">Nyaya AI Voice Assistant</h2>
            <p className="text-xs text-muted-foreground">
              {state === "idle" && "Ready to listen"}
              {state === "listening" && "Listening to you..."}
              {state === "processing" && "Processing your speech..."}
              {state === "speaking" && "Speaking response..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant={state === "listening" ? "destructive" : "default"}
            onClick={handleMicToggle}
            disabled={state === "processing" || state === "speaking"}
            data-testid="button-voice-mic"
          >
            {state === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={handleClose} data-testid="button-voice-close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="voice-assistant-body">
        <div className="voice-left-panel">
          <div className="voice-visual-area">
            {state === "speaking" ? (
              <RobotAvatar speakingAmplitude={speakingAmplitude} />
            ) : (
              <GlowingOrb amplitude={amplitude} state={state} />
            )}
          </div>

          <div className="voice-controls">
            {state === "idle" && (
              <Button
                onClick={startListening}
                className="gap-2"
                data-testid="button-voice-start"
              >
                <Mic className="h-4 w-4" />
                Tap to Speak
              </Button>
            )}
            {state === "listening" && (
              <Button
                variant="destructive"
                onClick={stopListening}
                className="gap-2"
                data-testid="button-voice-stop"
              >
                <MicOff className="h-4 w-4" />
                Stop Recording
              </Button>
            )}
            {state === "processing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="voice-processing-dots">
                  <span /><span /><span />
                </div>
                Processing...
              </div>
            )}
            {state === "speaking" && (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <Volume2 className="h-4 w-4 animate-pulse" />
                Speaking...
              </div>
            )}
          </div>
        </div>

        <div className="voice-right-panel">
          <div className="voice-right-header">
            <h3 className="text-sm font-medium text-muted-foreground">Conversation</h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {messages.length === 0 && state === "idle" && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                  <Volume2 className="h-12 w-12 mb-4 text-amber-400/50" />
                  <h3 className="text-lg font-medium mb-2">Voice Assistant Ready</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Click "Tap to Speak" or the microphone button to ask your legal question. Nyaya AI will listen, understand, and respond with voice.
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-primary text-primary-foreground p-3 rounded-lg max-w-[85%]">
                        <p className="text-sm">{msg.content}</p>
                      </div>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Scale className="h-4 w-4 text-amber-600" />
                          <span className="font-medium text-sm text-amber-900 dark:text-amber-200">Nyaya AI</span>
                        </div>
                        <div className="mb-2 p-2 rounded bg-amber-50/50 dark:bg-amber-900/20 border-l-2 border-amber-500">
                          <p className="text-[10px] text-muted-foreground italic">
                            This research compiles judicial decisions and statutory provisions. No legal opinion or advice is provided.
                          </p>
                        </div>
                        <div
                          className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none voice-response-text"
                          dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}

              {state === "processing" && currentTranscript && (
                <div className="flex justify-end">
                  <div className="bg-primary/80 text-primary-foreground p-3 rounded-lg max-w-[85%]">
                    <p className="text-sm">{currentTranscript}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive text-center p-2">{error}</div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

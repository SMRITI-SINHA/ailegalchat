import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale, X, Mic, MicOff, Square } from "lucide-react";
import { markdownToHtml } from "@/lib/utils";

import LexAIRobot, { BOT_STATE } from "./LexAIRobot";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

const VOICE_TO_BOT_STATE: Record<VoiceState, string> = {
  idle: BOT_STATE.IDLE,
  listening: BOT_STATE.LISTENING,
  processing: BOT_STATE.THINKING,
  speaking: BOT_STATE.SPEAKING,
};

interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface VoiceAssistantProps {
  onClose: () => void;
}

function AnimatedOrb({ amplitude, state }: { amplitude: number; state: VoiceState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const smoothAmpRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const cssSize = 280;
    const size = 400;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";
    const scaleFactor = (cssSize / size) * dpr;
    ctx.scale(scaleFactor, scaleFactor);
    const cx = size / 2;
    const cy = size / 2;

    const draw = () => {
      timeRef.current += 0.012;
      const t = timeRef.current;
      smoothAmpRef.current += (amplitude - smoothAmpRef.current) * 0.08;
      const amp = smoothAmpRef.current;

      ctx.clearRect(0, 0, size, size);

      const isActive = state === "listening" || state === "speaking";
      const baseRadius = 70 + (isActive ? amp * 30 : 0);

      for (let layer = 4; layer >= 0; layer--) {
        const layerAmp = amp * (1 + layer * 0.3);
        const r = baseRadius + layer * 18 + layerAmp * 12;
        const alpha = (0.06 - layer * 0.008) + layerAmp * 0.04;

        ctx.beginPath();
        const points = 180;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wave1 = Math.sin(angle * 3 + t * 2) * (4 + layerAmp * 15);
          const wave2 = Math.sin(angle * 5 - t * 1.5) * (3 + layerAmp * 10);
          const wave3 = Math.sin(angle * 7 + t * 3) * (2 + layerAmp * 8);
          const dist = r + wave1 + wave2 + wave3;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const hue1 = 30 + Math.sin(t * 0.5 + layer) * 15;
        const hue2 = 45 + Math.sin(t * 0.7 + layer * 0.5) * 20;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 30);
        grad.addColorStop(0, `hsla(${hue1}, 70%, 65%, ${alpha * 3})`);
        grad.addColorStop(0.5, `hsla(${hue2}, 60%, 55%, ${alpha * 2})`);
        grad.addColorStop(1, `hsla(${hue1 + 10}, 50%, 45%, ${alpha})`);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      const corePoints = 180;
      ctx.beginPath();
      for (let i = 0; i <= corePoints; i++) {
        const angle = (i / corePoints) * Math.PI * 2;
        const wave1 = Math.sin(angle * 4 + t * 2.5) * (3 + amp * 18);
        const wave2 = Math.cos(angle * 6 - t * 1.8) * (2 + amp * 12);
        const wave3 = Math.sin(angle * 8 + t * 3.2) * (1.5 + amp * 8);
        const dist = baseRadius + wave1 + wave2 + wave3;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const coreGrad = ctx.createRadialGradient(cx - 15, cy - 15, 0, cx, cy, baseRadius + 20);
      const h1 = 35 + Math.sin(t) * 10;
      const h2 = 25 + Math.cos(t * 0.8) * 10;
      coreGrad.addColorStop(0, `hsla(50, 85%, 80%, 0.95)`);
      coreGrad.addColorStop(0.3, `hsla(${h1}, 75%, 68%, 0.9)`);
      coreGrad.addColorStop(0.6, `hsla(${h1}, 65%, 55%, 0.85)`);
      coreGrad.addColorStop(0.85, `hsla(${h2}, 55%, 42%, 0.8)`);
      coreGrad.addColorStop(1, `hsla(${h2}, 50%, 35%, 0.7)`);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      const specR = baseRadius * 0.5;
      const specGrad = ctx.createRadialGradient(cx - 20, cy - 25, 0, cx - 20, cy - 25, specR);
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
      specGrad.addColorStop(0.5, "rgba(255, 245, 220, 0.15)");
      specGrad.addColorStop(1, "rgba(255, 240, 200, 0)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.ellipse(cx - 20, cy - 25, specR * 0.8, specR * 0.6, -0.3, 0, Math.PI * 2);
      ctx.fill();

      if (amp > 0.05) {
        const numParticles = Math.floor(amp * 12);
        for (let i = 0; i < numParticles; i++) {
          const angle = (i / numParticles) * Math.PI * 2 + t * 0.5;
          const dist = baseRadius + 30 + Math.sin(t * 2 + i * 1.5) * 20 * amp;
          const px = cx + Math.cos(angle) * dist;
          const py = cy + Math.sin(angle) * dist;
          const pAlpha = amp * 0.4 * (0.5 + Math.sin(t * 3 + i) * 0.5);
          const pSize = 1.5 + amp * 2;
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(40, 80%, 70%, ${pAlpha})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [amplitude, state]);

  return (
    <div className="voice-orb-wrapper" data-testid="voice-orb">
      <canvas
        ref={canvasRef}
        className="voice-orb-canvas"
      />
      <div className="voice-orb-status">
        {state === "idle" && "Tap to start speaking"}
        {state === "listening" && "Listening..."}
        {state === "processing" && "Thinking..."}
      </div>
    </div>
  );
}

function Avatar3D({ speakingAmplitude, state }: { speakingAmplitude: number; state: VoiceState }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const leftArmRef = useRef<SVGGElement>(null);
  const rightArmRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGEllipseElement>(null);
  const mouthSmileRef = useRef<SVGPathElement>(null);
  const leftEyeRef = useRef<SVGRectElement>(null);
  const rightEyeRef = useRef<SVGRectElement>(null);
  const leftBlinkRef = useRef<SVGLineElement>(null);
  const rightBlinkRef = useRef<SVGLineElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  const timeRef = useRef(0);
  const animRef = useRef<number>(0);
  const smoothAmpRef = useRef(0);
  const gestureTimerRef = useRef(0);
  const currentGestureRef = useRef(0);
  const blinkStateRef = useRef(false);

  useEffect(() => {
    const animate = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;
      smoothAmpRef.current += (speakingAmplitude - smoothAmpRef.current) * 0.12;
      const amp = smoothAmpRef.current;

      const floatY = Math.sin(t * 0.8) * 12 + Math.sin(t * 1.3) * 5;
      const floatRotate = Math.sin(t * 0.5) * 2;
      const bodyScale = 1 + (state === "speaking" ? amp * 0.03 : 0);

      if (sceneRef.current) {
        sceneRef.current.style.transform = `translateY(${floatY}px) rotate(${floatRotate}deg) scale(${bodyScale})`;
      }

      gestureTimerRef.current += 0.016;
      if (gestureTimerRef.current > 2.5 + Math.random() * 2) {
        gestureTimerRef.current = 0;
        currentGestureRef.current = Math.floor(Math.random() * 4);
      }

      let leftArm = Math.sin(t * 0.6) * 5;
      let rightArm = Math.sin(t * 0.7 + 1) * 5;

      if (state === "speaking") {
        const gesture = currentGestureRef.current;
        if (gesture === 0) { rightArm = -30 + Math.sin(t * 1.5) * 10; leftArm = 5 + Math.sin(t * 1.2) * 5; }
        else if (gesture === 1) { leftArm = -25 + Math.sin(t * 1.3) * 8; rightArm = -25 + Math.sin(t * 1.3 + 0.5) * 8; }
        else if (gesture === 2) { rightArm = -45 + Math.sin(t * 2) * 5; leftArm = 10 + Math.sin(t * 0.8) * 5; }
        else { leftArm = -15 + Math.sin(t * 1.8) * 12; rightArm = 15 + Math.sin(t * 1.8 + Math.PI) * 12; }
      }

      if (leftArmRef.current) leftArmRef.current.setAttribute("transform", `rotate(${leftArm}, -35, -10)`);
      if (rightArmRef.current) rightArmRef.current.setAttribute("transform", `rotate(${rightArm}, 35, -10)`);

      const headTilt = state === "speaking" ? Math.sin(t * 1.2) * 4 + amp * 3 : Math.sin(t * 0.4) * 2;
      if (headRef.current) headRef.current.setAttribute("transform", `rotate(${headTilt}, 0, -50)`);

      const mouthOpen = state === "speaking" ? amp * 0.8 + Math.sin(t * 8) * amp * 0.3 : 0;
      const mw = (12 + mouthOpen * 16) / 2;
      const mh = (2 + mouthOpen * 12) / 2;
      if (mouthRef.current) {
        mouthRef.current.setAttribute("rx", String(mw));
        mouthRef.current.setAttribute("ry", String(mh));
        mouthRef.current.style.display = state === "speaking" ? "" : "none";
      }
      if (mouthSmileRef.current) {
        mouthSmileRef.current.style.display = state === "speaking" ? "none" : "";
      }

      const shouldBlink = Math.random() < 0.005;
      if (shouldBlink) blinkStateRef.current = true;
      if (blinkStateRef.current && Math.random() < 0.15) blinkStateRef.current = false;
      const isBlink = blinkStateRef.current;
      const eyeH = isBlink ? 2 : (amp > 0.6 ? 10 : 8);

      if (leftEyeRef.current && rightEyeRef.current) {
        leftEyeRef.current.style.display = isBlink ? "none" : "";
        rightEyeRef.current.style.display = isBlink ? "none" : "";
        leftEyeRef.current.setAttribute("height", String(eyeH));
        leftEyeRef.current.setAttribute("y", String(-78 - eyeH / 2));
        rightEyeRef.current.setAttribute("height", String(eyeH));
        rightEyeRef.current.setAttribute("y", String(-78 - eyeH / 2));
      }
      if (leftBlinkRef.current && rightBlinkRef.current) {
        leftBlinkRef.current.style.display = isBlink ? "" : "none";
        rightBlinkRef.current.style.display = isBlink ? "" : "none";
      }

      if (barsRef.current) {
        const bars = barsRef.current.children;
        for (let i = 0; i < bars.length; i++) {
          const center = 3;
          const dist = Math.abs(i - center);
          const factor = 1 - dist * 0.15;
          const h = 4 + amp * 36 * factor + Math.sin(t * 6 + i) * 3;
          (bars[i] as HTMLElement).style.height = `${Math.max(4, h)}px`;
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [speakingAmplitude, state]);

  return (
    <div className="voice-avatar-3d-wrapper" data-testid="voice-robot-avatar">
      <div ref={sceneRef} className="voice-avatar-3d-scene">
        <svg viewBox="0 0 200 280" className="voice-avatar-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#f5f0ea" />
              <stop offset="60%" stopColor="#e8ddd0" />
              <stop offset="100%" stopColor="#d4c5b0" />
            </radialGradient>
            <radialGradient id="headGrad" cx="45%" cy="35%" r="55%">
              <stop offset="0%" stopColor="#faf5ef" />
              <stop offset="50%" stopColor="#f0e6d8" />
              <stop offset="100%" stopColor="#ddd0be" />
            </radialGradient>
            <linearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1520" />
              <stop offset="100%" stopColor="#0a0810" />
            </linearGradient>
            <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e8a855" />
              <stop offset="100%" stopColor="#c48840" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="softShadow">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00000040" />
            </filter>
          </defs>

          <g transform="translate(100, 140)" filter="url(#softShadow)">
            <g ref={leftArmRef}>
              <line x1="-35" y1="-10" x2="-55" y2="20" stroke="#3a3540" strokeWidth="4" strokeLinecap="round" />
              <circle cx="-55" cy="20" r="6" fill="#3a3540" />
              <line x1="-55" y1="20" x2="-50" y2="15" stroke="#3a3540" strokeWidth="2" strokeLinecap="round" />
              <line x1="-55" y1="20" x2="-58" y2="14" stroke="#3a3540" strokeWidth="2" strokeLinecap="round" />
              <line x1="-55" y1="20" x2="-60" y2="17" stroke="#3a3540" strokeWidth="2" strokeLinecap="round" />
            </g>

            <g ref={rightArmRef}>
              <line x1="35" y1="-10" x2="55" y2="20" stroke="#3a3540" strokeWidth="4" strokeLinecap="round" />
              <circle cx="55" cy="20" r="6" fill="#3a3540" />
              <line x1="55" y1="20" x2="50" y2="15" stroke="#3a3540" strokeWidth="2" strokeLinecap="round" />
              <line x1="55" y1="20" x2="58" y2="14" stroke="#3a3540" strokeWidth="2" strokeLinecap="round" />
              <line x1="55" y1="20" x2="60" y2="17" stroke="#3a3540" strokeWidth="2" strokeLinecap="round" />
            </g>

            <ellipse cx="0" cy="15" rx="32" ry="38" fill="url(#bodyGrad)" />
            <ellipse cx="0" cy="15" rx="28" ry="34" fill="url(#bodyGrad)" opacity="0.5" />
            <rect x="-8" y="-8" width="16" height="16" rx="3" fill="url(#accentGrad)" opacity="0.7" filter="url(#glow)" />
            <path d="M-12,42 Q-8,50 0,52 Q8,50 12,42" fill="none" stroke="#e8a855" strokeWidth="2" opacity="0.6" />
            <path d="M-8,44 Q0,50 8,44" fill="none" stroke="#e8a855" strokeWidth="1.5" opacity="0.4" />

            <line x1="-5" y1="-42" x2="-5" y2="-48" stroke="#3a3540" strokeWidth="3" strokeLinecap="round" />
            <line x1="5" y1="-42" x2="5" y2="-48" stroke="#3a3540" strokeWidth="3" strokeLinecap="round" />

            <g ref={headRef}>
              <ellipse cx="0" cy="-75" rx="38" ry="32" fill="url(#headGrad)" />
              <ellipse cx="-10" cy="-85" rx="18" ry="4" fill="url(#headGrad)" />
              <ellipse cx="10" cy="-85" rx="18" ry="4" fill="url(#headGrad)" />
              <rect x="-35" y="-100" width="70" height="50" rx="12" fill="url(#faceGrad)" />
              <rect x="-33" y="-98" width="66" height="17" rx="6" fill="#1a1520" opacity="0.3" />

              <g filter="url(#glow)">
                <line ref={leftBlinkRef} x1="-20" y1="-78" x2="-10" y2="-78" stroke="#e8a855" strokeWidth="2" strokeLinecap="round" style={{ display: "none" }} />
                <line ref={rightBlinkRef} x1="10" y1="-78" x2="20" y2="-78" stroke="#e8a855" strokeWidth="2" strokeLinecap="round" style={{ display: "none" }} />
                <rect ref={leftEyeRef} x="-22" y="-82" width="8" height="8" rx="1" fill="#e8a855" />
                <rect ref={rightEyeRef} x="14" y="-82" width="8" height="8" rx="1" fill="#e8a855" />
                <ellipse ref={mouthRef} cx="0" cy="-65" rx="6" ry="1" fill="#e8a855" style={{ display: "none" }} />
                <path ref={mouthSmileRef} d="M-6,-66 Q0,-63 6,-66" fill="none" stroke="#e8a855" strokeWidth="1.5" />
              </g>

              <circle cx="-30" cy="-70" r="2" fill="#e8a855" opacity="0.3" />
              <circle cx="30" cy="-70" r="2" fill="#e8a855" opacity="0.3" />
            </g>

            <g>
              <line x1="-15" y1="52" x2="-20" y2="75" stroke="#3a3540" strokeWidth="4" strokeLinecap="round" />
              <line x1="15" y1="52" x2="20" y2="75" stroke="#3a3540" strokeWidth="4" strokeLinecap="round" />
              <ellipse cx="-20" cy="78" rx="8" ry="4" fill="#3a3540" />
              <ellipse cx="20" cy="78" rx="8" ry="4" fill="#3a3540" />
            </g>
          </g>
        </svg>
      </div>

      {state === "speaking" && (
        <div ref={barsRef} className="voice-speaking-bars" data-testid="voice-activity-bars">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="voice-speak-bar" style={{ height: "4px" }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VoiceAssistant({ onClose }: VoiceAssistantProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [amplitude, setAmplitude] = useState(0);
  const [speakingAmplitude, setSpeakingAmplitude] = useState(0);
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stopFnRef = useRef<() => void>(() => {});

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
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const startAmplitudeMonitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    silenceCountRef.current = 0;

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalized = avg / 255;
      setAmplitude(normalized);

      if (normalized < 0.02) {
        silenceCountRef.current++;
        if (silenceCountRef.current > 120) {
          silenceCountRef.current = 0;
          const recorder = mediaRecorderRef.current;
          if (recorder && recorder.state === "recording") {
            if (audioChunksRef.current.length > 0) {
              stopFnRef.current();
              return;
            }
          }
        }
      } else {
        silenceCountRef.current = 0;
      }

      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const startListening = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
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
      silenceCountRef.current = 0;
      startAmplitudeMonitor();
    } catch (err) {
      console.error("Mic access denied:", err);
      setError("Microphone access is required. Please allow microphone access in your browser.");
    }
  };

  const stopListeningAndProcess = async () => {
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

  stopFnRef.current = stopListeningAndProcess;

  const getAIResponse = async (query: string) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
        signal: controller.signal,
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
    } catch (err: any) {
      if (err.name === "AbortError") return;
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

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speakText }),
        signal: controller.signal,
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
        audioCtx.close();
        playbackContextRef.current = null;
      };

      source.start();
      speakAnimFrameRef.current = requestAnimationFrame(updateSpeakingAmplitude);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("TTS error:", err);
      setState("idle");
    }
  };

  const stopSpeaking = () => {
    cancelAnimationFrame(speakAnimFrameRef.current);
    setSpeakingAmplitude(0);
    if (playbackSourceRef.current) {
      try { playbackSourceRef.current.stop(); } catch {}
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    setState("idle");
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
    abortControllerRef.current?.abort();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    onClose();
  };

  return (
    <div className="voice-assistant-container" data-testid="voice-assistant">
      <div className="voice-header-bar">
        <div className="flex items-center gap-3">
          <div className="voice-header-icon">
            <Scale className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-white/90">Nyaya AI Voice</span>
        </div>
        <div className="flex items-center gap-2">
          {state === "speaking" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={stopSpeaking}
              className="gap-1 voice-stop-btn"
              data-testid="button-voice-stop-speaking"
            >
              <Square className="h-3 w-3" />
              Stop
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleClose}
            className="text-white/70 hover:text-white"
            data-testid="button-voice-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="voice-body">
        <div className="voice-panel voice-panel-left">
          <div className="voice-visual-center">
            <div className="voice-assistant-avatar-container">
              <LexAIRobot 
                botState={VOICE_TO_BOT_STATE[state]} 
                audioAmplitude={state === "speaking" ? speakingAmplitude : amplitude} 
              />
            </div>
          </div>

          <div className="voice-action-area">
            {state === "idle" && (
              <button
                onClick={startListening}
                className="voice-mic-button"
                data-testid="button-voice-start"
              >
                <Mic className="h-6 w-6" />
              </button>
            )}
            {state === "listening" && (
              <button
                onClick={stopListeningAndProcess}
                className="voice-mic-button voice-mic-active"
                data-testid="button-voice-stop"
              >
                <MicOff className="h-6 w-6" />
              </button>
            )}
            {state === "processing" && (
              <div className="voice-processing-indicator">
                <div className="voice-processing-spinner" />
                <span>Processing...</span>
              </div>
            )}
            {state === "speaking" && (
              <button
                onClick={stopSpeaking}
                className="voice-mic-button voice-mic-stop"
                data-testid="button-voice-stop-speak"
              >
                <Square className="h-5 w-5" />
              </button>
            )}
          </div>

          {error && (
            <div className="voice-error">{error}</div>
          )}
        </div>

        <div className="voice-panel voice-panel-right">
          <div className="voice-transcript-header">
            <Scale className="h-4 w-4 text-amber-300/70" />
            <span>Conversation</span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {messages.length === 0 && (
                <div className="voice-empty-state">
                  <Mic className="h-10 w-10 text-amber-400/30" />
                  <h3>Voice Assistant Ready</h3>
                  <p>Tap the microphone and ask your legal question. The assistant will listen, understand, and respond naturally.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`voice-msg ${msg.role === "user" ? "voice-msg-user" : "voice-msg-ai"}`}>
                  {msg.role === "assistant" && (
                    <div className="voice-msg-label">
                      <Scale className="h-3 w-3" />
                      <span>Nyaya AI</span>
                    </div>
                  )}
                  {msg.role === "user" ? (
                    <p>{msg.content}</p>
                  ) : (
                    <div
                      className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }}
                    />
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
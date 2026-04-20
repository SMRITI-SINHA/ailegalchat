import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Trust X-Forwarded-For from proxy/load balancer so rate limits
// apply per real user IP, not Chakshi's server IP
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const replitDomains = process.env.REPLIT_DOMAINS
  ? process.env.REPLIT_DOMAINS.split(",").map((d) => `https://${d.trim()}`)
  : [];

const allowedOrigins = new Set<string>([
  "https://chakshi.com",
  "https://www.chakshi.com",
  "https://chakshi.in",
  "https://www.chakshi.in",
  ...replitDomains,
]);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const isDev = process.env.NODE_ENV !== "production";

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isDev) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
  })
);

// Extract user ID from JWT for rate limit key — prevents all users
// sharing one bucket when Chakshi's backend proxies requests.
// We decode without verifying here (auth middleware does the real check).
// IPv6-mapped IPv4 addresses are normalised to plain IPv4 as fallback.
function resolveRateLimitKey(req: Request): string {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
    if (!token && typeof req.query.token === "string") token = req.query.token as string;
    if (token) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      const userId = payload.sub || payload.userId || payload.user_id;
      if (userId) return String(userId);
    }
  } catch {
    // fall through to IP
  }
  // Normalise IPv6-mapped IPv4 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
  const ip = (req.ip || "unknown").replace(/^::ffff:/, "");
  return ip;
}

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveRateLimitKey,
  // Primary key is JWT user ID — IP is only a fallback for unauthenticated
  // requests. Suppress the IPv6 static check which doesn't apply here.
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many requests, please try again later." },
  skip: (req) => !req.path.startsWith("/api"),
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveRateLimitKey,
  validate: { keyGeneratorIpFallback: false },
  message: { error: "AI rate limit exceeded, please wait before sending more requests." },
});

app.use(globalLimiter);

app.use("/api/chat/query", aiLimiter);
app.use("/api/draft", aiLimiter);
app.use("/api/drafts/generate", aiLimiter);
app.use("/api/memos/generate", aiLimiter);
app.use("/api/compliance/generate", aiLimiter);
app.use("/api/research", aiLimiter);

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log('Voice service: using OpenAI Whisper (transcription) + OpenAI TTS (speech)');

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[Error ${status}]: ${message}`);

    const safeMessage = status >= 500 ? "Internal Server Error" : message;
    res.status(status).json({ error: safeMessage });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

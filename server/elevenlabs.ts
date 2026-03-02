import { ElevenLabsClient } from 'elevenlabs';
import WebSocket from 'ws';

let cachedApiKey: string | null = null;
let cachedClient: ElevenLabsClient | null = null;

async function getCredentials(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  if (process.env.ELEVENLABS_API_KEY) {
    cachedApiKey = process.env.ELEVENLABS_API_KEY;
    return cachedApiKey;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('ElevenLabs not configured. Set ELEVENLABS_API_KEY in your .env file.');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=elevenlabs',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error('ElevenLabs not connected. Set ELEVENLABS_API_KEY in your .env file.');
  }

  cachedApiKey = connectionSettings.settings.api_key;
  return cachedApiKey!;
}

export async function getUncachableElevenLabsClient() {
  if (cachedClient) return cachedClient;
  const apiKey = await getCredentials();
  cachedClient = new ElevenLabsClient({ apiKey });
  return cachedClient;
}

export async function getElevenLabsApiKey() {
  return await getCredentials();
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<{ text: string; language_code: string }> {
  if (!audioBuffer || audioBuffer.length < 100) {
    throw new Error('Audio file is empty or too small');
  }

  const apiKey = await getCredentials();

  const formData = new FormData();
  const mimeType = filename.endsWith('.wav') ? 'audio/wav'
    : filename.endsWith('.mp3') ? 'audio/mpeg'
    : filename.endsWith('.ogg') ? 'audio/ogg'
    : 'audio/webm';
  formData.append('file', new Blob([audioBuffer], { type: mimeType }), filename);
  formData.append('model_id', 'scribe_v1');

  console.log(`Transcription: sending ${audioBuffer.length} bytes, mime=${mimeType}, file=${filename}`);

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body');
    console.error('ElevenLabs transcription error:', response.status, response.statusText, errorBody);
    throw new Error('Transcription failed: ' + response.status + ' ' + errorBody);
  }

  const result = await response.json();
  console.log(`Transcription result: "${(result.text || '').substring(0, 50)}..." lang=${result.language_code}`);
  return { text: result.text || '', language_code: result.language_code || 'eng' };
}

export const DEFAULT_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';
export const TTS_MODEL = 'eleven_v3';

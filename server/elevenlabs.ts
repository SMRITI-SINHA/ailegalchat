import { ElevenLabsClient } from 'elevenlabs';
import WebSocket from 'ws';

let envApiKey: string | null = null;

async function getCredentials(): Promise<string> {
  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }

  if (envApiKey) {
    return envApiKey;
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

  console.log('Fetching ElevenLabs credentials from Replit connector...');
  const res = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=elevenlabs',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('Replit connector error:', res.status, body.substring(0, 200));
    throw new Error('Failed to get ElevenLabs credentials from Replit: ' + res.status);
  }

  const data = await res.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    console.error('ElevenLabs connector response:', JSON.stringify(data).substring(0, 300));
    throw new Error('ElevenLabs not connected. Set ELEVENLABS_API_KEY in your .env file.');
  }

  envApiKey = connectionSettings.settings.api_key;
  console.log('ElevenLabs credentials obtained successfully');
  return envApiKey!;
}

export async function getUncachableElevenLabsClient() {
  const apiKey = await getCredentials();
  return new ElevenLabsClient({ apiKey });
}

export async function getElevenLabsApiKey() {
  return await getCredentials();
}

export async function warmupElevenLabs(): Promise<boolean> {
  try {
    const key = await getCredentials();
    console.log('ElevenLabs warmup: credentials available, key starts with:', key.substring(0, 8) + '...');
    return true;
  } catch (err: any) {
    console.error('ElevenLabs warmup FAILED:', err?.message || err);
    return false;
  }
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

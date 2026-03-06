import OpenAI from "openai";
import { Readable } from "stream";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<{ text: string; language_code: string }> {
  if (!audioBuffer || audioBuffer.length < 100) {
    throw new Error("Audio file is empty or too small");
  }

  const mimeType = filename.endsWith(".wav")
    ? "audio/wav"
    : filename.endsWith(".mp3")
    ? "audio/mpeg"
    : filename.endsWith(".ogg")
    ? "audio/ogg"
    : "audio/webm";

  console.log(
    `Transcription (OpenAI): sending ${audioBuffer.length} bytes, mime=${mimeType}, file=${filename}`
  );

  const file = new File([audioBuffer], filename, { type: mimeType });

  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
  });

  const text = result.text || "";
  const lang = (result as any).language || "english";

  const LANG_MAP: Record<string, string> = {
    english: "eng",
    hindi: "hin",
    bengali: "ben",
    tamil: "tam",
    telugu: "tel",
    marathi: "mar",
    gujarati: "guj",
    kannada: "kan",
    malayalam: "mal",
    punjabi: "pan",
    odia: "ori",
    assamese: "asm",
    urdu: "urd",
    nepali: "nep",
    sanskrit: "san",
    sindhi: "snd",
    kashmiri: "kas",
    konkani: "kok",
    maithili: "mai",
    manipuri: "mni",
    dogri: "doi",
    bodo: "bod",
    santali: "sat",
  };

  const langCode = LANG_MAP[lang.toLowerCase()] || "eng";

  console.log(
    `Transcription result: "${text.substring(0, 50)}..." lang=${lang} → ${langCode}`
  );

  return { text, language_code: langCode };
}

export async function generateSpeech(
  text: string,
  voice: string = "nova"
): Promise<Buffer> {
  const speakText =
    text.length > 4096 ? text.substring(0, 4096) + "..." : text;

  console.log(
    `TTS (OpenAI): ${speakText.length} chars, voice=${voice}`
  );

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as any,
    input: speakText,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`TTS result: ${buffer.length} bytes`);
  return buffer;
}

export const DEFAULT_VOICE = "nova";
export const AVAILABLE_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
];

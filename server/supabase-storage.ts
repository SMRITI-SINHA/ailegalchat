import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "chakshi-documents";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured: SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

export async function uploadDocument(
  userId: string,
  documentId: string,
  file: Express.Multer.File
): Promise<{ path: string; signedUrl: string }> {
  const client = getClient();
  const safeName = encodeURIComponent(file.originalname);
  const path = `${userId}/${documentId}/${safeName}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const signedUrl = await getSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, signedUrl };
}

export async function uploadTrainingDoc(
  userId: string,
  docId: string,
  file: Express.Multer.File
): Promise<{ path: string; signedUrl: string }> {
  const client = getClient();
  const safeName = encodeURIComponent(file.originalname);
  const path = `${userId}/training/${docId}/${safeName}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase training doc upload failed: ${error.message}`);
  }

  const signedUrl = await getSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, signedUrl };
}

export async function uploadAudio(
  file: Express.Multer.File
): Promise<{ path: string }> {
  const client = getClient();
  const timestamp = Date.now();
  const safeName = encodeURIComponent(file.originalname || "recording.webm");
  const path = `temp/audio/${timestamp}/${safeName}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase audio upload failed: ${error.message}`);
  }

  return { path };
}

export async function deleteFile(path: string): Promise<void> {
  const client = getClient();
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) {
    console.warn(`[Supabase] Failed to delete ${path}: ${error.message}`);
  }
}

export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message || "unknown"}`);
  }

  return data.signedUrl;
}

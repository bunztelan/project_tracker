import { put, del } from "@vercel/blob";

/**
 * Upload a file to Vercel Blob storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<{ url: string }> {
  const blob = await put(pathname, file, {
    access: "public",
  });
  return { url: blob.url };
}

/**
 * Delete a file from Vercel Blob storage by its URL.
 */
export async function deleteFromBlob(url: string): Promise<void> {
  await del(url);
}

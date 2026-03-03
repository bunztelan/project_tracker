import { put, del } from "@vercel/blob";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const useLocalStorage = !process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Upload a file to Vercel Blob (production) or local disk (development).
 * Returns the URL to access the uploaded file.
 */
export async function uploadToBlob(
  file: File,
  pathname: string
): Promise<{ url: string }> {
  if (useLocalStorage) {
    const absDir = path.join(process.cwd(), "uploads", path.dirname(pathname));
    await mkdir(absDir, { recursive: true });
    const absPath = path.join(process.cwd(), "uploads", pathname);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absPath, buffer);
    return { url: `/api/files/${pathname}` };
  }

  const blob = await put(pathname, file, { access: "public" });
  return { url: blob.url };
}

/**
 * Delete a file from Vercel Blob (production) or local disk (development).
 */
export async function deleteFromBlob(url: string): Promise<void> {
  if (useLocalStorage) {
    // Local URLs look like /api/files/attachments/...
    const relativePath = url.replace("/api/files/", "");
    const absPath = path.join(process.cwd(), "uploads", relativePath);
    try {
      await unlink(absPath);
    } catch {
      // File may not exist, ignore
    }
    return;
  }

  await del(url);
}

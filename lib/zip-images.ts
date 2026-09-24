import AdmZip from "adm-zip";

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".eps": "application/postscript",
};

export interface ExtractedImage {
  bytes: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Every real image file inside a .zip — used both when a partner uploads a
 * .zip themselves (BrandAssetsCard) and when one arrives as an email
 * attachment (lib/email-ingestion.ts). Skips directories and dotfiles
 * (macOS's .DS_Store / __MACOSX junk, which real logo zips regularly carry).
 */
export function extractImagesFromZip(zipBytes: Buffer): ExtractedImage[] {
  const zip = new AdmZip(zipBytes);
  const images: ExtractedImage[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const baseName = entry.entryName.split("/").pop() ?? "";
    if (baseName.startsWith(".")) continue;
    const extension = baseName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
    const mimeType = IMAGE_MIME_BY_EXTENSION[extension];
    if (!mimeType) continue;
    images.push({ bytes: entry.getData(), mimeType, filename: baseName });
  }
  return images;
}

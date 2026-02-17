import fs from "node:fs/promises";
import path from "node:path";

function normalizeStoragePath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") throw new Error("Invalid upload path");
  const trimmed = inputPath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (trimmed.includes("..")) throw new Error("Invalid upload path");
  return trimmed;
}

export function toPublicUploadUrl(apiPublicUrl, relativePath) {
  const encoded = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${apiPublicUrl.replace(/\/+$/, "")}/uploads/${encoded}`;
}

export async function saveBase64Upload({ uploadsDir, relativePath, base64Data }) {
  const normalizedPath = normalizeStoragePath(relativePath);
  const destination = path.join(uploadsDir, normalizedPath);
  const resolvedUploadsDir = path.resolve(uploadsDir);
  const resolvedDestination = path.resolve(destination);

  if (!resolvedDestination.startsWith(resolvedUploadsDir)) throw new Error("Upload path escapes upload directory");

  await fs.mkdir(path.dirname(resolvedDestination), { recursive: true });
  const buffer = Buffer.from(base64Data, "base64");
  await fs.writeFile(resolvedDestination, buffer);

  return normalizedPath;
}


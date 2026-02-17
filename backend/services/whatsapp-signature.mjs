import { createHmac, timingSafeEqual } from "node:crypto";

export function computeMetaSignature(rawBody, appSecret) {
  const digest = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return `sha256=${digest}`;
}

export function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=") || !appSecret) return false;
  const expected = computeMetaSignature(rawBody, appSecret);
  const left = Buffer.from(expected);
  const right = Buffer.from(signatureHeader.trim());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}


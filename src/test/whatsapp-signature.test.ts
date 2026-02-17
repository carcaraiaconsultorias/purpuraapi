import { describe, it, expect } from "vitest";
import { computeMetaSignature, verifyMetaSignature } from "../../backend/services/whatsapp-signature.mjs";

describe("whatsapp signature validation", () => {
  it("accepts valid signature", async () => {
    const body = JSON.stringify({ hello: "world" });
    const secret = "unit-test-secret";
    const signature = await computeMetaSignature(body, secret);

    const ok = await verifyMetaSignature(body, signature, secret);
    expect(ok).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const body = JSON.stringify({ hello: "world" });
    const ok = await verifyMetaSignature(body, "sha256=deadbeef", "unit-test-secret");
    expect(ok).toBe(false);
  });
});

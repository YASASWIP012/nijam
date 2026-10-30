import { createPrivateKey, sign } from "node:crypto";

/** Signs a receipt so a report cannot be rebuilt elsewhere and passed off as Nijam's. */
export function signReceipt(receipt: string): string | undefined {
  const pem = process.env.RECEIPT_KEY;
  if (!pem) return undefined;
  const key = createPrivateKey({ key: Buffer.from(pem, "base64"), format: "der", type: "pkcs8" });
  return sign(null, Buffer.from(receipt), key).toString("base64");
}

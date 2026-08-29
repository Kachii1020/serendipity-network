import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { Provider } from "@serendipity/contracts";

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export type HoldTokenEncryptionContext = {
  bundleSessionId: string;
  provider: Provider;
};

export const parseBundleEncryptionKey = (encoded: string): Buffer => {
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) {
    throw new Error("BUNDLE_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
};

const additionalData = (context: HoldTokenEncryptionContext): Buffer =>
  Buffer.from(
    `serendipity:hold-token:v1:${context.bundleSessionId}:${context.provider}`,
  );

export const encryptHoldToken = (
  rawToken: string,
  encodedKey: string,
  context: HoldTokenEncryptionContext,
): string => {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    "aes-256-gcm",
    parseBundleEncryptionKey(encodedKey),
    iv,
  );
  cipher.setAAD(additionalData(context));
  const ciphertext = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const envelope = Buffer.concat([
    Buffer.from([VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
  return envelope.toString("base64url");
};

export const decryptHoldToken = (
  envelope: string,
  encodedKey: string,
  context: HoldTokenEncryptionContext,
): string => {
  const bytes = Buffer.from(envelope, "base64url");
  if (bytes.length < 1 + IV_LENGTH + TAG_LENGTH || bytes[0] !== VERSION) {
    throw new Error("Invalid hold-token ciphertext envelope");
  }
  const iv = bytes.subarray(1, 1 + IV_LENGTH);
  const tag = bytes.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = bytes.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    parseBundleEncryptionKey(encodedKey),
    iv,
  );
  decipher.setAAD(additionalData(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
};

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { parseBundleEncryptionKey } from "./encryption";

export type HubServerEnv = {
  bundleEncryptionKey: string;
  interserviceSecret: string;
  secretKey: string;
  url: string;
};

const requireEnv = (
  source: Record<string, string | undefined>,
  name: string,
): string => {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required on the server`);
  return value;
};

const validateSupabaseUrl = (value: string): string => {
  const parsed = new URL(value);
  const localHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error("SUPABASE_URL must use HTTPS, except for localhost");
  }
  return parsed.origin;
};

export const readHubServerEnv = (
  source: Record<string, string | undefined> = process.env,
): HubServerEnv => {
  const bundleEncryptionKey = requireEnv(source, "BUNDLE_ENCRYPTION_KEY");
  parseBundleEncryptionKey(bundleEncryptionKey);
  return {
    bundleEncryptionKey,
    interserviceSecret: requireEnv(source, "HUB_INTERSERVICE_SECRET"),
    secretKey: requireEnv(source, "SUPABASE_SECRET_KEY"),
    url: validateSupabaseUrl(requireEnv(source, "SUPABASE_URL")),
  };
};

export const createHubSupabaseClient = (
  config: HubServerEnv = readHubServerEnv(),
) =>
  createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

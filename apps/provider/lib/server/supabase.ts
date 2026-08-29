import "server-only";

import { createClient } from "@supabase/supabase-js";

export type ProviderServerEnv = { secretKey: string; url: string };

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

export const readProviderServerEnv = (
  source: Record<string, string | undefined> = process.env,
): ProviderServerEnv => ({
  secretKey: requireEnv(source, "SUPABASE_SECRET_KEY"),
  url: validateSupabaseUrl(requireEnv(source, "SUPABASE_URL")),
});

export const createProviderSupabaseClient = (
  config: ProviderServerEnv = readProviderServerEnv(),
) =>
  createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

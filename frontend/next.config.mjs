import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load the root .env file so API routes always have the correct keys,
// even if the shell environment has empty values that block .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, "..", ".env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    // Only override if current value is empty or missing
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // Root .env not found — fall back to .env.local (normal on Vercel)
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

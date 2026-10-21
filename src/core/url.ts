export type UrlValidationResult = {
  valid: boolean;
  url: string;
  normalized?: string;
  error?: string;
  hostname?: string;
  origin?: string;
  pathname?: string;
  isLocalhost?: boolean;
};

const DISALLOWED_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "ftp:",
  "gopher:",
  "blob:",
  "about:",
  "chrome:",
  "vscode:",
]);

export function isLocalhostHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local")
  );
}

/**
 * Validate and normalize a website URL for walkthrough generation.
 * Enforces http/https protocols and sanitizes input.
 */
export function validateWebsiteUrl(input: string): UrlValidationResult {
  const raw = (input ?? "").trim();
  if (!raw) {
    return { valid: false, url: raw, error: "Please enter a website URL." };
  }

  // Check for disallowed script/data URI schemes
  const lowerRaw = raw.toLowerCase();
  for (const protocol of DISALLOWED_PROTOCOLS) {
    if (lowerRaw.startsWith(protocol)) {
      return { valid: false, url: raw, error: `Protocol "${protocol}" is not supported.` };
    }
  }

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    // Infer http for localhost/IPs, https for domain names
    const hasLocalhost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?(\/.*)?$/i.test(candidate);
    candidate = (hasLocalhost ? "http://" : "https://") + candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        valid: false,
        url: raw,
        error: `Only http:// and https:// URLs are supported (received ${parsed.protocol}).`,
      };
    }

    const isLocal = isLocalhostHostname(parsed.hostname);
    const normalized = parsed.href;

    return {
      valid: true,
      url: raw,
      normalized,
      hostname: parsed.hostname,
      origin: parsed.origin,
      pathname: parsed.pathname || "/",
      isLocalhost: isLocal,
    };
  } catch {
    return { valid: false, url: raw, error: "The provided website URL is not valid." };
  }
}

/**
 * Check if a candidate target URL belongs to the same origin as the base website URL.
 */
export function isSameOriginRoute(targetUrl: string, baseUrl: string): boolean {
  try {
    const baseObj = new URL(baseUrl);
    const targetObj = new URL(targetUrl, baseUrl);
    return baseObj.origin === targetObj.origin;
  } catch {
    return false;
  }
}

/**
 * Format a website URL cleanly for display in topbars, badges, and headers.
 */
export function sanitizeUrlForDisplay(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${path}`;
  } catch {
    return url;
  }
}

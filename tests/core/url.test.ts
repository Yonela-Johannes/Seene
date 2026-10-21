import { describe, expect, it } from "vitest";
import {
  isLocalhostHostname,
  isSameOriginRoute,
  sanitizeUrlForDisplay,
  validateWebsiteUrl,
} from "../../src/core/url";

describe("validateWebsiteUrl", () => {
  it("validates standard http and https URLs", () => {
    const res1 = validateWebsiteUrl("https://example.com");
    expect(res1.valid).toBe(true);
    expect(res1.normalized).toBe("https://example.com/");
    expect(res1.isLocalhost).toBe(false);

    const res2 = validateWebsiteUrl("http://localhost:3000/features");
    expect(res2.valid).toBe(true);
    expect(res2.normalized).toBe("http://localhost:3000/features");
    expect(res2.isLocalhost).toBe(true);
  });

  it("infers protocol when scheme is missing", () => {
    const res1 = validateWebsiteUrl("example.com/products");
    expect(res1.valid).toBe(true);
    expect(res1.normalized).toBe("https://example.com/products");

    const res2 = validateWebsiteUrl("localhost:8080/app");
    expect(res2.valid).toBe(true);
    expect(res2.normalized).toBe("http://localhost:8080/app");
  });

  it("rejects invalid and unsafe protocols", () => {
    expect(validateWebsiteUrl("javascript:alert(1)").valid).toBe(false);
    expect(validateWebsiteUrl("file:///etc/passwd").valid).toBe(false);
    expect(validateWebsiteUrl("data:text/html,hello").valid).toBe(false);
    expect(validateWebsiteUrl("ftp://ftp.example.com").valid).toBe(false);
  });

  it("rejects empty or malformed URLs", () => {
    expect(validateWebsiteUrl("").valid).toBe(false);
    expect(validateWebsiteUrl("   ").valid).toBe(false);
  });
});

describe("isLocalhostHostname", () => {
  it("detects loopback addresses and local hosts", () => {
    expect(isLocalhostHostname("localhost")).toBe(true);
    expect(isLocalhostHostname("127.0.0.1")).toBe(true);
    expect(isLocalhostHostname("0.0.0.0")).toBe(true);
    expect(isLocalhostHostname("::1")).toBe(true);
    expect(isLocalhostHostname("app.localhost")).toBe(true);
    expect(isLocalhostHostname("dev.local")).toBe(true);
    expect(isLocalhostHostname("example.com")).toBe(false);
  });
});

describe("isSameOriginRoute", () => {
  it("matches same origin URLs", () => {
    expect(isSameOriginRoute("https://example.com/pricing", "https://example.com/")).toBe(true);
    expect(isSameOriginRoute("https://other.com/pricing", "https://example.com/")).toBe(false);
    expect(isSameOriginRoute("http://localhost:3000/app", "http://localhost:3000/")).toBe(true);
  });
});

describe("sanitizeUrlForDisplay", () => {
  it("formats URLs cleanly for display", () => {
    expect(sanitizeUrlForDisplay("https://example.com/features/item")).toBe("example.com/features/item");
    expect(sanitizeUrlForDisplay("http://localhost:3000/")).toBe("localhost:3000");
  });
});

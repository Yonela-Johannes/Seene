import { describe, expect, it } from "vitest";
import { inspectWebsiteHtml } from "../../src/core/websiteInspector";

describe("inspectWebsiteHtml", () => {
  it("extracts page title, description, headings, sections and links from HTML", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Acme Product Demo</title>
          <meta name="description" content="Discover Acme's cinematic web features." />
        </head>
        <body>
          <header id="site-header">
            <h1>Welcome to Acme</h1>
            <a href="/features">See Features</a>
          </header>
          <main id="hero">
            <h2>Transforming Web Demos</h2>
            <button id="cta-button">Get Started</button>
          </main>
          <section id="features" data-section-id="features-section">
            <h3>Feature Breakdown</h3>
          </section>
          <footer>
            <a href="/privacy">Privacy Policy</a>
          </footer>
        </body>
      </html>
    `;

    const inspection = inspectWebsiteHtml("https://example.com", html);

    expect(inspection.url).toBe("https://example.com/");
    expect(inspection.title).toBe("Acme Product Demo");
    expect(inspection.description).toBe("Discover Acme's cinematic web features.");
    expect(inspection.sections.length).toBeGreaterThan(0);
    expect(inspection.pages.length).toBeGreaterThan(0);
    expect(inspection.interactiveElements.length).toBeGreaterThan(0);
    expect(inspection.canIframe).toBe(true);
    expect(inspection.status).toBe("ok");
  });

  it("detects X-Frame-Options DENY header and marks iframe-blocked", () => {
    const html = "<html><head><title>Secure Portal</title></head><body><h1>Dashboard</h1></body></html>";
    const inspection = inspectWebsiteHtml("https://secure.example.com", html, {
      "x-frame-options": "DENY",
    });

    expect(inspection.canIframe).toBe(false);
    expect(inspection.status).toBe("iframe-blocked");
    expect(inspection.fallbackReason).toContain("X-Frame-Options");
  });

  it("detects Content-Security-Policy frame-ancestors block", () => {
    const html = "<html><head><title>Restricted Site</title></head><body></body></html>";
    const inspection = inspectWebsiteHtml("https://restricted.example.com", html, {
      "content-security-policy": "frame-ancestors 'none'",
    });

    expect(inspection.canIframe).toBe(false);
    expect(inspection.status).toBe("iframe-blocked");
  });
});

import { chromium } from "/home/skye/Desktop/Projects/seene/node_modules/playwright/index.mjs";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://127.0.0.1:4173/tests/preview/walkthrough-fixture.html?seene-mode=scroll", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const r = (el) => el ? { y: Math.round(el.getBoundingClientRect().y), h: Math.round(el.getBoundingClientRect().height), w: Math.round(el.getBoundingClientRect().width) } : null;
  const pres = [...document.querySelectorAll(".seene-presentation-rail button")].filter(b => b.textContent.trim() === "Overview");
  return {
    stack: r(q(".seene-studio-bottom > .seene-studio-stack--inline")),
    pres: r(q(".seene-presentations")),
    bottom: r(q(".seene-studio-bottom")),
    bottomChildren: [...document.querySelectorAll(".seene-studio-bottom > *")].map(el => [el.className.slice(0, 50), r(el)]),
    body: r(q(".seene-studio-body")),
    overviewButtons: [...document.querySelectorAll("button")].filter(b => b.textContent.trim() === "Overview").map(b => ({ cls: b.className.slice(0, 40), disabled: b.disabled, inRail: !!b.closest(".seene-presentation-rail"), r: r(b) })),
    topbar: r(q(".seene-studio-topbar")),
    viewport: r(q(".seene-studio-viewport")),
  };
}), null, 2));
console.log(errors);
await page.screenshot({ path: "/tmp/scroll-studio.png" });
await browser.close();

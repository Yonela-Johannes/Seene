import { test, expect } from "@playwright/test";

/**
 * End-to-end check for the Walkthrough Studio: one continuous timeline drives real DOM scrolling,
 * highlights and interactions, and the sequence canvas edits the same document the timeline plays.
 */
test("walkthrough studio authors, plays and interacts on one timeline", async ({ page }) => {
  await page.goto("/tests/preview/walkthrough-studio-fixture.html");

  // The editor replaces the preview chrome when a walkthrough document is present.
  await expect(page.locator(".seene-walkthrough-studio")).toBeVisible();
  await expect(page.getByLabel("Walkthrough sequence")).toBeVisible();
  await expect(page.locator(".seene-studio-node")).toHaveCount(7);
  await expect(page.locator('[data-seene-capture="scene"]')).toHaveAttribute("data-seene-valid", "true");

  // Selecting a step applies its highlight against the real rendered section.
  await page.locator(".seene-studio-node", { hasText: "Highlight hero" }).click();
  await expect(page.locator("[data-seene-walkthrough-active]")).toHaveCount(1);
  await expect(page.locator("[data-seene-walkthrough-active]")).toHaveAttribute("data-section-id", "hero");

  // Selecting a later step scrolls the real page instead of animating a fake canvas.
  await page.locator(".seene-studio-node", { hasText: "Features" }).click();
  await expect.poll(() => page.locator(".seene-walkthrough-scroll").evaluate(element => element.scrollTop)).toBeGreaterThan(0);

  // Selecting the final steps runs the click action and shows the caption on the same timeline.
  const slider = page.getByRole("slider", { name: "Walkthrough time" });
  const max = (await slider.getAttribute("max")) ?? "0";
  expect(Number(max)).toBeGreaterThan(0);
  await page.locator(".seene-studio-node", { hasText: "Wrap up" }).click();
  await expect(page.getByTestId("tour-revealed")).toBeVisible();
  await expect(page.getByText("You completed the tour")).toBeVisible();

  // Adding and undoing steps keeps the sequence and timeline in sync.
  await page.getByRole("button", { name: "+ wait" }).click();
  await expect(page.locator(".seene-studio-node")).toHaveCount(8);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator(".seene-studio-node")).toHaveCount(7);
});

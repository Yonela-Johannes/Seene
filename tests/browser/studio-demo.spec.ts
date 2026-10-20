import { test, expect } from "@playwright/test";

/**
 * The homepage `#demo` is a real miniature of the studio, not a screenshot. These tests drive
 * its controls and assert the visible state actually changes, so a regression that turns it back
 * into a static mock fails here.
 */
test("homepage studio demo is driveable: playback, presets, camera edits and walkthrough mode", async ({ page }) => {
  await page.goto("/");
  const demo = page.getByTestId("studio-demo");
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toBeVisible();
  await expect(demo.locator(".seene-demo-title")).toHaveText("hero.scene.json");
  await expect(demo.getByRole("button", { name: "Focused Scene", exact: true })).toHaveAttribute("aria-pressed", "true");

  // Playback: the timeline is a real requestAnimationFrame clock, so the readout advances.
  const time = demo.locator(".seene-demo-time");
  await expect(time).toHaveText("00:00 / 00:06");
  await demo.getByRole("button", { name: "Play the demo" }).click();
  await expect(demo.getByRole("button", { name: "Pause the demo" })).toBeVisible();
  await expect.poll(async () => (await time.textContent()) ?? "", { timeout: 8000 }).not.toBe("00:00 / 00:06");
  await demo.getByRole("button", { name: "Pause the demo" }).click();
  await expect(demo.getByRole("button", { name: "Play the demo" })).toBeVisible();

  // Presets apply real camera values: Wide flattens the camera onto the plane (z = 0).
  await demo.getByRole("button", { name: "Wide" }).click();
  await expect(demo.getByRole("button", { name: "Wide" })).toHaveAttribute("aria-pressed", "true");
  const cameraZ = demo.getByLabel("Camera Z");
  expect(await cameraZ.inputValue()).toBe("0");

  // Editing overrides the motion track and the readout follows.
  await cameraZ.fill("120");
  await expect(demo.locator(".seene-demo-caption")).toContainText("Z 120");
  await demo.getByRole("button", { name: "Reset camera" }).click();
  await expect(demo.getByRole("button", { name: "Authored" })).toHaveAttribute("aria-pressed", "true");

  // Website Walkthrough mode renders the real founder-story screens and shares one playhead.
  await demo.getByRole("button", { name: "Website Walkthrough", exact: true }).click();
  await expect(demo.locator(".seene-demo-title")).toHaveText("founder-story.walkthrough.json");
  await expect(demo.getByRole("button", { name: "Website Walkthrough", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(time).toHaveText("00:00 / 00:06");
  const screens = demo.locator('[data-testid^="home-demo-story-"]');
  await expect(screens).toHaveCount(5);

  // Jumping to a screen moves the timeline and the inspector selection to that stop.
  await demo.locator(".seene-demo-seg", { hasText: "Screen 5" }).click();
  await expect(time).toHaveText("00:06 / 00:06");
  await expect(demo.locator(".seene-demo-field-wide select")).toHaveValue("4");
  await expect(screens.nth(4)).toBeInViewport({ timeout: 5000 });
});

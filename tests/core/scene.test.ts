import { describe, it, expect } from "vitest";
import { validateScene, evaluateScene, transformToCss, cameraFromPose, uniformFocusBlur, focusForSurface, FocusSchema } from "../../src/core";

describe("versioned scene contract", () => {
  it("derives defaults and preserves a data-only serializable recipe", () => {
    const result = validateScene({ version: 3, nodes: [{ id: "chart" }] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(3);
      expect(validateScene(JSON.parse(JSON.stringify(result.data)))).toEqual(
        result,
      );
    }
  });
  it.each([
    { version: 1, nodes: [] },
    { version: 3, nodes: [{ id: "a" }, { id: "a" }] },
    { version: 3, nodes: [{ id: "a", parentId: "b" }] },
    {
      version: 3,
      nodes: [
        { id: "a", parentId: "b" },
        { id: "b", parentId: "a" },
      ],
    },
    { version: 3, nodes: [{ id: "a", transform: { z: Infinity } }] },
    { version: 3, nodes: [{ id: "a", transform: { scale: 0 } }] },
    { version: 3, nodes: [], focus: { targetId: "absent" } },
    { version: 3, nodes: [], token: "secret" },
    { version: 3, nodes: [{ id: "a", component: () => null }] },
  ])("rejects malformed, cyclic or non-serializable configuration", (input) => {
    expect(validateScene(input).success).toBe(false);
    expect(evaluateScene(input).nodes).toEqual([]);
  });
});

describe("spatial evaluation", () => {
  it("changes focal sharpness across three depths and clamps blur", () => {
    const nodes = [-200, 0, 200].map((z, i) => ({
      id: "n" + i,
      transform: { z },
    }));
    const center = evaluateScene({
      version: 3,
      nodes,
      focus: { distance: 1400, fStop:0.7, focalLength:300, maxBlur: 3 },
    });
    expect(center.nodes.map((n) => n.blur)).toBeDefined();
  });
  it("composes parent rotation, layout offset and child depth", () => {
    const result = evaluateScene(
      {
        version: 3,
        nodes: [
          { id: "p", transform: { rotateY: 90, z: 100 } },
          { id: "c", parentId: "p", transform: { z: 20 } },
        ],
      },
      { c: { width: 10, height: 10, offsetX: 30 } },
    );
    const child = result.nodes[1];
    expect(child.worldPosition.x).toBeCloseTo(20);
    expect(child.worldPosition.z).toBeCloseTo(70);
  });
  it("includes camera rotation against independent focus coordinates", () => {
    const result = evaluateScene({
      version: 3,
      camera: { rotateY: 90 },
      focus: { distance: 1500 },
      nodes: [{ id: "a", transform: { x: 100 } }],
    });
    expect(result.focusDepth).toBeCloseTo(-0);
  });
  it("handles missing measurements and diagnoses invalid/zero area and camera collision", () => {
    expect(evaluateScene({ version: 3, nodes: [{ id: "a" }] }).issues).toEqual([]);
  });
  it("keeps CSS transform order aligned with world transform composition", () => {
    expect(transformToCss({ x: 2, rotateY: 30 })).toBe(
      "translate3d(2px, 0px, 0px) rotateX(0deg) rotateY(30deg) rotateZ(0deg) scale(1)",
    );
  });
  it("cameraFromPose computes look-at rotation for common cinematic angles", () => {
    const direct = cameraFromPose({
      position: { x: 0, y: 0, z: 1200 },
      target: { x: 0, y: 0, z: 0 },
      perspective: 1400,
    });
    expect(direct.rotateX).toBeCloseTo(0);
    expect(direct.rotateY).toBeCloseTo(0);
    expect(direct.x).toBe(0);
    expect(direct.z).toBe(1200);
    expect(direct.perspective).toBe(1400);

    const right = cameraFromPose({
      position: { x: 0, y: 0, z: 1200 },
      target: { x: 300, y: 0, z: 0 },
      perspective: 1400,
    });
    expect(right.rotateY).toBeGreaterThan(0);

    const up = cameraFromPose({
      position: { x: 0, y: 0, z: 1200 },
      target: { x: 0, y: -200, z: 0 },
      perspective: 1400,
    });
    expect(up.rotateX).toBeGreaterThan(0);

    const corner = cameraFromPose({
      position: { x: 0, y: -400, z: 1000 },
      target: { x: 0, y: 0, z: 0 },
      perspective: 1400,
    });
    expect(corner.rotateX).toBeLessThan(0);
  });
  it("graduated blur increases with defocus distance and respects f-stop", () => {
    const focus = FocusSchema.parse({});
    const atFocus = evaluateScene({
      version: 3,
      focus: { distance: 1400, fStop: 8, maxBlur: 6 },
      nodes: [{ id: "at-focus", transform: { z: 0 } }],
    }).nodes[0]!.blur;
    const close = evaluateScene({
      version: 3,
      focus: { distance: 1400, fStop: 8, maxBlur: 6 },
      nodes: [{ id: "close", transform: { z: 200 } }],
    }).nodes[0]!.blur;
    const far = evaluateScene({
      version: 3,
      focus: { distance: 1400, fStop: 8, maxBlur: 6 },
      nodes: [{ id: "far", transform: { z: -400 } }],
    }).nodes[0]!.blur;
    expect(atFocus).toBe(0);
    expect(close).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(close);

    const wide = evaluateScene({
      version: 3,
      focus: { distance: 1400, fStop: 1.4, maxBlur: 6 },
      nodes: [{ id: "w", transform: { z: -400 } }],
    }).nodes[0]!.blur;
    expect(wide).toBeGreaterThan(far);

    const sharp = evaluateScene({
      version: 3,
      focus: { distance: 1400, maxBlur: 0 },
      nodes: [{ id: "sharp", transform: { z: 500 } }],
    }).nodes[0]!.blur;
    expect(sharp).toBe(0);
  });
  it("uniformFocusBlur produces graduated values across defocus distances", () => {
    const focus = FocusSchema.parse({ distance: 1400, fStop: 8, maxBlur: 6 });
     const atFocus = uniformFocusBlur({ depth: 0, distance: 0, span: 200, maxBlur: 6, scale: 1, fStop: 8, focalLength: 50 }, 200) ?? 0;
    const near = uniformFocusBlur({ depth: 100, distance: 100, span: 200, maxBlur: 6, scale: 1, fStop: 8, focalLength: 50 }, 200) ?? 0;
    const far = uniformFocusBlur({ depth: -100, distance: 100, span: 200, maxBlur: 6, scale: 1, fStop: 8, focalLength: 50 }, 200) ?? 0;
    const farther = uniformFocusBlur({ depth: -300, distance: 300, span: 200, maxBlur: 6, scale: 1, fStop: 8, focalLength: 50 }, 200) ?? 0;
    expect(atFocus).toBe(0);
    expect(far).toBeGreaterThanOrEqual(near);
    expect(farther).toBeGreaterThanOrEqual(far);
  });
});

it("reports composed numeric overflow without leaking NaN into render output", () => {
  const nodes = Array.from({ length: 100 }, (_, index) => ({
    id: "n" + index,
    ...(index ? { parentId: "n" + (index - 1) } : {}),
    transform: { x: 1e300, scale: 2 },
  }));
  const result = evaluateScene({ version: 3, nodes });
  expect(result.nodes).toEqual([]);
  expect(result.issues[0].message).toContain("numeric limits");
  expect(result.focusDepth).toBe(0);
});

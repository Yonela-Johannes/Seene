import { describe, expect, it } from "vitest";
import {
  compileWalkthrough,
  connectWalkthroughNodes,
  createWalkthroughDocument,
  createWalkthroughNode,
  disconnectWalkthroughNodes,
  duplicateWalkthroughNode,
  evaluateWalkthrough,
  insertWalkthroughNode,
  migrateWalkthrough,
  moveWalkthroughNode,
  removeWalkthroughNode,
  updateWalkthroughNode,
  validateWalkthrough,
  walkthroughDuration,
  walkthroughSchedule,
  type WalkthroughDocument,
  type WalkthroughDocumentInput,
} from "../../src/core";
import { presentPreview } from "../../src/core";

const target = (id: string) => ({ kind: "section" as const, sectionId: id, label: id });

function sample(): WalkthroughDocument {
  return createWalkthroughDocument({
    title: "Product tour",
    targets: [
      { title: "Hero", target: target("hero") },
      { title: "Features", target: target("features") },
    ],
  });
}

describe("walkthrough document model", () => {
  it("creates a connected start -> steps -> end chain", () => {
    const document = sample();
    const review = validateWalkthrough(document);
    expect(review.valid).toBe(true);
    expect(document.nodes.map(node => node.type)).toEqual(["start", "show", "show", "end"]);
    expect(document.nodes[0].next).toBe("show-1");
    expect(document.nodes[1].next).toBe("show-2");
    expect(document.nodes[3].next).toBeUndefined();
  });

  it("rejects duplicates, cycles, dangling links and missing end nodes", () => {
    const base = sample();
    const dangling: WalkthroughDocumentInput = { ...base, nodes: base.nodes.map(node => (node.id === "start" ? { ...node, next: "ghost" } : node)) };
    expect(validateWalkthrough(dangling).valid).toBe(false);
    expect(validateWalkthrough(dangling).issues.some(issue => issue.message.includes("missing node"))).toBe(true);

    const cyclic: WalkthroughDocumentInput = { ...base, nodes: base.nodes.map(node => (node.id === "end" ? { ...node, next: "start" } : node)) };
    expect(validateWalkthrough(cyclic).issues.some(issue => issue.message.includes("loop"))).toBe(true);

    const noEnd: WalkthroughDocumentInput = { ...base, nodes: base.nodes.filter(node => node.type !== "end") };
    const noEndReview = validateWalkthrough(noEnd);
    expect(noEndReview.valid).toBe(false);
    expect(noEndReview.issues.some(issue => issue.message.includes("end node"))).toBe(true);

    const duplicated: WalkthroughDocumentInput = { ...base, nodes: [...base.nodes, { ...base.nodes[1], next: undefined }] };
    expect(validateWalkthrough(duplicated).issues.some(issue => issue.message.includes("Duplicate node ID"))).toBe(true);
  });

  it("requires targets for interaction nodes and captions for caption nodes", () => {
    const document = sample();
    const missing = updateWalkthroughNode(document, "show-1", { target: undefined });
    expect(validateWalkthrough(missing.document).issues.some(issue => issue.path === "nodes.show-1.target")).toBe(true);

    const caption = insertWalkthroughNode(document, createWalkthroughNode("caption", { id: "note" }), "start");
    expect(validateWalkthrough(caption.document).issues.some(issue => issue.path === "nodes.note.caption")).toBe(true);
  });

  it("persists inside a scene recipe definition without breaking legacy scenes", () => {
    const document = sample();
    const legacy = presentPreview({ scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] } });
    expect(legacy.valid).toBe(true);

    const walkthrough = presentPreview({
      scene: { version: 3, camera: {}, focus: {}, nodes: [{ id: "host" }] },
      compositionType: "walkthrough",
      sizingMode: "viewport",
      walkthrough: document,
      motion: compileWalkthrough(document)!.motion,
    });
    expect(walkthrough.valid).toBe(true);
    if (walkthrough.valid) expect(walkthrough.definition.walkthrough?.nodes).toHaveLength(4);
  });
});

describe("walkthrough scheduling", () => {
  it("sums delays and durations into one continuous timeline", () => {
    const document = sample();
    const schedule = walkthroughSchedule(document);
    expect(schedule.valid).toBe(true);
    const step = schedule.steps[1];
    const next = schedule.steps[2];
    expect(next.startTime).toBe(step.endTime);
    expect(schedule.durationMs).toBe(walkthroughDuration(document));
    expect(schedule.durationMs).toBe(
      document.nodes.reduce((total, node) => total + node.delayMs + node.durationMs, 0),
    );
  });

  it("resolves the active node, progress and transition boundaries", () => {
    const document = sample();
    const schedule = walkthroughSchedule(document);
    const transitionInto = schedule.steps[2];

    const before = evaluateWalkthrough(document, transitionInto.startTime - 1);
    expect(before.activeNodeId).toBe(schedule.steps[1].nodeId);

    const during = evaluateWalkthrough(document, transitionInto.transitionStartTime + transitionInto.transitionDurationMs / 2);
    expect(during.transition).not.toBeNull();
    expect(during.transition?.fromNodeId).toBe(schedule.steps[1].nodeId);
    expect(during.transition?.toNodeId).toBe(transitionInto.nodeId);
    expect(during.transition?.progress).toBeCloseTo(0.5, 5);

    const after = evaluateWalkthrough(document, transitionInto.startTime);
    expect(after.activeNodeId).toBe(transitionInto.nodeId);
    expect(after.checkpointIndex).toBe(2);
  });

  it("is deterministic when seeking backward and forward", () => {
    const document = sample();
    const forward = evaluateWalkthrough(document, 1500);
    const backward = evaluateWalkthrough(document, 1500);
    expect(forward).toEqual(backward);
    expect(evaluateWalkthrough(document, 0).activeNodeId).toBe("start");
    expect(evaluateWalkthrough(document, 999_999).activeNodeId).toBe("end");
  });
});

describe("camera, motion and node overrides", () => {
  it("keeps a sticky camera override and interpolates between authored poses", () => {
    const document = sample();
    const withCamera = updateWalkthroughNode(document, "show-1", { camera: { z: 40, rotateY: -8 } }).document;
    const moved = updateWalkthroughNode(withCamera, "end", { camera: { z: 400 } }).document;
    const compiled = compileWalkthrough(moved)!;
    const early = evaluateWalkthrough(moved, compiled.steps[1].startTime);
    const late = evaluateWalkthrough(moved, compiled.steps[3].startTime);
    expect(early.camera.z ?? 0).toBeLessThan(late.camera.z ?? 0);
    const held = evaluateWalkthrough(moved, compiled.steps[2].startTime);
    expect(held.camera.rotateY).toBe(-8);
  });

  it("exposes resolved focus and camera in every frame", () => {
    const document = updateWalkthroughNode(sample(), "show-1", { focus: { fStop: 1.4, maxBlur: 14 } }).document;
    const frame = evaluateWalkthrough(document, walkthroughSchedule(document).steps[1].startTime);
    expect(frame.focus.fStop).not.toBeUndefined();
    expect(frame.camera.perspective).toBeGreaterThan(0);
  });
});

describe("walkthrough editing operations", () => {
  it("inserts, duplicates, reorders and deletes nodes", () => {
    const document = sample();
    const inserted = insertWalkthroughNode(document, createWalkthroughNode("wait", { id: "pause", title: "Pause" }), "show-1");
    expect(inserted.issues).toEqual([]);
    expect(inserted.document.nodes.map(node => node.id)).toContain("pause");
    expect(inserted.document.nodes.find(node => node.id === "show-1")?.next).toBe("pause");

    const duplicated = duplicateWalkthroughNode(inserted.document, "show-2");
    expect(duplicated.issues).toEqual([]);
    expect(duplicated.createdId).toBe("show-2-copy");

    const moved = moveWalkthroughNode(duplicated.document, "end", -1);
    expect(moved.issues).toEqual([]);
    expect(moved.document.nodes.find(node => node.id === "show-2")?.next).toBe("end");
    expect(moved.document.nodes.find(node => node.id === "end")?.next).toBe("show-2-copy");

    const removed = removeWalkthroughNode(moved.document, "pause");
    expect(removed.issues).toEqual([]);
    expect(removed.document.nodes.find(node => node.id === "show-1")?.next).toBe("show-2");
    expect(removed.document.nodes.some(node => node.id === "pause")).toBe(false);
  });

  it("connects and disconnects without creating cycles", () => {
    const document = sample();
    const loop = connectWalkthroughNodes(document, "show-2", "start");
    expect(loop.issues.some(issue => issue.message.includes("loop"))).toBe(true);

    const self = connectWalkthroughNodes(document, "show-1", "show-1");
    expect(self.issues.some(issue => issue.message.includes("itself"))).toBe(true);

    const disconnected = disconnectWalkthroughNodes(document, "show-1");
    const review = validateWalkthrough(disconnected.document);
    expect(review.valid).toBe(false);
    expect(review.issues.some(issue => issue.message.includes("not connected"))).toBe(true);
  });

  it("migrates a hand-edited document by repairing next pointers", () => {
    const document = sample();
    const broken: WalkthroughDocumentInput = {
      ...document,
      nodes: document.nodes.map(node => (node.id === "show-1" ? { ...node, next: undefined } : node)),
    };
    const migrated = migrateWalkthrough(broken);
    expect(migrated.document).toBeDefined();
    expect(validateWalkthrough(migrated.document).valid).toBe(true);
  });
});

describe("interaction-driven nodes", () => {
  it("reports the due action and completed checkpoints for a click node", () => {
    const document = sample();
    const clicked = insertWalkthroughNode(
      document,
      createWalkthroughNode("click", {
        id: "click-create",
        title: "Click create",
        target: { kind: "element", selector: '[data-seene-target="create"]' },
        action: { expect: { selector: "[data-seene-target=form]", state: "visible" }, timeoutMs: 3000 },
      }),
      "show-1",
    ).document;
    const schedule = walkthroughSchedule(clicked);
    const clickStep = schedule.steps.find(step => step.nodeId === "click-create")!;
    const frame = evaluateWalkthrough(clicked, clickStep.startTime + 10);
    expect(frame.action?.nodeId).toBe("click-create");
    expect(frame.action?.expect?.state).toBe("visible");
    expect(frame.action?.timeoutMs).toBe(3000);
    expect(frame.completedClickNodeIds).toContain("click-create");
    // Seeking back before the click clears the completed checkpoint.
    expect(evaluateWalkthrough(clicked, 0).completedClickNodeIds).toEqual([]);
  });
});

import type { Measurement, TransformInput, SceneIssue } from "../core";

export type Binding = {
  token: symbol;
  id: string;
  parent?: symbol;
  element: HTMLDivElement;
  transform?: TransformInput;
};
function sameObject(a: object | undefined, b: object | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.is(Reflect.get(a, key), Reflect.get(b, key)))
  );
}

function origin(element: HTMLElement) {
  let x = 0,
    y = 0;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.offsetParent as HTMLElement | null
  ) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    x += parent?.clientLeft ?? 0;
    y += parent?.clientTop ?? 0;
  }
  for (let node = element.parentElement; node; node = node.parentElement) {
    x -= node.scrollLeft;
    y -= node.scrollTop;
  }
  return { x, y };
}

function uncoveredContent(root:Element):boolean {
  for (const child of root.childNodes) {
    if (child.nodeType===3 && child.textContent?.trim()) return true;
    if (!(child instanceof Element)) continue;
    if (child.hasAttribute("data-seene-id") || child.hasAttribute("data-seene-content") || child.matches('svg[width="0"],script,style,template')) continue;
    const css=getComputedStyle(child);
    if(css.display==='none'||css.visibility==='hidden') continue;
    if(child.matches('img,svg,canvas,video,input,textarea,select') || (css.backgroundImage && css.backgroundImage!=='none')) return true;
    if(uncoveredContent(child)) return true;
  }
  return false;
}

export function createRegistry() {
  const entries = new Map<symbol, Binding>();
  const measurements = new Map<symbol, Measurement>();
  const measuredTokens = new Set<symbol>();
  const listeners = new Set<() => void>();
  let revision = 0;
  let coverageDirty = true;
  let coverageIssues: SceneIssue[] = [];
  let mutations: MutationObserver | undefined;
  let stage: HTMLDivElement | null = null;
  let observer: ResizeObserver | undefined;
  const publish = () => {
    revision++;
    listeners.forEach((listener) => listener());
  };
  const measure = () => {
    if (!stage) return false;
    let changed = false;
    for (const [token, entry] of entries) {
      const parent = (entry.parent && entries.get(entry.parent)?.element) || stage;
      const p = origin(parent), e = origin(entry.element);
      const width = entry.element.offsetWidth, height = entry.element.offsetHeight;
      const next = {
        width,
        height,
        offsetX: e.x + width / 2 - p.x - parent.offsetWidth / 2,
        offsetY: e.y + height / 2 - p.y - parent.offsetHeight / 2,
      };
      if (measurements.has(token)) {
        measuredTokens.add(token);
      }
      if (!sameObject(measurements.get(token), next)) {
        measurements.set(token, next);
        changed = true;
        coverageDirty = true;
      }
    }
    const zeroArea = Array.from(entries.entries())
      .filter(([token, b]) => measuredTokens.has(token) && (b.element.offsetWidth === 0 || b.element.offsetHeight === 0))
      .map(([_, b]) => ({ path: "surface." + b.id, message: "no measurable area" }));

    const emptyNodes = Array.from(entries.values())
      .filter(b => {
        const text = b.element.textContent?.trim() ?? "";
        const hasMedia = b.element.querySelector("img,svg,canvas,video,iframe,input,textarea,select") !== null;
        const contentEl = b.element.querySelector("[data-seene-content]");
        const hasContentChildren = contentEl ? contentEl.childElementCount > 0 : b.element.childElementCount > 0;
        return !text && !hasMedia && !hasContentChildren;
      })
      .map(b => ({ path: "surface." + b.id, message: `Surface node '${b.id}' has no mounted content.` }));

    const groups = new Set(Array.from(entries.values()).map(b => b.parent));
    const next: SceneIssue[] = Array.from(entries.values())
      .filter(b => groups.has(b.token) && uncoveredContent(b.element))
      .map(b => ({ path: b.id, message: "Unfiltered content in spatial group. Wrap each visible text/media region in a Surface, or put its paint in content. Group filters would flatten nested 3D." }));
    if (uncoveredContent(stage)) next.push({ path: "scene", message: "Unfiltered scene content. Wrap visible text/media in a Surface so camera depth of field can apply." });
    next.push(...zeroArea, ...emptyNodes);

    if (JSON.stringify(next) !== JSON.stringify(coverageIssues)) {
      coverageIssues = next;
      changed = true;
    }
    coverageDirty = false;
    return changed;
  };
  const refresh = () => {
    if (measure()) publish();
  };
  return {
    entries,
    measurements,
    get coverageIssues(){return coverageIssues;},
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => revision,
    refresh,
    mount(element: HTMLDivElement) {
      stage = element;
      if(typeof MutationObserver!=="undefined") {
        mutations=new MutationObserver(records=>{
          if(records.some(r=>!(r.target instanceof Element ? r.target : r.target.parentElement)?.closest('[data-seene-content],svg[width="0"]'))) {
            coverageDirty=true; refresh();
          }
        });
        mutations.observe(element,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["data-seene-content"]});
      }
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(refresh);
        observer.observe(element);
        entries.forEach((entry) => observer!.observe(entry.element));
      }
      window.addEventListener("resize", refresh);
      element.addEventListener("scroll", refresh, true);
      refresh();
      return () => {
        mutations?.disconnect();
        observer?.disconnect();
        observer = undefined;
        window.removeEventListener("resize", refresh);
        element.removeEventListener("scroll", refresh, true);
        stage = null;
      };
    },
    upsert(binding: Binding) {
      const previous = entries.get(binding.token);
      const changed =
        !previous ||
        previous.id !== binding.id ||
        previous.parent !== binding.parent ||
        previous.element !== binding.element ||
        !sameObject(previous.transform, binding.transform);
      if (changed) {
        if (previous && previous.element !== binding.element)
          observer?.unobserve(previous.element);
        entries.set(binding.token, {
          ...binding,
          transform: binding.transform && { ...binding.transform },
        });
        observer?.observe(binding.element);
      }
      if (changed) {
        coverageDirty=true;
        measure();
        publish();
      }
    },
    remove(token: symbol) {
      const previous = entries.get(token);
      if (!previous) return;
      observer?.unobserve(previous.element);
      entries.delete(token);
      measuredTokens.delete(token);
      coverageDirty=true;
      measurements.delete(token);
      measure();
      publish();
    },
  };
}
export type Registry = ReturnType<typeof createRegistry>;

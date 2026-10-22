import { useState, type ReactNode } from "react";
import {
  WALKTHROUGH_CAMERA_PROPERTIES,
  WALKTHROUGH_FOCUS_PROPERTIES,
  type WalkthroughDocument,
  type WalkthroughGlobals,
  type WalkthroughNode,
  type WalkthroughNodeType,
  type WalkthroughTarget,
} from "../core";

const TARGET_TYPES: WalkthroughNodeType[] = ["show", "scroll", "focus", "highlight", "click", "navigate"];
const TRANSITION_TYPES = ["cut", "crossfade", "camera", "focus"] as const;
const HIGHLIGHT_STYLES = ["outline", "glow", "dim", "spotlight"] as const;
const EASINGS = ["cinematic", "easeInOut", "easeIn", "easeOut", "linear"] as const;

export type WalkthroughInspectorProps = {
  document: WalkthroughDocument;
  node: WalkthroughNode | undefined;
  tab: "node" | "global";
  status: string;
  onTabChange: (tab: "node" | "global") => void;
  onUpdateDocument: (patch: Partial<Pick<WalkthroughDocument, "title" | "description">>) => void;
  onUpdateNode: (patch: Partial<WalkthroughNode>) => void;
  onUpdateGlobals: (patch: Partial<WalkthroughGlobals>) => void;
  onConnect: (toId: string) => void;
  onResetNode: () => void;
  onExportConfig?: () => void;
  onImportConfig?: (jsonText: string) => void;
};

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="seene-inspector-section">
      <h3>{title}</h3>
      {hint ? <p className="seene-inspector-hint">{hint}</p> : null}
      <div className="seene-inspector-fields">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="seene-inspector-row">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <Row label={label}>
      <input type="text" value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    </Row>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder = "inherit",
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <Row label={label}>
      <input
        type="number"
        value={value === undefined ? "" : value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={event => {
          const raw = event.target.value;
          if (raw === "") return onChange(undefined);
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    </Row>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <Row label={label}>
      <select value={value} onChange={event => onChange(event.target.value as T)}>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Row>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="seene-inspector-toggle">
      <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function patchCamera(node: WalkthroughNode, key: string, value: number | undefined) {
  const camera: Record<string, number> = { ...(node.camera ?? {}) };
  if (value === undefined) delete camera[key];
  else camera[key] = value;
  return Object.keys(camera).length ? (camera as WalkthroughNode["camera"]) : undefined;
}

function patchFocus(node: WalkthroughNode, key: string, value: number | undefined) {
  const focus: Record<string, number> = { ...(node.focus ?? {}) };
  if (value === undefined) delete focus[key];
  else focus[key] = value;
  return Object.keys(focus).length ? (focus as WalkthroughNode["focus"]) : undefined;
}

export function WalkthroughInspector({
  document,
  node,
  tab,
  status,
  onTabChange,
  onUpdateDocument,
  onUpdateNode,
  onUpdateGlobals,
  onConnect,
  onResetNode,
  onExportConfig,
  onImportConfig,
}: WalkthroughInspectorProps): ReactNode {
  const settings = document.settings;
  const otherNodes = document.nodes.filter(candidate => candidate.id !== node?.id);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  const exportCommand = `pnpm exec seene export --url ${quote(typeof location === "undefined" ? "http://localhost:5173" : location.href)} --output walkthrough.mp4 --fps ${settings.frameRate}`;
  const copyExportCommand = () => {
    void navigator.clipboard.writeText(exportCommand).then(
      () => setCopyState("copied"),
      () => setCopyState("error"),
    );
  };
  return (
    <aside className="seene-studio-inspector" aria-label="Walkthrough inspector">
      <div className="seene-studio-tabs">
        <button type="button" aria-pressed={tab === "node"} onClick={() => onTabChange("node")}>
          Step
        </button>
        <button type="button" aria-pressed={tab === "global"} onClick={() => onTabChange("global")}>
          Project
        </button>
      </div>
      <p className="seene-inspector-status" role="status">
        {status}
      </p>

      {tab === "global" ? (
        <>
          <Section title="Project">
            <TextField label="Title" value={document.title} onChange={value => onUpdateDocument({ title: value || document.title })} placeholder="Walkthrough title" />
            <Row label="Description">
              <textarea
                value={document.description ?? ""}
                onChange={event => onUpdateDocument({ description: event.target.value })}
                placeholder="Optional summary"
                rows={2}
              />
            </Row>
          </Section>
          <Section title="Output">
            <NumberField label="Width" value={settings.width} min={64} max={3840} onChange={value => onUpdateGlobals({ width: value ?? settings.width })} />
            <NumberField label="Height" value={settings.height} min={64} max={3840} onChange={value => onUpdateGlobals({ height: value ?? settings.height })} />
            <Row label="Frame rate">
              <select value={settings.frameRate} onChange={event => onUpdateGlobals({ frameRate: Number(event.target.value) as 30 | 60 | 120 })}>
                {[30, 60, 120].map(fps => (
                  <option key={fps} value={fps}>
                    {fps} fps
                  </option>
                ))}
              </select>
            </Row>
          </Section>
          <Section title="Defaults">
            <SelectField label="Transition" value={settings.defaultTransition.type} options={TRANSITION_TYPES} onChange={value => onUpdateGlobals({ defaultTransition: { ...settings.defaultTransition, type: value } })} />
            <NumberField label="Transition ms" value={settings.defaultTransition.durationMs} min={0} max={5000} onChange={value => onUpdateGlobals({ defaultTransition: { ...settings.defaultTransition, durationMs: value ?? settings.defaultTransition.durationMs } })} />
            <SelectField label="Easing" value={settings.defaultEasing as (typeof EASINGS)[number]} options={EASINGS} onChange={value => onUpdateGlobals({ defaultEasing: value })} />
          </Section>
          <Section title="Default camera" hint="Framing inherited by steps without a camera override.">
            {WALKTHROUGH_CAMERA_PROPERTIES.map(property => (
              <NumberField
                key={property}
                label={property}
                value={settings.defaultCamera?.[property]}
                onChange={value => {
                  const camera: Record<string, number> = { ...(settings.defaultCamera ?? {}) };
                  if (value === undefined) delete camera[property];
                  else camera[property] = value;
                  onUpdateGlobals({ defaultCamera: Object.keys(camera).length ? (camera as WalkthroughGlobals["defaultCamera"]) : undefined });
                }}
              />
            ))}
          </Section>
          <Section title="Default focus">
            {WALKTHROUGH_FOCUS_PROPERTIES.map(property => (
              <NumberField
                key={property}
                label={property}
                value={settings.defaultFocus?.[property]}
                onChange={value => {
                  const focus: Record<string, number> = { ...(settings.defaultFocus ?? {}) };
                  if (value === undefined) delete focus[property];
                  else focus[property] = value;
                  onUpdateGlobals({ defaultFocus: Object.keys(focus).length ? (focus as WalkthroughGlobals["defaultFocus"]) : undefined });
                }}
              />
            ))}
          </Section>
          <Section title="Playback">
            <ToggleField label="Autoplay" value={settings.autoplay} onChange={value => onUpdateGlobals({ autoplay: value })} />
            <ToggleField label="Loop" value={settings.loop} onChange={value => onUpdateGlobals({ loop: value })} />
          </Section>
          <Section title="Export" hint="Renders the whole walkthrough as one continuous MP4 with local FFmpeg.">
            <Row label="Command">
              <input type="text" readOnly value={exportCommand} aria-label="Export command" onFocus={event => event.currentTarget.select()} />
            </Row>
            <button type="button" className="seene-control seene-small" onClick={copyExportCommand}>
              {copyState === "copied" ? "Copied" : "Copy export command"}
            </button>
            <p className="seene-inspector-hint" role="status">
              {copyState === "error" ? "Select and copy the command above manually." : "Progress prints in your project terminal; the capture is capped at 120 seconds."}
            </p>
          </Section>
          <Section title="Configuration JSON" hint="Download or import the walkthrough specification document locally.">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {onExportConfig && (
                <button type="button" className="seene-control seene-small" onClick={onExportConfig}>
                  Download JSON config
                </button>
              )}
              {onImportConfig && (
                <label className="seene-control seene-small" style={{ cursor: "pointer", textAlign: "center", display: "inline-block" }}>
                  Import JSON config
                  <input
                    type="file"
                    accept=".json,.scene.json"
                    style={{ display: "none" }}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = e => {
                        const text = e.target?.result;
                        if (typeof text === "string") onImportConfig(text);
                      };
                      reader.readAsText(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </Section>
        </>
      ) : !node ? (
        <p className="seene-inspector-hint">Select a step to edit its settings.</p>
      ) : (
        <>
          <Section title="Step">
            <TextField label="Title" value={node.title} onChange={value => onUpdateNode({ title: value || node.title })} />
            <Row label="Type">
              <input type="text" value={node.type} readOnly />
            </Row>
            <NumberField label="Duration ms" value={node.durationMs} min={0} max={120000} onChange={value => onUpdateNode({ durationMs: value ?? node.durationMs })} />
            <NumberField label="Delay ms" value={node.delayMs} min={0} max={120000} onChange={value => onUpdateNode({ delayMs: value ?? node.delayMs })} />
            <SelectField label="Easing" value={node.easing as (typeof EASINGS)[number]} options={EASINGS} onChange={value => onUpdateNode({ easing: value })} />
            <SelectField label="Transition in" value={node.transitionIn?.type ?? document.settings.defaultTransition.type} options={TRANSITION_TYPES} onChange={value => onUpdateNode({ transitionIn: { type: value, durationMs: node.transitionIn?.durationMs ?? document.settings.defaultTransition.durationMs } })} />
            <NumberField label="Transition ms" value={node.transitionIn?.durationMs} min={0} max={5000} onChange={value => onUpdateNode({ transitionIn: { type: node.transitionIn?.type ?? document.settings.defaultTransition.type, durationMs: value ?? 0 } })} />
          </Section>

          <Section title="Connection">
            <Row label="Continues to">
              <select value={node.next ?? ""} onChange={event => event.target.value && onConnect(event.target.value)}>
                <option value="">End of sequence</option>
                {otherNodes.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.title}
                  </option>
                ))}
              </select>
            </Row>
          </Section>

          {TARGET_TYPES.includes(node.type) ? (
            <Section title="Target">
              <SelectField
                label="Kind"
                value={node.target?.kind ?? (node.type === "click" ? "element" : "section")}
                options={["component", "section", "element", "page"] as const}
                onChange={value => onUpdateNode({ target: { ...(node.target ?? {}), kind: value } as WalkthroughTarget })}
              />
              <TextField label="Section ID" value={node.target?.sectionId ?? ""} onChange={value => onUpdateNode({ target: { ...(node.target ?? { kind: "section" }), sectionId: value || undefined } as WalkthroughTarget })} placeholder="hero" />
              <TextField label="Selector" value={node.target?.selector ?? ""} onChange={value => onUpdateNode({ target: { ...(node.target ?? { kind: "element" }), selector: value || undefined } as WalkthroughTarget })} placeholder="[data-seene-target=create]" />
              <TextField label="File" value={node.target?.file ?? ""} onChange={value => onUpdateNode({ target: { ...(node.target ?? { kind: "component" }), file: value || undefined } as WalkthroughTarget })} placeholder="src/sections/Hero.tsx" />
              <TextField label="Export" value={node.target?.export ?? ""} onChange={value => onUpdateNode({ target: { ...(node.target ?? { kind: "component" }), export: value || undefined } as WalkthroughTarget })} placeholder="Hero" />
              <TextField label="Label" value={node.target?.label ?? ""} onChange={value => onUpdateNode({ target: { ...(node.target ?? { kind: "section" }), label: value || undefined } as WalkthroughTarget })} />
              <TextField label="Page URL" value={node.target?.url ?? ""} onChange={value => onUpdateNode({ target: { ...(node.target ?? { kind: "page" }), url: value || undefined } as WalkthroughTarget })} placeholder="https://example.com/features" />
            </Section>
          ) : null}

          {node.type === "scroll" || node.type === "show" ? (
            <Section title="Scroll">
              <SelectField label="Align" value={node.scroll?.align ?? "start"} options={["start", "center", "end"] as const} onChange={value => onUpdateNode({ scroll: { align: value, offsetPx: node.scroll?.offsetPx ?? 0 } })} />
              <NumberField label="Offset px" value={node.scroll?.offsetPx} onChange={value => onUpdateNode({ scroll: { align: node.scroll?.align ?? "start", offsetPx: value ?? 0 } })} />
            </Section>
          ) : null}

          {node.type === "highlight" || node.highlight ? (
            <Section title="Highlight">
              <SelectField label="Style" value={node.highlight?.style ?? "outline"} options={HIGHLIGHT_STYLES} onChange={value => onUpdateNode({ highlight: { style: value, paddingPx: node.highlight?.paddingPx ?? 8, ...(node.highlight?.color ? { color: node.highlight.color } : {}) } })} />
              <TextField label="Color" value={node.highlight?.color ?? ""} onChange={value => onUpdateNode({ highlight: { style: node.highlight?.style ?? "outline", paddingPx: node.highlight?.paddingPx ?? 8, ...(value ? { color: value } : {}) } })} placeholder="#7c9cff" />
              <NumberField label="Padding px" value={node.highlight?.paddingPx} min={0} max={240} onChange={value => onUpdateNode({ highlight: { style: node.highlight?.style ?? "outline", paddingPx: value ?? 8, ...(node.highlight?.color ? { color: node.highlight.color } : {}) } })} />
            </Section>
          ) : null}

          {node.type === "click" ? (
            <Section title="Action" hint="Verify the intended result instead of trusting the animation.">
              <TextField label="Expect selector" value={node.action?.expect?.selector ?? ""} onChange={value => onUpdateNode({ action: { timeoutMs: node.action?.timeoutMs ?? 5000, required: node.action?.required ?? true, expect: { selector: value || undefined, sectionId: node.action?.expect?.sectionId, state: node.action?.expect?.state ?? "visible" } } })} />
              <TextField label="Expect section" value={node.action?.expect?.sectionId ?? ""} onChange={value => onUpdateNode({ action: { timeoutMs: node.action?.timeoutMs ?? 5000, required: node.action?.required ?? true, expect: { selector: node.action?.expect?.selector, sectionId: value || undefined, state: node.action?.expect?.state ?? "visible" } } })} />
              <SelectField label="Expected state" value={node.action?.expect?.state ?? "visible"} options={["visible", "hidden"] as const} onChange={value => onUpdateNode({ action: { timeoutMs: node.action?.timeoutMs ?? 5000, required: node.action?.required ?? true, expect: { selector: node.action?.expect?.selector, sectionId: node.action?.expect?.sectionId, state: value } } })} />
              <NumberField label="Timeout ms" value={node.action?.timeoutMs} min={0} max={60000} onChange={value => onUpdateNode({ action: { timeoutMs: value ?? 5000, required: node.action?.required ?? true, expect: node.action?.expect } })} />
              <ToggleField label="Required" value={node.action?.required ?? true} onChange={value => onUpdateNode({ action: { timeoutMs: node.action?.timeoutMs ?? 5000, required: value, expect: node.action?.expect } })} />
            </Section>
          ) : null}

          {node.type === "caption" ? (
            <Section title="Caption">
              <TextField label="Text" value={node.caption?.text ?? ""} onChange={value => onUpdateNode({ caption: { text: value || node.title, position: node.caption?.position ?? "bottom" } })} />
              <SelectField label="Position" value={node.caption?.position ?? "bottom"} options={["top", "center", "bottom"] as const} onChange={value => onUpdateNode({ caption: { text: node.caption?.text ?? node.title, position: value } })} />
            </Section>
          ) : null}

          <Section title="Camera override" hint="Leave blank to inherit the previous framing.">
            {WALKTHROUGH_CAMERA_PROPERTIES.map(property => (
              <NumberField key={property} label={property} value={node.camera?.[property]} onChange={value => onUpdateNode({ camera: patchCamera(node, property, value) })} />
            ))}
          </Section>

          <Section title="Focus override">
            {WALKTHROUGH_FOCUS_PROPERTIES.map(property => (
              <NumberField key={property} label={property} value={node.focus?.[property]} onChange={value => onUpdateNode({ focus: patchFocus(node, property, value) })} />
            ))}
          </Section>

          <div className="seene-inspector-actions">
            <button type="button" className="seene-control" onClick={onResetNode}>
              Reset step
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

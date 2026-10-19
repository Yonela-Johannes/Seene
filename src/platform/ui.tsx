import type { ReactNode } from "react";

export const buttonPrimary = "seene-btn seene-btn-primary seene-btn-nav";
export const buttonQuiet = "seene-btn seene-btn-secondary seene-btn-nav";
export const buttonGhost = "seene-btn seene-btn-ghost seene-btn-nav";
export const fieldClass = "h-9 w-full rounded-sm border border-[var(--seene-border)] bg-[var(--seene-surface)] px-3 font-mono text-sm text-[var(--seene-text)] placeholder:text-[var(--seene-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--seene-accent)] focus-visible:outline-offset-2";


export function Command({ children }: { children: ReactNode }) {
  return <code className="rounded-sm border border-[var(--seene-border)] bg-[var(--seene-surface-2)] px-3 py-2 font-mono text-xs">{children}</code>;
}

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      data-status={ok ? "connected" : "pending"}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${ok ? "border-[var(--seene-accent)] bg-[var(--seene-accent-soft)] text-[var(--seene-accent)]" : "border-[var(--seene-border)] bg-[var(--seene-surface-2)] text-[var(--seene-text-muted)]"}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[var(--seene-accent)]" : "bg-[var(--seene-text-muted)]"}`} />
      {label}
    </span>
  );
}

export function Panel({ title, description, actions, children, className = "" }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-[var(--seene-border)] bg-[var(--seene-surface)] ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-[var(--seene-border)] px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight uppercase text-[var(--seene-text-muted)]">{title}</h2>
          {description && <p className="mt-1 text-sm text-[var(--seene-text-muted)]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-sm border px-4 py-3 text-sm ${tone === "error" ? "border-[var(--seene-accent)] bg-[var(--seene-accent-soft)]" : "border-[var(--seene-border)] bg-[var(--seene-surface-2)] text-[var(--seene-text-muted)]"}`}
    >
      {children}
    </p>
  );
}

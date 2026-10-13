import { SEENE_BRAND } from "../core";

export function BrandAttribution({ showName = true }: { showName?: boolean }) {
  return (
    <span className="text-xs text-[var(--seene-text-muted)]">
      {showName && <>{SEENE_BRAND.name} </>}by{" "}
      <a
        href={SEENE_BRAND.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[var(--seene-text)] hover:underline"
        aria-label={SEENE_BRAND.creator + " on Website (opens in a new tab)"}
      >
        {SEENE_BRAND.creator}
      </a>
    </span>
  );
}

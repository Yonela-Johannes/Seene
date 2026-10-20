import { SEENE_BRAND } from "../core";

export function BrandAttribution({ showName = true }: { showName?: boolean }) {
  return (
    <span className="seene-attribution">
      {showName && <>{SEENE_BRAND.name} </>}by{" "}
      <a
        href={SEENE_BRAND.url}
        target="_blank"
        rel="noopener noreferrer"
        className="seene-attribution-link"
        aria-label={SEENE_BRAND.creator + " on Website (opens in a new tab)"}
      >
        {SEENE_BRAND.creator}
      </a>
    </span>
  );
}

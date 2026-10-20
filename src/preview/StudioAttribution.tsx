
import { BrandAttribution } from "./BrandAttribution";

export function StudioAttribution({ project }: { project?: string }) {
  return (
    <p className="seene-studio-attribution" data-seene-preview-chrome="" data-seene-chrome="attribution">
      <BrandAttribution />
      {project ? (
        <span className="seene-attribution" title={project}>
          <span aria-hidden="true"> · </span>
          {project}
        </span>
      ) : null}
    </p>
  );
}

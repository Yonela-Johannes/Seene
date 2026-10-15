import { AUTHORED_PRESENTATION, PRESENTATIONS, presentation } from "../core";

export type PresentationPickerProps = {
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export function PresentationPicker({ value, onChange, disabled = false }: PresentationPickerProps) {
  const active = value ?? AUTHORED_PRESENTATION;
  const summary =
    active === AUTHORED_PRESENTATION
      ? "The camera, focus and motion written in this scene recipe."
      : presentation(active).summary;

  return (
    <div className="seene-presentations" role="group" aria-label="Presentation" aria-disabled={disabled} title={disabled ? "Presets apply in Scene mode" : undefined}>
      <div className="seene-presentation-rail" aria-disabled={disabled}>
        <button
          type="button"
          className={active === AUTHORED_PRESENTATION ? "seene-control seene-primary" : "seene-control"}
          aria-pressed={active === AUTHORED_PRESENTATION}
          disabled={disabled}
          title={disabled ? "Presets apply in Scene mode" : "The camera, focus and motion written in this scene recipe."}
          onClick={() => onChange(AUTHORED_PRESENTATION)}
        >
          Authored
        </button>
        {PRESENTATIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? "seene-control seene-primary" : "seene-control"}
            aria-pressed={active === item.id}
            disabled={disabled}
            title={disabled ? "Presets apply in Scene mode" : item.summary}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="seene-presentation-note" role="status">
        {summary}
      </p>
    </div>
  );
}

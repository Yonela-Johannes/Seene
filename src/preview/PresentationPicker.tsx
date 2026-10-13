import { AUTHORED_PRESENTATION, PRESENTATIONS, presentation } from "../core";

export type PresentationPickerProps = {
  value: string | undefined;
  onChange: (id: string) => void;
};

export function PresentationPicker({ value, onChange }: PresentationPickerProps) {
  const active = value ?? AUTHORED_PRESENTATION;
  const summary =
    active === AUTHORED_PRESENTATION
      ? "The camera, focus and motion written in this scene recipe."
      : presentation(active).summary;

  return (
    <div className="seene-presentations" role="group" aria-label="Presentation">
      <div className="seene-presentation-rail">
        <button
          type="button"
          className={active === AUTHORED_PRESENTATION ? "seene-control seene-primary" : "seene-control"}
          aria-pressed={active === AUTHORED_PRESENTATION}
          title="The camera, focus and motion written in this scene recipe."
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
            title={item.summary}
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

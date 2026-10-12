import { TRANSITION_PRESETS, type TransitionPresetName } from "../core";

export type TransitionPickerProps = {
  value: TransitionPresetName | undefined;
  onChange: (id: TransitionPresetName | undefined) => void;
};

export function TransitionPicker({ value, onChange }: TransitionPickerProps) {
  return (
    <div className="seene-transitions" role="group" aria-label="Transition">
      <div className="seene-presentation-rail">
        {Object.entries(TRANSITION_PRESETS).map(([id, preset]) => {
          const name = id as TransitionPresetName;
          return (
            <button
              key={name}
              type="button"
              className={value === name ? "seene-control seene-primary" : "seene-control"}
              aria-pressed={value === name}
              title={preset.description}
              onClick={() => onChange(value === name ? undefined : name)}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
      <p className="seene-presentation-note" role="status">
        {value ? TRANSITION_PRESETS[value].description : "No transition between scenes"}
      </p>
    </div>
  );
}

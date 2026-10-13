import { useState } from "react";

const STEPS = [
  {
    number: "01",
    title: "Add Seene to your app",
    description:
      "Open a terminal in the main folder of your React project and run this command once.",
    command: "pnpm exec seene init",
  },
  {
    number: "02",
    title: "Open the studio",
    description:
      "Start your app the way you normally do, then open the Seene studio. It shows your real app, so you can work on it directly.",
  },
  {
    number: "03",
    title: "Create a scene",
    description:
      "Pick the part of your app you want to show. Then choose the camera angle, background blur, and movement.",
  },
];

export type GettingStartedProps = {
  onStartCreating?: () => void;
};

export function GettingStarted({ onStartCreating }: GettingStartedProps) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;

  const handleNext = () => {
    if (isLastStep) {
      onStartCreating?.();
      return;
    }

    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (isFirstStep) {
      setStarted(false);
      return;
    }

    setStep((current) => current - 1);
  };

  return (
    <main className="fixed inset-0 overflow-y-auto bg-[var(--seene-bg)] text-[var(--seene-text)]">
      <div className="flex min-h-full w-full flex-col px-6 sm:px-8">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full max-w-5xl">
            {!started ? (
              <section
                aria-labelledby="seene-hero-title"
                className="flex w-full flex-col items-center text-center"
              >
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
                  <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-[var(--seene-text-muted)]">
                    Cinematic React presentations
                  </p>

                  <h1
                    id="seene-hero-title"
                    className="mx-auto max-w-5xl text-5xl font-medium leading-[0.92] tracking-[-3.5px] text-[var(--seene-text)] sm:text-6xl lg:text-7xl"
                  >
                    Turn your app into a cinematic experience.
                  </h1>

                  <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[var(--seene-text-muted)] sm:text-xl">
                    Create interactive scenes from your app and present your
                    product with cinematic camera movement, depth, focus, and
                    motion.
                  </p>

                  <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="mt-12 inline-flex h-14 items-center justify-center rounded-xl bg-[var(--seene-surface-2)] px-8 text-base font-medium text-[var(--seene-text)] transition-all duration-200 hover:scale-[1.02] hover:bg-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
                  >
                    Get started
                  </button>
                </div>
              </section>
            ) : (
              <section
                aria-labelledby="getting-started-title"
                className="mx-auto w-full max-w-3xl"
              >
                <div className="min-h-[390px]">
                  <div
                    key={currentStep.number}
                    className="animate-in fade-in slide-in-from-bottom-3 duration-500"
                  >
                    <div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium tracking-[0.15em] text-[var(--seene-accent)]">
                          {currentStep.number}
                        </span>

                        <span className="h-px w-10 bg-[var(--seene-border-text)]" />

                        <span className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--seene-text-muted)]">
                          Getting started
                        </span>
                      </div>

                      <h2
                        id="getting-started-title"
                        className="mt-7 max-w-3xl text-4xl font-medium leading-[0.98] tracking-[-2.5px] text-[var(--seene-text)] sm:text-5xl lg:text-6xl"
                      >
                        {currentStep.title}
                      </h2>

                      <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--seene-text-muted)] sm:text-xl">
                        {currentStep.description}
                      </p>

                      {currentStep.command && (
                        <div className="mt-9 inline-flex items-center gap-3 rounded-lg border border-[var(--seene-border-text)] bg-[var(--seene-surface-2)] px-5 py-4 font-mono text-sm text-[var(--seene-text)]">
                          <span className="text-[var(--seene-text-muted)]">$</span>
                          <code>{currentStep.command}</code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex h-16 items-center justify-between border-t border-[var(--seene-border)]">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--seene-border-text)] px-5 text-sm font-medium text-[var(--seene-text-muted)] transition-colors hover:border-[var(--seene-border-text)] hover:text-[var(--seene-text)] focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
                  >
                    {isFirstStep ? "Back" : "Back"}
                  </button>

                  <div
                    className="flex items-center gap-2"
                    aria-label={`Step ${step + 1} of ${STEPS.length}`}
                  >
                    {STEPS.map((item, index) => (
                      <span
                        key={item.number}
                        className={`h-1 rounded-full transition-all duration-500 ${
                          index === step
                            ? "w-8 bg-[var(--seene-surface-2)]"
                            : index < step
                              ? "w-2 bg-[var(--seene-text-muted)]"
                              : "w-2 bg-[var(--seene-border-text)]"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--seene-surface-2)] px-6 text-sm font-medium text-[var(--seene-text)] transition-all duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
                  >
                    {isLastStep ? "Start creating" : "Next"}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="flex h-16 shrink-0 items-center justify-center">
          <span className="text-xs tracking-[0.08em] text-[var(--seene-text-muted)]">
            SEENE BY{" "}
            <a
              href="https://yonela-johannes.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--seene-text-muted)] transition-colors hover:text-[var(--seene-text)]"
            >
              THATG33K
            </a>
            <span className="mx-2 text-[var(--seene-border-text)]">·</span>
            <a
              href="https://github.com/orgs/thatg33k-t33/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--seene-text-muted)] transition-colors hover:text-[var(--seene-text)]"
            >
              GitHub
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}

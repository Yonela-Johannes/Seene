import { vi } from "vitest";

export function installLayoutStubs() {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute("data-seene-stage")
        ? 800
        : parseFloat(this.style.width) || 200;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute("data-seene-stage")
        ? 400
        : parseFloat(this.style.height) || 100;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      return parseFloat(this.style.left) || 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return parseFloat(this.style.top) || 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        this.parentElement?.closest("[data-seene-id], [data-seene-stage]") ??
        null
      );
    },
  );
}

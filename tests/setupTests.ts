import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/vue";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-corners");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--app-corner-radius");
});

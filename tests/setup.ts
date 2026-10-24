import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// jsdom per test: unmount RTL trees so queries never leak across tests.
afterEach(() => {
  cleanup();
});

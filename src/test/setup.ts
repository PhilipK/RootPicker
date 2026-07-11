import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Node ships an experimental global `localStorage` accessor that vitest's
// jsdom bridge sees as "already present" and so declines to override with
// jsdom's real, working implementation — leaving `window.localStorage`
// undefined under test. A tiny in-memory Storage stands in for it; we only
// need get/set/clear semantics, not jsdom's storage-event behavior.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

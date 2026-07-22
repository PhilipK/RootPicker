import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./styles.css";

// A session stays open for a full game (device passed hand to hand for an
// hour+), so the browser's own once-per-navigation update check never fires.
// Poll explicitly, and check right away whenever the tab regains focus —
// exactly the moment the device comes back from being passed around — so a
// deploy that landed mid-session doesn't leave the tab stuck on stale assets.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => void registration.update();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    setInterval(check, 30 * 60 * 1000);
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

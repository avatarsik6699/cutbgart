import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

async function hydrateApplicationFx(): Promise<void> {
  if (__RENDER_DIAGNOSTICS__) await import("./app/render-diagnostics/render-diagnostics");

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
}

void hydrateApplicationFx();

export function installManualDraftUnloadGuard(shouldBlock: () => boolean): () => void {
  function beforeUnloadFx(event: BeforeUnloadEvent): void {
    if (!shouldBlock()) return;
    event.preventDefault();
    event.returnValue = "";
  }
  globalThis.addEventListener("beforeunload", beforeUnloadFx);
  return () => globalThis.removeEventListener("beforeunload", beforeUnloadFx);
}

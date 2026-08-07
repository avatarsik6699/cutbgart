import type {
  ProcessingWorker,
  ProcessingWorkerCommand,
  ProcessingWorkerEvent,
} from "@/editor/runtime";

export class WorkerScenarioDriver implements ProcessingWorker {
  readonly commands: ProcessingWorkerCommand[] = [];
  readonly transfers: Transferable[][] = [];
  #messageListeners = new Set<(event: MessageEvent<ProcessingWorkerEvent>) => void>();
  #failureListeners = new Map<"error" | "messageerror", Set<(event: Event) => void>>();
  #terminated = false;

  addEventListener(
    type: "message" | "error" | "messageerror",
    listener:
      ((event: MessageEvent<ProcessingWorkerEvent>) => void) | ((event: Event) => void),
  ): void {
    if (type === "message") {
      this.#messageListeners.add(listener);
      return;
    }
    const listeners = this.#failureListeners.get(type) ?? new Set();
    listeners.add(listener as (event: Event) => void);
    this.#failureListeners.set(type, listeners);
  }

  postMessage(command: ProcessingWorkerCommand, transfer: Transferable[] = []): void {
    if (this.#terminated) throw new Error("Worker scenario is terminated");
    this.commands.push(command);
    this.transfers.push([...transfer]);
  }

  emit(event: ProcessingWorkerEvent): void {
    if (this.#terminated) return;
    const message = new MessageEvent<ProcessingWorkerEvent>("message", { data: event });
    for (const listener of this.#messageListeners) listener(message);
  }

  crash(type: "error" | "messageerror" = "error"): void {
    if (this.#terminated) return;
    const event = new Event(type);
    for (const listener of this.#failureListeners.get(type) ?? []) listener(event);
  }

  terminate(): void {
    this.#terminated = true;
    this.#messageListeners.clear();
    this.#failureListeners.clear();
  }

  terminated(): boolean {
    return this.#terminated;
  }
}

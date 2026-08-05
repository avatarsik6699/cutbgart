import { Bug, X } from "lucide-react";
import type { ComponentProps } from "react";

import { m } from "@/paraglide/messages";
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui";

export type DiagnosticsLogEntry = Readonly<{
  id: string;
  message: string;
  timestamp: number;
}>;

export type DiagnosticsRunInfo = Readonly<{
  dtype: string;
  inferencePath: string;
}>;

export type DiagnosticsSheetProps = {
  logs: readonly DiagnosticsLogEntry[];
  runInfo?: DiagnosticsRunInfo | null;
  lightweightMode?: boolean;
  fallbackUsed?: boolean;
  modelLoadBytes?: { loaded: number; total: number | null };
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function DiagnosticsBody(props: DiagnosticsSheetProps) {
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto p-5 font-mono text-xs text-muted-foreground"
      data-testid="processing-details"
    >
      <dl className="mb-4 grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
        {props.runInfo && (
          <div>
            <dt className="inline text-foreground">runtime: </dt>
            <dd className="inline">
              {props.runInfo.inferencePath} · {props.runInfo.dtype}
            </dd>
          </div>
        )}
        {props.modelLoadBytes && props.modelLoadBytes.loaded > 0 && (
          <div>
            <dt className="inline text-foreground">model bytes: </dt>
            <dd className="inline">
              {(props.modelLoadBytes.loaded / 1_048_576).toFixed(1)} MiB
              {props.modelLoadBytes.total
                ? ` / ${(props.modelLoadBytes.total / 1_048_576).toFixed(1)} MiB`
                : ""}
            </dd>
          </div>
        )}
        {props.lightweightMode && (
          <div>
            <dt className="inline text-foreground">fallback: </dt>
            <dd className="inline">WASM</dd>
          </div>
        )}
        {props.fallbackUsed && (
          <div>
            <dt className="inline text-foreground">quality fallback: </dt>
            <dd className="inline">ben2-fp16 → isnet-fp32</dd>
          </div>
        )}
      </dl>
      {props.logs.length ? (
        <ul className="grid gap-1.5">
          {props.logs.map((entry) => (
            <li key={entry.id}>
              <span className="text-muted-foreground/60">
                {formatTime(entry.timestamp)}
              </span>{" "}
              {entry.message}
            </li>
          ))}
        </ul>
      ) : (
        <p>{m.diagnosticsDescription()}</p>
      )}
    </div>
  );
}

type TriggerButtonProps = {
  testId: string;
  className: string;
} & ComponentProps<typeof Button>;

function extractTriggerButtonProps({
  testId,
  className,
  ...buttonProps
}: TriggerButtonProps) {
  return { buttonProps, className, testId };
}

function TriggerButton(props: TriggerButtonProps) {
  const extracted = extractTriggerButtonProps(props);
  return (
    <Button
      {...extracted.buttonProps}
      type="button"
      variant="ghost"
      size="icon"
      className={extracted.className}
      aria-label={m.diagnostics()}
      data-testid={extracted.testId}
    >
      <Bug aria-hidden="true" />
    </Button>
  );
}

export function DiagnosticsSheet(props: DiagnosticsSheetProps) {
  return (
    <>
      <Sheet>
        <SheetTrigger
          render={
            <TriggerButton
              testId="diagnostics-trigger-desktop"
              className="hidden min-[56rem]:inline-flex"
            />
          }
        />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{m.diagnostics()}</SheetTitle>
            <SheetDescription>{m.diagnosticsDescription()}</SheetDescription>
          </SheetHeader>
          <DiagnosticsBody {...props} />
        </SheetContent>
      </Sheet>

      <Drawer>
        <DrawerTrigger
          render={
            <TriggerButton
              testId="diagnostics-trigger-mobile"
              className="min-[56rem]:hidden"
            />
          }
        />
        <DrawerContent>
          <DrawerHeader className="relative pr-14">
            <DrawerTitle>{m.diagnostics()}</DrawerTitle>
            <DrawerDescription>{m.diagnosticsDescription()}</DrawerDescription>
            <DrawerClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-4 top-4"
                  aria-label={m.close()}
                />
              }
            >
              <X aria-hidden="true" />
            </DrawerClose>
          </DrawerHeader>
          <DiagnosticsBody {...props} />
        </DrawerContent>
      </Drawer>
    </>
  );
}

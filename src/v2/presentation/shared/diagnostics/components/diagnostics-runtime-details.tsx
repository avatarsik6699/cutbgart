import { DescriptionList, DescriptionListItem } from "@/shared/ui";

import type { DiagnosticsSheetProps } from "../diagnostics.types";

type Props = Pick<
  DiagnosticsSheetProps,
  "fallbackUsed" | "lightweightMode" | "modelLoadBytes" | "runInfo"
>;

function modelBytesValue(props: Props): string {
  const bytes = props.modelLoadBytes;
  if (bytes === undefined) return "";
  const loaded = `${(bytes.loaded / 1_048_576).toFixed(1)} MiB`;
  return bytes.total === null
    ? loaded
    : `${loaded} / ${(bytes.total / 1_048_576).toFixed(1)} MiB`;
}

export function DiagnosticsRuntimeDetails(props: Props) {
  return (
    <DescriptionList className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
      {props.runInfo && (
        <DescriptionListItem
          label="runtime"
          value={`${props.runInfo.inferencePath} · ${props.runInfo.dtype}`}
        />
      )}
      {props.modelLoadBytes && props.modelLoadBytes.loaded > 0 && (
        <DescriptionListItem label="model bytes" value={modelBytesValue(props)} />
      )}
      {props.lightweightMode && <DescriptionListItem label="fallback" value="WASM" />}
      {props.fallbackUsed && (
        <DescriptionListItem label="quality fallback" value="ben2-fp16 → isnet-fp32" />
      )}
    </DescriptionList>
  );
}

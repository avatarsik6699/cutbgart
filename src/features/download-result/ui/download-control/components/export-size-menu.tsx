import { Menu } from "@base-ui/react/menu";
import { Check, Download } from "lucide-react";

import { m } from "@/paraglide/messages";

import type { ExportSize } from "../../../model/types";
import { exportSizeLabel } from "../download-control.utils";

type Props = Readonly<{
  onDownload(): void;
  onSelectSize(size: ExportSize): void;
  selectedSize: ExportSize;
  sizes: readonly ExportSize[];
}>;

export function ExportSizeMenu(props: Props) {
  return (
    <Menu.Popup className="min-w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
      <Menu.Group>
        <Menu.GroupLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {m.exportOutputSize()}
        </Menu.GroupLabel>
        <Menu.RadioGroup
          value={props.selectedSize}
          onValueChange={(value) => props.onSelectSize(value as ExportSize)}
        >
          {props.sizes.map((size) => (
            <Menu.RadioItem
              key={size}
              value={size}
              className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-muted"
            >
              <span className="flex size-4 items-center justify-center">
                <Menu.RadioItemIndicator>
                  <Check className="size-4" aria-hidden="true" />
                </Menu.RadioItemIndicator>
              </span>
              {exportSizeLabel(size)}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Group>
      <div role="separator" className="my-1 h-px bg-border" />
      <Menu.Item
        onClick={props.onDownload}
        className="flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium outline-none data-highlighted:bg-muted"
      >
        <Download className="size-4" aria-hidden="true" />
        {m.download()}
      </Menu.Item>
    </Menu.Popup>
  );
}

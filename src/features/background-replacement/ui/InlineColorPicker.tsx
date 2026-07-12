import { useRef, useState } from "react";
import { m } from "@/paraglide/messages";

import type { HexColor } from "../../../entities/processed-image";

interface HsvColor {
  hue: number;
  saturation: number;
  value: number;
}

function channelToHex(channel: number): string {
  return Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

function hsvToHex({ hue, saturation, value }: HsvColor): HexColor {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = value * saturation;
  const section = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = value - chroma;
  return `#${channelToHex(red + match)}${channelToHex(green + match)}${channelToHex(blue + match)}`;
}

function hexToHsv(color: HexColor): HsvColor {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255;
  const green = Number.parseInt(color.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

export function InlineColorPicker({
  color,
  onChange,
}: {
  color: HexColor;
  onChange: (color: HexColor) => void;
}) {
  const activePointerRef = useRef<number | null>(null);
  const colorChannels = hexToHsv(color);
  // Hue cannot be recovered from an achromatic hex value (white/gray/black),
  // so retain it independently while this inline picker stays mounted.
  const [hue, setHue] = useState(colorChannels.hue);
  const hsv = { ...colorChannels, hue };

  function selectFromPointer(element: HTMLDivElement, clientX: number, clientY: number) {
    const bounds = element.getBoundingClientRect();
    const saturation = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const value = Math.min(1, Math.max(0, 1 - (clientY - bounds.top) / bounds.height));
    onChange(hsvToHex({ hue: hsv.hue, saturation, value }));
  }

  return (
    <div className="flex w-full max-w-72 flex-col gap-3 rounded-lg border border-border bg-popover p-3 shadow-md">
      <div
        role="slider"
        tabIndex={0}
        aria-label={m.colorPalette()}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.saturation * 100)}
        aria-valuetext={color}
        data-testid="color-palette"
        className="relative h-40 w-full touch-none cursor-crosshair overflow-hidden rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        style={{
          backgroundColor: `hsl(${String(Math.round(hsv.hue))} 100% 50%)`,
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          activePointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          selectFromPointer(event.currentTarget, event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          selectFromPointer(event.currentTarget, event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          activePointerRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          activePointerRef.current = null;
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.01;
          let saturation = hsv.saturation;
          let value = hsv.value;
          if (event.key === "ArrowLeft") saturation -= step;
          else if (event.key === "ArrowRight") saturation += step;
          else if (event.key === "ArrowDown") value -= step;
          else if (event.key === "ArrowUp") value += step;
          else return;
          event.preventDefault();
          onChange(
            hsvToHex({
              hue: hsv.hue,
              saturation: Math.min(1, Math.max(0, saturation)),
              value: Math.min(1, Math.max(0, value)),
            }),
          );
        }}
      >
        <span
          aria-hidden="true"
          data-testid="color-palette-thumb"
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
          style={{
            left: `${String(hsv.saturation * 100)}%`,
            top: `${String((1 - hsv.value) * 100)}%`,
          }}
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="shrink-0">{m.hue()}</span>
        <input
          aria-label={m.colorHue()}
          type="range"
          min={0}
          max={359}
          value={Math.round(hsv.hue)}
          onInput={(event) => {
            const nextHue = Number(event.currentTarget.value);
            setHue(nextHue);
            onChange(hsvToHex({ ...colorChannels, hue: nextHue }));
          }}
          className="h-3 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
        />
        <output className="w-16 font-mono text-xs">{color}</output>
      </label>
    </div>
  );
}

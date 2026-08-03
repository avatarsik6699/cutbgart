import type { ComponentPropsWithRef } from "react";

import { cn } from "@/shared/lib";

export type ImagePreset = "content" | "hero" | "preview" | "thumbnail";

type ImageDimensions =
  { height: number; width: number } | { height?: never; width?: never };

type ImageAccessibility =
  { alt: string; decorative?: false } | { alt?: never; decorative: true };

type ImagePolicy = {
  className: string;
  decoding: "async" | "sync";
  fetchPriority: "auto" | "high" | "low";
  loading: "eager" | "lazy";
};

export type ImageProps = Omit<
  ComponentPropsWithRef<"img">,
  | "alt"
  | "className"
  | "decoding"
  | "fetchPriority"
  | "height"
  | "loading"
  | "src"
  | "width"
> &
  ImageAccessibility &
  ImageDimensions & {
    className?: string;
    preset: ImagePreset;
    src: string;
  };

const PRESET_POLICY: Record<ImagePreset, ImagePolicy> = {
  content: {
    className: "h-auto w-full object-contain",
    decoding: "async",
    fetchPriority: "auto",
    loading: "lazy",
  },
  hero: {
    className: "aspect-video w-full object-cover",
    decoding: "async",
    fetchPriority: "high",
    loading: "eager",
  },
  preview: {
    className: "size-full object-contain",
    decoding: "async",
    fetchPriority: "high",
    loading: "eager",
  },
  thumbnail: {
    className: "aspect-square size-full object-cover",
    decoding: "async",
    fetchPriority: "low",
    loading: "lazy",
  },
};

function imageAttributes(
  props: ImageProps,
): Omit<
  ImageProps,
  | keyof ImageAccessibility
  | keyof ImageDimensions
  | "className"
  | "decorative"
  | "preset"
  | "ref"
  | "src"
> {
  const { alt, className, decorative, height, preset, ref, src, width, ...attributes } =
    props;
  return attributes;
}

function accessibleAlt(props: ImageProps): string {
  if (props.decorative) {
    return "";
  }
  if (props.alt.trim().length === 0) {
    throw new Error("Image alt text must be meaningful or the image must be decorative");
  }
  return props.alt;
}

export function Image(props: ImageProps) {
  const policy = PRESET_POLICY[props.preset];
  return (
    <img
      {...imageAttributes(props)}
      alt={accessibleAlt(props)}
      aria-hidden={props.decorative ? true : props["aria-hidden"]}
      className={cn(policy.className, props.className)}
      decoding={policy.decoding}
      fetchPriority={policy.fetchPriority}
      height={props.height}
      loading={policy.loading}
      ref={props.ref}
      src={props.src}
      width={props.width}
    />
  );
}

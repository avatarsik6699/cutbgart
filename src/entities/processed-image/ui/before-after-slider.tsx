import { useEffect, useState, type CSSProperties } from "react";

import { m } from "@/paraglide/messages";

import type { BackgroundFill, SourceImage } from "../model/types";
import { BeforeAfterUrlSlider } from "./before-after-url-slider";

export type BeforeAfterSliderProps = Readonly<{
  after: Blob;
  alt?: string;
  backgroundFill?: BackgroundFill;
  before: SourceImage;
  onPositionChange?: (position: number) => void;
  position?: number;
}>;

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(
    function syncObjectUrlFx() {
      if (!blob) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- external Blob removal must clear its derived URL.
        setUrl(null);
        return;
      }
      const nextUrl = URL.createObjectURL(blob);
      setUrl(nextUrl);
      return () => URL.revokeObjectURL(nextUrl);
    },
    [blob],
  );
  return url;
}

export function BeforeAfterSlider(props: BeforeAfterSliderProps) {
  const backgroundFill = props.backgroundFill ?? { type: "transparent" };
  const beforeUrl = useObjectUrl(props.before.blob);
  const afterUrl = useObjectUrl(props.after);
  const backgroundImageUrl = useObjectUrl(
    backgroundFill.type === "image" ? backgroundFill.blob : null,
  );
  let backgroundStyle: CSSProperties | undefined;
  if (backgroundFill.type === "color") {
    backgroundStyle = { backgroundColor: backgroundFill.value, backgroundImage: "none" };
  } else if (backgroundFill.type === "gradient") {
    const gradient =
      backgroundFill.kind === "linear"
        ? "linear-gradient(to right"
        : "radial-gradient(circle at center";
    backgroundStyle = {
      backgroundImage: `${gradient}, ${backgroundFill.stops[0].color}, ${backgroundFill.stops[1].color})`,
    };
  } else if (backgroundFill.type === "image" && backgroundImageUrl) {
    backgroundStyle = {
      backgroundImage: `url("${backgroundImageUrl}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    };
  }

  return (
    <BeforeAfterUrlSlider
      afterUrl={afterUrl}
      alt={props.alt ?? m.beforeAfterAlt()}
      backgroundStyle={backgroundStyle}
      beforeUrl={beforeUrl}
      height={props.before.height}
      onPositionChange={props.onPositionChange}
      position={props.position}
      transparentBackground={backgroundFill.type === "transparent"}
      width={props.before.width}
    />
  );
}

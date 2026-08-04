import { Image } from "@/v2/shared/ui";

type Props = Readonly<{
  height: number;
  image: Readonly<{ alt: string; decorative: boolean; src: string }>;
  width: number;
}>;

export function WorkspaceComparisonImage(props: Props) {
  const common = {
    src: props.image.src,
    preset: "preview" as const,
    width: props.width,
    height: props.height,
    className: "h-full w-full object-contain",
  };
  if (props.image.decorative) return <Image {...common} decorative />;
  return <Image {...common} alt={props.image.alt} />;
}

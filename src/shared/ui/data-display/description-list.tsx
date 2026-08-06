import type { ReactNode } from "react";

import { cn } from "@/shared/lib";

type Props = Readonly<{
  children: ReactNode;
  className?: string;
}>;

function DescriptionList(props: Props) {
  return <dl className={cn("grid gap-2", props.className)}>{props.children}</dl>;
}

export { DescriptionList };

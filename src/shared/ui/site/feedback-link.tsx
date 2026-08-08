import { MessageCircle } from "lucide-react";

import { m } from "@/paraglide/messages";
import { cn } from "@/shared/lib";

const TELEGRAM_FEEDBACK_URL = "https://t.me/+HaqBWI1A3vg4MWJi";

type Props = Readonly<{
  label?: string;
  variant: "footer" | "header" | "inline";
}>;

const LINK_CLASSES: Record<Props["variant"], string> = {
  footer: "inline-flex items-center gap-1 text-muted-foreground hover:text-foreground",
  header:
    "hidden items-center gap-1 text-muted-foreground hover:text-foreground sm:inline-flex",
  inline: "inline-flex items-center gap-1 text-foreground underline underline-offset-4",
};

export function FeedbackLink(props: Props) {
  return (
    <a
      href={TELEGRAM_FEEDBACK_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASSES[props.variant]}
    >
      <MessageCircle
        className={cn(props.variant === "inline" ? "size-3.5" : "size-4")}
        aria-hidden="true"
      />
      {props.label ?? m.navFeedback()}
    </a>
  );
}

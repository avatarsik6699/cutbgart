import { Bug } from "lucide-react";
import type { ComponentProps } from "react";

import { m } from "@/paraglide/messages";
import { Button } from "@/shared/ui";

type Props = Readonly<{
  className: string;
  testId: string;
}> &
  ComponentProps<typeof Button>;

function buttonProps(props: Props): ComponentProps<typeof Button> {
  const { className, testId, ...attributes } = props;
  return attributes;
}

export function DiagnosticsTriggerButton(props: Props) {
  return (
    <Button
      {...buttonProps(props)}
      type="button"
      variant="ghost"
      size="icon"
      className={props.className}
      aria-label={m.diagnostics()}
      data-testid={props.testId}
    >
      <Bug aria-hidden="true" />
    </Button>
  );
}

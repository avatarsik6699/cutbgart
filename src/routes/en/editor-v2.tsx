import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/en/editor-v2")({
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are control-flow signals, not Error instances.
    throw redirect({ to: "/en", statusCode: 308 });
  },
});

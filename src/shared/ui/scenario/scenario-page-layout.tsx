import type { ReactNode } from "react";

import { Image } from "../media";
import { Typography } from "../typography";

type Props = Readonly<{
  body: readonly [string, string];
  children: ReactNode;
  example: Readonly<{
    alt: string;
    caption: string;
    height: number;
    src: string;
    width: number;
  }>;
  exampleHeading: string;
  lead: string;
  testId: string;
  title: string;
  trust: string;
}>;

export function ScenarioPageLayout(props: Props) {
  return (
    <main
      data-testid={props.testId}
      className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-8"
    >
      <header className="flex flex-col gap-2">
        <Typography variant="page-title">{props.title}</Typography>
        <Typography variant="body-muted">{props.lead}</Typography>
        <Typography variant="caption-muted">{props.trust}</Typography>
      </header>

      <Typography variant="body-muted">{props.body[0]}</Typography>
      <Typography variant="body-muted">{props.body[1]}</Typography>

      {props.children}

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <Typography variant="section-title">{props.exampleHeading}</Typography>
        <Image
          preset="content"
          src={props.example.src}
          alt={props.example.alt}
          width={props.example.width}
          height={props.example.height}
          className="mx-auto h-auto w-auto max-w-[min(100%,40rem)] rounded-xl border border-border"
        />
        <Typography variant="body-muted">{props.example.caption}</Typography>
      </section>
    </main>
  );
}

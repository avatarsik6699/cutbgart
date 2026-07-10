/**
 * `/about` — project/tech/author info (SPEC.md §5.1, does not block launch).
 * Static content only; does not compose the upload/remove-background
 * features (there is no product action to take on this page).
 */
export function AboutPage() {
  return (
    <main
      data-testid="about-page"
      className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6 sm:p-8"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">About BG Remove App</h1>
        <p className="text-sm text-muted-foreground">
          A free, anonymous background-removal tool that never sends your image anywhere.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">How it works</h2>
        <p className="text-sm text-muted-foreground">
          BG Remove App runs the entire background-removal pipeline on your own device.
          When you upload a photo, an image-segmentation model (IS-Net, an open-source
          neural network) loads directly in your browser and runs inference in a
          background thread — using your GPU via WebGPU when available, falling back to a
          WASM CPU path otherwise. Your image is never uploaded to a server, because this
          app has no server endpoint that accepts images at all.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Tech</h2>
        <p className="text-sm text-muted-foreground">
          Built with TanStack Start (React 19, TanStack Router) for server-rendered page
          shells, Tailwind CSS and shadcn/ui for the interface, and Transformers.js with
          ONNX Runtime Web for in-browser ML inference. The whole stack is self-hosted on
          a small VPS behind Nginx, with privacy-respecting analytics (Umami, Cloudflare
          Web Analytics) covering aggregate usage only — no personal data, no image
          content, ever leaves your device.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Author</h2>
        <p className="text-sm text-muted-foreground">
          Built and maintained by v.godlevskiy, as an independent, self-hosted project —
          no company, no third-party tracking beyond the aggregate analytics described
          above.
        </p>
      </section>
    </main>
  );
}

import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Image } from "./image";

describe("Image", () => {
  it("applies the preview policy and preserves known intrinsic dimensions", () => {
    const ref = createRef<HTMLImageElement>();
    render(
      <Image
        preset="preview"
        src="blob:preview-1"
        alt="Background removed preview"
        width={1200}
        height={800}
        className="rounded-lg"
        ref={ref}
      />,
    );

    const image = screen.getByRole("img", { name: "Background removed preview" });
    expect(image.getAttribute("src")).toBe("blob:preview-1");
    expect(image.getAttribute("width")).toBe("1200");
    expect(image.getAttribute("height")).toBe("800");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(image.getAttribute("fetchpriority")).toBe("high");
    expect(image.className).toContain("object-contain");
    expect(image.className).toContain("rounded-lg");
    expect(ref.current).toBe(image);
  });

  it("uses lazy low-priority thumbnail policy", () => {
    render(<Image preset="thumbnail" src="/thumbnail.png" alt="Imported image" />);
    const image = screen.getByRole("img", { name: "Imported image" });

    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("fetchpriority")).toBe("low");
    expect(image.className).toContain("aspect-square");
    expect(image.className).toContain("object-cover");
  });

  it("requires explicit decorative intent for an empty accessible name", () => {
    const rendered = render(<Image preset="content" src="/grid.png" decorative />);
    const image = rendered.container.querySelector("img");
    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.getAttribute("aria-hidden")).toBe("true");
    expect(within(rendered.container).queryByRole("img")).toBeNull();
  });

  it("rejects empty non-decorative alt text", () => {
    expect(() => render(<Image preset="content" src="/subject.png" alt="  " />)).toThrow(
      "Image alt text must be meaningful",
    );
  });
});

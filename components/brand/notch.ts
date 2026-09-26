import type { CSSProperties } from "react";

/**
 * Ticket-style notches (the Tabela card cut-outs) as a CSS mask. Returned as an
 * inline style on purpose: it keeps the mask layers away from the CSS minifier.
 */
export type NotchSide = "top" | "bottom" | "left" | "right";

const svg = (viewBox: string, d: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' preserveAspectRatio='none'><path d='${d}'/></svg>`,
  )}")`;

const SHAPES: Record<NotchSide, { image: string; position: string; vertical: boolean }> = {
  top: { image: svg("0 0 80 24", "M0 0C18 0 24 20 40 20S62 0 80 0Z"), position: "top center", vertical: false },
  bottom: {
    image: svg("0 0 80 24", "M0 24C18 24 24 4 40 4S62 24 80 24Z"),
    position: "bottom center",
    vertical: false,
  },
  left: { image: svg("0 0 24 80", "M0 0C0 18 20 24 20 40S0 62 0 80Z"), position: "left center", vertical: true },
  right: { image: svg("0 0 24 80", "M24 0C24 18 4 24 4 40S24 62 24 80Z"), position: "right center", vertical: true },
};

export function notchMask(
  sides: NotchSide[],
  { length = 88, depth = 22 }: { length?: number; depth?: number } = {},
): CSSProperties {
  const layers = sides.map((side) => SHAPES[side]);
  const image = [...layers.map((l) => l.image), "linear-gradient(#000 0 0)"].join(", ");
  const position = [...layers.map((l) => l.position), "0 0"].join(", ");
  const size = [
    ...layers.map((l) => (l.vertical ? `${depth}px ${length}px` : `${length}px ${depth}px`)),
    "100% 100%",
  ].join(", ");
  const repeat = [...layers.map(() => "no-repeat"), "no-repeat"].join(", ");

  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskPosition: position,
    maskPosition: position,
    WebkitMaskSize: size,
    maskSize: size,
    WebkitMaskRepeat: repeat,
    maskRepeat: repeat,
    WebkitMaskComposite: [...layers.map(() => "xor"), "source-over"].join(", "),
    maskComposite: [...layers.map(() => "exclude"), "add"].join(", "),
  };
}

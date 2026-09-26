import type { SVGProps } from "react";

// Decorative geometric marks used across the storefront, drawn in currentColor.
type GlyphProps = SVGProps<SVGSVGElement>;

export function Star4(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0c.9 6.6 4.8 10.6 12 12-7.2 1.4-11.1 5.4-12 12-.9-6.6-4.8-10.6-12-12C7.2 10.6 11.1 6.6 12 0Z" />
    </svg>
  );
}

export function Ring(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}

export function Clover(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="7" cy="7" r="5.5" />
      <circle cx="17" cy="7" r="5.5" />
      <circle cx="7" cy="17" r="5.5" />
      <circle cx="17" cy="17" r="5.5" />
      <rect x="7" y="7" width="10" height="10" />
    </svg>
  );
}

export function PetalX(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <g transform="rotate(45 12 12)">
        <rect x="8.5" y="0.5" width="7" height="23" rx="3.5" />
        <rect x="0.5" y="8.5" width="23" height="7" rx="3.5" />
      </g>
    </svg>
  );
}

export function Leaf(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 2h12a8 8 0 0 1 8 8v12H10a8 8 0 0 1-8-8V2Z" />
    </svg>
  );
}

/** Brand mark: three dots. */
export function Dots(props: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="6" cy="6" r="4.5" />
      <circle cx="6" cy="18" r="4.5" />
      <circle cx="18" cy="12" r="4.5" />
    </svg>
  );
}

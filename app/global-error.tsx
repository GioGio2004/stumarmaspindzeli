"use client";

// Last resort when the root layout itself fails: no fonts, providers or theme.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f3f2ed", fontFamily: "system-ui, sans-serif", color: "#111110" }}>
        <main style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#6b6b66", marginTop: 8 }}>Stumar couldn&apos;t start. Reload to try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 20, height: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#2d2d2d", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

import { ConvexError } from "convex/values";

const GENERIC = "Something went wrong. Please try again.";

/**
 * The backend's human message. Production Convex redacts plain `Error`
 * messages to "Server Error", so user-facing failures are ConvexErrors.
 */
export function errorText(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | string | undefined;
    if (typeof data === "string") return data;
    if (data && typeof data.message === "string") return data.message;
    return GENERIC;
  }
  if (!(error instanceof Error)) return GENERIC;
  const uncaught = error.message.match(/Uncaught (?:Convex)?Error: ([^\n]+)/);
  if (uncaught) return uncaught[1];
  if (/\[CONVEX|Server Error|Request ID/.test(error.message)) return GENERIC;
  return error.message.split("\n")[0] || GENERIC;
}

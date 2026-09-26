import type { WebhookEvent } from "@clerk/backend";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";

const http = httpRouter();

// Clerk -> Convex user sync.
// Register this URL in the Clerk dashboard under Webhooks:
//   <NEXT_PUBLIC_CONVEX_SITE_URL>/clerk-users-webhook
// and put its signing secret in the Convex env as CLERK_WEBHOOK_SECRET.
http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!env.CLERK_WEBHOOK_SECRET) {
      return new Response("Webhook not configured", { status: 503 });
    }
    const event = await validateRequest(request, env.CLERK_WEBHOOK_SECRET);
    if (event === null) {
      return new Response("Invalid webhook signature", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;
      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (clerkUserId) {
          await ctx.runMutation(internal.users.deleteFromClerk, {
            clerkUserId,
          });
        }
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request, secret: string): Promise<WebhookEvent | null> {
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return null;

  const payload = await req.text();
  const wh = new Webhook(secret);
  try {
    // svix 2.x: verify() throws on a bad signature and returns nothing.
    wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (error) {
    console.error("Clerk webhook verification failed", error);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { type?: unknown }).type !== "string" ||
    typeof (parsed as { data?: unknown }).data !== "object"
  ) {
    return null;
  }
  return parsed as WebhookEvent;
}

export default http;

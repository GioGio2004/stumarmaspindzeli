import { GoogleGenAI } from "@google/genai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env } from "./_generated/server";

const MODEL = "gemini-2.5-flash";

/**
 * Turn a manager's rough description into clean numbered playbook steps.
 * Runs in the default runtime (fetch only), so no "use node" needed.
 * Requires GEMINI_API_KEY in the Convex env; returns [] when it is unset.
 */
export const draftSteps = action({
  args: {
    hotelId: v.id("hotels"),
    title: v.string(),
    roughText: v.string(),
    language: v.optional(v.string()), // BCP-47, defaults to Georgian
  },
  returns: v.array(v.string()),
  handler: async (ctx, { hotelId, title, roughText, language }) => {
    // Throws unless the caller is a member of the hotel.
    await ctx.runQuery(internal.members.assertMember, { hotelId });
    if (!env.GEMINI_API_KEY) return [];
    if (title.length > 200 || roughText.length > 4000) throw new Error("Input too long");

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const lang = language && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(language) ? language : "ka";

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        `Task title: ${title}`,
        `Manager's rough notes: ${roughText}`,
      ].join("\n"),
      config: {
        systemInstruction: [
          "You write short step-by-step instructions for a hotel housekeeping",
          "or reception staff member who is new and has never done this task.",
          `Write in language "${lang}". One physical action per step.`,
          "Keep exact locations, item names and quantities from the notes.",
          "Between 2 and 10 steps. Return only JSON: an array of strings.",
        ].join(" "),
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: { type: "string" },
        },
        temperature: 0.3,
      },
    });

    const text = response.text ?? "[]";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Model returned invalid JSON");
    }
    if (!Array.isArray(parsed)) throw new Error("Model returned non-array");
    return parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
  },
});

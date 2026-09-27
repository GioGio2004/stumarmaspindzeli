import type { Metadata } from "next";
import { Deck } from "@/components/pitch/deck";

export const metadata: Metadata = { title: "პრეზენტაცია · Stumar Maspindzeli" };

// Full-screen presentation, outside the app shell. It is a scripted demo with
// no hotel data, so it needs no sign-in.
export default function PitchPage() {
  return <Deck />;
}

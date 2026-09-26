"use client";

import { RedirectToSignIn } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Dots } from "@/components/brand/glyphs";
import { AuthFrame } from "@/components/auth-frame";
import { ArrowButton, Field, Segmented, TextInput, useRun } from "@/components/kit";
import { api } from "@/convex/_generated/api";

export default function OnboardingPage() {
  return (
    <>
      <AuthLoading>{null}</AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>
        <AuthFrame title="Let's get your team" mark="started">
          <Onboarding />
        </AuthFrame>
      </Authenticated>
    </>
  );
}

function Onboarding() {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const createHotel = useMutation(api.hotels.create);
  const joinHotel = useMutation(api.hotels.join);
  const router = useRouter();
  const run = useRun();
  const me = useQuery(api.users.current);
  const memberships = useQuery(api.hotels.mine);
  const member = memberships !== undefined && memberships.length > 0;

  // Already on a team (an invite was accepted, or they came here by URL): go to work.
  useEffect(() => {
    if (member && !busy) router.replace("/dashboard");
  }, [member, busy, router]);

  if (me === undefined || me === null || memberships === undefined || (member && !busy)) {
    return <Dots className="size-8 animate-pulse" />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok =
      mode === "create"
        ? await run(() => createHotel({ name: name.trim() }), "Hotel created")
        : await run(() => joinHotel({ joinCode: code.trim().toUpperCase() }), "You joined the team");
    setBusy(false);
    if (ok) router.replace(mode === "create" ? "/dashboard" : "/queue");
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-[30px] bg-panel p-6 sm:p-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight">Welcome</h2>
        <p className="mt-1 text-[14px] text-black/55">Set up a new hotel, or join your team with the code your manager shared.</p>
      </div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: "create", label: "New hotel" },
          { value: "join", label: "Join a team" },
        ]}
      />
      {mode === "create" ? (
        <Field label="Hotel name" hint="You'll be its manager. Departments are created for you.">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Gino Seaside Tbilisi" required maxLength={80} />
        </Field>
      ) : (
        <Field label="Join code" hint="Six letters and numbers, from your manager.">
          <TextInput
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="2N3XEY"
            required
            maxLength={6}
            className="font-mono uppercase tracking-[0.3em]"
          />
        </Field>
      )}
      <ArrowButton type="submit" className="w-full" disabled={busy || (mode === "create" ? !name.trim() : code.trim().length < 6)}>
        {mode === "create" ? "Create hotel" : "Join team"}
      </ArrowButton>
    </form>
  );
}

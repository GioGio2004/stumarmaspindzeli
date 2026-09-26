"use client";

import { useMutation } from "convex/react";
import { ExternalLink } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useActiveHotel } from "@/components/hotel-context";
import { ArrowButton, Card, Field, PageHeader, Select, TextInput, buttonClass, useRun } from "@/components/kit";
import { RoleGate } from "@/components/role-gate";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const GUEST_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ka", label: "ქართული" },
  { value: "ru", label: "Русский" },
  { value: "tr", label: "Türkçe" },
  { value: "he", label: "עברית" },
  { value: "ar", label: "العربية" },
];

export default function SettingsPage() {
  return (
    <RoleGate allow={["manager"]}>
      <Settings />
    </RoleGate>
  );
}

function Settings() {
  const { hotelId, hotel } = useActiveHotel();
  const update = useMutation(api.hotels.update);
  const run = useRun();
  const [name, setName] = useState(hotel.name);
  const [brandName, setBrandName] = useState(hotel.brandName ?? "");
  const [collection, setCollection] = useState(hotel.collection ?? "");
  const [address, setAddress] = useState(hotel.address ?? "");
  const [phone, setPhone] = useState(hotel.phone ?? "");
  const [checkoutTime, setCheckoutTime] = useState(hotel.checkoutTime ?? "12:00");
  const [wifiName, setWifiName] = useState(hotel.wifiName ?? "");
  const [wifiPassword, setWifiPassword] = useState(hotel.wifiPassword ?? "");
  const [defaultLanguage, setDefaultLanguage] = useState(hotel.defaultLanguage);
  const [languages, setLanguages] = useState<string[]>(hotel.guestLanguages ?? ["en", "ka", "ru"]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(
      () =>
        update({
          hotelId,
          name: name.trim(),
          brandName: brandName.trim() || undefined,
          collection: collection.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          checkoutTime,
          wifiName: wifiName.trim() || undefined,
          wifiPassword: wifiPassword.trim() || undefined,
          defaultLanguage,
          guestLanguages: languages,
        }),
      "Settings saved",
    );
  };

  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL;

  return (
    <>
      <PageHeader eyebrow="Your hotel" title="Settings" description="What guests see in their app, and how your hotel appears to the team." />
      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 rounded-[30px] bg-panel p-3 sm:p-4">
          <Card className="space-y-4">
            <p className="text-[15px] font-medium">Identity</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hotel name">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
              </Field>
              <Field label="Brand shown to guests" hint="Short, like GINO">
                <TextInput value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={24} />
              </Field>
              <Field label="Collection or tagline" hint="Optional">
                <TextInput value={collection} onChange={(e) => setCollection(e.target.value)} maxLength={80} />
              </Field>
              <Field label="Phone">
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              </Field>
            </div>
            <Field label="Address">
              <TextInput value={address} onChange={(e) => setAddress(e.target.value)} maxLength={140} />
            </Field>
          </Card>
          <Card className="space-y-4" delay={0.05}>
            <p className="text-[15px] font-medium">Guest stay</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Check-out time">
                <TextInput type="time" value={checkoutTime} onChange={(e) => setCheckoutTime(e.target.value)} />
              </Field>
              <Field label="Wi-Fi network">
                <TextInput value={wifiName} onChange={(e) => setWifiName(e.target.value)} maxLength={60} />
              </Field>
              <Field label="Wi-Fi password" hint="Only shown to checked-in guests">
                <TextInput value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} maxLength={60} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="Staff language">
                <Select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
                  <option value="ka">ქართული</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <div>
                <span className="mb-1.5 block text-[13px] font-medium">Guest languages</span>
                <div className="flex flex-wrap gap-2">
                  {GUEST_LANGUAGES.map((l) => {
                    const on = languages.includes(l.value);
                    return (
                      <button
                        key={l.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setLanguages((list) => (on ? list.filter((x) => x !== l.value) : [...list, l.value]))}
                        className={cn("h-10 rounded-full px-4 text-[14px] transition-colors", on ? "bg-ink text-white" : "bg-panel text-black/65 hover:bg-panel-hover")}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
          <ArrowButton type="submit" className="w-full sm:w-auto">
            Save settings
          </ArrowButton>
        </div>
        <div className="space-y-4">
          <Card tone="dark">
            <p className="text-[13px] text-white/60">Guest app</p>
            <p className="mt-1 text-[15px]">Room tags open your storefront. Open it to see what guests see.</p>
            {storefront && (
              <a href={storefront} target="_blank" rel="noopener noreferrer" className={cn(buttonClass("lime", "md"), "mt-5")}>
                <ExternalLink className="size-4" />
                Open storefront
              </a>
            )}
          </Card>
        </div>
      </form>
    </>
  );
}

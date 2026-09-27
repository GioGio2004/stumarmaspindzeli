"use client";

import { animate, motion } from "motion/react";
import { Check, Languages, Nfc, Radio, Route, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { SlideProps } from "./deck";
import { C, Eyebrow, Headline, Rise, Word, Words, ease } from "./slides";

// The Pitch Canvas slides around the demo: market pain, what's unique,
// traction, business model, team and the ask.

// ---- numbers ---------------------------------------------------------------------------
// Market facts: Geostat 2025 (via Georgia Today). Pricing and payback are our
// proposal. Confirm them before presenting.
export const FACTS = {
  hotels: 2783,
  rooms: 54300,
  employees: 29101,
  source: "საქსტატი, 2025",
  pricePerRoom: 5, // ₾ per room per month
  exampleRooms: 20,
  exampleOrder: 35, // ₾, one room-service order in the demo
} as const;

const roomsPerHotel = Math.round(FACTS.rooms / FACTS.hotels);
const staffPerHotel = Math.round(FACTS.employees / FACTS.hotels);
const yearlyTam = FACTS.rooms * FACTS.pricePerRoom * 12;
const exampleMonthly = FACTS.exampleRooms * FACTS.pricePerRoom;
const ordersToPayBack = Math.ceil(exampleMonthly / FACTS.exampleOrder);
// The lari sign follows the number, as in the guest app ("35₾").
const gel = (n: number) => `${Math.round(n).toLocaleString("en-US")}₾`;
const millions = (n: number) => (n / 1_000_000).toFixed(1);

// ---- shared pieces -----------------------------------------------------------------------

function CountUp({ to, delay = 0, format = (n: number) => Math.round(n).toLocaleString("en-US") }: { to: number; delay?: number; format?: (n: number) => string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, to, { duration: 1.4, delay, ease, onUpdate: setValue });
    return () => controls.stop();
  }, [to, delay]);
  return <>{format(value)}</>;
}

function Card({ children, delay = 0, show = true, className, style }: { children: ReactNode; delay?: number; show?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={{ background: C.card, ...style }}
      initial={{ opacity: 0, y: 36 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
      transition={{ delay: show ? delay : 0, duration: 0.65, ease }}
    >
      {children}
    </motion.div>
  );
}

function IconDot({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-24 shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: "#111110" }}>
      <Icon className="size-11" />
    </span>
  );
}

function CheckDot() {
  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-full" style={{ background: C.lime, color: "#111110" }}>
      <Check className="size-7" />
    </span>
  );
}

function Header({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Headline>{children}</Headline>
    </div>
  );
}

// ---- pain, in numbers ----------------------------------------------------------------------

export function MarketSlide({ step }: SlideProps) {
  const stats = [
    { value: FACTS.hotels, label: "სასტუმრო საქართველოში" },
    { value: roomsPerHotel, label: "ოთახი ერთ სასტუმროში", prefix: "~" },
    { value: staffPerHotel, label: "თანამშრომელი ერთ სასტუმროში", prefix: "~" },
  ];
  const pains = ["პერსონალის მართვა", "სტუმრის გამოცდილება", "კადრების ნაკლებობა"];
  return (
    <div className="absolute inset-0 px-[140px] pt-[96px]">
      <Header eyebrow="პრობლემა ციფრებში">
        <Words text="სასტუმროები უმეტესად პატარაა." delay={0.1} />
        <br />
        <Words text="პერსონალი გადატვირთულია." delay={0.35} />
      </Header>
      <div className="mt-16 grid grid-cols-3 gap-8">
        {stats.map((s, i) => (
          <Card key={s.label} delay={0.5 + i * 0.1} className="rounded-[36px] p-10">
            <p className="text-[140px] font-medium leading-none tracking-[-0.04em] tabular-nums">
              {s.prefix}
              <CountUp to={s.value} delay={0.6 + i * 0.1} />
            </p>
            <p className="mt-5 text-[44px] leading-tight">{s.label}</p>
          </Card>
        ))}
      </div>
      <Rise show={step >= 1} delay={0.1} className="mt-12 flex flex-wrap items-center gap-5">
        <span className="mr-2 text-[44px]">მთავარი პრობლემები:</span>
        {pains.map((p) => (
          <span key={p} className="rounded-full px-8 py-3 text-[40px] font-medium" style={{ background: C.graphite }}>
            {p}
          </span>
        ))}
      </Rise>
      <p className="absolute bottom-10 left-[140px] text-[26px]">წყაროები: {FACTS.source} · SmartStay 3.0-ის კვლევა</p>
    </div>
  );
}

// ---- what's unique -------------------------------------------------------------------------

const PILLARS: { icon: LucideIcon; title: string }[] = [
  { icon: Nfc, title: "არც აპლიკაცია, არც რეგისტრაცია" },
  { icon: Route, title: "მოთხოვნას მხოლოდ საჭირო გუნდი იღებს" },
  { icon: Languages, title: "სტუმარი ინგლისურად, პერსონალი ქართულად" },
  { icon: Radio, title: "რეალურ დროში: სტუმარი, პერსონალი, მენეჯერი" },
];

export function UniqueSlide() {
  return (
    <div className="absolute inset-0 px-[140px] pt-[96px]">
      <Header eyebrow="რით გამოვირჩევით">
        <Words text="სასტუმროს ორივე მხარე," delay={0.1} />
        <br />
        <Words text="ერთ სისტემაში, რეალურ დროში." delay={0.3} />
      </Header>
      <div className="mt-16 grid grid-cols-2 gap-8">
        {PILLARS.map((p, i) => (
          <Card key={p.title} delay={0.5 + i * 0.12} className="flex items-center gap-8 rounded-[36px] p-10">
            <IconDot icon={p.icon} />
            <p className="text-balance text-[46px] font-medium leading-tight tracking-[-0.02em]">{p.title}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- traction -----------------------------------------------------------------------------

const GINO = ["Gino Seaside Tbilisi", "GINO Paradise", "Gino Wellness Mtskheta", "Gino Wellness Rabati"];

export function TractionSlide() {
  const done = [
    { big: "36", text: "საათი — იდეიდან მომუშავე პროდუქტამდე" },
    { big: "3", text: "აპლიკაცია: სტუმრის, პერსონალის და მენეჯერის" },
    { big: "9", text: "სერვისი სტუმრისთვის, სასტუმროს 5 გუნდი" },
  ];
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_700px] gap-16 px-[140px] pt-[96px]">
      <div>
        <Header eyebrow="პროგრესი">
          <Words text="36 საათში შევქმენით." delay={0.1} />
          <br />
          <Words text="უკვე მუშაობს." delay={0.3} />
        </Header>
        <div className="mt-14 space-y-8">
          {done.map((d, i) => (
            <Rise key={d.text} delay={0.5 + i * 0.12} className="flex items-center gap-8">
              <span className="w-[210px] shrink-0 text-[110px] font-medium leading-none tracking-[-0.04em]">{d.big}</span>
              <span className="text-[40px] leading-tight">{d.text}</span>
            </Rise>
          ))}
        </div>
      </div>
      <Card delay={0.6} className="self-center overflow-hidden rounded-[40px]">
        <div className="relative h-[280px]">
          <Image src="/pitch/water-park.webp" alt="" fill unoptimized sizes="700px" className="object-cover" />
          <span className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.1), rgba(26,26,24,1))" }} />
          <span className="absolute bottom-5 left-10 inline-flex items-center gap-3 rounded-full bg-[#111110]/85 px-6 py-2.5 text-[28px] font-medium">
            <span className="size-3.5 rounded-full" style={{ background: C.lime }} />
            მოლაპარაკება პირველ პილოტზე
          </span>
        </div>
        <div className="p-10 pt-6">
          <p className="text-[52px] font-medium tracking-[-0.03em]">Gino-ს სასტუმროები</p>
          <ul className="mt-6 space-y-5">
            {GINO.map((name) => (
              <li key={name} className="flex items-center gap-5 text-[36px]">
                <CheckDot />
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}

// ---- business model --------------------------------------------------------------------

export function BusinessSlide({ step }: SlideProps) {
  const cards: { big: ReactNode; text: string; show: boolean; lime?: boolean }[] = [
    { big: gel(exampleMonthly), text: `თვეში, ${FACTS.exampleRooms}-ოთახიანი სასტუმროსთვის`, show: true },
    { big: String(ordersToPayBack), text: "შეკვეთა ოთახში — და თვის ხარჯი დაფარულია", show: true, lime: true },
    {
      // "მლნ ₾" is set smaller so the number still fits its card at 140px.
      big: (
        <>
          {millions(yearlyTam)}
          <span className="ml-3 text-[64px] tracking-[-0.02em]">მლნ ₾</span>
        </>
      ),
      text: "წელიწადში, საქართველოს ყველა სასტუმროში",
      show: step >= 1,
    },
  ];
  return (
    <div className="absolute inset-0 px-[140px] pt-[96px]">
      <Header eyebrow="ბიზნესმოდელი">
        <Word delay={0.1}>{FACTS.pricePerRoom}</Word> <Words text="ლარი ოთახზე, თვეში." delay={0.18} />
      </Header>
      <div className="mt-16 grid grid-cols-3 gap-8">
        {cards.map((c, i) => (
          <Card
            key={c.text}
            delay={0.4 + i * 0.15}
            show={c.show}
            className="rounded-[36px] p-10"
            style={c.lime ? { boxShadow: `inset 0 0 0 4px ${C.lime}` } : undefined}
          >
            <p className="text-[140px] font-medium leading-none tracking-[-0.04em]">{c.big}</p>
            <p className="mt-6 text-balance text-[44px] leading-tight">{c.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- team ----------------------------------------------------------------------------------

// Add teammates here.
const TEAM: { name: string; role: string }[] = [{ name: "გიორგი ხვიჩია", role: "დამფუძნებელი · პროდუქტი და დეველოპმენტი" }];

export function TeamSlide() {
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_1fr] items-center gap-20 px-[140px]">
      <div>
        <Header eyebrow="გუნდი">
          <Words text="რატომ ჩვენ?" delay={0.1} />
        </Header>
        <Rise delay={0.5} className="mt-10 space-y-2 text-[48px] leading-snug">
          <p>სტუმართმოყვარეობა ჩვენი კულტურაა.</p>
          <p className="text-balance">ჩვენი დახმარებით პატარა გუნდიც დიდივით მასპინძლობს.</p>
        </Rise>
      </div>
      <div className="space-y-6">
        {TEAM.map((m, i) => (
          <Card key={m.name} delay={0.4 + i * 0.12} className="flex items-center gap-8 rounded-[40px] p-10">
            <span
              className="grid size-32 shrink-0 place-items-center rounded-full text-[48px] font-semibold"
              style={{ background: C.graphite, boxShadow: `inset 0 0 0 4px ${C.lime}` }}
            >
              {m.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </span>
            <span>
              <span className="block text-[52px] font-medium leading-tight tracking-[-0.03em]">{m.name}</span>
              <span className="mt-2 block text-[34px]">{m.role}</span>
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- the ask + call to action ---------------------------------------------------------------

const USE_OF_FUNDS = ["NFC ტეგი 215-ვე ოთახში", "პერსონალის ტრენინგი ქართულად", "PMS-თან ინტეგრაცია"];

export function AskSlide({ step }: SlideProps) {
  return (
    <div className="absolute inset-0 grid grid-cols-[1fr_620px] gap-20 px-[140px] pt-[96px]">
      <div>
        <Header eyebrow="რას ვითხოვთ">
          <Words text="მხარი დაუჭირეთ Gino-ს პილოტს." delay={0.1} />
        </Header>
        <Rise delay={0.45} className="mt-10 text-[44px] leading-snug">
          3 თვე Gino Seaside Tbilisi-ში:
        </Rise>
        <div className="mt-10 space-y-6">
          {USE_OF_FUNDS.map((u, i) => (
            <Rise key={u} delay={0.6 + i * 0.1} className="flex items-center gap-6 text-[44px]">
              <CheckDot />
              {u}
            </Rise>
          ))}
        </div>
      </div>
      <Card delay={0.2} show={step >= 1} className="self-center rounded-[44px] p-10 text-center">
        <p className="inline-block -rotate-2 font-script text-[64px] leading-none">სცადეთ ახლავე</p>
        <div className="mx-auto mt-8 w-[380px] rounded-[28px] bg-white p-5">
          <Image src="/pitch/qr.svg" alt="QR კოდი: stumar-maspindzeli-storefront.vercel.app" width={300} height={300} unoptimized className="h-auto w-full" />
        </div>
        <p className="mt-8 text-[26px]">stumar-maspindzeli-storefront.vercel.app</p>
      </Card>
    </div>
  );
}

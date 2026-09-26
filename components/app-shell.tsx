"use client";

import { UserButton } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import {
  BedDouble,
  BookOpen,
  CalendarClock,
  ChevronDown,
  DoorOpen,
  Globe2,
  Inbox,
  LayoutGrid,
  ListChecks,
  Menu,
  Settings,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { roleLabel, type Role } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Dots } from "./brand/glyphs";
import { useHotel } from "./hotel-context";
import { Sheet, Toggle, useRun } from "./kit";
import { ThemeSwitch } from "./theme";

type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[]; supervisorOnly?: boolean };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, roles: ["manager", "reception"] },
  { href: "/requests", label: "Requests", icon: Inbox, roles: ["manager", "reception", "staff"] },
  { href: "/stays", label: "Front desk", icon: DoorOpen, roles: ["manager", "reception"] },
  { href: "/queue", label: "My queue", icon: ListChecks, roles: ["manager", "reception", "staff"] },
  { href: "/storefront", label: "Guest app", icon: Smartphone, roles: ["manager"] },
  { href: "/catalog", label: "Catalog", icon: BookOpen, roles: ["manager"] },
  { href: "/routines", label: "Routines", icon: CalendarClock, roles: ["manager"] },
  { href: "/rooms", label: "Rooms", icon: BedDouble, roles: ["manager", "reception"] },
  { href: "/team", label: "Team", icon: Users, roles: ["manager"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["manager"] },
  { href: "/platform", label: "All hotels", icon: Globe2, roles: ["manager"], supervisorOnly: true },
];

export function navFor(role: Role, supervisor = false) {
  return NAV.filter((item) => item.roles.includes(role) && (!item.supervisorOnly || supervisor));
}

export function homeFor(role: Role) {
  return role === "staff" ? "/queue" : "/dashboard";
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Sidebar: an icon rail from lg, the full panel from xl. The nav scrolls on its
// own so short screens never clip the shift / theme / account cards.
export function AppShell({ children }: { children: ReactNode }) {
  const { current, role } = useHotel();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!current || !role) return null;

  const items = navFor(role, Boolean(current.supervisor));
  const primary = items.slice(0, 4);
  const overflow = items.slice(4);
  const roleName = current.supervisor ? "Supervisor" : roleLabel[role];

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[100px] p-3 lg:block xl:w-[264px] xl:p-4">
        <div className="flex h-full min-h-0 flex-col rounded-[30px] bg-panel p-2.5 xl:p-3">
          <Link
            href={homeFor(role)}
            aria-label="Stumar home"
            className="flex shrink-0 items-center justify-center gap-2.5 py-3 xl:justify-start xl:px-3"
          >
            <Dots className="size-6" />
            <span className="hidden text-xl font-bold tracking-tight xl:inline">Stumar</span>
          </Link>
          <div className="shrink-0">
            <HotelSwitcher compactBelowXl />
          </div>

          <nav
            aria-label="Main"
            className="-mx-1 mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-1 py-1 [scrollbar-width:thin]"
          >
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center justify-center gap-3 rounded-full py-2.5 text-[15px] xl:justify-start xl:px-4",
                    "[@media(max-height:820px)]:py-2",
                    !active && "hover:bg-panel-hover",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-full bg-ink"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <Icon className={cn("relative size-[18px] shrink-0", active ? "text-on-ink-accent" : "text-black/60")} />
                  <span className={cn("relative sr-only truncate xl:not-sr-only", active ? "text-white" : "text-black/75")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 shrink-0 space-y-2">
            <div className="hidden xl:block">
              <ThemeSwitch />
            </div>
            <div className="flex justify-center xl:hidden">
              <ThemeSwitch compact />
            </div>
            <ShiftCard compactBelowXl />
            <div className="flex items-center justify-center gap-3 rounded-[22px] bg-white px-3 py-2.5 xl:justify-start">
              <UserButton />
              <div className="hidden min-w-0 xl:block">
                <p className="truncate text-[13px] font-medium">{roleName}</p>
                <p className="truncate text-[12px] text-black/45">{current.hotel.name}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* phone / tablet top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <Link href={homeFor(role)} className="flex min-w-0 items-center gap-2">
          <Dots className="size-5 shrink-0" />
          <span className="truncate text-[15px] font-semibold">{current.hotel.name}</span>
        </Link>
        <UserButton />
      </header>

      <main className="px-3 pb-32 pt-2 sm:px-6 lg:pb-12 lg:pl-[124px] lg:pr-8 lg:pt-8 xl:pl-[296px]">
        {/* keyed by hotel: switching hotels starts every page fresh, no stale forms or ids */}
        <div key={current.hotel._id} className="mx-auto max-w-[1240px]">
          {children}
        </div>
      </main>

      {/* phone / tablet bottom bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ink p-1.5 shadow-2xl">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="relative grid h-12 w-14 shrink-0 place-items-center rounded-full"
              >
                {active && (
                  <motion.span
                    layoutId="bottom-active"
                    className="absolute inset-0 rounded-full bg-lime"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <Icon className={cn("relative size-5", active ? "text-black" : "text-white/70")} />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
            className={cn(
              "relative grid h-12 w-14 shrink-0 place-items-center rounded-full",
              overflow.some((i) => isActive(pathname, i.href)) ? "bg-lime text-black" : "text-white/70",
            )}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" width="max-w-md">
        <div className="space-y-3 pb-2">
          <HotelSwitcher onPicked={() => setMenuOpen(false)} />
          {overflow.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {overflow.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex flex-col gap-5 rounded-[22px] p-4 transition",
                      active ? "bg-ink text-white" : "bg-panel hover:bg-panel-hover",
                    )}
                  >
                    <Icon className={cn("size-5", active && "text-lime")} />
                    <span className="text-[15px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
          <ShiftCard />
          <ThemeSwitch />
        </div>
      </Sheet>
    </div>
  );
}

function HotelSwitcher({ compactBelowXl = false, onPicked }: { compactBelowXl?: boolean; onPicked?: () => void }) {
  const { memberships, current, setHotelId } = useHotel();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!current) return null;
  const many = memberships.length > 1;

  const pick = (m: (typeof memberships)[number]) => {
    setOpen(false);
    onPicked?.();
    if (m.hotel._id === current.hotel._id) return;
    setHotelId(m.hotel._id);
    // Detail pages (a task id) belong to the old hotel, and the new role may not see this page.
    const allowed = navFor(m.role as Role, Boolean(m.supervisor)).some((i) => pathname === i.href);
    if (!allowed) router.push(homeFor(m.role as Role));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={!many}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={current.hotel.name}
        className={cn(
          "flex w-full items-center gap-3 rounded-[22px] bg-white px-3 py-2.5 text-left",
          compactBelowXl && "justify-center px-0 xl:justify-start xl:px-3",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime text-[13px] font-bold">
          {current.hotel.name.slice(0, 1)}
        </span>
        <span className={cn("min-w-0 flex-1", compactBelowXl && "hidden xl:block")}>
          <span className="block truncate text-[14px] font-medium">{current.hotel.name}</span>
          <span className="block text-[12px] text-black/45">
            {current.supervisor ? "Supervisor" : roleLabel[current.role as Role]}
          </span>
        </span>
        {many && (
          <ChevronDown
            className={cn("size-4 shrink-0 text-black/50 transition-transform", open && "rotate-180", compactBelowXl && "hidden xl:block")}
          />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className={cn(
              "absolute z-40 mt-1.5 max-h-[60vh] space-y-1 overflow-y-auto rounded-[22px] bg-white p-1.5 shadow-xl ring-1 ring-black/5",
              compactBelowXl ? "left-0 top-full w-64 xl:inset-x-0 xl:w-auto" : "inset-x-0 top-full",
            )}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            {memberships.map((m) => (
              <li key={m.hotel._id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className={cn(
                    "w-full rounded-2xl px-3 py-2 text-left text-[14px] transition hover:bg-panel",
                    m.hotel._id === current.hotel._id && "bg-panel font-medium",
                  )}
                >
                  {m.hotel.name}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShiftCard({ compactBelowXl = false }: { compactBelowXl?: boolean }) {
  const { current } = useHotel();
  const setOnShift = useMutation(api.members.setOnShift);
  const run = useRun();
  if (!current) return null;
  const toggle = (
    <Toggle
      label={current.onShift ? "On shift" : "Off shift"}
      checked={current.onShift}
      onChange={(onShift) =>
        run(() => setOnShift({ hotelId: current.hotel._id, onShift }), onShift ? "You're on shift" : "Shift ended")
      }
    />
  );
  return (
    <div
      title={current.onShift ? "On shift" : "Off shift"}
      className={cn(
        "flex items-center justify-between gap-3 rounded-[22px] bg-white px-4 py-3",
        compactBelowXl && "justify-center px-2 xl:justify-between xl:px-4",
      )}
    >
      <div className={cn(compactBelowXl && "hidden xl:block")}>
        <p className="text-[14px] font-medium">{current.onShift ? "On shift" : "Off shift"}</p>
        <p className="text-[12px] text-black/45">{current.onShift ? "You get new tasks" : "No notifications"}</p>
      </div>
      {toggle}
    </div>
  );
}

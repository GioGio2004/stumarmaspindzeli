"use client";

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { Clover, Ring, Star4 } from "./brand/glyphs";

// Shared admin UI in the storefront's Tabela language: stone panels, white
// cards, ink pills, lime as the single accent, soft spring motion everywhere.

export const ease = [0.22, 1, 0.36, 1] as const;
export const spring = { type: "spring", bounce: 0.14, duration: 0.55 } as const;

// ---- layout ------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const words = title.split(" ");
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <motion.p
            className="mb-1 inline-block -rotate-1 font-script text-2xl text-black/60"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            {eyebrow}
          </motion.p>
        )}
        <h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          {words.map((word, i) => (
            <span key={`${word}-${i}`}>
              <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ delay: 0.04 + i * 0.05, duration: 0.7, ease }}
                >
                  {word}
                </motion.span>
              </span>
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>
        {description && (
          <motion.p
            className="mt-2 max-w-2xl text-[15px] leading-relaxed text-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            {description}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div
          className="flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease }}
        >
          {actions}
        </motion.div>
      )}
    </header>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-[30px] bg-panel p-3 sm:p-5", className)}>{children}</section>;
}

export function Card({
  className,
  children,
  tone = "light",
  delay = 0,
}: {
  className?: string;
  children: ReactNode;
  tone?: "light" | "dark" | "lime";
  delay?: number;
}) {
  return (
    <motion.div
      className={cn(
        "rounded-[24px] p-5",
        tone === "dark" && "bg-graphite text-white",
        tone === "light" && "bg-white",
        tone === "lime" && "bg-lime text-black",
        className,
      )}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease }}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-wider text-black/50">
        <Star4 className="size-3" />
        {children}
      </h2>
      {action}
    </div>
  );
}

// ---- numbers -----------------------------------------------------------------

export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = value.toFixed(decimals);
      previous.current = value;
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.9,
      ease,
      onUpdate: (v) => {
        node.textContent = v.toFixed(decimals);
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, decimals, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toFixed(decimals)}
    </span>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  hint,
  tone = "light",
  icon,
  delay = 0,
  decimals = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint?: ReactNode;
  tone?: "light" | "dark" | "lime";
  icon?: ReactNode;
  delay?: number;
  decimals?: number;
}) {
  return (
    <Card tone={tone} delay={delay} className="flex min-h-[148px] flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[13px]", tone === "dark" ? "text-white/60" : "text-black/55")}>{label}</p>
        {icon && (
          <span
            className={cn(
              "grid size-9 place-items-center rounded-full",
              tone === "dark" ? "bg-white/10" : tone === "lime" ? "bg-black/10" : "bg-panel",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div>
        <p className="text-4xl font-medium tracking-tight">
          <AnimatedNumber value={value} decimals={decimals} />
          {suffix && <span className="ml-1 text-lg">{suffix}</span>}
        </p>
        {hint && <p className={cn("mt-1 text-[12px]", tone === "dark" ? "text-white/50" : "text-black/45")}>{hint}</p>}
      </div>
    </Card>
  );
}

// ---- pills & buttons -----------------------------------------------------------

type PillTone = "lime" | "ink" | "stone" | "white" | "danger" | "success" | "outline";

export function Pill({ tone = "stone", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium",
        tone === "lime" && "bg-lime text-black",
        tone === "ink" && "bg-ink text-white",
        tone === "stone" && "bg-panel text-black/70",
        tone === "white" && "bg-white text-black/70",
        tone === "danger" && "bg-red-50 text-red-700",
        tone === "success" && "bg-emerald-50 text-emerald-700",
        tone === "outline" && "ring-1 ring-black/15 text-black/70",
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "lime" | "ghost" | "outline" | "danger" | "white";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium outline-none transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink",
    size === "sm" && "h-9 px-3.5 text-[13px]",
    size === "md" && "h-11 px-5 text-[14px]",
    size === "lg" && "h-12 px-6 text-[15px]",
    variant === "primary" && "bg-ink text-white hover:bg-black",
    variant === "lime" && "bg-lime text-black hover:brightness-95",
    variant === "ghost" && "bg-panel text-black hover:bg-panel-hover",
    variant === "outline" && "ring-1 ring-black/15 hover:bg-panel",
    variant === "white" && "bg-white text-black hover:bg-paper",
    variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

/** The storefront's signature action: ink pill with a lime arrow circle. */
export function ArrowButton({
  children,
  className,
  tone = "ink",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ink" | "lime" }) {
  return (
    <button
      type="button"
      className={cn(
        "group inline-flex h-12 items-center justify-between gap-3 rounded-full pl-5 pr-1.5 text-[15px] font-medium transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45",
        tone === "ink" ? "bg-ink text-white" : "bg-lime text-black",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full transition-transform group-enabled:group-hover:translate-x-0.5",
          tone === "ink" ? "bg-lime text-black" : "bg-ink text-white",
        )}
      >
        <ArrowRight className="size-4" />
      </span>
    </button>
  );
}

// ---- form fields ---------------------------------------------------------------

const fieldBase =
  "w-full rounded-2xl bg-paper px-4 text-[15px] outline-none ring-1 ring-black/[0.06] transition placeholder:text-black/35 focus:bg-white focus:ring-2 focus:ring-ink disabled:opacity-50";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-black/45">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-12", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-12 appearance-none bg-[length:16px] pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50",
        checked ? "bg-ink" : "bg-black/15",
      )}
    >
      <motion.span
        className={cn("block size-6 rounded-full shadow-sm", checked ? "bg-lime" : "bg-white")}
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div className="no-scrollbar inline-flex max-w-full overflow-x-auto rounded-full bg-white p-1 ring-1 ring-black/5" role="tablist">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 rounded-full font-medium whitespace-nowrap",
              size === "md" ? "px-4 py-2 text-[14px]" : "px-3 py-1.5 text-[13px]",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            )}
            <span className={cn("relative flex items-center gap-1.5", on ? "text-white" : "text-black/60")}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---- feedback ----------------------------------------------------------------

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div
      className="flex flex-col items-center rounded-[24px] bg-white px-6 py-12 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <div className="flex gap-1.5">
        <Star4 className="size-7 text-ink" />
        <Clover className="size-7 text-panel" />
        <Ring className="size-7 text-panel" />
      </div>
      <p className="mt-4 text-lg font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[14px] text-black/55">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[24px] bg-white/70", className)} />;
}

export function Avatar({ name, imageUrl, size = 36 }: { name: string; imageUrl?: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-lime text-[12px] font-medium text-black"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

// ---- sheet (modal that can morph out of the element that opened it) ------------

export function Sheet({
  open,
  onClose,
  title,
  description,
  layoutId,
  width = "max-w-2xl",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  layoutId?: string;
  width?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 30);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-6">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-scrim backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            layoutId={layoutId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{ borderRadius: 30 }}
            className={cn("relative flex max-h-full w-full flex-col overflow-hidden bg-white shadow-2xl", width)}
            initial={layoutId ? undefined : { opacity: 0, y: 40, scale: 0.98 }}
            animate={layoutId ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={layoutId ? undefined : { opacity: 0, y: 30, scale: 0.98 }}
            transition={spring}
          >
            <div className="flex items-start gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-2xl font-medium tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-1 text-[14px] text-black/55">{description}</p>}
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-panel transition hover:bg-ink hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
            <motion.div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-7"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.12, duration: 0.35, ease } }}
            >
              {children}
            </motion.div>
            {footer && <div className="border-t border-black/5 px-5 py-4 sm:px-7">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ---- toasts --------------------------------------------------------------------

type Toast = { id: number; text: string; tone: "success" | "error" };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    counter.current += 1;
    const id = counter.current;
    setToasts((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-3 lg:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-2 pr-5 text-[14px] shadow-2xl",
                toast.tone === "success" ? "bg-ink text-white" : "bg-red-600 text-white",
              )}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={spring}
            >
              <span className={cn("grid size-7 place-items-center rounded-full", toast.tone === "success" ? "bg-lime text-black" : "bg-white/20")}>
                {toast.tone === "success" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              </span>
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/** Runs a Convex call and reports failures as a toast instead of throwing. */
export function useRun() {
  const toast = useToast();
  return useCallback(
    async <T,>(run: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await run();
        if (success) toast(success);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "Something went wrong";
        toast(message, "error");
        return undefined;
      }
    },
    [toast],
  );
}

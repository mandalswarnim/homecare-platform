import { BRAND } from "@/lib/theme";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M16 8.5 8.5 14.6V23a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-8.4z" fill="none" stroke="var(--brand-ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 15.2v5.6M13.2 18h5.6" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BrandName({ sub = "Console" }: { sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-ink">{BRAND}</span>
        <span className="block text-[11px] tracking-wide text-muted uppercase">{sub}</span>
      </span>
    </span>
  );
}

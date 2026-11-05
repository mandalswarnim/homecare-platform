import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold text-ink">Page not found</h1>
      <p className="text-sm text-muted">That address doesn&apos;t match anything in the console.</p>
      <Link href="/" className="text-sm font-medium text-brand hover:underline">
        Go to the overview
      </Link>
    </div>
  );
}

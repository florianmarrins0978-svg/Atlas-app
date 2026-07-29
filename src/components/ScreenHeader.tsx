import Link from "next/link";

export default function ScreenHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-4 backdrop-blur">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Retour"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : null}
      <h1 className="flex-1 font-display text-2xl font-bold tracking-tight text-ink">
        {title}
      </h1>
      {action}
    </header>
  );
}

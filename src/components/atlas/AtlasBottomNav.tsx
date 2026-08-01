"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/design-tokens";

const tabs = [
  { href: "/", label: "Chantiers", icon: "home" as const },
  { href: "/planning", label: "Planning", icon: "calendar" as const },
  { href: "/termines", label: "Terminés", icon: "check" as const },
  { href: "/reglages", label: "Tarifs", icon: "tag" as const },
];

export default function AtlasBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="atlas-nav-basse fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-around border-t pt-3 backdrop-blur"
      style={{ borderColor: colors.line, backgroundColor: `${colors.cream}F2` }}
      aria-label="Navigation principale"
    >
      {tabs.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className="flex flex-col items-center gap-1.5">
            <NavIcon icon={t.icon} active={active} />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: active ? colors.rust : colors.muted }}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ icon, active }: { icon: "home" | "calendar" | "check" | "tag"; active: boolean }) {
  const color = active ? colors.rust : colors.muted;
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8 };
  if (icon === "check")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (icon === "calendar")
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 10h16M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    );
  if (icon === "tag")
    return (
      <svg {...common}>
        <path d="M12 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-.29.71l-9 9a1 1 0 0 1-1.42 0l-6-6a1 1 0 0 1 0-1.42l9-9A1 1 0 0 1 12 3Z" />
        <circle cx="16.5" cy="7.5" r="1" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

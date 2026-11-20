/**
 * Next.js, sans Next.js : ce dont les écrans ont besoin pour se dessiner dans
 * une page publiée. Un lien vers un écran que la démonstration connaît y
 * mène (routeur.tsx) ; un lien vers un autre écran ne quitte pas la
 * démonstration. Le site la montre en films (appli/scripts/film-outils.cjs),
 * et aucun film ne touche un tel lien.
 */
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";
import { cheminCourant, connait, naviguer } from "./routeur";

function aller(cible: string) {
  if (connait(cible)) naviguer(cible);
}

export default function Link({ href, children, ...reste }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string }; children?: ReactNode; prefetch?: boolean; replace?: boolean; scroll?: boolean }) {
  delete (reste as Record<string, unknown>).prefetch;
  delete (reste as Record<string, unknown>).replace;
  delete (reste as Record<string, unknown>).scroll;
  const cible = typeof href === "string" ? href : href.pathname ?? "#";
  return (
    <a
      {...reste}
      href={cible}
      onClick={(e) => {
        e.preventDefault();
        reste.onClick?.(e);
        aller(cible);
      }}
    >
      {children}
    </a>
  );
}

export function Image({ src, alt, ...reste }: ImgHTMLAttributes<HTMLImageElement> & { src: string | { src: string }; fill?: boolean; priority?: boolean }) {
  delete (reste as Record<string, unknown>).fill;
  delete (reste as Record<string, unknown>).priority;
  return <img {...reste} src={typeof src === "string" ? src : src.src} alt={alt} />;
}

export function usePathname() {
  return cheminCourant();
}
export function useRouter() {
  return {
    push: (c: string) => aller(c),
    replace: (c: string) => aller(c),
    back: () => {},
    forward: () => {},
    // Les données ont pu changer (un diagnostic rattaché) : l'écran se relit.
    refresh: () => naviguer(cheminCourant()),
    prefetch: () => {},
  };
}
export function useSearchParams() {
  return new URLSearchParams();
}
export function redirect(c: string) {
  aller(c);
}
export function notFound() {}

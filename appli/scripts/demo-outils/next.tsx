/**
 * Next.js, sans Next.js : ce dont les écrans ont besoin pour se dessiner dans
 * une page publiée. Un lien de l'appli ne mène nulle part ici (il n'y a pas
 * d'autres écrans) : il ne quitte pas la démonstration, et la page du site dit
 * en une ligne, à côté du téléphone, ce qu'il ouvre dans l'appli (sa règle du
 * 8 novembre 2026 : aucun geste muet).
 */
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";

export default function Link({ href, children, ...reste }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string }; children?: ReactNode; prefetch?: boolean; replace?: boolean; scroll?: boolean }) {
  delete (reste as Record<string, unknown>).prefetch;
  delete (reste as Record<string, unknown>).replace;
  delete (reste as Record<string, unknown>).scroll;
  const cible = typeof href === "string" ? href : href.pathname ?? "#";
  return (
    <a {...reste} href={cible} onClick={(e) => { e.preventDefault(); reste.onClick?.(e); window.parent.postMessage({ lien: cible, nom: e.currentTarget.textContent?.trim() || e.currentTarget.getAttribute("aria-label") || "" }, "*"); }}>
      {children}
    </a>
  );
}

export function Image({ src, alt, ...reste }: ImgHTMLAttributes<HTMLImageElement> & { src: string | { src: string }; fill?: boolean; priority?: boolean }) {
  delete (reste as Record<string, unknown>).fill;
  delete (reste as Record<string, unknown>).priority;
  return <img {...reste} src={typeof src === "string" ? src : src.src} alt={alt} />;
}

let chemin = "/paysage/arrosage";
export function cheminDeLaDemo(c: string) { chemin = c; }
export function usePathname() { return chemin; }
export function useRouter() {
  return { push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, refresh: () => {}, prefetch: () => {} };
}
export function useSearchParams() { return new URLSearchParams(); }
export function redirect() {}
export function notFound() {}

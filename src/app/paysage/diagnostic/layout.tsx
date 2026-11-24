import type { ReactNode } from "react";

/**
 * **Le dossier du diagnostic n'a plus de porte commune — 19 novembre 2026.**
 *
 * Elle fermait aussi le RÉSULTAT (`[id]`) : le diagnostic offert pris, il ne
 * pouvait plus lire celui qu'il venait de recevoir. La porte est désormais sur
 * l'écran qui en commence un (`page.tsx`) ; un diagnostic déjà fait reste à
 * lui, et se lit, comme tout ce qu'Atlas range pour une entreprise (sous RLS).
 * Les actions qui en COMMENCENT un tiennent la garde (`analyserPhotoAction`).
 */
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { annulerRangementAction } from "./importer/actions";

/**
 * La bande de l'import, sous la recherche de « Vos clients » : où en est la
 * lecture pendant qu'il fait autre chose, puis ce qui reste à vérifier, puis
 * « Annuler » juste après le rangement (la réversibilité après, plutôt que la
 * confirmation avant).
 *
 * **Elle relit l'état toutes les trois secondes, et seulement quand il bouge** :
 * rien ne tourne sur un écran sans import en cours.
 */
type Etat = {
  id: string;
  attendues: number;
  recues: number;
  lues: number;
  aVerifier: number;
  pretes: number;
  rangees: number;
  rangeLe: string | null;
  derniereArrivee: string | null;
};

const nombre = (n: number) => n.toLocaleString("fr-FR");

export default function BandeImport() {
  const router = useRouter();
  // « Coupé » se calcule à la lecture de l'état, pas au rendu : l'heure du
  // téléphone n'a rien à faire dans le dessin.
  const [etat, setEtat] = useState<(Etat & { coupe: boolean }) | null>(null);
  const [annule, setAnnule] = useState(false);

  useEffect(() => {
    let fini = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const tour = async () => {
      const r = await fetch("/api/pieces-importees/etat", { cache: "no-store" }).catch(() => null);
      const e = r?.ok ? ((await r.json()) as { etat: Etat | null }).etat : null;
      if (fini) return;
      setEtat(
        e && {
          ...e,
          coupe:
            e.recues < e.attendues && !!e.derniereArrivee && Date.now() - new Date(e.derniereArrivee).getTime() > 120_000,
        }
      );
      const bouge = e && !e.rangeLe && e.lues < e.recues;
      if (bouge) minuteur = setTimeout(tour, 3000);
      else if (e && e.lues >= e.recues && !e.rangeLe) router.refresh();
    };
    void tour();
    return () => {
      fini = true;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [router]);

  if (!etat || annule) return null;

  // Juste rangé : « Annuler », une minute durant.
  if (etat.rangeLe) {
    return (
      <div
        role="status"
        data-atlas="bandeau-rangement"
        className="mx-[16px] mt-[14px] flex items-center justify-between gap-3 rounded-[16px] px-[18px] py-[10px] text-[14.5px]"
        style={{ backgroundColor: colors.ink, color: colors.cream }}
      >
        <span>{nombre(etat.rangees)} documents rangés</span>
        <button
          type="button"
          className="min-h-[44px] px-1 font-semibold"
          style={{ color: colors.or }}
          onClick={async () => {
            const r = await annulerRangementAction(etat.id);
            if (r.ok) {
              setAnnule(true);
              router.refresh();
            }
          }}
        >
          Annuler
        </button>
      </div>
    );
  }

  const coupe = etat.coupe;
  const lit = etat.lues < etat.recues;
  const pct = `${Math.round((Math.max(lit ? etat.lues : etat.recues, 0) / Math.max(lit ? etat.recues : etat.attendues, 1)) * 100)}%`;

  return (
    <Link
      href="/clients/importer"
      data-atlas="bande-import"
      className="mx-[26px] mt-[16px] block rounded-[16px] px-[18px] py-[16px]"
      style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
    >
      {lit ? (
        <>
          <span className="block text-[15px]">Lecture de vos documents</span>
          <span className="mt-[4px] block text-[13px]" style={{ color: colors.inkSoft }}>
            {nombre(etat.lues)} sur {nombre(etat.recues)}
          </span>
          <span className="mt-[12px] block h-[4px] overflow-hidden rounded-full" style={{ backgroundColor: colors.rustTint }}>
            <span className="block h-full rounded-full" style={{ width: pct, backgroundColor: colors.plein }} />
          </span>
        </>
      ) : coupe ? (
        <>
          <span className="block text-[15px]">Envoi interrompu, {nombre(etat.recues)} sur {nombre(etat.attendues)}</span>
          <span className="mt-[4px] block text-[13px]" style={{ color: colors.alert }}>
            Choisissez à nouveau le même fichier
          </span>
        </>
      ) : etat.recues < etat.attendues ? (
        <>
          <span className="block text-[15px]">Envoi en cours</span>
          <span className="mt-[4px] block text-[13px]" style={{ color: colors.inkSoft }}>
            {nombre(etat.recues)} sur {nombre(etat.attendues)}
          </span>
        </>
      ) : (
        <>
          <span className="block text-[15px]">{nombre(etat.recues)} documents lus</span>
          <span className="mt-[4px] block text-[13px]" style={{ color: etat.aVerifier > 0 ? colors.alert : colors.inkSoft }}>
            {etat.aVerifier > 0 ? `${nombre(etat.aVerifier)} à vérifier` : "Prêts à ranger"}
          </span>
        </>
      )}
    </Link>
  );
}

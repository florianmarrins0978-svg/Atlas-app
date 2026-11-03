"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/design-tokens";
import { ANNULER_PENDANT_MS } from "@/lib/delai-annuler";
import { annulerRangementAction } from "./importer/actions";

/**
 * La bande de l'import, sous la recherche de « Vos clients » : où en est la
 * lecture pendant qu'il fait autre chose, puis ce qui reste à vérifier, puis
 * « Annuler » juste après le rangement (la réversibilité après, plutôt que la
 * confirmation avant).
 *
 * **Elle relit l'état toutes les trois secondes, et seulement quand il bouge** :
 * rien ne tourne sur un écran sans import en cours.
 *
 * **« Annuler » part de lui-même au bout de six secondes** (sa capture du
 * 3 novembre 2026 : *« il faut qu'il disparaisse un jour »*). Le serveur dit le
 * temps qui reste (`annulableMs`, compté à SON heure) ; la bande pose son
 * minuteur dessus, puis relit. Ce qu'un rangement a laissé (un nom illisible)
 * reprend alors sa place, « documents lus », « à vérifier », et mène à
 * l'import ; rien ne reste, plus de bande.
 */
type Etat = {
  id: string;
  attendues: number;
  recues: number;
  lues: number;
  aVerifier: number;
  pretes: number;
  rangees: number;
  annulableMs: number | null;
  derniereArrivee: string | null;
};

const nombre = (n: number) => n.toLocaleString("fr-FR");

/** « 1 document lu », « 3 documents lus » : ce qui reste n'est parfois qu'un document. */
const documents = (n: number, participe: string) => `${nombre(n)} document${n > 1 ? "s" : ""} ${participe}${n > 1 ? "s" : ""}`;

export default function BandeImport() {
  const router = useRouter();
  // « Coupé » se calcule à la lecture de l'état, pas au rendu : l'heure du
  // téléphone n'a rien à faire dans le dessin.
  const [etat, setEtat] = useState<(Etat & { coupe: boolean }) | null>(null);
  // Après « Annuler », la bande relit : ce qui est revenu à ranger s'y dit.
  const [relire, setRelire] = useState(0);
  // Un refus d'« Annuler » se dit à la place du compte, le temps d'un
  // « Annuler », avant que la bande ne bouge : jamais un refus muet.
  const [refus, setRefus] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState(false);

  useEffect(() => {
    let fini = false;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    if (refus) {
      minuteur = setTimeout(() => setRefus(null), ANNULER_PENDANT_MS);
      return () => clearTimeout(minuteur);
    }
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
      if (e && e.annulableMs !== null) minuteur = setTimeout(tour, e.annulableMs);
      else if (e && e.lues < e.recues) minuteur = setTimeout(tour, 3000);
      else if (e && e.lues >= e.recues) router.refresh();
    };
    void tour();
    return () => {
      fini = true;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [router, relire, refus]);

  if (!etat) return null;

  // Juste rangé : « Annuler », six secondes durant.
  if (etat.annulableMs !== null || refus) {
    return (
      <div
        role="status"
        data-atlas="bandeau-rangement"
        className="mx-[16px] mt-[14px] flex items-center justify-between gap-3 rounded-[16px] px-[18px] py-[10px] text-[14.5px]"
        style={{ backgroundColor: colors.ink, color: colors.cream }}
      >
        {/* Sans le bouton, la phrase garde sa hauteur : la bande ne bouge pas. */}
        <span className={refus ? "flex min-h-[44px] items-center" : undefined}>{refus ?? documents(etat.rangees, "rangé")}</span>
        {!refus && (
          <button
            type="button"
            className="min-h-[44px] px-1 font-semibold"
            disabled={annulation}
            // L'or posé sur l'ENCRE du bandeau : sur Nuit et Sylve l'encre est
            // claire, et `or` y tombait à 2,49 (batterie commune du 22 octobre).
            style={{ color: colors.orSurEncre }}
            onClick={async () => {
              setAnnulation(true);
              const r = await annulerRangementAction(etat.id).catch(() => ({ ok: false as const, raison: "Le réseau ne répond pas." }));
              setAnnulation(false);
              if (r.ok) {
                router.refresh();
                setRelire((n) => n + 1);
              } else {
                setRefus(r.raison);
              }
            }}
          >
            Annuler
          </button>
        )}
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
          <span className="block text-[15px]">{documents(etat.recues, "lu")}</span>
          <span className="mt-[4px] block text-[13px]" style={{ color: etat.aVerifier > 0 ? colors.alert : colors.inkSoft }}>
            {etat.aVerifier > 0 ? `${nombre(etat.aVerifier)} à vérifier` : etat.recues > 1 ? "Prêts à ranger" : "Prêt à ranger"}
          </span>
        </>
      )}
    </Link>
  );
}

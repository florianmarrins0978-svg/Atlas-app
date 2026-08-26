"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { reglerExigibiliteAction } from "./actions";
import type { Exigibilite } from "@/lib/exigibilite-tva";

/**
 * Quand la TVA devient exigible — le réglage, posé là où la question se pose.
 *
 * **Sa question du 14 août 2026 :** *« si un client décide de ne pas me payer,
 * je vais avoir des problèmes. »* Il avait raison : pour une prestation de
 * services, la TVA est due **à l'encaissement** (CGI art. 269-2-c), et les
 * débits sont une **option** qui se demande à l'administration.
 *
 * **Ce n'est pas une préférence d'écran, c'est une DÉCLARATION.** D'où la
 * phrase qui accompagne le choix : ce que le patron coche ici doit correspondre
 * à ce que les impôts savent de lui. Le même parti que la périodicité
 * (`RythmeTva`), pour la même raison — Atlas ne devine pas un régime fiscal.
 *
 * ─── RÉÉCRIT LE 26 AOÛT 2026, SUR SES DEUX PHRASES ─────────────────────────
 *
 * *« Quand le client le paye / quand je met la facture. C'est pas clair, on
 * comprend rien. Qu'est-ce que ça signifie ? »* Puis, dans la foulée :
 * *« et lorsque je change entre les deux, rien ne se passe, c'est normal ? »*
 *
 * **Le verbe manquait.** « Quand le client me paie » nomme un instant sans dire
 * ce qui s'y produit — lu seul, cela ressemble à un réglage d'affichage. Le
 * surtitre porte donc le verbe, et chaque ligne répond à « et alors ? ».
 *
 * **Et la seconde plainte n'était PAS un défaut** — contrairement à celle du
 * rythme, le même soir, qui en était un (`ARCHITECTURE.md` §193). Quand toutes
 * les factures d'un mois ont été payées dans le mois, les deux régimes tombent
 * sur le même chiffre : c'est le calcul, pas le cache. Ce qui manquait est la
 * ligne du bas, qui dit ce que le choix change sur le mois affiché — **y
 * compris quand il n'y change rien.** Sans elle, un écran qui ne bouge pas se
 * lit comme une panne.
 *
 * **Ce qui a été ÉCARTÉ, et qu'il ne faut pas reproposer :** un tableau
 * d'exemple (« facture envoyée le 28 août, payée le 12 septembre, déclarée en
 * septembre »). Retenu sur planche puis retiré par le patron le 26 août : il
 * EXPLIQUE, et un écran n'explique pas son propre fonctionnement
 * (`CLAUDE.md` §3). Deux lignes à relire chaque fois qu'il ouvre sa TVA, pour
 * une règle qu'il connaît après l'avoir lue une fois.
 * Planche : `appli/quand-je-reverse-la-tva.html`.
 */
export default function RegimeTva({
  actuelle,
  periode,
  tvaRetenue,
  tvaAutre,
}: {
  actuelle: Exigibilite;
  /** Le mois ou le trimestre affiché, tel qu'il est écrit dans le titre. */
  periode: string;
  /** La TVA collectée de cette période sous le régime ENREGISTRÉ. */
  tvaRetenue: string;
  /** La même, sous l'autre régime. */
  tvaAutre: string;
}) {
  const [choisie, setChoisie] = useState<Exigibilite>(actuelle);
  const [enCours, setEnCours] = useState(false);
  const router = useRouter();

  async function choisir(regime: Exigibilite) {
    if (regime === choisie) return;
    setChoisie(regime);
    setEnCours(true);
    try {
      await reglerExigibiliteAction(regime);
      router.refresh();
    } catch {
      setChoisie(actuelle);
    } finally {
      setEnCours(false);
    }
  }

  const OPTIONS: { valeur: Exigibilite; titre: string; quoi: string }[] = [
    {
      valeur: "encaissements",
      titre: "Le mois où mon client me paie",
      quoi: "Une facture pas encore payée n'est pas déclarée.",
    },
    {
      valeur: "debits",
      titre: "Le mois où j'envoie la facture",
      quoi: "Même si le client n'a pas encore payé.",
    },
  ];

  // **Les deux montants suivent le DOIGT, pas la base.** L'écran coche la ligne
  // avant que le serveur réponde — c'est voulu, le doigt doit voir tout de
  // suite. Les chiffres, eux, décrivent le régime ENREGISTRÉ : sans cette
  // bascule, la phrase mentirait pendant l'aller-retour, et c'est justement
  // l'instant où il la lit.
  const surLaLigne = choisie === actuelle ? tvaRetenue : tvaAutre;
  const surLAutre = choisie === actuelle ? tvaAutre : tvaRetenue;
  const memeChiffre = surLaLigne === surLAutre;

  return (
    <div className="mt-5 px-6">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        Je reverse ma TVA aux impôts
      </p>
      <div
        role="radiogroup"
        aria-label="Quand ma TVA devient exigible"
        className="mt-2 flex flex-col gap-2"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={choisie === o.valeur}
            disabled={enCours}
            onClick={() => choisir(o.valeur)}
            className="flex min-h-[44px] items-start gap-2.5 px-1 py-2.5 text-left disabled:opacity-50"
            style={{ borderBottom: `1px solid ${colors.line}` }}
          >
            <span
              aria-hidden
              className="mt-[3px] h-[18px] w-[18px] flex-none rounded-full"
              style={{
                border: `1.5px solid ${choisie === o.valeur ? colors.rust : colors.muted}`,
                backgroundColor: choisie === o.valeur ? colors.rust : "transparent",
                boxShadow: choisie === o.valeur ? `inset 0 0 0 3px ${colors.cream}` : undefined,
              }}
            />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium" style={{ color: colors.ink }}>
                {o.titre}
              </span>
              <span className="text-[12px]" style={{ color: colors.muted }}>
                {o.quoi}
              </span>
            </span>
          </button>
        ))}
      </div>
      {/* **La ligne qui répond à « rien ne se passe ».** Elle est là même quand
          les deux régimes donnent le même chiffre — c'est ce cas-là, le plus
          fréquent chez lui, qui l'a fait douter de l'application. */}
      <p
        data-atlas="ecart-des-regimes"
        className="mt-3 rounded-[10px] px-3 py-2.5 text-[12.5px] leading-snug"
        style={{ backgroundColor: colors.rustTint, color: colors.muted }}
      >
        {memeChiffre ? (
          <>
            Sur <strong style={{ color: colors.ink }}>{periode}</strong>, ce choix ne change rien —{" "}
            <strong style={{ color: colors.ink }}>{surLaLigne}</strong> dans les deux cas.
          </>
        ) : (
          <>
            Sur <strong style={{ color: colors.ink }}>{periode}</strong>, ce choix change :{" "}
            <strong style={{ color: colors.ink }}>{surLaLigne}</strong> avec cette ligne,{" "}
            <strong style={{ color: colors.ink }}>{surLAutre}</strong> avec l&apos;autre.
          </>
        )}
      </p>

      <p className="mt-2 text-[12px] leading-snug" style={{ color: colors.muted }}>
        Ce choix doit correspondre à ce que les impôts savent de vous. Dans le doute, votre comptable
        le dit en une phrase.
      </p>
    </div>
  );
}

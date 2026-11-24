"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { colors, surPlein } from "@/lib/design-tokens";
import { SERIF } from "@/components/atlas/PorteDeNuit";
import { deconnexionAction } from "@/app/login/actions";
import { sabonnerAction } from "@/app/reglages/abonnement/actions";
import type { ChoixDeLEssai, LigneDeLEssai } from "@/lib/essai-avec-carte";

/**
 * Les deux écrans de la carte, et celui du salarié — tels que la planche du
 * 24 novembre 2026 les dessine (`appli/soignee/essai-avec-carte.html`), dans le
 * moule de « C'est fait » (`creer-un-compte/pret/PretClient.tsx`) : le même
 * titre, le même relevé, les mêmes boutons. Il reconnaît l'écran d'avant.
 *
 * **Le paiement est celui de Réglages, Abonnement** (`sabonnerAction`), avec
 * ses jours d'essai : une seule façon de poser une carte.
 */
type Props =
  | { pour: "salarie" }
  | {
      pour: "patron";
      debut: boolean;
      essai: boolean;
      jours: number;
      lignes: LigneDeLEssai[];
      ligneSansCarte: LigneDeLEssai;
      arreter: string | null;
      sansCarte: string;
      choix: ChoixDeLEssai;
    };

export default function EssaiClient(props: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [sortieEnCours, demarrerSortie] = useTransition();

  function sortir() {
    // Pas de `catch` : l'action se termine par une redirection qui remonte
    // jusqu'au routeur (la règle de `documents-legaux/formulaire.tsx`).
    demarrerSortie(async () => {
      await deconnexionAction("entree");
    });
  }

  if (props.pour === "salarie") {
    return (
      <>
        <div className="flex-1 overflow-y-auto pb-4 pt-[30px]">
          <p className="text-[17px] leading-[1.45]" data-atlas="essai-salarie">
            Le compte de l&apos;entreprise n&apos;est pas encore ouvert.
          </p>
        </div>
        <div className="flex-shrink-0 pb-1 pt-2">
          <Discret onClick={sortir} occupe={sortieEnCours}>
            Se déconnecter
          </Discret>
        </div>
      </>
    );
  }

  function poserLaCarte() {
    if (props.pour !== "patron") return;
    setMessage(null);
    const { formule, periodicite, modules } = props.choix;
    demarrer(async () => {
      const r = await sabonnerAction(formule, periodicite, [...modules], "essai");
      if (!r.ok) setMessage(r.message);
      else if (r.url) window.location.href = r.url;
      // Sans adresse : la carte était déjà posée, et vient d'être enregistrée.
      else window.location.reload();
    });
  }

  const occupe = enCours || sortieEnCours;
  const premiereFois = props.debut;

  return (
    <>
      <div className="flex-1 overflow-y-auto pb-4 pt-[30px]" data-atlas={premiereFois ? "votre-essai" : "il-manque-votre-carte"}>
        <h1 className="text-[30px] leading-[1.12] tracking-[-0.01em]" style={SERIF}>
          {premiereFois ? (props.essai ? "Votre essai." : "Votre abonnement.") : "Il manque votre carte."}
        </h1>
        {premiereFois ? (
          <>
            <Phrase>
              {props.essai
                ? `${props.jours} jours pour tout essayer. Rien n’est débité aujourd’hui.`
                : props.sansCarte}
            </Phrase>
            <Releve lignes={props.lignes} />
            {props.arreter && (
              <>
                <Phrase marge="mt-[14px]">{props.arreter}</Phrase>
                <CheminPourResilier />
              </>
            )}
          </>
        ) : (
          <>
            <Phrase>{props.sansCarte}</Phrase>
            {props.essai && <CheminPourResilier />}
            <Releve lignes={[props.ligneSansCarte]} />
            {/* Pour qui hésite, sa décision du 24 novembre 2026 : la visite
                guidée, servie par l'appli (`visite-guidee/route.ts`), dont
                « Quitter la visite » ramène ici. Une adresse de document, pas
                un écran : `<a>`, comme la carte de l'accueil. */}
            <a
              href="/visite-guidee"
              className="mt-[10px] inline-flex min-h-[44px] items-center text-[15px] font-semibold"
              style={{ color: colors.or }}
            >
              Faire la visite guidée
            </a>
          </>
        )}
        {message && (
          <p role="alert" className="mt-5 text-[14.5px] leading-[1.45]" style={{ color: colors.alert }}>
            {message}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 pb-1 pt-2">
        <button
          type="button"
          onClick={poserLaCarte}
          disabled={occupe}
          data-atlas="ajouter-ma-carte"
          className="flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold disabled:opacity-60"
          style={{ background: colors.plein, color: surPlein }}
        >
          {enCours ? "Un instant…" : "Ajouter ma carte"}
        </button>
        {/* « Plus tard » ferme la session : la prochaine ouverture redemande la
            carte (la planche le dit, et l'appli reste fermée sans elle). */}
        <Discret onClick={sortir} occupe={occupe}>
          {premiereFois ? "Plus tard" : "Se déconnecter"}
        </Discret>
      </div>
    </>
  );
}

function Phrase({ children, marge = "mt-2" }: { children: React.ReactNode; marge?: string }) {
  return (
    <p className={`${marge} text-[15.5px] leading-[1.45]`} style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

function Releve({ lignes }: { lignes: LigneDeLEssai[] }) {
  return (
    <dl className="mt-[18px] rounded-[14px] px-[18px]" style={{ backgroundColor: colors.card }} data-atlas="releve-essai">
      {lignes.map((l, i) => (
        <div key={l.intitule} className="py-[13px]" style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
          <dt className="text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
            {l.intitule}
          </dt>
          <dd className="m-0">
            <span className="mt-[3px] block text-[18px] leading-[1.3]" style={SERIF}>
              {l.valeur}
            </span>
            {l.sous && (
              <span className="mt-1 block text-[13.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                {l.sous}
              </span>
            )}
            {/* Les trois formules sont dans Réglages, Abonnement, ouvert avant
                la carte pour cela seul : choisir là-bas, c'est poser la carte
                avec l'essai (`sabonnerAction`). */}
            {l.changer && (
              <Link
                href="/reglages/abonnement"
                className="mt-[2px] inline-flex min-h-[44px] items-center text-[15px] font-semibold"
                style={{ color: colors.or }}
              >
                Changer
              </Link>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Sa demande du 24 novembre 2026 : le chemin pour résilier, dessiné, pour être
 * transparent. Les mots de l'appli : l'onglet Réglages, l'écran Abonnement, le
 * bouton « Résilier », rouge comme dans `AbonnementClient`.
 */
function CheminPourResilier() {
  const pas = "inline-flex min-h-[36px] items-center rounded-full px-[14px] text-[14.5px] font-semibold";
  const fond = { backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` };
  const trait = <span aria-hidden="true" className="inline-block h-px w-3" style={{ background: colors.chevron }} />;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-[6px]" data-atlas="chemin-pour-resilier">
      <span className={pas} style={{ ...fond, color: colors.ink }}>
        Réglages
      </span>
      {trait}
      <span className={pas} style={{ ...fond, color: colors.ink }}>
        Abonnement
      </span>
      {trait}
      <span className={pas} style={{ ...fond, color: colors.alert }}>
        Résilier
      </span>
    </div>
  );
}

function Discret({ children, onClick, occupe }: { children: React.ReactNode; onClick: () => void; occupe: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={occupe}
      className="mt-1 flex min-h-[48px] w-full items-center justify-center text-[15.5px] font-semibold disabled:opacity-60"
      style={{ color: colors.inkSoft }}
    >
      {children}
    </button>
  );
}

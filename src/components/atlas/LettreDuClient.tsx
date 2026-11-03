import type React from "react";
import { colors, font, voile } from "@/lib/design-tokens";
import { initialesDeLaSociete } from "@/lib/prix-achat";
import IconeTrait from "./IconeTrait";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LA LETTRE DE L'ARTISAN : ce que les pages de son client partagent.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sa planche du 31 octobre 2026 (`appli/soignee/client-recoit.html`), codée
 * sur sa réponse du 1er novembre : *« tu peux tout coder »*. Le devis, le
 * contrat, les dates du mois et le compte rendu s'ouvrent de la même façon :
 * un grand titre, les initiales de l'artisan à l'or de l'appli, son nom
 * dessous. Le client reconnaît d'abord qui lui écrit.
 *
 * **Et les écrans de retour se ressemblent aussi** (devis accepté, correction
 * demandée, réponse enregistrée, lien expiré, contrat accepté) : un signe, une
 * phrase, et le geste qui reste. Ils écrivaient chacun leur carte, avec ombre
 * et bordure, et trois pages sur cinq leurs couleurs en dur.
 *
 * **Aucune charte de l'artisan ici** : une page de client ne reçoit aucune
 * variable (`layout.tsx`, `estPageDuClient`), les jetons retombent sur la
 * charte d'origine. Un devis ne part pas en noir parce qu'il a choisi Nuit.
 */

/** Les initiales de l'artisan, dans un rond d'or. Décor : le nom se lit à côté. */
export function Monogramme({ nom, taille = 40 }: { nom: string; taille?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid flex-none place-items-center rounded-full"
      style={{
        width: taille,
        height: taille,
        fontFamily: font.display,
        fontSize: Math.round(taille * 0.38),
        letterSpacing: "0.04em",
        color: colors.or,
        boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.65)}`,
      }}
    >
      {initialesDeLaSociete(nom)}
    </span>
  );
}

/** La tête d'une page du client : le titre, et les initiales de l'artisan. */
export function TeteDeLettre({
  titre,
  nom,
  taille = 29,
  rond = 40,
}: {
  titre: React.ReactNode;
  nom: string;
  taille?: number;
  rond?: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <h1
        className="m-0 min-w-0 flex-1"
        style={{ fontFamily: font.display, fontSize: taille, lineHeight: 1.12, letterSpacing: "-0.012em", fontVariantNumeric: "lining-nums", textWrap: "balance" }}
      >
        {titre}
      </h1>
      <Monogramme nom={nom} taille={rond} />
    </div>
  );
}

/** Un rond vert et sa coche : ce qui est fait, ce qui est accepté. */
export function CocheFaite({ taille = 26 }: { taille?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid flex-none place-items-center rounded-full"
      style={{ width: taille, height: taille, backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }}
    >
      <IconeTrait nom="coche" taille={Math.round(taille * 0.62)} epaisseur={2.4} />
    </span>
  );
}

/**
 * Un écran de retour : un signe, une phrase, et ce qui reste à faire.
 * Il occupe tout l'écran, au milieu : c'est la seule chose à lire.
 */
export function EcranDeRetour({
  signe,
  ton,
  titre,
  texte,
  enDessous,
  signature,
  repere,
}: {
  signe: "coche" | "crayon" | "sablier";
  ton: "vert" | "or";
  titre: string;
  texte: string;
  enDessous?: React.ReactNode;
  /** « Atelier Démo EI, devis n° 12 » : qui écrit, quand la page le sait. */
  signature?: React.ReactNode;
  repere?: string;
}) {
  return (
    <div
      className="flex min-h-dvh items-center justify-center px-6 py-10"
      style={{ backgroundColor: colors.cream, color: colors.ink }}
      data-atlas={repere}
    >
      <div className="w-full max-w-sm text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full"
          style={
            ton === "vert"
              ? { backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }
              : { backgroundColor: voile(colors.or, 0.14), color: colors.or }
          }
        >
          <IconeTrait nom={signe} taille={28} epaisseur={2} />
        </span>
        <h1 className="m-0" style={{ fontFamily: font.display, fontSize: 27, lineHeight: 1.15 }}>
          {titre}
        </h1>
        <p className="mx-auto mt-2.5 max-w-[21em] text-[16px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          {texte}
        </p>
        {enDessous}
        {signature && (
          <p className="mt-6 text-[14px]" style={{ color: colors.inkSoft }}>
            {signature}
          </p>
        )}
      </div>
    </div>
  );
}

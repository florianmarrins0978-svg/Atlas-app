"use client";

import { useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { liensItineraire, lienAppel } from "@/lib/itineraire";

/**
 * « Y aller » — l'adresse d'un chantier portée jusqu'au GPS, en un doigt.
 *
 * *Retenue sur maquette le 12 août 2026 (`docs/maquettes/32-le-chevron.html`),
 * après quatre versions : le « + » est devenu chevron, et le chevron est doré.*
 *
 * **Pourquoi trois destinations et pas une.** Un téléphone ne dit pas quelles
 * applications il possède : impossible de n'afficher que Waze parce que c'est
 * la seule installée. Les trois sont proposées, et le doigt choisit.
 *
 * **Ce qui n'y est pas, et c'est délibéré.** La maquette portait une case
 * « Toujours celle-là, ne plus me demander ». Elle n'est pas reprise ici :
 * mémoriser un choix sans offrir nulle part de le défaire, c'est enfermer le
 * patron dans une application qu'il aura touchée par erreur. Elle reviendra
 * avec son interrupteur dans Réglages, ou pas du tout.
 *
 * **« Ouvrir la fiche du chantier » n'y est pas non plus** : sur le planning,
 * le nom du chantier y mène déjà — c'était un second chemin vers le même
 * endroit, sur la même ligne.
 */
export default function FeuilleYAller({
  ouverte,
  onFermer,
  nomChantier,
  clientNom,
  adresse,
  telephone,
  quand,
}: {
  ouverte: boolean;
  onFermer: () => void;
  nomChantier: string;
  clientNom: string | null;
  adresse: string | null;
  telephone: string | null;
  quand: string;
}) {
  const [motDuCopier, setMotDuCopier] = useState<string | null>(null);

  const liens = liensItineraire(adresse);
  const appel = lienAppel(telephone);

  // Le presse-papier peut refuser (page non sécurisée, permission retirée) et
  // il refuse en silence. Un bouton qui ne dit rien se fait appuyer trois fois,
  // et le patron finit par croire que l'adresse est copiée alors qu'elle ne
  // l'est pas — il colle du vide dans son GPS.
  async function copier() {
    if (!adresse) {
      setMotDuCopier("Rien à copier");
      return;
    }
    try {
      await navigator.clipboard.writeText(adresse);
      setMotDuCopier("Adresse copiée");
    } catch {
      setMotDuCopier("Copie impossible");
    }
  }

  function fermer() {
    setMotDuCopier(null);
    onFermer();
  }

  return (
    <BottomSheet open={ouverte} onBackdropClick={fermer}>
      <p className={`text-center ${libelleCaps}`} style={{ color: colors.or }}>
        Y aller
      </p>

      {/* **On n'invente pas d'adresse** (`CLAUDE.md` §4). Sans elle, la feuille
          dit ce qui manque et où le saisir, plutôt que de proposer un départ
          vers nulle part. */}
      <p
        className="mt-2.5 text-center"
        style={{ fontFamily: font.display, fontSize: 21.5, lineHeight: 1.22, color: colors.ink }}
      >
        {adresse ?? "Adresse non renseignée"}
      </p>
      <p className="mt-[7px] text-center text-[13.5px]" style={{ color: colors.muted }}>
        {clientNom ? `${clientNom} — ${nomChantier}` : nomChantier}
      </p>
      <p className="mt-[5px] text-center text-[12px]" style={{ color: colors.muted }}>
        {adresse ? quand : "À saisir sur la fiche du chantier"}
      </p>

      <div className="my-4 h-px" style={{ backgroundColor: colors.lineSoft }} />

      <div
        className="flex flex-col gap-px overflow-hidden rounded-[10px]"
        style={{ backgroundColor: colors.lineSoft, opacity: liens ? 1 : 0.3 }}
      >
        <Destination nom="Plans" href={liens?.plans} icone={<IconeEpingle />} />
        <Destination nom="Google Maps" href={liens?.google} icone={<IconeCarte />} />
        <Destination nom="Waze" href={liens?.waze} icone={<IconeFleche />} />
      </div>

      {/* Leurs mots ENTIERS. Raccourcis en « Copier · Appeler · Le chantier »,
          les deux rangs se relisaient « appeler le chantier » — c'est-à-dire
          l'inverse de ce qu'ils font (12 août 2026). */}
      <div
        className="mt-2.5 flex gap-px overflow-hidden rounded-[10px]"
        style={{ backgroundColor: colors.lineSoft }}
      >
        <button
          type="button"
          onClick={copier}
          className="flex-1 py-[13px] text-center text-[13.5px]"
          style={{ backgroundColor: colors.card, color: colors.ink }}
        >
          {motDuCopier ?? "Copier l’adresse"}
        </button>
        {appel ? (
          <a
            href={appel}
            className="flex-1 py-[13px] text-center text-[13.5px]"
            style={{ backgroundColor: colors.card, color: colors.ink }}
          >
            Appeler le client
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="flex-1 py-[13px] text-center text-[13.5px]"
            style={{ backgroundColor: colors.card, color: colors.muted, opacity: 0.4 }}
          >
            Appeler le client
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={fermer}
        className="mt-1.5 w-full py-[13px] text-[15px]"
        style={{ color: colors.muted }}
      >
        Annuler
      </button>
    </BottomSheet>
  );
}

/**
 * Une destination. Sans lien — le chantier n'a pas d'adresse — elle reste
 * lisible mais **inatteignable au doigt comme au clavier** : un `<a>` sans
 * `href` disparaîtrait de la navigation au clavier, mais un lien vide gardé
 * cliquable ouvrirait le GPS sur rien du tout.
 */
function Destination({ nom, href, icone }: { nom: string; href?: string; icone: React.ReactNode }) {
  const contenu = (
    <>
      <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center">{icone}</span>
      <span className="flex-1 text-[16px]">{nom}</span>
      <span aria-hidden="true" className="text-[17px]" style={{ color: colors.or }}>
        ›
      </span>
    </>
  );
  const classe = "flex items-center gap-3.5 px-4 py-[13px]";
  const style = { backgroundColor: colors.card, color: colors.ink };

  if (!href) {
    return (
      <span aria-disabled="true" className={classe} style={style}>
        {contenu}
      </span>
    );
  }
  return (
    // `target="_blank"` : le lien universel peut retomber sur le SITE de Waze ou
    // de Google quand l'application manque. Dans le même onglet, le patron
    // perdrait son planning et devrait revenir à la main.
    <a href={href} target="_blank" rel="noopener noreferrer" className={classe} style={style}>
      {contenu}
    </a>
  );
}

const traits = { fill: "none", stroke: colors.rust, strokeWidth: 1.5 } as const;

function IconeEpingle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...traits} aria-hidden="true">
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function IconeCarte() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...traits} aria-hidden="true">
      <path d="M3.5 6.8 9.2 4.4l5.6 2.4 5.7-2.4v12.8l-5.7 2.4-5.6-2.4-5.7 2.4z" strokeLinejoin="round" />
      <path d="M9.2 4.4v14.8M14.8 6.8v14.8" opacity=".55" />
    </svg>
  );
}

function IconeFleche() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...traits} aria-hidden="true">
      <path d="M20.5 3.5 3.5 10.4l7.4 2.7 2.7 7.4z" strokeLinejoin="round" />
    </svg>
  );
}

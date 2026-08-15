"use client";

import { useState } from "react";
import Link from "next/link";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { liensItineraire, lienAppel } from "@/lib/itineraire";
import { intituleDuChantier } from "@/lib/nom-chantier";

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
 *
 * **« Créer la facture », en revanche, a quitté la ligne pour venir ici** le
 * 12 août 2026 : *« il faut cliquer sur le chevron, la page s'ouvre avec le GPS
 * et tout machin, et là tu mets créer la facture »*. La ligne du planning s'en
 * trouve allégée d'un geste, et le nom du chantier respire.
 *
 * **Ce qui ne doit PAS se perdre en le déplaçant.** Le planning a été un
 * cul-de-sac jusqu'au 8 août 2026 — *« comment je fais pour avoir accès au
 * devis ? »* — et le chemin vers la facture a été ouvert pour cela. Il passe
 * désormais par un appui de plus, ce qui est son choix ; il ne doit pas devenir
 * introuvable. Trois suites le parcourent en entier, depuis le planning.
 */
export default function FeuilleYAller({
  ouverte,
  onFermer,
  chantierId,
  nomChantier,
  clientNom,
  adresse,
  telephone,
  quand,
  equipes = [],
  onDeplacer,
  rangEquipe = null,
  onChangerEquipe,
}: {
  ouverte: boolean;
  onFermer: () => void;
  chantierId: string;
  nomChantier: string;
  clientNom: string | null;
  adresse: string | null;
  telephone: string | null;
  quand: string;
  /**
   * Les équipes déclarées, avec leur libellé déjà calculé.
   *
   * **Vide à une seule équipe**, et la ligne disparaît alors entièrement : il
   * n'y a personne à distinguer, et proposer un choix à un seul terme ferait
   * exactement ce que le patron a interdit le 10 août.
   */
  equipes?: { rang: number; libelle: string }[];
  rangEquipe?: number | null;
  /** Rend un refus lisible plutôt que de lever : voir `changerEquipeChantierAction`. */
  onChangerEquipe?: (rang: number | null) => Promise<{ succes: boolean; erreur?: string }>;
  /**
   * Changer la DATE — arrivé ici le 14 août 2026, la pastille d'équipe lui
   * ayant pris sa place sur la ligne du planning (geste A). Absent, la ligne
   * ne s'affiche pas : les écrans qui montent cette feuille sans savoir
   * déplacer ne doivent pas promettre un geste qui ne fera rien.
   */
  onDeplacer?: () => void;
}) {
  const [motDuCopier, setMotDuCopier] = useState<string | null>(null);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [refusEquipe, setRefusEquipe] = useState<string | null>(null);
  const [rang, setRang] = useState<number | null>(rangEquipe);

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
      {/* **Jamais « M. Bernard — Chez M. Bernard ».** Un chantier qu'on n'a pas
          nommé s'appelle « Chez <le client> » (`nomDuChantier`) : recoller le
          client devant produisait un doublon dans le cas le PLUS courant du
          produit. Vu sur capture, le 12 août 2026. */}
      <p className="mt-[7px] text-center text-[13.5px]" style={{ color: colors.muted }}>
        {intituleDuChantier(clientNom, nomChantier)}
      </p>
      {/* **La date, même sans adresse.** Cette ligne disait « À saisir sur la
          fiche du chantier » — une consigne devenue fausse le 13 août 2026 : le
          bouton ci-dessous mène au devis complet, pas à la fiche. Et redondante,
          puisqu'il dit déjà quoi faire. Le titre annonce ce qui manque, le
          bouton offre de le réparer ; entre les deux, la date reste ce qu'elle
          est sur tous les autres chantiers. */}
      <p className="mt-[5px] text-center text-[12px]" style={{ color: colors.muted }}>
        {quand}
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

      {/* **« Saisir l'adresse » — retenu sur maquette le 13 août 2026**
          (`docs/maquettes/34`, variante B) : *« ça, c'est au cas où la fiche
          entière n'a pas été rentrée. Dans ce cas-là, tu peux faire ça, mais
          avec le bouton, tu le mets arrondi. »*

          **Il n'apparaît QUE sans adresse.** La feuille porte déjà « Créer la
          facture » ; un bouton de plus, visible les onze fois sur douze où
          l'adresse existe, la chargerait pour rien.

          **Il mène au devis complet, seul endroit où l'adresse s'édite.**
          Elle ne se saisissait qu'à la création jusqu'au 10 août, et c'est là
          qu'elle a été rouverte — `mettreAJourAdresseChantier`. L'envoyer vers
          la fiche l'obligerait à chercher.

          La pastille creuse, et non pleine : le geste principal de cette
          feuille reste de PARTIR. Celui-ci répare ce qui manque. */}
      {!liens && (
        <a
          href={`/chantiers/${chantierId}/devis-complet`}
          aria-label={`Saisir l'adresse — ${nomChantier}`}
          onClick={fermer}
          className="mt-2.5 block w-full rounded-full py-[13px] text-center text-[14.5px]"
          style={{ border: `1px solid ${colors.rust}`, color: colors.rust }}
        >
          Saisir l’adresse
        </a>
      )}

      {/* **L'ÉQUIPE, depuis le 14 août 2026, à sa demande** : *« on devait
          pouvoir affilier une équipe à un chantier ajouté au planning une fois
          que le client a validé le devis »* (`ARCHITECTURE.md` §100).

          **Ici et non sur un écran à part** : la feuille porte déjà les gestes
          du chantier posé, et un écran de plus pour changer un nom ne se
          justifierait pas.

          **Elle ne touche ni au jour ni à la demi-journée**, et l'écran le dit :
          un chantier que le client a validé est justement celui qu'on ne veut
          plus déplacer. */}
      {equipes.length > 1 && onChangerEquipe && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: colors.lineSoft }}>
          <button
            type="button"
            onClick={() => setChoixOuvert((o) => !o)}
            aria-expanded={choixOuvert}
            className="flex w-full items-center gap-3 py-2 text-left"
            style={{ minHeight: 44 }}
          >
            <span className="flex-1 text-[15px]">Équipe</span>
            <span className="text-[14px]" style={{ color: colors.muted }}>
              {equipes.find((e) => e.rang === rang)?.libelle ?? "à choisir"}
            </span>
            <span
              aria-hidden="true"
              className="-mt-[3px] h-[7px] w-[7px] flex-none rotate-45"
              style={{ borderRight: `1.5px solid ${colors.chevron}`, borderBottom: `1.5px solid ${colors.chevron}` }}
            />
          </button>

          {choixOuvert && (
            <div className="mt-1.5 overflow-hidden rounded-[4px]" style={{ backgroundColor: colors.card }}>
              {equipes.map((e) => (
                <button
                  key={e.rang}
                  type="button"
                  aria-pressed={e.rang === rang}
                  onClick={async () => {
                    setRefusEquipe(null);
                    const avant = rang;
                    setRang(e.rang); // optimiste : le doigt doit voir tout de suite
                    const r = await onChangerEquipe(e.rang);
                    if (r.succes) {
                      setChoixOuvert(false);
                    } else {
                      // **On revient à ce que la base porte, jamais à ce qu'on a
                      // demandé.** Un refus silencieux laisserait une équipe
                      // cochée qui n'existe pas.
                      setRang(avant);
                      setRefusEquipe(r.erreur ?? "Ce changement n'a pas abouti.");
                    }
                  }}
                  className="flex w-full items-center gap-3 border-b px-3.5 text-left last:border-b-0"
                  style={{
                    borderColor: colors.line,
                    minHeight: 46,
                    backgroundColor: e.rang === rang ? colors.line : "transparent",
                  }}
                >
                  <span className="flex-1 text-[15px]">{e.libelle}</span>
                </button>
              ))}
            </div>
          )}

          {refusEquipe ? (
            <p role="alert" className="mt-2 text-[12px] leading-snug" style={{ color: colors.alert }}>
              {refusEquipe}
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: colors.muted }}>
              Le jour et la demi-journée ne changent pas.
            </p>
          )}
        </div>
      )}

      {/* **« Créer la facture » vit ici depuis le 12 août 2026, à sa demande :**
          *« il faut cliquer sur le chevron, la page s'ouvre avec le GPS et tout
          machin, et là tu mets créer la facture »*.

          **Il est SÉPARÉ des deux rangs au-dessus, et ce n'est pas décoratif.**
          Copier et appeler ne touchent à rien ; celui-ci bâtit un document.
          Collé aux autres, il se toucherait par erreur en visant « Appeler ».
          Le filet et le vert pin disent qu'on change de nature — la charte
          réserve le pin à ce qu'on FAIT (`design-tokens.ts`).

          Créer n'est toujours pas envoyer : l'arrêt 3 reste en travers du
          chemin, et rien ne part sans un geste de plus (`docs/AGENT.md` §6). */}
      {/* **« Déplacer » est arrivé ici le 14 août 2026**, la pastille d'équipe
          lui ayant pris sa place sur la ligne du planning (geste A, retenu sur
          `docs/maquettes/52-appliquer-une-equipe.html`).

          **Creux et non plein.** Le seul aplat de cette feuille reste « Créer la
          facture » : deux pleins l'un sous l'autre, et l'œil ne sait plus lequel
          est le geste principal — c'est exactement ce que le patron a fait
          corriger le 13 août sur la feuille d'envoi.

          **Et il ferme la feuille en partant** : le calendrier se trouve
          derrière elle, et l'y envoyer sans la refermer donnerait un écran qui
          défile sous un calque. */}
      {onDeplacer && (
        <button
          type="button"
          aria-label={`Déplacer le chantier ${nomChantier}`}
          onClick={() => {
            fermer();
            onDeplacer();
          }}
          className="mt-2.5 block w-full rounded-full py-[13px] text-center text-[14.5px]"
          style={{ border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          Déplacer ce chantier
        </button>
      )}

      <div className="mt-4 h-px" style={{ backgroundColor: colors.lineSoft }} />
      <Link
        href={`/chantiers/${chantierId}/facture`}
        aria-label={`Créer la facture — ${nomChantier}`}
        onClick={fermer}
        // **La capsule, comme partout ailleurs.** Il était resté en `rounded-md`
        // — et le contrôle des boutons arrondis ne l'a pas vu, deux fois : il ne
        // regardait ni les `<Link>`, ni les rayons NOMMÉS de Tailwind. C'est le
        // patron qui l'a repéré, le 13 août 2026, sur sa capture.
        className="mt-4 block w-full rounded-full py-[14px] text-center text-[15px]"
        style={{ backgroundColor: colors.rust, color: colors.cream }}
      >
        Créer la facture
      </Link>

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

"use client";

import { useState, useTransition } from "react";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { etatConfirmation, etatNouveau, verifierNouveauMotDePasse, type Personnel } from "@/lib/mot-de-passe";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { FeuilleDeSortie } from "../SeDeconnecter";
import { changerMotDePasseAction, deconnecterPartoutAction } from "./actions";
import SectionFaceId from "./SectionFaceId";
import Trace from "@/components/atlas/reglages/Trace";
import type { CleAppareil } from "@/lib/cle-appareil";

/**
 * « Connexion » — `maquettes/atlas-reglages-moi.html`, écran 3, puis sa
 * planche soignée du 26 octobre 2026 (`appli/soignee/reglages-connexion.html`,
 * vue Proposé).
 *
 * **Ses deux demandes du 14 août 2026, mot pour mot :** *« il faut pouvoir
 * confirmer son mdp 2× avant de le changer et met le petit œil à côté pour
 * afficher ou non le mdp »*. Ma planche proposait l'œil À LA PLACE de la
 * seconde saisie ; il veut les deux, et il a raison — l'œil se touche après
 * coup, la confirmation attrape la faute au moment où elle se fait.
 *
 * **L'œil est sur les TROIS champs.** Une confirmation qu'on ne peut pas relire
 * ne confirme rien : elle se remplirait à l'aveugle, exactement comme la
 * première.
 *
 * **Les règles viennent de `src/lib/mot-de-passe.ts`, et le serveur emploie les
 * mêmes.** Deux rédactions divergeraient, et l'écart se paierait dans le
 * mauvais sens : un bouton allumé sur une saisie que le serveur refuse
 * (`CLAUDE.md` §3).
 *
 * **L'écran tient sans défiler, Face ID compris — sa règle du 31 août 2026.**
 * La planche soignée l'obtient de trois façons : chaque case tient sur UNE
 * ligne (« Actuel », « Nouveau », « Confirmer » : le titre au-dessus dit déjà
 * « mot de passe »), Face ID et « Me déconnecter partout » partagent une seule
 * plage, et la confirmation de la sortie monte dans une feuille au lieu de
 * s'ouvrir dans l'écran et de tout pousser vers le bas.
 */
export default function ConnexionClient({
  cles,
  personnel,
  nomEntreprise,
}: {
  cles: CleAppareil[];
  personnel: Personnel;
  /** Le titre de la feuille de sortie : on nomme d'où l'on sort. */
  nomEntreprise: string | null;
}) {
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [partoutDemande, setPartoutDemande] = useState(false);

  const bloquant = verifierNouveauMotDePasse(nouveau, confirmation, personnel);
  const pret = actuel !== "" && bloquant === null && !enCours;
  const etat = etatConfirmation(nouveau, confirmation);
  const court = etatNouveau(nouveau, personnel);

  /** Retaper efface la confirmation verte : elle parlait du mot de passe d'avant. */
  function saisir(poser: (v: string) => void) {
    return (v: string) => {
      setFait(false);
      poser(v);
    };
  }

  function changer() {
    demarrer(async () => {
      const r = await changerMotDePasseAction(actuel, nouveau, confirmation);
      if (r.ok) {
        setRefus(null);
        setFait(true);
        // **Les trois champs se vident.** Les laisser remplis laisserait le
        // mot de passe en clair dans un écran ouvert sur une table de chantier,
        // et donnerait à croire qu'il reste quelque chose à faire.
        setActuel("");
        setNouveau("");
        setConfirmation("");
      } else {
        setFait(false);
        setRefus(r.raison);
      }
    });
  }

  function partout() {
    demarrer(async () => {
      const r = await deconnecterPartoutAction();
      if (!r.ok) {
        // La feuille se referme : le refus s'écrit sur l'écran, et une feuille
        // restée ouverte le cacherait.
        setPartoutDemande(false);
        setRefus(r.raison);
        return;
      }
      // **On s'en va vers la route qui EFFACE LES COOKIES.** Rester ici
      // laisserait une page dont chaque geste serait désormais refusé — l'écran
      // paraîtrait figé, et c'est le piège du 10 août 2026 : un cookie mort que
      // rien n'efface, et une soirée perdue.
      window.location.href = "/api/session-perimee";
    });
  }

  return (
    // **PLUS AUCUNE RÉSERVE ICI, et c'est 96 px repris — sa demande du 31 août
    // 2026 : « je veux qu'elle tienne sur une seule page ».** `pb-24` comptait
    // la barre du bas UNE SECONDE FOIS : `main.atlas-contenu`
    // (`src/app/layout.tsx`) la réserve déjà pour tous les écrans. C'est le
    // même défaut que celui corrigé sur l'export de chantier — un vide qui ne
    // porte rien et qui pousse la dernière rubrique hors de l'écran.
    <div className="pb-3">
      {/* **Une question, pas une étiquette — sa demande du 9 septembre 2026 :**
          *« rajoute juste un ? à la fin de changer de mdp »*. C'est la même
          idée qu'il avait retenue sur l'écran Équipe le 8 : un titre qui pose
          la question à laquelle le bloc répond se lit tout seul, là où une
          étiquette se survole. Les libellés, eux, passent en toutes lettres
          avec le reste de la série (sa planche soignée du 26 octobre 2026). */}
      <Paquet titre={"Changer de mot de passe\u00a0?"}>
        <ChampSecret
          mot="Actuel"
          etiquette="Mot de passe actuel"
          valeur={actuel}
          onChange={saisir(setActuel)}
          autoComplete="current-password"
        />
        <ChampSecret
          mot="Nouveau"
          etiquette="Nouveau mot de passe"
          valeur={nouveau}
          onChange={saisir(setNouveau)}
          autoComplete="new-password"
          // **La longueur ne s'annonce plus au repos — 31 août 2026.** Elle
          // vivait ici en gris, en permanence, et il les a toutes fait
          // retirer. Elle parle désormais quand elle mord, et seulement là :
          // sans elle, un bouton éteint sur huit caractères n'aurait plus
          // aucune explication à l'écran.
          sous={court?.message ?? null}
          sousTeinte={colors.alert}
        />
        <ChampSecret
          mot="Confirmer"
          etiquette="Confirmer le nouveau mot de passe"
          valeur={confirmation}
          onChange={saisir(setConfirmation)}
          autoComplete="new-password"
          // La ligne ne parle QU'UNE FOIS qu'il a commencé à retaper : annoncer
          // « les deux diffèrent » sur un champ vide est une alarme qui hurle à
          // vide, et c'est ainsi qu'on apprend à ne plus les lire. Identiques,
          // elle passe au vert, la couleur de ce qui marche (sa planche
          // soignée) ; celle qui bloque reste rouge.
          sous={etat?.message ?? null}
          sousTeinte={etat?.identiques ? colors.carteVertTexte : colors.alert}
        />
      </Paquet>

      {/* **LE BOUTON SOUS SES PROPRES CHAMPS — sa demande du 26 août 2026 :**
          *« le bouton changer mon mot de passe doit se trouver au-dessus de
          ouvrir avec Face ID »*.

          Il était collé en bas de l'écran, sur une barre fixe. Deux rubriques
          l'en séparaient — Face ID, puis « Ailleurs » —, et l'on remplissait
          trois champs pour aller chercher, tout en bas, un bouton qui parlait
          d'eux. Sous ses champs, il ne peut plus se lire autrement.

          **Une fois changé, la confirmation se lit À SA PLACE**, en vert (sa
          planche soignée) : ouverte en haut, elle poussait l'écran vers le bas,
          et il défilait. Elle cède la place au bouton dès qu'il retape. */}
      <div className="mx-[22px] mt-2.5">
        {fait ? (
          <div role="status">
            <PlageTon ton="vert">
              <span className="flex min-h-[30px] items-center justify-center gap-2 text-[16px] font-semibold">
                <Trace taille={20} epaisseur={2.2}>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </Trace>
                Votre mot de passe est changé.
              </span>
            </PlageTon>
          </div>
        ) : (
          <button
            type="button"
            onClick={changer}
            disabled={!pret}
            // **Passé au vert des boutons le 4 septembre 2026.** Il l'a relevé
            // lui-même — *« j'avais demandé à changer tous les boutons en vert
            // clair »* —, et ce bouton-ci avait échappé au balayage du 3 : il ne
            // portait pas `atlas-plein`, et le contrôle ne regardait QUE ce qui la
            // portait. Il la porte maintenant, et il est donc gardé.
            //
            // **La classe n'est posée que quand le bouton est ALLUMÉ** : éteint,
            // il est gris, et le voile de l'appui n'aurait rien à éclaircir.
            className={`flex min-h-[56px] w-full items-center justify-center rounded-full px-[22px] text-[17px] font-semibold ${
              pret ? "atlas-plein" : ""
            }`}
            style={{
              backgroundColor: pret ? colors.plein : colors.line,
              color: pret ? surPlein : colors.inkSoft,
            }}
          >
            {enCours ? "En cours…" : "Changer mon mot de passe"}
          </button>
        )}
      </div>

      {refus && (
        <div role="alert" className="mx-[22px] mt-2.5">
          <PlageTon ton="rouge">{refus}</PlageTon>
        </div>
      )}

      {/* **Face ID et la sortie dans une seule plage** (sa planche soignée) :
          « Ailleurs » est parti, et la plage tient ce qu'il gardait.

          **Face ID vient APRÈS le mot de passe, et ce n'est pas un hasard de
          mise en page.** Sa règle du 23 août : on crée son compte au mot de
          passe, puis on décide. L'ordre de l'écran dit la même chose que la
          règle — le mot de passe d'abord, le raccourci ensuite.

          La plage n'est pas un `Paquet` : elle suit le bouton à 12 px, sans
          titre, là où un paquet ouvre une rubrique à 28 px. Ces seize pixels
          font tenir l'écran sans défiler. */}
      <div className="mx-[22px] mt-3 overflow-hidden rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        <SectionFaceId clesInitiales={cles} />

        {/* **Deux appuis, et le second n'est pas une politesse.** Ce geste
            déconnecte l'appareil qui appuie : posé en un seul toucher au milieu
            d'un écran de réglages, il se déclenche par mégarde et le patron se
            retrouve devant l'écran de connexion sans comprendre pourquoi. Le
            second se fait dans la feuille de Se déconnecter. */}
        <button
          type="button"
          onClick={() => setPartoutDemande(true)}
          className="relative flex min-h-[62px] w-full items-center gap-3.5 py-[9px] text-left"
        >
          <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
          <PastilleIcone ton="rouge">
            <Trace>
              <path d="M14.5 4.5h4v15h-4M10 8l-4 4 4 4M6 12h9.5" />
            </Trace>
          </PastilleIcone>
          <span
            className="min-w-0 flex-1"
            style={{ fontFamily: font.display, fontSize: 17.5, lineHeight: 1.25, color: colors.alert }}
          >
            Me déconnecter partout
          </span>
          <span className="flex flex-none opacity-60" style={{ color: colors.alert }}>
            <Trace taille={20} epaisseur={2}>
              <path d="M9 5l7 7-7 7" />
            </Trace>
          </span>
        </button>
      </div>

      <FeuilleDeSortie
        ouverte={partoutDemande}
        titre={nomEntreprise ?? "Me déconnecter partout ?"}
        libelle="Me déconnecter partout"
        enCours={enCours}
        onConfirmer={partout}
        onFermer={() => setPartoutDemande(false)}
      >
        <p className="mt-2 text-[15.5px] leading-[1.45]" style={{ color: colors.ink }}>
          Vous devrez vous reconnecter sur tous vos appareils, celui-ci compris.
        </p>
        {/* **CE BOUTON FERME AUSSI FACE ID — depuis le 7 septembre 2026.**

            Il ne le faisait pas, et c'était le seul défaut de sécurité
            connu et non réparé du produit : un appareil déjà enregistré
            rouvrait une session à l'instant d'après. L'écran disait la
            vérité depuis le 25 août ; il ne réparait rien.

            La phrase change donc de sens, et c'est délibéré : elle annonce un
            COÛT, plus une faille. On la garde parce qu'un geste qui retire
            Face ID sans le dire se découvre au moment où l'on veut entrer, et
            le raisonnement de `CLAUDE.md` §3 sur les phrases inutiles ne la
            vise pas — elle ne décrit pas le bouton d'à côté, elle annonce ce
            qu'on va perdre. */}
        {cles.length > 0 && (
          <p className="mt-2 text-[15.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Face ID sera retiré de vos appareils. Vous le remettrez en un toucher.
          </p>
        )}
      </FeuilleDeSortie>
    </div>
  );
}

/**
 * Un mot de passe, avec son œil, sur une seule ligne.
 *
 * **Le mot court à l'écran, le nom entier pour qui ne voit pas l'écran.** Le
 * libellé visible dit « Nouveau » parce que le titre du paquet dit déjà « mot
 * de passe » ; le champ, lui, garde son nom complet, et l'œil le reprend —
 * « Afficher nouveau mot de passe » —, sans quoi une personne qui n'entend que
 * les libellés ne saurait pas lequel des trois il ouvre.
 *
 * **L'œil est en encre douce, pas en vert.** Un pictogramme plein au bord d'un
 * champ se lit comme un bouton d'envoi — et le seul plein de l'écran doit
 * rester « Changer mon mot de passe ». Il passe à l'or une fois ouvert : c'est
 * alors un état, et un état se LIT.
 */
function ChampSecret({
  mot,
  etiquette,
  valeur,
  onChange,
  autoComplete,
  sous,
  sousTeinte,
}: {
  mot: string;
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  sous?: string | null;
  sousTeinte?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = `secret-${autoComplete}-${mot.toLowerCase()}`;

  return (
    <div className="relative">
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <div className="flex min-h-[54px] items-center gap-2.5">
        <label htmlFor={id} className="w-[86px] flex-none text-[15px] font-semibold" style={{ color: colors.inkSoft }}>
          {mot}
        </label>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={valeur}
          autoComplete={autoComplete}
          aria-label={etiquette}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
          // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
          style={{ fontSize: 18, lineHeight: 1.3, color: colors.ink, letterSpacing: visible ? "0.01em" : "0.16em" }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          // Le libellé DIT ce que l'appui va faire, pas ce qu'on voit : « Voir »
          // sur un mot de passe déjà visible envoie appuyer pour rien.
          aria-label={visible ? `Masquer ${etiquette.toLowerCase()}` : `Afficher ${etiquette.toLowerCase()}`}
          aria-pressed={visible}
          // **44 px de cible**, qu'une main gantée ne rate pas ; la marge
          // négative la fait déborder dans le retrait de la plage sans décaler
          // la case.
          className="-mr-[11px] flex h-11 w-11 flex-none items-center justify-center rounded-full"
          style={{ color: visible ? colors.or : colors.inkSoft }}
        >
          <Oeil barre={visible} />
        </button>
      </div>
      {sous && (
        // Sous la saisie, pas sous le mot : la phrase parle de ce qu'on a tapé.
        <span
          className="-mt-1.5 mb-2.5 ml-[96px] block text-[14px] font-semibold leading-[1.35]"
          style={{ color: sousTeinte ?? colors.inkSoft }}
        >
          {sous}
        </span>
      )}
    </div>
  );
}

/** Le même dessin que sur la planche — 22 px, filaire. */
function Oeil({ barre }: { barre: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {barre && <path d="M4.5 19.5l15-15" />}
    </svg>
  );
}

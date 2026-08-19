"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import DicterCoordonnees from "./DicterCoordonnees";
import type { CoordonneesDictees } from "@/lib/coordonnees-dictees";
import { creerChantierAction } from "./actions";
import { reprendreChantierAction } from "../[id]/coordonnees/actions";
import ChoixCivilite from "@/components/atlas/ChoixCivilite";
import type { Civilite } from "@/lib/civilite";

// Intégration réelle : la création passe désormais par une Server Action
// (creerChantierAction), qui persiste le chantier (et le client s'il est
// renseigné) dans la base réelle, dans le contexte de l'entreprise active.
//
// Comportement clavier mobile : le bouton principal reste dans le flux normal de
// la page (pas de position fixed) — pas de risque de chevauchement à l'ouverture
// du clavier. Les champs utilisent une taille de police ≥16px pour éviter le zoom
// automatique d'iOS Safari au focus.

/**
 * Le formulaire de création, extrait de sa page le 10 août 2026.
 *
 * **Pourquoi il ne vit plus seulement dans une page.** L'écran retenu par le
 * patron ouvre « Nouveau chantier » en FEUILLE : la liste recule, s'assombrit,
 * et le formulaire monte devant elle. La route `/chantiers/nouveau` reste — les
 * suites de bout en bout y vont directement, et un lien profond doit continuer
 * de fonctionner. Deux formulaires auraient divergé au premier champ ajouté ;
 * il n'y en a qu'un, et il ne connaît de son hôte que deux choses : s'il est en
 * feuille, et comment se refermer.
 */
/**
 * Où l'on va en sortant de cet écran — et ce n'est plus un « choix » à faire
 * avant d'agir : depuis le 18 août 2026, chaque bouton porte sa destination.
 *
 * `fiche` mène à la fiche du chantier, là où l'on dicte. `devis` mène au devis
 * entier, à remplir soi-même. Les deux passent par la MÊME création : voir
 * `creerPuisAller`.
 */
type Destination = "fiche" | "devis";

/**
 * Un chantier DÉJÀ LÀ, que cet écran rouvre au lieu d'en créer un.
 *
 * **Sa demande du 17 août 2026 :** *« lorsque s'affiche Adresse non renseignée,
 * je puisse cliquer dessus et que ça m'amène sur la page […] RIEN DE PLUS, RIEN
 * DE MOINS »* — la page en question étant celle-ci, sa propre capture à l'appui.
 *
 * **Pourquoi le même composant, et pas un second écran.** Un formulaire jumeau
 * aurait divergé au premier champ ajouté : l'un enregistrerait le canal d'envoi,
 * l'autre l'aurait oublié. C'est la raison qui avait déjà fait extraire ce
 * formulaire de sa page le 10 août — « il n'y en a qu'un, et il ne connaît de
 * son hôte que deux choses ».
 */
export type ChantierRepris = {
  id: string;
  nomClient: string;
  civilite: Civilite | null;
  telephone: string;
  email: string;
  canal: "sms" | "email" | null;
  adresseChantier: string;
  /** Vide quand elle est la même que celle du chantier — l'écran ne la montre
   *  alors pas, comme à la création. */
  adresseClient: string;
};

export default function FormulaireNouveauChantier({
  enFeuille = false,
  onFermer,
  reprise,
}: {
  enFeuille?: boolean;
  onFermer?: () => void;
  /** Présent : l'écran ENREGISTRE sur ce chantier au lieu d'en créer un. */
  reprise?: ChantierRepris;
} = {}) {
  const router = useRouter();
  const [nomClient, setNomClient] = useState(reprise?.nomClient ?? "");
  const [civilite, setCivilite] = useState<Civilite | null>(reprise?.civilite ?? null);
  const [telephone, setTelephone] = useState(reprise?.telephone ?? "");
  const [email, setEmail] = useState(reprise?.email ?? "");
  const [canalChoisi, setCanalChoisi] = useState<"sms" | "email" | null>(reprise?.canal ?? null);
  const [adresseChantier, setAdresseChantier] = useState(reprise?.adresseChantier ?? "");
  const [adresseClient, setAdresseClient] = useState(reprise?.adresseClient ?? "");
  // Déjà dépliée quand elle porte quelque chose : la replier cacherait une
  // adresse qu'il a saisie, et il la croirait perdue.
  const [adresseClientVisible, setAdresseClientVisible] = useState(
    (reprise?.adresseClient ?? "").length > 0
  );
  // **Quel bouton travaille**, et pas seulement « ça travaille ». Les deux
  // capsules sont identiques ; sans cela, « Création… » s'afficherait sur celle
  // qu'il n'a pas touchée, et il croirait s'être trompé de geste.
  const [enCoursVers, setEnCoursVers] = useState<Destination | null>(null);
  const enCours = enCoursVers !== null;
  const [erreur, setErreur] = useState<string | null>(null);

  // Plus rien n'est obligatoire : le chantier prend le nom de ce qui a été
  // donné, et la date s'il n'y a rien (`src/lib/nom-chantier.ts`).
  const peutCreer = !enCours;

  // Le canal se devine dans la plupart des cas : une seule coordonnée renseignée
  // ne laisse pas d'ambiguïté. Le choix explicite du patron prime toujours —
  // c'est un accord passé avec son client, pas une déduction de l'application.
  const aTelephone = telephone.trim().length > 0;
  const aEmail = email.trim().length > 0;
  const canal = canalChoisi ?? (aTelephone ? "sms" : aEmail ? "email" : null);

  /**
   * Ce que la dictée a compris entre dans les champs VIDES seulement.
   *
   * Écraser une saisie parce qu'on a dicté ensuite serait la pire façon
   * d'aider : le patron aurait tapé le numéro, dicté l'adresse, et perdu le
   * numéro sans comprendre pourquoi.
   */
  function appliquerDictee(c: CoordonneesDictees) {
    if (c.nom && !nomClient.trim()) setNomClient(c.nom);
    if (c.telephone && !telephone.trim()) setTelephone(c.telephone);
    if (c.email && !email.trim()) setEmail(c.email);
    if (c.adresse && !adresseChantier.trim()) setAdresseChantier(c.adresse);
  }

  /**
   * Crée le chantier, puis mène là où le patron a dit vouloir aller.
   *
   * **Une seule création, deux destinations.** Le patron, le 11 août 2026 :
   * *« si je clique sur "ou rédiger le devis à la main", ça m'ouvre la page du
   * devis complet, avec les informations du client qui se seront ajoutées
   * automatiquement ? »* — oui, et c'est justement parce que le chantier est
   * créé d'abord que ça marche : `devis-complet` lit le client rattaché au
   * chantier (`devis-complet/page.tsx`). Sauter la création pour « gagner du
   * temps » produirait le devis orphelin qu'il redoutait.
   *
   * Écrire deux fonctions de création aurait fait diverger les deux chemins au
   * premier champ ajouté — l'un enregistrerait le téléphone, l'autre l'aurait
   * oublié.
   */
  async function creerPuisAller(vers: Destination) {
    if (enCours) return;
    setEnCoursVers(vers);
    setErreur(null);

    // **Rouvert, l'écran ENREGISTRE — il ne crée pas un second chantier.** La
    // saisie est la même, la destination aussi ; seul le chemin d'écriture
    // change, et il vit côté serveur (`coordonnees/actions.ts`).
    if (reprise) {
      const r = await reprendreChantierAction(reprise.id, {
        nomClient,
        civilite: civilite ?? undefined,
        telephone,
        email,
        canal: canal ?? undefined,
        adresseChantier,
        adresseClient,
      });
      if (!r.ok) {
        // Le refus se dit en toutes lettres, jamais un `catch {}` muet : le
        // 11 août 2026, « impossible d'enregistrer la note » ne pouvait être
        // expliqué par personne (`AGENTS.md`).
        setErreur(r.raison);
        setEnCoursVers(null);
        return;
      }
      router.push(vers === "devis" ? `/chantiers/${reprise.id}/devis-complet` : `/chantiers/${reprise.id}`);
      return;
    }

    try {
      const { id } = await creerChantierAction({
        nomClient,
        civilite: civilite ?? undefined,
        telephone,
        email,
        canal: canal ?? undefined,
        adresseChantier,
        adresseClient,
      });
      router.push(vers === "devis" ? `/chantiers/${id}/devis-complet` : `/chantiers/${id}`);
    } catch {
      setErreur("Impossible de créer le chantier pour l'instant. Réessayez.");
      setEnCoursVers(null);
    }
  }

  return (
    <div
      style={{
        backgroundColor: enFeuille ? "transparent" : colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: enFeuille ? undefined : "100%",
      }}
    >
      {/* **La bulle de l'assistant flotte au-dessus du bas de l'écran — mais
          seulement EN PAGE.** Mesuré le 11 août 2026 : la phrase de pied
          tombait sous elle, et `finDePage: 0` — aucun défilement ne l'en
          dégageait. Elle était donc illisible en permanence, sur la moitié de
          sa largeur.

          En FEUILLE, rien à réserver : celle-ci est `fixed` en `z-[50]` et
          recouvre déjà la bulle et le bandeau du bas (`EcranChantiers.tsx`).
          Y poser la même réserve ajoutait quatre-vingts pixels de vide sous le
          formulaire, pour se protéger de quelque chose qui n'y arrive pas. */}
      <div className={enFeuille ? "pb-10" : "pb-40"}>
        {/* Retour discret — même style que la fiche chantier. En feuille il
            referme sans quitter l'accueil ; en page il y revient. Le dessin est
            le même : c'est le même geste pour le patron. */}
        <div className="px-6 pt-8">
          {enFeuille ? (
            <button
              type="button"
              onClick={onFermer}
              aria-label="Retour à la liste des chantiers"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.rustTint }}
            >
              <FlecheRetour />
            </button>
          ) : (
            <Link
              href="/"
              aria-label="Retour à la liste des chantiers"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.rustTint }}
            >
              <FlecheRetour />
            </Link>
          )}
        </div>

        {/* **`items-center` et non plus `items-start`.** Sans le surtitre, le
            bloc de gauche n'a plus qu'une ligne : le micro aligné par le haut
            se posait au-dessus du titre au lieu d'en face. Mesuré à l'écran —
            les deux centres tombent maintenant sur le même pixel. */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5">
          <div>
            {/* **« Fiche client », et plus de surtitre du tout.** Sa demande du
                16 août 2026, capture à l'appui : *« Enlève nouveau un chantier
                et remplace par fiche client. »*

                **Le surtitre disparaît avec le mot qui le justifiait.** Il
                portait « Nouveau » — que le titre ne reprend plus — et « Les
                coordonnées » en reprise, écrit la veille pour la seule raison
                que « nouveau » aurait été faux au-dessus d'un chantier ouvert
                trois jours plus tôt. Ce contre-mot n'a plus rien à contrer :
                « Fiche client » est vrai dans les deux cas, à la création
                comme à la reprise. Lui garder une ligne au-dessus obligerait
                à inventer un mot qu'il n'a pas demandé (`CLAUDE.md` §4). */}
            <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
              Fiche client
            </h1>
          </div>
          {/* Le raccourci pour qui a les mains prises — jamais l'action
              principale de cet écran, d'où le rond discret plutôt qu'un
              bouton. */}
          <DicterCoordonnees onCoordonnees={appliquerDictee} />
        </div>

        <form
          className="mt-7 flex flex-col gap-4 px-6"
          onSubmit={(e) => {
            e.preventDefault();
            // **« Entrée » mène à la dictée, et c'est un retour en arrière
            // assumé.** Tant qu'une bascule portait le choix, la touche devait
            // le suivre — l'ignorer aurait envoyé sur la fiche quelqu'un qui
            // venait de toucher « je l'écris ». Il n'y a plus de choix à
            // suivre : deux boutons, deux gestes distincts. Une touche ne peut
            // pas deviner lequel, et tomber dans le devis à la main sans
            // l'avoir demandé est le défaut le plus coûteux des deux.
            creerPuisAller("fiche");
          }}
        >
          {/* 1 — Nom du client.
              Le champ « Nom du chantier » a été retiré le 2026-08-05, à la
              demande du patron. C'était le seul champ obligatoire, et le seul
              qui lui demandait d'inventer quelque chose : un élagueur ne
              baptise pas ses chantiers, il dit « chez M. Bernard ». Le nom se
              déduit désormais du client, sinon de l'adresse, sinon de la date
              (`src/lib/nom-chantier.ts`). Rien n'est fabriqué : c'est une
              étiquette, pas une donnée sur le chantier. */}
          {/* **La civilité se choisit AU-DESSUS du nom**, comme il l'a demandé
              le 13 août 2026. Rien n'est présélectionné : son silence ne doit
              pas devenir un choix (`src/components/atlas/ChoixCivilite.tsx`). */}
          <ChoixCivilite valeur={civilite} onChange={setCivilite} />
          <Field
            label="Nom du client (facultatif)"
            placeholder="Bernard"
            big
            value={nomClient}
            onChange={setNomClient}
          />
          {/* 3 — Téléphone : facultatif */}
          <Field
            label="Téléphone (facultatif)"
            placeholder="06 12 34 56 78"
            type="tel"
            value={telephone}
            onChange={setTelephone}
          />
          {/* 4 — E-mail : facultatif */}
          <Field
            label="E-mail (facultatif)"
            placeholder="bernard@exemple.fr"
            type="email"
            value={email}
            onChange={setEmail}
          />

          {/* 5 — Canal d'envoi. N'apparaît qu'une fois une coordonnée saisie :
              poser la question avant serait sans objet. */}
          {(aTelephone || aEmail) && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className={smallCaps} style={{ color: colors.muted }}>
                Comment lui envoyer son devis ?
              </legend>
              <div className="flex gap-2">
                <ChoixCanal
                  libelle="Par SMS"
                  actif={canal === "sms"}
                  disponible={aTelephone}
                  onClick={() => setCanalChoisi("sms")}
                />
                <ChoixCanal
                  libelle="Par e-mail"
                  actif={canal === "email"}
                  disponible={aEmail}
                  onClick={() => setCanalChoisi("email")}
                />
              </div>
            </fieldset>
          )}

          {/* 6 — Adresse du chantier : facultative, et proposée pendant la
              frappe. Le champ reste libre : un lieu-dit ou un chemin de
              campagne ne figure dans aucune base, et le patron y travaille
              (`src/components/atlas/ChampAdresse.tsx`). */}
          <ChampAdresse
            label="Adresse du chantier (facultatif)"
            placeholder="12 rue des Lilas, Nantes"
            value={adresseChantier}
            onChange={setAdresseChantier}
          />

          {/* 7 — Adresse client, masquée par défaut */}
          {!adresseClientVisible ? (
            <button
              type="button"
              onClick={() => setAdresseClientVisible(true)}
              className="self-start text-[14px] font-medium"
              style={{ color: colors.rust }}
            >
              + Ajouter une adresse client différente
            </button>
          ) : (
            <ChampAdresse
              label="Adresse du client (facultatif)"
              placeholder="Si différente de l'adresse du chantier"
              value={adresseClient}
              onChange={setAdresseClient}
            />
          )}

          {/* 8 — Les deux actions.

              **Sa demande du 18 août 2026 :** *« supprime "je dicterai" et
              "je l'écris", remplace par un bouton cliquable "je dicte mon
              devis" et un autre "j'écris mon devis", en gardant le chemin »* —
              puis, devant la planche (`appli/deux-boutons-devis.html`) :
              *« la 5, mais sans les flèches »*.

              **Ce que ça change, et qui n'est pas qu'une affaire de dessin.**
              Jusqu'ici il y avait un CHOIX (la bascule) puis une ACTION (le
              bouton) : deux gestes pour qui écrit son devis. Le choix est
              maintenant l'action — un seul geste dans les deux cas.

              **Les deux capsules sont identiques, à dessein.** Il a écarté la
              hiérarchie (une pleine, une cernée) qu'on lui proposait : ici les
              deux chemins se valent. C'est la proposition 5 de la planche.

              **Pas de flèche.** Sa correction, littérale. Le reste de
              l'application en porte — « Créer le chantier → », « Ouvrir le
              devis → » — mais ces deux-là n'annoncent pas un pas de plus : ils
              disent ce qu'il va faire, et le font.

              **« Créer le chantier » a disparu de l'écran, et c'est assumé.**
              C'était le seul endroit qui annonçait la création. Les deux
              boutons créent le chantier avant d'aller où ils disent — sans quoi
              le devis serait orphelin (`creerPuisAller`).

              **Elles ne remplacent pas la porte du tiroir**, sur la fiche
              chantier, et ce n'est pas un doublon : ce sont deux MOMENTS. Ici,
              « je sais déjà que je l'écrirai moi-même » ; là-bas, « j'ai
              commencé, finalement je l'écris ».

              **En reprise, un seul bouton — et c'est délibéré.** L'écran sert
              alors à corriger des coordonnées (sa demande du 17 août : « RIEN
              DE PLUS, RIEN DE MOINS ») ; lui proposer deux devis pour changer
              une adresse serait lui poser une question qu'il n'a pas. */}
          <div className="flex flex-col gap-3 pt-4">
            {reprise ? (
              <PrimaryButton
                disabled={!peutCreer}
                onClick={() => creerPuisAller("fiche")}
                repere="action-creation"
              >
                {enCours ? "Enregistrement…" : "Enregistrer →"}
              </PrimaryButton>
            ) : (
              <>
                <PrimaryButton
                  disabled={!peutCreer}
                  onClick={() => creerPuisAller("fiche")}
                  repere="action-dicter"
                >
                  {enCoursVers === "fiche" ? "Création…" : "Je dicte mon devis"}
                </PrimaryButton>
                <PrimaryButton
                  disabled={!peutCreer}
                  onClick={() => creerPuisAller("devis")}
                  repere="action-ecrire"
                >
                  {enCoursVers === "devis" ? "Création…" : "J'écris mon devis"}
                </PrimaryButton>
              </>
            )}
          </div>
          {/* **Cette ligne ne parle plus que quand il y a quelque chose à dire.**
              Elle portait aussi, en permanence, « Le nom crée la fiche du
              client. Le reste se corrige ensuite, sur le devis. » — retirée le
              11 août 2026 à la demande du patron : l'écran est plus net sans
              elle, et il connaît son application.

              Ce qu'elle disait reste vrai et n'est écrit nulle part ailleurs à
              l'écran : **c'est le NOM qui crée la fiche client**. Sans lui,
              aucun client n'est rattaché, et le devis n'offre pas d'en ajouter
              un après coup. Si ce cas devait un jour se voir, c'est sur l'écran
              du devis qu'il faudrait le dire — pas en remettant une phrase
              permanente ici.

              La place, elle, est RÉSERVÉE en toutes circonstances : sans cela,
              l'apparition d'une erreur ferait sauter la mise en page d'une
              ligne sous le doigt qui vient d'appuyer. */}
          <p
            className="min-h-[19px] text-center text-[13px]"
            style={{ color: colors.alert }}
            role="alert"
            aria-live="polite"
          >
            {erreur}
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * **Ce qui vivait ici jusqu'au 18 août 2026 : la bascule, et le bouton dont le
 * libellé la suivait.**
 *
 * `BasculePorte` — deux mots en serif, un filet d'or qui glissait de l'un à
 * l'autre — et `LibelleDeLaPorte`, qui gardait les deux libellés superposés
 * dans le bouton, l'un à `opacity:0`, pour que sa largeur ne saute pas au
 * moment du choix. Les deux ont été retirés d'un bloc : deux boutons portent
 * désormais chacun leur destination, et il n'y a plus de choix à refléter.
 *
 * **Rien n'en est gardé « au cas où ».** Un dessin que plus rien n'emploie
 * finit repris au hasard par un écran futur — c'est la raison qui avait déjà
 * fait supprimer la variante « plaque » du bouton principal le 11 août.
 * L'historique les garde ; le code, non.
 */

// Un canal sans sa coordonnée est proposé mais inerte : le masquer laisserait
// le patron chercher pourquoi le choix qu'il attend n'est pas là.
function ChoixCanal({
  libelle,
  actif,
  disponible,
  onClick,
}: {
  libelle: string;
  actif: boolean;
  disponible: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      aria-pressed={actif}
      className="flex-1 rounded-full py-3.5 text-[15px] font-medium disabled:opacity-40"
      style={{
        backgroundColor: actif ? colors.rustTint : colors.card,
        color: actif ? colors.rust : colors.ink,
      }}
    >
      {libelle}
    </button>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
  big = false,
  value,
  onChange,
  required = false,
}: {
  label: string;
  placeholder: string;
  type?: string;
  big?: boolean;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={smallCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-required={required || undefined}
        className="rounded-[4px] border-0 px-4 py-3.5 outline-none"
        style={{
          backgroundColor: colors.card,
          color: colors.ink,
          fontFamily: big ? font.display : font.body,
          fontSize: big ? "20px" : "16px",
        }}
      />
    </label>
  );
}

function FlecheRetour() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.rust} strokeWidth="2.4">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

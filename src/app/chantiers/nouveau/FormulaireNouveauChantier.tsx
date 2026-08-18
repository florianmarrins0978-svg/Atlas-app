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
 * Par quelle porte on sort de cet écran.
 *
 * `dictee` mène à la fiche du chantier — c'est là qu'on dicte, et c'est la
 * réponse neuf fois sur dix. `main` mène au devis entier, à remplir soi-même.
 * Les deux passent par la MÊME création : voir `creerPuisAller`.
 */
type Porte = "dictee" | "main";

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
  // Le choix par défaut est la dictée, et il ne se discute pas : c'est le
  // produit. La porte du devis à la main existe pour ceux qui savent déjà ; la
  // proposer en premier reviendrait à ne plus jamais proposer la dictée.
  const [porte, setPorte] = useState<Porte>("dictee");
  const [enCours, setEnCours] = useState(false);
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
  async function creerPuisAller(vers: "fiche" | "devis") {
    if (enCours) return;
    setEnCours(true);
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
        setEnCours(false);
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
      setEnCours(false);
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
            // **« Entrée » suit désormais la bascule, et c'est un changement.**
            // Tant que le devis à la main était un lien discret, valider un
            // champ au clavier ne devait surtout pas y mener : on n'aurait pas
            // choisi cette sortie, on serait tombé dedans. Depuis que le choix
            // est explicite et affiché au-dessus du bouton, l'ignorer serait
            // l'inverse du défaut : le patron aurait touché « je l'écris » et se
            // retrouverait sur la fiche sans comprendre pourquoi.
            creerPuisAller(porte === "main" ? "devis" : "fiche");
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

          {/* 8 — Le choix, puis l'action.

              **Le patron, le 11 août 2026 au soir, capture à l'appui :** *« on
              ne voit que création de chantier, on ne voit pas devis à la
              main »*. C'était juste : le lien en capitales d'or vivait SOUS le
              bouton, dans la zone où l'œil ne revient pas une fois qu'il a
              trouvé ce qu'il cherchait — et sur son téléphone, la barre du
              navigateur mange le bas.

              **Ce qui a été gardé de la version d'avant, et qui gouverne ce
              dessin :** deux boutons à égalité obligeraient TOUT LE MONDE à
              trancher avant d'avoir vu le chantier, alors que neuf fois sur dix
              la réponse est « je dicterai ». D'où la bascule plutôt que deux
              portes : les deux chemins se voient, et il n'y a toujours qu'un
              seul bouton à toucher. Le geste ordinaire n'a pas changé de coût.

              **Elle ne remplace pas la porte du tiroir**, sur la fiche
              chantier, et ce n'est pas un doublon : ce sont deux MOMENTS. Ici,
              « je sais déjà que je l'écrirai moi-même » ; là-bas, « j'ai
              commencé, finalement je l'écris ». Retirer la seconde enfermerait
              un chantier créé la veille dont la dictée n'a rien donné.

              Six dessins de bascule et huit de bouton lui ont été montrés
              (`docs/maquettes/15-…`, `17-…`) ; il a retenu le trait qui glisse
              et la capsule. */}
          <div className="pt-4">
            <BasculePorte porte={porte} onChange={setPorte} />
            {/* Le repère sert aux suites : les DEUX libellés vivent dans le
                bouton — l'un à `opacity:0` — et un sélecteur par le texte les
                trouverait tous les deux. Voir `test-devis-main-depuis-creation-e2e`. */}
            <div className="mt-5" data-atlas="action-creation">
              <PrimaryButton
                disabled={!peutCreer}
                onClick={() => creerPuisAller(porte === "main" ? "devis" : "fiche")}
              >
                {enCours
                  ? reprise
                    ? "Enregistrement…"
                    : "Création…"
                  : <LibelleDeLaPorte porte={porte} reprise={reprise !== undefined} />}
              </PrimaryButton>
            </div>
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
 * **Les deux mots, et le trait d'or qui glisse de l'un à l'autre.**
 *
 * Trois choix de dessin, tous mesurés à l'écran plutôt que raisonnés :
 *
 * 1. **La serif, pas les capitales.** Un mot en capitales espacées est un
 *    panneau ; le même en serif est une phrase. On choisit ici entre deux
 *    façons de travailler, pas entre deux rubriques.
 * 2. **Le trait GLISSE, il ne saute pas.** Un repère qui saute d'un bloc à
 *    l'autre donne un écran mécanique ; le même qui glisse en trois dixièmes de
 *    seconde donne un écran habité. C'est un `translateX`, jamais un
 *    changement de bordure : déplacer coûte moins cher au navigateur que
 *    repeindre, et le mouvement reste fluide sur son téléphone.
 * 3. **La couleur désigne, jamais le gras.** Un mot qui grossit décale son
 *    voisin, et l'œil voit bouger ce qui n'a pas changé.
 *
 * `aria-pressed` plutôt qu'un `role="tablist"` : ce ne sont pas des onglets —
 * rien n'apparaît en dessous. C'est un choix qui arme le bouton.
 */
function BasculePorte({
  porte,
  onChange,
}: {
  porte: Porte;
  onChange: (p: Porte) => void;
}) {
  return (
    <div className="relative flex" style={{ borderBottom: `1px solid ${colors.line}` }}>
      {(
        [
          ["dictee", "Je dicterai"],
          ["main", "Je l'écris"],
        ] as const
      ).map(([valeur, libelle]) => (
        <button
          key={valeur}
          type="button"
          onClick={() => onChange(valeur)}
          aria-pressed={porte === valeur}
          className="flex-1 pb-3 text-center text-[17px]"
          style={{
            fontFamily: font.display,
            color: porte === valeur ? colors.ink : colors.muted,
            transition: "color .26s ease",
          }}
        >
          {libelle}
        </button>
      ))}
      <span
        aria-hidden="true"
        className="absolute left-0 w-1/2"
        style={{
          bottom: -1,
          height: 1.5,
          backgroundColor: colors.or,
          transform: porte === "main" ? "translateX(100%)" : "none",
          transition: "transform .3s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}

/**
 * **Les deux libellés superposés dans la même case, qui se croisent en
 * opacité.**
 *
 * Les afficher l'un OU l'autre ferait changer le bouton de largeur au moment du
 * choix — et un bouton qui bouge sous le doigt est la façon la plus sûre de
 * faire douter de ce qu'on vient de toucher. Superposés, ils imposent au bouton
 * la largeur du plus long, une fois pour toutes.
 *
 * Le libellé caché est retiré aux lecteurs d'écran : deux textes lus à la suite
 * pour un seul bouton n'apprendraient rien à personne.
 */
/**
 * Ce que dit le bouton, selon la porte — et selon qu'il crée ou qu'il reprend.
 *
 * **« Créer le chantier » ne créerait rien sur un chantier qui existe.** C'est
 * le second des deux mots que la reprise oblige à changer (planche du 17 août
 * 2026) : le laisser ferait annoncer à l'écran une action qu'il ne fait pas, et
 * le patron chercherait ensuite pourquoi il a deux chantiers.
 *
 * **Les DEUX libellés restent dans le bouton**, l'un à `opacity:0` — c'est ce
 * qui permet à la bascule de glisser sans que la largeur saute. Les suites le
 * savent et visent le repère `data-atlas="action-creation"` plutôt que le texte
 * (`test-devis-main-depuis-creation-e2e`).
 */
function LibelleDeLaPorte({ porte, reprise = false }: { porte: Porte; reprise?: boolean }) {
  return (
    <span className="grid">
      {(
        [
          ["dictee", reprise ? "Enregistrer →" : "Créer le chantier →"],
          ["main", "Ouvrir le devis →"],
        ] as const
      ).map(([valeur, libelle]) => (
        <span
          key={valeur}
          aria-hidden={porte !== valeur}
          className="whitespace-nowrap"
          style={{
            gridArea: "1 / 1",
            opacity: porte === valeur ? 1 : 0,
            transition: "opacity .26s ease",
          }}
        >
          {libelle}
        </span>
      ))}
    </span>
  );
}

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

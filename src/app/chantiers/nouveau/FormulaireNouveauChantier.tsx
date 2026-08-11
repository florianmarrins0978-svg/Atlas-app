"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { colors, font, smallCaps, libelleCaps } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import ChampAdresse from "@/components/atlas/ChampAdresse";
import DicterCoordonnees from "./DicterCoordonnees";
import type { CoordonneesDictees } from "@/lib/coordonnees-dictees";
import { creerChantierAction } from "./actions";

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
export default function FormulaireNouveauChantier({
  enFeuille = false,
  onFermer,
}: {
  enFeuille?: boolean;
  onFermer?: () => void;
} = {}) {
  const router = useRouter();
  const [nomClient, setNomClient] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [canalChoisi, setCanalChoisi] = useState<"sms" | "email" | null>(null);
  const [adresseChantier, setAdresseChantier] = useState("");
  const [adresseClient, setAdresseClient] = useState("");
  const [adresseClientVisible, setAdresseClientVisible] = useState(false);
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
    try {
      const { id } = await creerChantierAction({
        nomClient,
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

        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <p className={smallCaps} style={{ color: colors.rust, marginBottom: 8 }}>
              Nouveau
            </p>
            <h1 className="text-[32px] leading-tight" style={{ fontFamily: font.display }}>
              Un chantier
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
            // La touche « Entrée » vaut le geste ordinaire, jamais la sortie de
            // secours : on ne part pas rédiger un devis à la main parce qu'on a
            // validé un champ au clavier.
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
          <Field
            label="Nom du client (facultatif)"
            placeholder="M. Bernard"
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

          {/* 8 — Action principale */}
          <div className="pt-4">
            <PrimaryButton disabled={!peutCreer} onClick={() => creerPuisAller("fiche")}>
              {enCours ? "Création…" : "Créer le chantier →"}
            </PrimaryButton>
            {/* **La sortie de secours, au moment où elle se décide.**
                Le patron, le 11 août 2026, maquette en main : *« je préfère la
                première option »* — le lien discret plutôt que deux boutons à
                égalité.

                Le choix de la forme n'est pas cosmétique. Deux boutons
                obligeraient TOUT LE MONDE à trancher avant même d'avoir vu le
                chantier, alors que neuf fois sur dix la réponse est « je
                dicterai ». Ici, « Créer le chantier » reste le geste évident ;
                celui qui sait déjà qu'il écrira son devis à la main trouve sa
                porte, sans que les autres aient à choisir.

                **Elle ne remplace pas celle du tiroir**, et ce n'est pas un
                doublon : ce sont deux MOMENTS. Ici, « je sais déjà que je
                l'écrirai moi-même » ; sur la fiche, « j'ai commencé, finalement
                je l'écris ». Retirer la seconde enfermerait un chantier créé la
                veille dont la dictée n'a rien donné. */}
            <button
              type="button"
              disabled={!peutCreer}
              onClick={() => creerPuisAller("devis")}
              className={`mt-4 block w-full text-center ${libelleCaps}`}
              style={{ color: colors.or }}
            >
              Ou rédiger le devis à la main →
            </button>
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
      className="flex-1 rounded-[4px] py-3.5 text-[15px] font-medium disabled:opacity-40"
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

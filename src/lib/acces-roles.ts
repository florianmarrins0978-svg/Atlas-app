/**
 * QUI ATTEINT QUOI — et l'unique endroit où la question se tranche.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La règle vient du patron**, `docs/QUESTIONS.md` §10, tranchée le 13 août
 * 2026 et précisée le 23 :
 *
 * > *« Les commerciaux auront accès à l'entièreté de l'application, sauf aux
 * > réglages pour modifier la mise en page des devis et aux informations liées
 * > à l'entreprise. Et les salariés, eux, auront accès qu'à la catégorie
 * > planning. »*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI UNE FONCTION PURE, ET POURQUOI ELLE EST SEULE.**
 *
 * La même liste sert à trois choses : dessiner la barre du bas, dessiner le
 * sommaire des réglages, et REFUSER une adresse tapée à la main. Deux
 * rédactions de la même règle finissent toujours par diverger (`CLAUDE.md` §3),
 * et ici la divergence porte un nom : un salarié qui ouvre l'adresse d'un PDF de
 * devis et y lit vos marges parce que seul le BOUTON avait été retiré.
 *
 * C'est exactement ce que §10 refuse d'avance : *« Les montants ne doivent pas
 * sortir du serveur pour qui n'a pas le droit de les voir — ni dans la page, ni
 * dans le PDF, ni dans une réponse d'API. »*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **DEUX SENS OPPOSÉS, ET C'EST DÉLIBÉRÉ.**
 *
 * | Rôle | Comment la liste se lit |
 * |---|---|
 * | commercial | **tout, SAUF** ce qui est nommé |
 * | salarié | **rien, SAUF** ce qui est nommé |
 *
 * Le salarié se garde par liste blanche parce qu'un écran neuf, ajouté demain
 * par une autre session, doit lui être **fermé d'office**. Une liste noire
 * l'aurait ouvert en silence — et personne ne s'en apercevrait avant qu'il y
 * lise un prix. Le commercial, lui, a droit à l'application entière : lui poser
 * une liste blanche obligerait à l'étendre à chaque écran neuf, et l'oubli se
 * verrait tout de suite (il vient se plaindre), donc il ne coûte rien.
 */

/** Les trois rôles. `membre` n'existe plus : repris en `salarie` (migration 0065). */
export type Role = "proprietaire" | "commercial" | "salarie";

export const ROLES: readonly Role[] = ["proprietaire", "commercial", "salarie"] as const;

/** Ce que la personne voit du planning. Réglé PAR PERSONNE, jamais par rôle. */
export type PorteePlanning = "tout" | "ses_equipes";

export function estRole(valeur: string | null | undefined): valeur is Role {
  return typeof valeur === "string" && (ROLES as readonly string[]).includes(valeur);
}

/**
 * Le mot à l'écran. **« Patron », pas « Propriétaire »** : c'est celui de sa
 * planche (`maquettes/atlas-reglages-equipe.html`) et celui qu'il emploie.
 */
export function libelleRole(role: Role): string {
  switch (role) {
    case "proprietaire":
      return "Patron";
    case "commercial":
      return "Commercial";
    case "salarie":
      return "Salarié";
  }
}

/**
 * Ce qu'un commercial n'atteint pas.
 *
 * Les deux premiers sont ses mots du 23 août. Les trois suivants demandent une
 * ligne chacun, parce qu'ils ne sont pas dans sa phrase :
 *
 * - **les accès** : un commercial qui donne les accès se nomme patron en deux
 *   appuis, et le rôle entier ne veut alors plus rien dire. Ce n'est pas une
 *   restriction de plus, c'est ce qui rend les autres vraies ;
 * - **l'abonnement** et **l'export des données** : le contrat Atlas, le moyen de
 *   paiement et l'export intégral de l'entreprise. C'est la même famille que
 *   « les informations liées à l'entreprise », qu'il a nommée — et sa table du
 *   13 août les excluait déjà, mot pour mot.
 */
const FERME_AU_COMMERCIAL = [
  // « la mise en page des devis » — ses mots.
  "/reglages/documents",
  // « les informations liées à l'entreprise » — ses mots. Identité, SIRET, IBAN.
  "/reglages/identite",
  "/reglages/equipe",
  "/reglages/abonnement",
  "/reglages/donnees",
] as const;

/**
 * **`/reglages/tarifs` et `/reglages/prix` NE sont PAS dans cette liste, et
 * pourtant un commercial n'y lit rien aujourd'hui.**
 *
 * Ces deux pages portent leur propre garde `estProprietaire` depuis le 23 août,
 * et elles la gardent : les rendre *lisibles sans être modifiables* est un
 * travail d'écran, qui se dessine avant de se coder. Le commercial voit donc la
 * rubrique et lit, en l'ouvrant, à qui elle appartient (`RubriqueReservee` —
 * elle explique, elle ne refuse pas).
 *
 * **Elles ne sont pas fermées ICI parce que la règle du patron dit l'inverse** —
 * *« il lit les tarifs, il ne les change pas »* (13 août) : les inscrire
 * ci-dessus graverait dans la règle un état qui n'est que provisoire, et les
 * retirerait de son sommaire le jour où l'écran sera fait. C'est noté dans
 * `TODO.md`, pas caché ici.
 */

/**
 * Ce qu'un salarié atteint, et **rien d'autre**.
 *
 * *« Les salariés, eux, auront accès qu'à la catégorie planning »* (23 août).
 * S'y ajoutent deux choses qu'il a demandées ailleurs, et une qui est une
 * obligation :
 *
 * - **la feuille de chantier en PDF** — le devis sans un seul montant, sa
 *   décision du 21 août : *« le plus simple, ça serait de mettre le devis en PDF
 *   sans les prix »*. C'est le SEUL document qu'un salarié verra jamais, et le
 *   planning est le seul endroit d'où il l'ouvre ;
 * - **ses propres réglages** — *« un salarié peut changer ses notifications ou
 *   son mot de passe »* (13 août). Quelles rubriques exactement, c'est
 *   `rubriquesReglages` qui le dit, pas cette liste-ci ;
 * - **les documents légaux**, qu'il doit accepter pour entrer : les lui fermer
 *   l'enfermerait dehors.
 *
 * **`/chantiers/…` n'y est PAS, et c'est le point le plus important de ce
 * fichier.** La fiche d'un chantier porte le devis, les prix, la facture. Ce que
 * le patron appelle « ses chantiers autorisés », un salarié l'obtient par le
 * planning — la carte du chantier (nom, client, adresse, téléphone, créneau,
 * pense-bête) et la feuille sans montants —, jamais par cette page-là.
 */
const OUVERT_AU_SALARIE = [
  "/planning",
  "/reglages",
  "/documents-legaux",
  // Les polices du rendu et les sondes de santé : aucune donnée d'entreprise.
  "/api/polices",
  "/api/health",
] as const;

/**
 * Les réglages qui appartiennent à la PERSONNE — elle les emporte d'une
 * entreprise à l'autre, et son rôle n'y change rien.
 *
 * *« Un salarié peut changer ses notifications ou son mot de passe, mais il ne
 * doit évidemment pas pouvoir modifier les tarifs ou les coordonnées
 * bancaires »* (13 août 2026).
 */
const REGLAGES_A_SOI = [
  "/reglages/compte",
  "/reglages/notifications",
  "/reglages/connexion",
  "/reglages/apparence",
] as const;

/** La feuille de chantier sans montants : `/api/chantiers/<id>/feuille/pdf`. */
const FEUILLE_SANS_MONTANTS = /^\/api\/chantiers\/[^/]+\/feuille\/pdf\/?$/;

function sousChemin(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

/**
 * Cette personne a-t-elle le droit d'ouvrir cette adresse ?
 *
 * **Ne connaît pas les chemins PUBLICS**, et ne doit pas les connaître : ceux-là
 * s'atteignent sans compte, donc sans rôle (`src/lib/chemins-publics.ts`). Les
 * mêler ici ferait naître la seconde liste que ce dépôt a déjà payée deux fois.
 */
export function cheminAutorise(role: Role, chemin: string): boolean {
  // Une adresse qu'on ne sait pas lire n'est pas une adresse autorisée.
  if (!chemin.startsWith("/")) return false;

  if (role === "proprietaire") return true;

  if (role === "commercial") {
    return !FERME_AU_COMMERCIAL.some((p) => sousChemin(chemin, p));
  }

  if (FEUILLE_SANS_MONTANTS.test(chemin)) return true;
  if (!OUVERT_AU_SALARIE.some((p) => sousChemin(chemin, p))) return false;

  /**
   * **Les réglages sont ouverts au salarié, mais pas TOUS les réglages.**
   *
   * `/reglages` mène à son compte, son mot de passe et ses notifications ; il ne
   * mène ni aux tarifs ni à l'identité de l'entreprise.
   *
   * **Ce fichier-ci décide, le sommaire ne fait qu'obéir.** `rubriques-reglages`
   * filtre SES rubriques par `cheminAutorise` — jamais l'inverse : une seconde
   * liste écrite là-bas se serait tue le jour où l'on ajoute une rubrique ici,
   * et la dépendance ne va donc que dans un sens (`CLAUDE.md` §3).
   */
  if (sousChemin(chemin, "/reglages")) {
    if (chemin === "/reglages") return true;
    return REGLAGES_A_SOI.some((h) => sousChemin(chemin, h));
  }

  return true;
}

/**
 * Où l'on renvoie quelqu'un qui a visé une adresse qui n'est pas la sienne.
 *
 * **Toujours une adresse que le rôle atteint** : un refus qui renverrait vers un
 * autre refus tournerait en boucle, et le navigateur n'afficherait plus rien du
 * tout. `/planning` est ouvert aux trois rôles — c'est ce qui rend ce repli sûr
 * par construction.
 */
export function accueilDuRole(role: Role): string {
  return role === "salarie" ? "/planning" : "/";
}

/**
 * Les onglets du bas, pour ce rôle.
 *
 * **La barre se dessine à partir de la MÊME règle qui refuse.** Un onglet
 * affiché qui mènerait à un refus se lit comme une panne ; un onglet caché dont
 * l'adresse répondrait quand même serait un mensonge. Les deux viennent d'ici.
 */
export function ongletsDuRole(role: Role, onglets: readonly { href: string }[]): { href: string }[] {
  return onglets.filter((o) => cheminAutorise(role, o.href));
}

/**
 * Cette personne peut-elle voir un montant ?
 *
 * Le patron chiffre, le commercial vend — *« il en a besoin pour vendre »*
 * (13 août). Le salarié, jamais : c'est toute la raison de la feuille sans prix.
 */
export function peutVoirLesMontants(role: Role): boolean {
  return role !== "salarie";
}

/**
 * L'assistant, est-ce pour cette personne ?
 *
 * **Sa demande du 25 août 2026 :** *« qu'il se comporte comme un vrai assistant
 * au service de l'utilisateur principal seulement le principal »*. Livré ce
 * jour-là au patron seul — puis **ouvert aux commerciaux le 26, sur sa réponse :
 * *« oui tu peux l'ouvrir aux commerciaux »*.**
 *
 * Il suit donc `peutVoirLesMontants`, et ce n'est pas une paraphrase : c'est un
 * appel. Les deux règles pourraient diverger demain — c'est même pour cela que
 * celle-ci porte son propre nom —, mais tant qu'elles disent la même chose,
 * elles ne s'écrivent qu'une fois (`CLAUDE.md` §3).
 *
 * **Ce qui avait fait hésiter, et qu'il a tranché.** Depuis le 25 août,
 * l'assistant cherche une ligne dans le devis de N'IMPORTE QUEL client
 * (`RechercherLignesDevis`) : un commercial y lit ce que chacun a payé pour la
 * même prestation. Il voit déjà ces prix écran par écran — c'est son métier de
 * vendre —, et le patron a jugé que la conversation ne changeait rien à cela.
 *
 * **Le salarié, lui, reste dehors**, et pour la raison de toujours : la feuille
 * de chantier part sans prix, et l'assistant les rendrait en une phrase.
 */
export function peutUtiliserLAssistant(role: Role): boolean {
  return peutVoirLesMontants(role);
}

/**
 * Ce que le rôle change, en français, pour l'écran qui donne un accès.
 *
 * **Le texte vit ici, avec la règle qu'il décrit.** Écrit dans l'écran, il
 * aurait vieilli à la première restriction déplacée — et une promesse fausse sur
 * un écran d'accès est pire que pas d'écran : le patron croirait avoir fermé.
 */
export function ceQueLeRoleChange(role: Role): { peut: string[]; nonPlus: string[] } {
  switch (role) {
    case "proprietaire":
      return {
        peut: ["Tout Atlas", "Les tarifs, l'identité, l'IBAN, l'abonnement", "Donner et retirer les accès"],
        nonPlus: [],
      };
    case "commercial":
      return {
        peut: ["Les chantiers, le planning, les devis et les prix", "Les factures et le relevé de TVA"],
        nonPlus: ["La mise en page des devis", "L'identité de l'entreprise et l'IBAN", "Les accès et l'abonnement"],
      };
    case "salarie":
      return {
        peut: ["Le planning", "La feuille de chantier, sans un seul montant"],
        nonPlus: ["Les prix, les devis, les factures", "Les chantiers et les clients", "Les réglages de l'entreprise"],
      };
  }
}

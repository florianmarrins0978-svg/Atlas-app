/**
 * UNE IDÉE POUR L'APPLI — les règles, sans base ni écran.
 *
 * **Sa demande du 5 novembre 2026** : *« que l'utilisateur puisse à chaque fois
 * me dire ce qu'il aimerait avoir en plus dans l'application »*. Sa planche du
 * même soir (`appli/soignee/une-idee-pour-l-appli.html`), ses choix 1 A, 2 B,
 * 3 B : « Une idée pour l'appli », l'artisan suit ses idées, l'éditeur les
 * range, et l'assistant propose d'en envoyer une quand il ne sait pas faire.
 *
 * **Ce qui se lit ici sert aux deux bouts** : l'écran de l'artisan, celui de
 * l'éditeur et le serveur qui revalide (`CLAUDE.md` §3, jamais deux fois la
 * même règle).
 */
import { libelleRole, type Role } from "./acces-roles";
import { jourEtMois, jourIso } from "./jour";

/** Le nom de la porte, son choix 1 A. */
export const NOM_DES_IDEES = "Une idée pour l'appli";

export const ETATS_IDEE = ["envoyee", "prevue", "pas_prevue", "faite"] as const;
export type EtatIdee = (typeof ETATS_IDEE)[number];

/** Les trois gestes de l'éditeur : « envoyée » est l'état de départ, pas un geste. */
export type TriIdee = Exclude<EtatIdee, "envoyee">;
export const TRIS_IDEE: readonly TriIdee[] = ["prevue", "pas_prevue", "faite"];

export function estTriIdee(valeur: unknown): valeur is TriIdee {
  return typeof valeur === "string" && (TRIS_IDEE as readonly string[]).includes(valeur);
}

/**
 * Le mot que l'ARTISAN lit sous son idée. « Faite » se dit « Dans l'appli » :
 * c'est ce qui l'intéresse, et c'est le mot de la planche.
 */
export function libelleEtatIdee(etat: EtatIdee): string {
  switch (etat) {
    case "envoyee":
      return "Envoyée";
    case "prevue":
      return "Prévue";
    case "pas_prevue":
      return "Pas prévue";
    case "faite":
      return "Dans l'appli";
  }
}

/** La couleur de la pastille : bleu pour ce qui vient, vert pour ce qui est là. */
export function tonEtatIdee(etat: EtatIdee): "neutre" | "bleu" | "vert" {
  if (etat === "prevue") return "bleu";
  if (etat === "faite") return "vert";
  return "neutre";
}

/** Le mot du bouton de l'éditeur : chez lui, « Faite » se dit « Faite ». */
export function libelleDuTri(tri: TriIdee): string {
  if (tri === "prevue") return "Prévue";
  if (tri === "pas_prevue") return "Pas prévue";
  return "Faite";
}

/** Le mot du tiroir de l'éditeur, après un geste. */
export function ditApresTri(tri: TriIdee): string {
  switch (tri) {
    case "prevue":
      return "Marquée prévue.";
    case "pas_prevue":
      return "Marquée pas prévue.";
    case "faite":
      return "Marquée faite.";
  }
}

/** Les trois onglets de l'éditeur. Une idée faite ou refusée est « traitée ». */
export type OngletIdees = "nouvelles" | "prevues" | "traitees";
export const ONGLETS_IDEES: readonly { cle: OngletIdees; nom: string }[] = [
  { cle: "nouvelles", nom: "Nouvelles" },
  { cle: "prevues", nom: "Prévues" },
  { cle: "traitees", nom: "Traitées" },
];

export function ongletDeLIdee(etat: EtatIdee): OngletIdees {
  if (etat === "envoyee") return "nouvelles";
  if (etat === "prevue") return "prevues";
  return "traitees";
}

/** Les gestes offerts à l'éditeur selon l'onglet : une idée prévue ne se re-prévoit pas. */
export function trisPossibles(etat: EtatIdee): TriIdee[] {
  if (etat === "envoyee") return ["prevue", "pas_prevue"];
  if (etat === "prevue") return ["faite"];
  return [];
}

export const TEXTE_IDEE_MAX = 2000;
export const REPONSE_IDEE_MAX = 1000;

/**
 * Ce qui part, une fois relu par le serveur. Un texte vide ne part pas, un
 * texte trop long non plus : la base le refuserait de toute façon
 * (`drizzle/0167`), mais avec une erreur qu'il ne lirait jamais.
 */
export function texteDIdeeValide(
  brut: unknown,
  max: number = TEXTE_IDEE_MAX,
  siVide: string = "Écrivez d'abord votre idée."
): { ok: true; texte: string } | { ok: false; message: string } {
  const texte = typeof brut === "string" ? brut.trim() : "";
  if (!texte) return { ok: false, message: siVide };
  if (texte.length > max) return { ok: false, message: `C'est un peu long : ${max} caractères au plus.` };
  return { ok: true, texte };
}

/**
 * La date d'une idée, et rien d'autre : sa règle du 5 novembre, *« l'heure,
 * ça sert à rien, juste la date »*. L'année ne s'écrit que si ce n'est pas
 * celle d'aujourd'hui.
 */
export function dateDeLIdee(envoyeeLe: Date, maintenant: Date = new Date()): string {
  const iso = jourIso(envoyeeLe);
  const annee = iso.slice(0, 4) === jourIso(maintenant).slice(0, 4) ? "" : ` ${iso.slice(0, 4)}`;
  return `Le ${jourEtMois(iso)}${annee}`;
}

/**
 * Qui l'a envoyée, en une phrase : « Marc, patron chez Jardins Démo. »
 * Ni « à la voix » ni « écrite », ni l'écran d'où elle vient : sa règle du
 * 5 novembre, *« on s'en fout de marquer ça »*.
 */
export function quiAEnvoye(auteurNom: string, role: Role, entrepriseNom: string): string {
  return `${auteurNom}, ${roleEnMots(role)} chez ${entrepriseNom}.`;
}

function roleEnMots(role: Role): string {
  // « Facturation » est un rôle, pas un titre : « Sophie, facturation chez… »
  // ne se dit pas. Les trois autres se disent comme le libellé.
  if (role === "facturation") return "à la facturation";
  return libelleRole(role).toLowerCase();
}

/**
 * Le nom figé sur l'idée au moment de l'envoi. Le prénom d'abord, puis le nom,
 * puis l'adresse : un compte sans nom écrit garde quand même un auteur.
 */
export function nomDeLAuteur(personne: { prenom: string | null; nom: string | null; email: string }): string {
  const prenom = personne.prenom?.trim();
  if (prenom) return prenom.slice(0, 120);
  const nom = personne.nom?.trim();
  if (nom) return nom.slice(0, 120);
  return personne.email.slice(0, 120);
}

/**
 * **« Votre idée est dans l'appli », sur la ligne des Réglages.** Elle se dit
 * pendant deux semaines après le geste de l'éditeur, puis se tait : un mot qui
 * reste pour toujours finit par ne plus se lire, et suivre ce qu'il a déjà vu
 * demanderait d'écrire en base à chaque ouverture de l'écran.
 */
export const IDEE_FAITE_SE_DIT_PENDANT_JOURS = 14;

export function ideeFaiteRecemment(
  idee: { etat: EtatIdee; traiteeLe: Date | null },
  maintenant: Date = new Date()
): boolean {
  if (idee.etat !== "faite" || !idee.traiteeLe) return false;
  const ecart = maintenant.getTime() - idee.traiteeLe.getTime();
  return ecart >= 0 && ecart <= IDEE_FAITE_SE_DIT_PENDANT_JOURS * 24 * 3600 * 1000;
}

/** La pastille de l'éditeur sur sa ligne des Réglages. */
export function nouvellesEnMots(nombre: number): string | null {
  if (nombre <= 0) return null;
  return nombre === 1 ? "1 nouvelle" : `${nombre} nouvelles`;
}

/**
 * **Le courriel qui prévient l'éditeur. Il dit QUI, jamais QUOI** : le texte
 * d'une idée peut nommer un client, il reste dans Atlas, derrière son mot de
 * passe. Un seul par journée (`idees_alertes`), et il le dit, pour qu'il ne
 * croie pas que les suivantes se sont perdues.
 */
export function courrielDAlerte(entrepriseNom: string): { objet: string; texte: string } {
  return {
    objet: "Une idée vous attend dans Atlas",
    texte: [
      `${entrepriseNom} vous a envoyé une idée.`,
      "",
      "Elle se lit dans Atlas : Réglages, puis Les idées reçues.",
      "",
      "Les autres idées de la journée vous attendent au même endroit, sans nouveau courriel.",
    ].join("\n"),
  };
}

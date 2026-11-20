/**
 * Ranger un diagnostic dans un dossier, avec une note : les règles, sans base
 * ni écran (sa demande du 20 novembre 2026, planche
 * `appli/soignee/diagnostic-dossiers.html`).
 *
 * **Un chantier est déjà un dossier** ; ses dossiers à lui servent à ce qui
 * n'a pas de chantier. Ses deux réponses sur la planche : le dossier d'un
 * chantier ne se montre pas sur la fiche du chantier, et la note s'écrit au
 * clavier seulement.
 *
 * La même fonction lit ce que l'écran envoie et ce que le serveur revalide
 * (`CLAUDE.md` §3) : la feuille borne le texte avec les mêmes chiffres que la
 * base (`dossiers_diagnostic_nom_ck`, `diagnostics_note_ck`).
 */

export const NOM_DE_DOSSIER_MAX = 60;
export const NOTE_MAX = 2000;

/** Où il range : un chantier, un dossier à lui, ou un dossier qu'il crée. */
export type Destination =
  | { genre: "chantier"; id: string }
  | { genre: "dossier"; id: string }
  | { genre: "nouveau"; nom: string };

export type RefusDeRangement = "nom_vide" | "nom_trop_long" | "note_trop_longue";

export const PHRASES_DE_REFUS: Record<RefusDeRangement, string> = {
  nom_vide: "Donnez un nom au dossier.",
  nom_trop_long: `Le nom tient en ${NOM_DE_DOSSIER_MAX} caractères.`,
  note_trop_longue: `La note tient en ${NOTE_MAX} caractères.`,
};

/** Les espaces en trop disparaissent : « Mes  observations » et « Mes
 *  observations » sont le même dossier, et la base le tient aussi. */
export function lireNomDeDossier(brut: string): { ok: true; nom: string } | { ok: false; refus: RefusDeRangement } {
  const nom = brut.replace(/\s+/g, " ").trim();
  if (nom.length === 0) return { ok: false, refus: "nom_vide" };
  if (nom.length > NOM_DE_DOSSIER_MAX) return { ok: false, refus: "nom_trop_long" };
  return { ok: true, nom };
}

/** Une note vide n'est pas une note : elle se range comme absente. Les retours
 *  à la ligne restent, c'est lui qui les a tapés. */
export function lireNote(brut: string | null | undefined): { ok: true; note: string | null } | { ok: false; refus: RefusDeRangement } {
  const note = (brut ?? "").trim();
  if (note.length === 0) return { ok: true, note: null };
  if (note.length > NOTE_MAX) return { ok: false, refus: "note_trop_longue" };
  return { ok: true, note };
}

/** « 12 novembre », et l'année seulement quand ce n'est pas celle-ci : à
 *  l'heure de Paris, qui est celle de ses chantiers. */
export function jourEnMots(jour: Date, maintenant: Date): string {
  const annee = (d: Date) => d.toLocaleDateString("fr-FR", { year: "numeric", timeZone: "Europe/Paris" });
  const memeAnnee = annee(jour) === annee(maintenant);
  const date = jour.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    ...(memeAnnee ? {} : { year: "numeric" as const }),
    timeZone: "Europe/Paris",
  });
  // Le navigateur écrit « 1 janvier » ; on écrit « 1er janvier ».
  return date.replace(/^1 /, "1er ");
}

/**
 * « Rangée dans Terrasse bois, le 12 novembre. » La date se tait quand elle
 * n'a pas été enregistrée (un rattachement d'avant la migration 0189) : on ne
 * l'invente pas.
 */
export function phraseRangee(nom: string, rangeLe: Date | null, maintenant: Date): string {
  return rangeLe ? `Rangée dans ${nom}, le ${jourEnMots(rangeLe, maintenant)}.` : `Rangée dans ${nom}.`;
}

/**
 * La ligne d'un dossier sur l'écran Diagnostic : « Chantier, 2 photos, la
 * dernière le 12 novembre. » La date ne se dit qu'à partir de deux : sous une
 * seule photo, elle ne départage rien.
 */
export function situationDuDossier(
  genre: "chantier" | "dossier",
  nombre: number,
  derniere: Date | null,
  maintenant: Date
): string {
  const quoi = genre === "chantier" ? "Chantier" : "Mon dossier";
  const combien = `${nombre} photo${nombre > 1 ? "s" : ""}`;
  if (nombre > 1 && derniere) return `${quoi}, ${combien}, la dernière le ${jourEnMots(derniere, maintenant)}.`;
  return `${quoi}, ${combien}.`;
}

/**
 * La ligne d'un diagnostic dans son dossier : « Le 12 novembre. » puis le
 * début de sa note, coupé au mot et jamais au milieu d'un mot.
 */
export function ligneDuDiagnostic(le: Date, note: string | null, maintenant: Date, longueur = 90): string {
  const jour = `Le ${jourEnMots(le, maintenant)}.`;
  if (!note) return jour;
  const uneLigne = note.replace(/\s+/g, " ").trim();
  if (uneLigne.length <= longueur) return `${jour} ${uneLigne}`;
  const coupe = uneLigne.slice(0, longueur);
  const finDeMot = coupe.lastIndexOf(" ");
  return `${jour} ${(finDeMot > 20 ? coupe.slice(0, finDeMot) : coupe).replace(/[,;:.]$/, "")}…`;
}

/**
 * Le nom d'un diagnostic dans son dossier : la fiche qu'il a rendue, sinon ce
 * que l'écran du résultat titrait. Jamais un nom deviné pour un diagnostic qui
 * n'a pas conclu.
 */
export function nomDuDiagnostic(statut: string, nomDeLaFiche: string | null): string {
  if (statut === "rendu") return nomDeLaFiche ?? "Diagnostic";
  if (statut === "inconclusif") return "Sans conclusion";
  if (statut === "echoue") return "La photo n’a pas été regardée";
  if (statut === "complement_demande") return "Une photo de plus";
  return "Analyse en cours";
}

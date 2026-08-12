/**
 * Traduire une panne d'enregistrement en une phrase qui désigne le coupable.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette fonction existe.** Le 11 août 2026, l'écran affichait
 * « Impossible d'enregistrer la note » quoi qu'il arrive. Les refus ATTENDUS
 * ont été rendus bavards le soir même — format, taille, cadence, enregistrement
 * vide. Mais les pannes IMPRÉVUES, elles, continuaient de lever, et le patron
 * a rapporté le 12 août la phrase de secours : *« l'enregistrement n'a pas pu
 * être transmis — la connexion a été interrompue »*.
 *
 * C'était le correctif à moitié fait. La catégorie laissée muette est
 * précisément celle qui se produisait, et sa phrase **accusait le mauvais
 * coupable** : elle désignait le réseau alors que l'aller-retour avait très bien
 * eu lieu, et que c'est le serveur qui avait échoué. Une erreur qui envoie
 * chercher au mauvais endroit coûte plus cher que pas d'erreur du tout
 * (`AGENTS.md`).
 *
 * **Ce qu'on montre, et ce qu'on retient.** Le détail technique reste au
 * journal ; l'écran reçoit une phrase choisie. Ce n'est pas de la pudeur : le
 * 11 août, une erreur de base non traduite a affiché **la requête SQL entière**
 * — noms de tables et identifiant d'entreprise compris. Traduire, c'est aussi
 * cesser de déverser la tuyauterie sur l'écran d'un artisan.
 */

/** Le maillon qui a cassé. Sert à l'écran ET au journal. */
export type EtapeNote = "session" | "cadence" | "lecture" | "stockage" | "base";

const PHRASE: Record<EtapeNote, string> = {
  session:
    "Votre session a expiré. Rechargez la page, reconnectez-vous, puis refaites la note — " +
    "l'enregistrement n'a pas été perdu par le micro, seulement par la session.",
  cadence:
    "Le service qui compte les envois ne répond pas. L'enregistrement n'a pas été rangé ; " +
    "réessayez dans un instant.",
  lecture: "L'enregistrement n'a pas pu être relu jusqu'au bout. Refaites la note.",
  stockage: "Le serveur n'a pas pu écrire l'enregistrement.",
  base: "L'enregistrement a été écrit, mais la fiche du chantier n'a pas pu être mise à jour.",
};

/**
 * Les pannes qui se reconnaissent au message, et qui méritent leur propre
 * phrase parce qu'elles appellent un geste PRÉCIS.
 *
 * Le disque plein en est le cas d'école : « le serveur n'a pas pu écrire »
 * envoie chercher un défaut d'application, alors que la réponse tient en un mot
 * et qu'aucun correctif de code n'y changera rien.
 */
function pannePrecise(brut: string): string | null {
  const t = brut.toLowerCase();
  if (t.includes("enospc") || t.includes("no space left")) {
    return "Le disque du serveur est plein : l'enregistrement n'a pas pu être écrit. Libérez de la place, puis refaites la note.";
  }
  if (t.includes("eacces") || t.includes("eperm") || t.includes("permission denied")) {
    return "Le serveur n'a pas le droit d'écrire là où il range les enregistrements.";
  }
  if (t.includes("econnrefused") || t.includes("enotfound") || t.includes("etimedout")) {
    return "Un service dont dépend l'enregistrement ne répond pas. Réessayez dans un instant ; s'il insiste, l'espace de travail est à relancer.";
  }
  return null;
}

/**
 * La phrase à montrer, pour une panne survenue à `etape`.
 *
 * **Elle nomme toujours l'étape**, même quand une panne précise est reconnue :
 * c'est ce qui permet au patron de rapporter le maillon sans avoir à lire un
 * journal, et donc de faire l'économie d'un aller-retour.
 */
export function messageDePanne(etape: EtapeNote, erreur: unknown): string {
  const brut = erreur instanceof Error ? erreur.message : String(erreur ?? "");
  const precise = pannePrecise(brut);
  return `${precise ?? PHRASE[etape]} (étape : ${etape})`;
}

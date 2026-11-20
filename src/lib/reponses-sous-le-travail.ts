import { mesureLisible } from "./questions-chiffrage";
import { lireCaracteristiques } from "./prestation-structuree";

/**
 * ─── SES RÉPONSES À LA GRILLE, SOUS LE TRAVAIL DU DEVIS ─────────────────────
 *
 * Sa planche du 20 novembre 2026 (`appli/soignee/devis-reponses-sous-le-travail.html`),
 * son « oui » le même jour. Depuis §588, ce qu'il a choisi dans sa grille ne
 * s'écrit plus sur la désignation ; il ne le relisait plus nulle part (*« la
 * page information, je n'y ai jamais accès »*). Ses réponses reviennent donc
 * sous le travail, pour lui seul : ni le PDF ni le client ne les voient.
 *
 * **Lues dans leurs cases, jamais dans le libellé** : la technique
 * (`methode`, nommée dans SA grille par `listerPrestationsDuDevis`) et les
 * mesures (`caracteristiques`). C'est le premier temps du rangement qu'il a
 * demandé : le libellé pourra cesser de les porter sans que cette ligne change.
 */

/** Une prestation telle que le devis la lit. */
export type PrestationRepondue = {
  id: string;
  methodeLibelle: string | null;
  caracteristiques: unknown;
};

/** Le lien d'une ligne du devis aux prestations qu'elle vend, dans leur ordre. */
export type LienDeLaLigne = { lignePrixId: string; prestationId: string };

// La longueur d'une haie est la quantité de sa ligne : la redire ici la
// répéterait. Seules les mesures qu'il a données à la grille.
const MESURES_DITES = [
  ["diametreCm", ".diametre", "cm"],
  ["hauteurM", ".hauteur", "m"],
  ["futM", ".fut", "m"],
] as const;

/** « Abattage entre 10 et 20 m, ⌀ 80 cm » ; `null` quand il n'a rien répondu. */
export function reponsesDuTravail(p: Pick<PrestationRepondue, "methodeLibelle" | "caracteristiques">): string | null {
  const mesures = lireCaracteristiques(p.caracteristiques);
  const morceaux = [
    p.methodeLibelle?.trim() ?? "",
    ...MESURES_DITES.flatMap(([cle, sujet, unite]) => {
      const v = mesures[cle];
      return v === undefined ? [] : [mesureLisible(sujet, String(v), unite)];
    }),
  ].filter((m) => m !== "");
  if (morceaux.length === 0) return null;
  const phrase = morceaux.join(", ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Ce que chaque ligne du devis dit de ses réponses : une phrase par travail
 * qu'elle vend, sans redire deux fois la même (trois chênes abattus de la même
 * façon n'en font qu'une).
 */
export function reponsesSousLesLignes(
  liens: readonly LienDeLaLigne[],
  prestations: readonly PrestationRepondue[]
): Record<string, string[]> {
  const parId = new Map(prestations.map((p) => [p.id, p]));
  const resultat: Record<string, string[]> = {};
  for (const lien of liens) {
    const p = parId.get(lien.prestationId);
    const phrase = p ? reponsesDuTravail(p) : null;
    if (phrase === null) continue;
    const deja = (resultat[lien.lignePrixId] ??= []);
    if (!deja.includes(phrase)) deja.push(phrase);
  }
  return resultat;
}

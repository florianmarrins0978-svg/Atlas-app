// Les jours fériés français, pour n'importe quelle année.
//
// **Sa réponse du 5 novembre 2026** : *« le calendrier doit connaître les jours
// fériés ; on doit quand même pouvoir les proposer, mais il faut mettre une
// couleur particulière pour qu'on les voie d'un coup d'œil »* (planche
// `appli/soignee/jours-feries.html`, le bleu choisi le même soir). Puis : *« il
// faut que chaque année l'application se mette à jour »*. Elle n'a rien à
// mettre à jour : les huit dates fixes ne bougent pas, et les trois autres se
// déduisent de Pâques, calculé ici. Seule une loi qui créerait ou retirerait
// un férié demanderait de toucher à ce fichier.
//
// **Ce fichier ne décide pas qu'un férié est fermé.** Il le NOMME. Le planning
// le peint en bleu et continue de le proposer (sa règle) ; le compte des jours
// travaillés le retire des jours ouvrés. Deux écrans, une seule liste.

import type { JourIso } from "@/lib/disponibilites";

/**
 * Le dimanche de Pâques, calendrier grégorien (algorithme de Meeus, Jones et
 * Butcher). Exact pour toutes les années grégoriennes : 2026 donne le 5 avril,
 * 2027 le 28 mars, 2038 le 25 avril (le plus tard possible).
 */
export function dimancheDePaques(annee: number): JourIso {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return jour(annee, Math.floor(n / 31), (n % 31) + 1);
}

function jour(annee: number, mois: number, numero: number): JourIso {
  return `${annee}-${String(mois).padStart(2, "0")}-${String(numero).padStart(2, "0")}`;
}

function decaler(j: JourIso, n: number): JourIso {
  const d = new Date(`${j}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Les fériés d'une année, du jour vers son nom.
 *
 * **L'Alsace et la Moselle en ont deux de plus** (code du travail,
 * L. 3134-13) : le Vendredi saint et le 26 décembre. Un artisan de Metz ou de
 * Colmar qui ne les verrait pas compterait deux jours travaillés de trop.
 */
export function feriesDeLAnnee(annee: number, alsaceMoselle = false): ReadonlyMap<JourIso, string> {
  const paques = dimancheDePaques(annee);
  const liste: [JourIso, string][] = [
    [jour(annee, 1, 1), "Jour de l’an"],
    [decaler(paques, 1), "Lundi de Pâques"],
    [jour(annee, 5, 1), "Fête du Travail"],
    [jour(annee, 5, 8), "Victoire 1945"],
    [decaler(paques, 39), "Ascension"],
    [decaler(paques, 50), "Lundi de Pentecôte"],
    [jour(annee, 7, 14), "Fête nationale"],
    [jour(annee, 8, 15), "Assomption"],
    [jour(annee, 11, 1), "Toussaint"],
    [jour(annee, 11, 11), "Armistice 1918"],
    [jour(annee, 12, 25), "Noël"],
  ];
  if (alsaceMoselle) {
    liste.push([decaler(paques, -2), "Vendredi saint"], [jour(annee, 12, 26), "Saint-Étienne"]);
  }
  return new Map(liste);
}

/** Le nom du férié de ce jour, ou `null` : la question que posent les écrans. */
export function nomDuFerie(j: JourIso, alsaceMoselle = false): string | null {
  return feriesDeLAnnee(Number(j.slice(0, 4)), alsaceMoselle).get(j) ?? null;
}

/**
 * L'entreprise est-elle en Alsace ou en Moselle ? Lu dans le code postal de son
 * adresse (57, 67, 68).
 *
 * **Sans code postal, la réponse est non**, et c'est le côté sûr : la liste
 * nationale reste juste partout ; il ne manquerait que deux jours peints en
 * bleu, que le patron corrige au besoin dans les jours travaillés. Le
 * contraire marquerait fériés deux jours travaillés partout ailleurs.
 */
export function estEnAlsaceMoselle(adresse: string | null | undefined): boolean {
  if (!adresse) return false;
  const codes = adresse.match(/\b\d{5}\b/g);
  if (!codes) return false;
  // Le DERNIER code de l'adresse : « 12 rue du 11 Novembre 1918, 57000 Metz »
  // ne porte qu'un code, mais une rue numérotée sur cinq chiffres existe
  // rarement ; le code postal s'écrit en fin d'adresse, avant la ville.
  const departement = codes[codes.length - 1].slice(0, 2);
  return departement === "57" || departement === "67" || departement === "68";
}

// ─── PRÉVENIR, JAMAIS BLOQUER — sa règle du 6 novembre 2026 ─────────────────
//
// *« Ça doit nous prévenir mais jamais nous bloquer »* : un chantier se pose
// sur un férié (on peut vouloir y travailler), et l'écran le dit. Ces deux
// fonctions rédigent l'avertissement ; aucune ne refuse quoi que ce soit.

/** Les fériés d'une liste de jours, dans l'ordre, chacun une fois. */
export function feriesParmi(jours: readonly JourIso[], alsaceMoselle = false): { jour: JourIso; nom: string }[] {
  return [...new Set(jours)]
    .sort()
    .map((jour) => ({ jour, nom: nomDuFerie(jour, alsaceMoselle) }))
    .filter((f): f is { jour: JourIso; nom: string } => f.nom !== null);
}

/** Les fériés qu'un geste vient de toucher : ceux d'après qui n'y étaient pas avant. */
export function feriesNouveaux(avant: readonly JourIso[], apres: readonly JourIso[], alsaceMoselle = false) {
  const deja = new Set(avant);
  return feriesParmi(apres.filter((j) => !deja.has(j)), alsaceMoselle);
}

function dateEnClair(jour: JourIso): string {
  const t = new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  return t.startsWith("1 ") ? `1ᵉʳ${t.slice(1)}` : t;
}

/**
 * « Le 11 novembre est férié (Armistice 1918). », « Le 11 novembre et le
 * 25 décembre sont fériés. » ; `null` sans férié.
 */
export function phraseDesFeries(feries: readonly { jour: JourIso; nom: string }[]): string | null {
  if (feries.length === 0) return null;
  if (feries.length === 1) return `Le ${dateEnClair(feries[0].jour)} est férié (${feries[0].nom}).`;
  const dates = feries.map((f) => `le ${dateEnClair(f.jour)}`);
  const liste = `${dates.slice(0, -1).join(", ")} et ${dates[dates.length - 1]}`;
  return `${liste.charAt(0).toUpperCase()}${liste.slice(1)} sont fériés.`;
}

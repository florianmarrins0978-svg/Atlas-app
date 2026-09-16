import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Empreinte } from "./_batterie-solitaire";

/**
 * CE QUE LA BATTERIE A DIT LA DERNIÈRE FOIS, ET SUR QUEL ARBRE.
 *
 * **Sans cette trace, `_portee-batterie.ts` n'a rien à comparer** : c'est elle
 * qui permet de répondre « rien n'a bougé depuis, la mesure rendrait le même
 * résultat » plutôt que de repartir pour vingt minutes.
 *
 * **Le fichier n'est pas versionné** (`.gitignore`) : il décrit l'état d'UNE
 * machine à UN instant. Le committer ferait refuser une batterie chez
 * quelqu'un qui ne l'a jamais jouée — le pire des faux positifs, puisqu'il
 * frapperait celui qui arrive.
 *
 * **Il ne bloque jamais rien à lui seul** : absent, illisible, écrit par une
 * version d'avant — dans les trois cas on rend `null`, et la batterie part
 * normalement. Un garde-fou qui tombe en panne doit tomber du côté de la
 * mesure, jamais du côté du refus.
 */
export type DernierVerdict = {
  /** L'instant où la batterie a rendu, en millisecondes. */
  quand: number;
  /** La ligne exacte qu'elle a écrite — relue telle quelle, jamais résumée. */
  verdict: string;
  /**
   * Vert ou non. **Seul un vert peut faire refuser la batterie suivante** :
   * un rouge sur un arbre inchangé accuse souvent la machine — Postgres
   * arrêté, un port pris, une suite voisine qui vidait la base —, et le
   * rejouer est alors le seul moyen de le savoir. Une trace d'avant ce champ
   * se lit comme un rouge : on mesure.
   */
  vert: boolean;
  /** L'arbre sur lequel elle a mesuré. */
  empreinte: Empreinte;
  /**
   * QUEL contrôle a rendu ce verdict — 3 la batterie complète, 2
   * `verifier:avant-fusion`.
   *
   * **Ajouté le 14 septembre 2026, pour `garde-fusion-main.mjs`.** Il refuse
   * une poussée vers `main` dont le contrôle n'atteint pas le niveau que le lot
   * exige (`.claude/rules/testing.md`) : sans ce champ, il lui faudrait deviner
   * d'après la phrase du verdict, ou tenir un second témoin à côté — c'est-à-dire
   * deux façons de dire la même chose (`CLAUDE.md` §3).
   *
   * Absent sur une trace d'avant ce champ : le garde-fou la lit alors comme un
   * niveau 0, donc insuffisante. On remesure, ce qui est le repli sûr.
   */
  niveau?: 2 | 3;
  /**
   * **QUELLES suites ont rougi — 16 septembre 2026.** Sans elles, un verdict
   * rouge ne dit que « rouge », et le garde-fou de `main` ne peut pas le
   * comparer à l'état connu de `main` (`_reference-batterie.mjs`) : il refuse
   * tout, pour toujours, dès qu'une machine porte un rouge d'outillage.
   *
   * Absent sur une trace d'avant ce champ : rien n'est comparable, on remesure.
   */
  rouges?: string[];
  /**
   * Les étapes tombées qui ne sont PAS des suites — types, lint, construction,
   * connexion —, ou dont le bilan ne tombe pas juste. Celles-là n'ont pas de
   * « rouge connu » : une seule suffit à fermer la fusion.
   */
  rougesHorsSuites?: string[];
  /** Le commit mesuré, pour dire de quoi on parle. */
  commit?: string;
};

function listeDeMots(x: unknown): string[] | undefined {
  return Array.isArray(x) && x.every((m) => typeof m === "string") ? [...(x as string[])] : undefined;
}

const NOM = ".atlas-dernier-verdict.json";

export function cheminDuVerdict(racine: string): string {
  return path.join(racine, NOM);
}

export function lireDernierVerdict(racine: string): DernierVerdict | null {
  const chemin = cheminDuVerdict(racine);
  if (!existsSync(chemin)) return null;
  try {
    const brut = JSON.parse(readFileSync(chemin, "utf8")) as {
      quand?: unknown;
      verdict?: unknown;
      vert?: unknown;
      niveau?: unknown;
      empreinte?: unknown;
      rouges?: unknown;
      rougesHorsSuites?: unknown;
      commit?: unknown;
    };
    if (typeof brut.quand !== "number" || typeof brut.verdict !== "string") return null;
    if (!Array.isArray(brut.empreinte)) return null;
    return {
      quand: brut.quand,
      verdict: brut.verdict,
      vert: brut.vert === true,
      niveau: brut.niveau === 3 ? 3 : brut.niveau === 2 ? 2 : undefined,
      empreinte: new Map(brut.empreinte as [string, { date: number; empreinte: string }][]),
      rouges: listeDeMots(brut.rouges),
      rougesHorsSuites: listeDeMots(brut.rougesHorsSuites),
      commit: typeof brut.commit === "string" ? brut.commit : undefined,
    };
  } catch {
    // Un fichier illisible n'est pas une faute : on repart pour une mesure
    // complète, ce qui est exactement le repli sûr.
    return null;
  }
}

export function ecrireDernierVerdict(racine: string, v: DernierVerdict): void {
  try {
    writeFileSync(
      cheminDuVerdict(racine),
      JSON.stringify({
        quand: v.quand,
        verdict: v.verdict,
        vert: v.vert,
        niveau: v.niveau,
        empreinte: [...v.empreinte],
        rouges: v.rouges,
        rougesHorsSuites: v.rougesHorsSuites,
        commit: v.commit,
      })
    );
  } catch {
    // Ne pas pouvoir noter le verdict ne doit pas faire échouer une batterie
    // qui vient de mesurer pour de bon : au pire, la suivante repart en entier.
  }
}

/** « il y a 4 minutes » — parce qu'un horodatage brut ne se lit pas. */
export function ilYA(quand: number, maintenant = Date.now()): string {
  const minutes = Math.max(0, Math.round((maintenant - quand) / 60_000));
  if (minutes < 1) return "à l'instant";
  if (minutes === 1) return "il y a 1 minute";
  if (minutes < 60) return `il y a ${minutes} minutes`;
  const heures = Math.round(minutes / 60);
  return heures === 1 ? "il y a 1 heure" : `il y a ${heures} heures`;
}

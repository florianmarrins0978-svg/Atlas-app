import { spawnSync } from "node:child_process";
import path from "node:path";
import { phraseDeNonMesurable } from "./_bilan-suites.mjs";

/**
 * UNE SUITE QUI NE PEUT PAS MESURER ICI REFUSE DE CONCLURE — elle ne rougit pas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa colère du 20 septembre 2026 :** *« ça fait deux jours j'ai une session
 * qui essaye de me fusionner une modif, elle y arrive pas alors qu'elle est
 * seule ; y'a toujours un problème depuis qu'on a mis le garde-fou en place »*.
 *
 * Dix-neuf suites d'outillage rougissent sur son PC **Windows** : elles
 * appellent `bash`, `gh`, `curl`, `npx` — des outils que la machine n'a pas,
 * ou pas sous ce nom. Elles sont rouges sur `main` aussi, avec ou sans lot.
 * Le garde-fou de `main` faisait alors son travail : devant un rouge, il
 * demande de prouver qu'il préexiste, une suite à la fois. Trente minutes par
 * lot, pour réapprendre ce qu'on savait déjà.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI A ÉTÉ REFUSÉ, ET QUI NE DOIT PAS REVENIR.** Une liste « ces
 * suites-là ne comptent pas sur Windows ». Une liste qui ABAISSE une exigence
 * se trompe un jour de fichier, et du danger part sans que rien ne le dise
 * (`.claude/rules/testing.md`). Les listes acceptées ici sont celles qui
 * REMONTENT le niveau ; jamais l'inverse.
 *
 * **CE QUI LE REMPLACE : une question posée à la MACHINE, pas au nom de la
 * suite.** La suite déclare l'outil dont elle a besoin — un fait sur elle,
 * vrai partout — et l'on sonde. L'outil est là : elle mesure, exactement comme
 * avant. Il manque : elle le dit, le nomme, et sort du compte.
 *
 * **Et elle n'est SURTOUT PAS comptée verte.** Un « non mesurable » fondu dans
 * les réussites serait le contrôle qui mesure zéro et rend un vert — la faute
 * du 15 août 2026, où `0 − 0 = 0` annonçait « rien n'est coupé » sur un écran
 * où trois noms l'étaient (`CLAUDE.md` §5). Le moteur le compte à part, et le
 * bilan exige que les deux chiffres se recoupent (`_bilan-suites.mjs`).
 */

/**
 * Le code de sortie qui dit « je n'ai rien pu mesurer ».
 *
 * **Ni 0 ni 1**, et c'est tout le point : 0 serait un vert mensonger, 1 un
 * rouge qui relancerait la comparaison de trente minutes. Les moteurs le
 * reconnaissent (`run-all-tests.ts`, `run-e2e-tests.ts`) ; un moteur qui ne le
 * connaîtrait pas le lirait comme un rouge, c'est-à-dire comme aujourd'hui —
 * le repli est du côté sûr.
 */
export const CODE_NON_MESURABLE = 3;

/**
 * L'outil répond-il sur cette machine ?
 *
 * **On l'APPELLE, on ne cherche pas son fichier.** `which` ment dans les deux
 * sens sous Windows — il ignore les `.cmd` et les fonctions du shell —, et
 * c'est précisément la machine où la question se pose. Une commande qui
 * démarre puis rend n'importe quel code prouve ce qu'on veut savoir : elle
 * existe. Seul `ENOENT` dit l'absence.
 */
export function outilRepond(
  nom: string,
  essai: (nom: string) => { error?: Error } = (n) =>
    spawnSync(n, ["--version"], { stdio: "ignore", timeout: 10_000, shell: false })
): boolean {
  try {
    const r = essai(nom);
    const code = (r.error as NodeJS.ErrnoException | undefined)?.code;
    return code !== "ENOENT";
  } catch {
    return false;
  }
}

/**
 * Le premier outil qui manque, ou `null` si la machine les a tous.
 *
 * **Fonction pure**, pour qu'on puisse lui montrer une machine démunie sans en
 * avoir une sous la main : un contrôle qu'on n'a jamais vu rouge ne prouve
 * rien (`AGENTS.md`).
 */
export function outilManquant(
  outils: readonly string[],
  repond: (nom: string) => boolean = (n) => outilRepond(n)
): string | null {
  for (const o of outils) if (!repond(o)) return o;
  return null;
}

/** La phrase rendue — elle NOMME l'outil, pour qu'elle cesse d'être vraie. */
export function raisonDuSilence(outil: string): string {
  return `« ${outil} » est absent de cette machine`;
}

/**
 * À APPELER EN TÊTE D'UNE SUITE, avant tout montage.
 *
 * Si l'un des outils manque, la suite s'arrête ici : rien n'a été mesuré, et
 * elle le dit. Sinon elle rend la main et la suite se déroule normalement —
 * c'est le cas de toutes les machines Linux, et de la CI.
 */
export function exigerLesOutils(...outils: string[]): void {
  const manquant = outilManquant(outils);
  if (manquant === null) return;
  const fichier = path.basename(process.argv[1] ?? "cette suite");
  // La phrase exacte que les moteurs relisent — écrite là-bas, jamais recopiée
  // ici : deux orthographes d'un même message finissent par diverger, et un
  // silence mal écrit deviendrait un rouge invisible (`CLAUDE.md` §3).
  console.log(phraseDeNonMesurable(fichier, raisonDuSilence(manquant)));
  process.exit(CODE_NON_MESURABLE);
}

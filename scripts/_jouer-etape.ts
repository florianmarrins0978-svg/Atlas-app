import { spawn } from "node:child_process";

/**
 * Joue une étape en la laissant s'afficher, ET en gardant ce qu'elle a écrit.
 *
 * Les deux contrôles (`verifier-avant-livraison`, `verifier-avant-fusion`)
 * lançaient leurs étapes en `stdio: "inherit"` : tout passait à l'écran, rien
 * ne restait. Or, depuis le 16 septembre 2026, le verdict doit NOMMER les
 * suites rouges pour être comparé à l'état connu de `main`
 * (`_bilan-suites.mjs`) — et ces noms sont dans ce que les moteurs écrivent.
 *
 * On ne bascule pas en `spawnSync` avec sortie capturée : une batterie de
 * cinquante minutes muette jusqu'au bout est une batterie qu'on croit bloquée
 * (`run-all-tests.ts` raconte ce que coûte une batterie qui ne dit plus rien).
 * Chaque morceau est donc réécrit à l'écran à l'instant où il arrive, et gardé.
 */
export function jouerEnGardantLaSortie(
  commande: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; cwd: string; shell: boolean }
): Promise<{ status: number | null; sortie: string }> {
  return new Promise((resoudre) => {
    const morceaux: string[] = [];
    const enfant = spawn(commande, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell,
      stdio: ["inherit", "pipe", "pipe"],
    });
    enfant.stdout.on("data", (bloc: Buffer) => {
      process.stdout.write(bloc);
      morceaux.push(bloc.toString("utf8"));
    });
    enfant.stderr.on("data", (bloc: Buffer) => {
      process.stderr.write(bloc);
      morceaux.push(bloc.toString("utf8"));
    });
    // Une commande introuvable n'est pas un code de retour : elle se lit ici,
    // et vaut un échec — sans quoi la promesse ne se résoudrait jamais.
    enfant.on("error", (erreur) => {
      process.stderr.write(`${erreur.message}\n`);
      resoudre({ status: null, sortie: morceaux.join("") });
    });
    enfant.on("close", (status) => resoudre({ status, sortie: morceaux.join("") }));
  });
}

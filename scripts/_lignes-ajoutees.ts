/* =======================================================================
   Ce qu'un lot AJOUTE, par rapport au tronc commun avec `main`.

   **Pourquoi deux contrôles en ont besoin, et pourquoi ils partagent
   celui-ci.** Un garde-fou qui rougirait sur du code d'il y a six mois
   serait éteint dans la journée, et l'on aurait perdu la protection pour
   de bon : le contrôle des pansements ne regarde donc que ce que le lot
   ajoute, et celui des points du milieu de phrase fait de même pour les
   maquettes, dont 2 320 points dorment dans des planches archivées que
   personne ne rouvrira.

   Deux copies de cette lecture auraient divergé (`CLAUDE.md` §3) — et
   c'est la lecture qui décide de ce qu'un contrôle voit.

   `git diff <base>` compare l'ARBRE DE TRAVAIL à ce tronc commun : ce qui
   est commité comme ce qui ne l'est pas encore. C'est bien ce qu'on veut,
   un défaut n'ayant pas besoin d'être commité pour être livré.
   ======================================================================= */
import { execFileSync } from "node:child_process";

export type LigneAjoutee = {
  fichier: string;
  ligne: string;
  /** La ligne ajoutée juste avant, pour lire un aveu posé au-dessus. */
  precedente: string;
  /** Son numéro dans le fichier d'arrivée, pour que le message envoie au bon endroit. */
  numero: number;
};

export function lignesAjoutees(racine: string, chemins: string[]): LigneAjoutee[] {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: racine, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

  let base: string;
  try {
    base = git("merge-base", "HEAD", "origin/main");
  } catch {
    // Pas de `origin/main` sous la main (dépôt fraîchement cloné, CI d'une
    // fourche) : on se rabat sur le commit précédent plutôt que de rendre un
    // vert qui n'aurait rien mesuré.
    base = git("rev-parse", "HEAD~1");
  }

  const diff = git("diff", "--unified=0", base, "--", ...chemins);
  const sorties: LigneAjoutee[] = [];
  let fichier = "";
  let precedente = "";
  let numero = 0;
  for (const ligne of diff.split("\n")) {
    if (ligne.startsWith("+++ b/")) {
      fichier = ligne.slice("+++ b/".length);
      precedente = "";
      continue;
    }
    // « @@ -12,0 +13,4 @@ » : le second nombre est la première ligne ajoutée.
    const entete = /^@@ -\S+ \+(\d+)/.exec(ligne);
    if (entete) {
      numero = Number(entete[1]);
      precedente = "";
      continue;
    }
    if (!ligne.startsWith("+") || ligne.startsWith("+++")) continue;
    const texte = ligne.slice(1);
    sorties.push({ fichier, ligne: texte, precedente, numero });
    precedente = texte;
    numero++;
  }
  return sorties;
}

/**
 * QUEL CONTRÔLE UN LOT EXIGE-T-IL AVANT DE PARTIR SUR `main` ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Sa règle du 13 septembre 2026, au soir : « ne pas lancer inutilement toute la
 * batterie après une petite modification », et en même temps « une session ne
 * doit pas pouvoir fusionner si les contrôles de son niveau de risque ont
 * échoué ». Les deux tiennent ensemble à une condition : que le niveau se
 * CALCULE sur ce que le lot touche, au lieu d'être déclaré par qui livre.
 *
 * Lu par `garde-fusion-main.mjs` (le hook) et par les deux commandes de
 * vérification. Une seule table, un seul calcul : deux auraient divergé
 * (`CLAUDE.md` §3).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Le témoin qu'une vérification laisse derrière elle. Hors du dépôt : il ne se commite pas. */
export const FICHIER_VERDICT = "/tmp/atlas-verdict-verification.json";

/**
 * Le niveau exigé par un lot, d'après les chemins qu'il touche.
 *
 * 3 — le produit : un écran, une règle, une migration. Rien de moins que la
 *     batterie complète, parce qu'une pièce partagée touche tous les écrans.
 * 2 — l'outillage : ce qui fait tourner le produit sans en faire partie.
 * 1 — ce qui ne s'exécute pas : documents, maquettes.
 */
export function niveauExige(chemins) {
  let niveau = 1;
  for (const chemin of chemins) {
    const c = chemin.trim();
    if (!c) continue;
    if (/^(src|drizzle)\//.test(c) || c === "package.json" || c === "next.config.ts") return 3;
    if (/^(scripts|\.claude|\.devcontainer|\.github)\//.test(c)) niveau = Math.max(niveau, 2);
  }
  return niveau;
}

/** La commande à jouer pour atteindre ce niveau — dite au refus, jamais devinée. */
export function commandeDuNiveau(niveau) {
  if (niveau >= 3) return "npm run verifier:avant-livraison";
  if (niveau === 2) return "npm run verifier:avant-fusion";
  return null;
}

/**
 * Cette commande pousse-t-elle vers `main` ?
 *
 * On vise le geste, pas un mot : `git push origin <branche>:main`,
 * `git push origin main`, et le `git push` nu depuis `main`. Le reste passe —
 * un garde-fou qui parle à tort s'apprend à être ignoré (`CLAUDE.md` §1 bis).
 */
export function poussseVersMain(commande, brancheCourante) {
  const c = String(commande ?? "");
  if (!/\bgit\s+push\b/.test(c)) return false;
  if (/:main(\s|$)/.test(c)) return true;
  if (/\bpush\s+(-\S+\s+)*origin\s+main(\s|$)/.test(c)) return true;
  // `git push` sans cible, depuis main.
  if (brancheCourante === "main" && !/\s(HEAD|[\w./-]+:)/.test(c.replace(/\bgit\s+push\b/, ""))) {
    return /\bgit\s+push\s*(-\S+\s*)*(origin\s*)?$/.test(c.trim());
  }
  return false;
}

/**
 * Le verdict lu est-il celui de CET arbre, et d'un niveau suffisant ?
 *
 * L'empreinte compte autant que le niveau : une vérification verte sur l'état
 * d'avant ne dit rien de celui d'après. C'est la leçon de l'empreinte de la
 * batterie — « le verrou EMPÊCHE, l'empreinte DIT » (`CLAUDE.md` §5).
 */
export function verdictSuffit(verdict, { niveau, empreinte }) {
  if (!verdict) return { suffit: false, raison: "aucune vérification n'a été jouée" };
  if (verdict.empreinte !== empreinte) {
    return { suffit: false, raison: "l'arbre a changé depuis la dernière vérification" };
  }
  if ((verdict.niveau ?? 0) < niveau) {
    return { suffit: false, raison: `la vérification jouée était de niveau ${verdict.niveau ?? "?"}` };
  }
  return { suffit: true, raison: "" };
}

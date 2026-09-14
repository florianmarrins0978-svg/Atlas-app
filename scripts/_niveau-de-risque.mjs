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

/**
 * Le témoin que les deux vérifications laissent — celui du dépôt, pas un second.
 *
 * **Écrit par `_dernier-verdict.ts`**, arrivé sur `main` le 14 septembre 2026 :
 * la batterie y note son verdict, son niveau et l'arbre mesuré. Ce garde-fou le
 * RELIT, il n'en tient aucun à côté — deux façons de dire « voilà ce qui a été
 * mesuré » finiraient par se contredire (`CLAUDE.md` §3), et c'est justement
 * cette duplication qui avait été écrite ici avant la fusion.
 */
export const FICHIER_VERDICT = ".atlas-dernier-verdict.json";

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
export function verdictSuffit(verdict, { niveau, derniereEcriture }) {
  if (!verdict) return { suffit: false, raison: "aucune vérification n'a été jouée" };
  if (verdict.vert !== true) return { suffit: false, raison: "la dernière vérification était ROUGE" };
  if ((verdict.niveau ?? 0) < niveau) {
    return { suffit: false, raison: `la vérification jouée était de niveau ${verdict.niveau ?? "?"}` };
  }
  // **L'arbre a-t-il bougé depuis ?** On compare l'instant du verdict au fichier
  // surveillé le plus récemment écrit. Recalculer une empreinte complète serait
  // plus fin — et ce serait une SECONDE façon de dire « ce fichier a changé »,
  // à côté de `empreinteDesSources` : exactement ce que `CLAUDE.md` §3 refuse.
  // Une date suffit à ce que ce garde-fou doit trancher, et elle coûte
  // quelques millisecondes dans un hook qui doit rendre la main tout de suite.
  if (derniereEcriture > verdict.quand) {
    return { suffit: false, raison: "l'arbre a changé depuis la dernière vérification" };
  }
  return { suffit: true, raison: "" };
}

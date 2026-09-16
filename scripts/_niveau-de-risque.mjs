/**
 * QUEL CONTRÔLE UN LOT EXIGE-T-IL AVANT DE PARTIR SUR `main` ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Sa décision du 14 septembre 2026 :**
 *
 *     niveau = MAX( plancher , rayon , gravité )
 *
 * Jamais un minimum, jamais une moyenne. Trois façons d'être dangereux ; il
 * suffit d'une.
 *
 * **CE QUI A CHANGÉ, ET POURQUOI.** La règle d'avant lisait le chemin : tout
 * ce qui vivait dans `src/` valait batterie complète, ~50 minutes. Elle se
 * trompait dans les deux sens — 339 fichiers sur 697 n'atteignent qu'un seul
 * point d'entrée, et `src/lib/civilite.ts` en atteint 64 sans qu'aucune liste
 * ne le sache. Le chemin est un INDICE du risque, jamais la décision.
 *
 * **LES DEUX LISTES NE JOUENT PAS LE MÊME RÔLE, et c'est tout le principe :**
 *
 *   · une liste qui ABAISSE le niveau — « ces fichiers-là sont centraux, les
 *     autres sont locaux » — est REFUSÉE : le jour où elle oublie un fichier,
 *     du danger part et rien ne le dit ;
 *   · une liste qui REMONTE le niveau — plancher, gravité — est acceptée : le
 *     jour où elle se trompe, on joue une batterie de trop. Des minutes, pas
 *     une régression.
 *
 * Ce qui ABAISSE, ici, n'est donc jamais une liste : c'est le rayon, calculé
 * sur le graphe d'imports (`_rayon-impact.mjs`). Une session ne peut pas se
 * l'accorder.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { execFileSync } from "node:child_process";
import { construireLeGraphe, routeDeLEcran } from "./_rayon-impact.mjs";
import { routesSansSuite } from "./_suites-ciblees.mjs";

/**
 * Les chemins que ce lot ajoute à `main` — commités ET pas encore commités.
 *
 * Il vit ici, et non chez l'un de ses deux appelants, parce que le garde-fou
 * et la vérification de niveau 2 doivent voir EXACTEMENT le même lot. Deux
 * façons de lire un diff finiraient par se contredire (`CLAUDE.md` §3), et
 * c'est alors la fusion qui serait refusée sur une mesure faite ailleurs.
 */
export function cheminsDuLot(racine) {
  const git = (...args) => {
    try {
      return execFileSync("git", ["-C", racine, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return null;
    }
  };
  const base = git("merge-base", "origin/main", "HEAD") ?? "origin/main";
  const commités = git("diff", "--name-only", `${base}...HEAD`) ?? "";
  const enCours = git("status", "--porcelain") ?? "";
  return [...commités.split("\n"), ...enCours.split("\n").map((l) => l.slice(3))].filter(Boolean);
}

/** Le témoin que les deux vérifications laissent — celui du dépôt, pas un second. */
export const FICHIER_VERDICT = ".atlas-dernier-verdict.json";

/**
 * **LE RAYON QUI FAIT BASCULER EN NIVEAU 3.** Valeur de départ, arbitrée le
 * 14 septembre 2026 : à ce seuil, 189 fichiers sur 697 sont en niveau 3.
 * Elle se règle sur des mesures, elle ne se devine pas — et surtout elle ne se
 * règle pas lot par lot.
 */
export const RAYON_MAXIMAL_DU_NIVEAU_2 = 10;

/**
 * LE PLANCHER — ce dont l'impact ne vit pas dans le graphe d'imports.
 *
 * Une migration ne casse pas un écran en l'important : elle change les
 * DONNÉES sous lui. Un middleware s'exécute avant tout le monde sans que
 * personne l'importe. Ces chemins-là ne se discutent pas.
 */
const PLANCHER = [
  [/^drizzle\//, "une migration : son impact vit dans les données, pas dans les imports"],
  [/^src\/middleware\.ts$/, "le middleware s'exécute devant chaque écran"],
  [/^src\/app\/layout\.tsx$/, "le gabarit racine porte tous les écrans"],
  [/^src\/app\/globals\.css$/, "la feuille de style globale touche tous les écrans"],
  [/^(package(-lock)?\.json|next\.config\.[cm]?[jt]s|tsconfig.*\.json|drizzle\.config\.[cm]?[jt]s)$/, "la configuration du projet"],
  [/^src\/server\/(env|logger|request-context)\.ts$/, "l'infrastructure que tout le serveur traverse"],
  [/^src\/server\/db\//, "l'accès à la base : schéma, client, isolation"],
];

/**
 * LA SÉCURITÉ — authentification, sessions, RLS, isolation entre entreprises.
 *
 * Une faute ici ne casse pas un écran : elle montre les données d'un artisan à
 * un autre, et personne ne s'en aperçoit. C'est le seul défaut de ce dépôt qui
 * ne se rattrape pas.
 */
const SÉCURITÉ = [
  /^src\/auth(\.config)?\.ts$/,
  /^src\/server\/(session-ctx|garde-action|garde-route|autorisation)\.ts$/,
  /^src\/server\/db\/with-entreprise\.ts$/,
  /^src\/server\/repositories\/context\.ts$/,
  /(^|[/_-])(auth|session|sessions|rls|isolation|entreprise|role|roles|acces-roles|permission|permissions)([/_.-]|$)/i,
];

/**
 * L'ARGENT — facturation, TVA, devis, règlements, et l'intégrité des chiffres.
 *
 * Un devis faux part chez son client, et c'est lui qui le découvre. Le rayon
 * ne dit rien de cela : `repositories/lignes-prix.ts` n'atteint que 11 points
 * d'entrée, quand un formateur de date en atteint 39.
 */
const ARGENT = [
  /(^|[/_-])(factur\w*|devis|tva|reglement|reglements|règlement|règlements|paiement\w*|acompte|acomptes|prix|euros|montant|montants|remise|remises|avoir|avoirs|tarif|tarifs|comptabilite|comptabilité|banque|rapprochement)([/_.-]|$)/i,
];

const teste = (motifs, chemin) => motifs.some((m) => (Array.isArray(m) ? m[0] : m).test(chemin));

/**
 * L'impact de ce chemin est-il impossible à établir de façon fiable ?
 *
 * Trois cas, et chacun a coûté quelque chose ailleurs :
 *   · une route d'API — ses appelants passent par `fetch("/api/…")`, donc
 *     aucun lien d'import ne les relie : son rayon dirait 1 en laissant tomber
 *     tous les écrans qui l'appellent ;
 *   · un fichier de `src/` qui n'est ni `.ts` ni `.tsx` — le graphe ne le lit
 *     pas ;
 *   · un fichier de `src/` que le graphe ne connaît pas : effacé par ce lot,
 *     ou renommé. On ne mesure rien sur ce qui n'est plus là.
 *
 * Une mesure impossible n'est jamais un vert (`CLAUDE.md` §5).
 */
function indéterminable(chemin, graphe) {
  if (!/^src\//.test(chemin)) return null;
  if (/^src\/app\/api\//.test(chemin)) return "une route d'API : ses appelants passent par « fetch », qu'aucun import ne relie";
  if (!/\.(ts|tsx)$/.test(chemin)) return "un fichier que le graphe d'imports ne sait pas lire";
  if (!graphe.connaît(chemin)) return "un fichier absent de l'arbre : effacé ou renommé, son impact ne se mesure plus";
  return null;
}

/** Le niveau d'un lot, et de quoi le dire au patron sans qu'il ait à deviner. */
export function evaluerLeLot(chemins, { racine, graphe } = {}) {
  const g = graphe ?? construireLeGraphe(racine ?? process.cwd());
  const propres = chemins.map((c) => c.trim()).filter(Boolean);

  let niveau = 1;
  const motifs = [];
  const atteints = new Set();
  let rayonMaximal = 0;

  for (const chemin of propres) {
    const monter = (n, pourquoi) => {
      niveau = Math.max(niveau, n);
      motifs.push({ chemin, niveau: n, pourquoi });
    };

    const plancher = PLANCHER.find(([motif]) => motif.test(chemin));
    if (plancher) monter(3, plancher[1]);
    if (teste(SÉCURITÉ, chemin)) monter(3, "authentification, sessions, isolation ou rôles");
    if (teste(ARGENT, chemin)) monter(3, "l'argent : facturation, TVA, devis ou règlements");

    const flou = indéterminable(chemin, g);
    if (flou) monter(3, flou);

    if (/^src\//.test(chemin) && g.connaît(chemin)) {
      const points = g.pointsAtteints(chemin);
      for (const p of points) atteints.add(p);
      rayonMaximal = Math.max(rayonMaximal, points.length);
      monter(points.length >= RAYON_MAXIMAL_DU_NIVEAU_2 ? 3 : 2, `rayon de ${points.length} point(s) d'entrée`);
    } else if (/^(scripts|\.claude|\.devcontainer|\.github|maquettes)\//.test(chemin)) {
      monter(2, "l'outillage : ce qui fait tourner le produit sans en faire partie");
    }
  }

  const routes = [...new Set([...atteints].map(routeDeLEcran).filter(Boolean))].sort();

  // **UN ÉCRAN QUE RIEN N'OUVRE NE SE FUSIONNE PAS AU RABAIS.** Le niveau 2
  // ne tient que parce qu'une suite navigateur regarde les écrans atteints ;
  // s'il n'y en a aucune, il n'y a rien à jouer qui les regarde — et l'on
  // retombe sur ce qui a coûté vingt allers-retours en août. Batterie entière.
  if (niveau === 2 && routes.length) {
    const orphelines = routesSansSuite(racine ?? process.cwd(), routes);
    if (orphelines.length) {
      niveau = 3;
      motifs.push({
        chemin: orphelines[0],
        niveau: 3,
        pourquoi: `aucune suite navigateur n'ouvre ${orphelines.join(", ")} : rien ne pourrait le regarder`,
      });
    }
  }

  // **La raison montrée est celle qui PARLE du produit.** Quand plusieurs
  // motifs décident du même niveau, « l'outillage » est le moins instructif :
  // il dirait « scripts/test-x.ts » là où le patron veut savoir quel écran ou
  // quelle règle a fait monter son lot.
  const décisif = motifs.filter((m) => m.niveau === niveau);
  décisif.sort((a, b) => Number(/^(src|drizzle)\//.test(b.chemin)) - Number(/^(src|drizzle)\//.test(a.chemin)));
  return {
    niveau,
    risque: niveau === 3 ? "élevé" : niveau === 2 ? "moyen" : "faible",
    raison: décisif.length ? décisif[0].pourquoi : "rien qui s'exécute",
    motifs,
    rayonMaximal,
    pointsAtteints: [...atteints].sort(),
    routes,
  };
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
  if (brancheCourante === "main" && !/\s(HEAD|[\w./-]+:)/.test(c.replace(/\bgit\s+push\b/, ""))) {
    return /\bgit\s+push\s*(-\S+\s*)*(origin\s*)?$/.test(c.trim());
  }
  return false;
}

/**
 * Le verdict lu est-il celui de CET arbre, et d'un niveau suffisant ?
 *
 * L'empreinte compte autant que le niveau : une vérification verte sur l'état
 * d'avant ne dit rien de celui d'après — « le verrou EMPÊCHE, l'empreinte
 * DIT » (`CLAUDE.md` §5).
 */
/**
 * @typedef {{ commit: string, rouges: string[], quand?: number, niveau?: number }} Reference
 * @param {{ quand: number, vert?: boolean, niveau?: number, rouges?: string[], rougesHorsSuites?: string[] } | null} verdict
 * @param {{ niveau: number, derniereEcriture: number, reference?: Reference | null, referenceEstAncetre?: boolean }} options
 */
export function verdictSuffit(verdict, { niveau, derniereEcriture, reference = null, referenceEstAncetre = false }) {
  if (!verdict) return { suffit: false, raison: "aucune vérification n'a été jouée", toleres: [] };
  let toleres = [];
  if (verdict.vert !== true) {
    const rouge = rougesToleres(verdict, reference, referenceEstAncetre);
    if (!rouge.ok) return { suffit: false, raison: rouge.raison, toleres: [] };
    toleres = rouge.toleres;
  }
  if ((verdict.niveau ?? 0) < niveau) {
    return { suffit: false, raison: `la vérification jouée était de niveau ${verdict.niveau ?? "?"}`, toleres: [] };
  }
  if (derniereEcriture > verdict.quand) {
    return { suffit: false, raison: "l'arbre a changé depuis la dernière vérification", toleres: [] };
  }
  return { suffit: true, raison: "", toleres };
}

/**
 * UN VERDICT ROUGE PEUT-IL QUAND MÊME OUVRIR LA FUSION ? — sa règle du
 * 16 septembre 2026 :
 *
 *   « état de référence connu + nouveau lot → aucun nouveau rouge autorisé.
 *     Un test qui était vert avant et devient rouge doit bloquer.
 *     Un nouveau test rouge doit bloquer.
 *     Un rouge préexistant identique ne doit pas empêcher éternellement
 *     toutes les futures fusions. »
 *
 * La référence est ce que la batterie a MESURÉ sur `main`, sur cette machine
 * (`_reference-batterie.mjs`) — jamais une liste écrite à la main : il l'a
 * refusée, et à raison, une liste qui abaisse le niveau vieillit sans le dire.
 *
 * Tout ce qui n'est pas exactement « les mêmes suites rouges que `main`, et
 * rien d'autre » ferme la porte :
 *   · un verdict d'avant le champ `rouges` — rien à comparer ;
 *   · une étape hors suites (types, construction, connexion…) ou un bilan qui
 *     ne tombe pas juste — un rouge sans nom est un rouge nouveau ;
 *   · pas de référence, ou une référence qui n'est pas dans l'histoire de ce
 *     lot — on ne compare pas à un `main` que le lot ne connaît pas ;
 *   · une suite rouge absente de la référence — verte avant, ou nouvelle.
 */
/**
 * @param {{ rouges?: string[], rougesHorsSuites?: string[], [autre: string]: unknown }} verdict
 * @param {Reference | null} reference
 * @param {boolean} referenceEstAncetre
 */
export function rougesToleres(verdict, reference, referenceEstAncetre) {
  const rouges = verdict.rouges;
  if (!Array.isArray(rouges)) {
    return { ok: false, raison: "la dernière vérification était ROUGE, sans la liste de ses suites (à rejouer)" };
  }
  const horsSuites = verdict.rougesHorsSuites ?? [];
  if (horsSuites.length > 0) {
    return { ok: false, raison: `la dernière vérification était ROUGE hors des suites : ${horsSuites.join(", ")}` };
  }
  if (!reference) {
    return {
      ok: false,
      raison: "la dernière vérification était ROUGE, et aucun état de référence n'a été mesuré sur main",
    };
  }
  if (!referenceEstAncetre) {
    return {
      ok: false,
      raison: `la dernière vérification était ROUGE, et la référence (main ${reference.commit.slice(0, 8)}) n'est pas dans l'histoire de ce lot`,
    };
  }
  const connus = new Set(reference.rouges);
  const nouveaux = rouges.filter((r) => !connus.has(r));
  if (nouveaux.length > 0) {
    return {
      ok: false,
      raison: `${nouveaux.length} nouveau(x) rouge(s) par rapport à main ${reference.commit.slice(0, 8)} : ${nouveaux.join(", ")}`,
    };
  }
  return { ok: true, raison: "", toleres: [...rouges] };
}

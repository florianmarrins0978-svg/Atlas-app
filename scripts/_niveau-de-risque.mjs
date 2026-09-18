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
import { decisionSurLesRouges, surMainPourCetteBase } from "./_rouge-prealable.mjs";
import { execFileSync } from "node:child_process";
import path from "node:path";
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
      // **Aucun `trim` sur la sortie entière**, et c'est tout le défaut du
      // 16 septembre 2026 : `git status --porcelain` rend « ␣M src/… », deux
      // caractères d'état puis une espace. Trimer le bloc mangeait l'espace de
      // la PREMIÈRE ligne, et le `slice(3)` qui suit emportait alors la
      // première lettre du chemin — « rc/app/… ». Ce fichier-là n'était plus
      // reconnu, et un lot de niveau 2 s'annonçait niveau 1.
      //
      // Le pire n'est pas la faute : c'est son SENS. Un garde-fou qui se
      // trompe vers le BAS laisse passer ce qu'il existe pour retenir, et rien
      // ne le dit.
      return execFileSync("git", ["-C", racine, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  };
  const base = (git("merge-base", "origin/main", "HEAD") ?? "origin/main").trim();
  return [
    ...cheminsDuDiff(git("diff", "--name-only", `${base}...HEAD`) ?? ""),
    ...cheminsDuStatut(git("status", "--porcelain") ?? ""),
  ];
}

/** Les chemins d'un `git diff --name-only` : une ligne, un chemin. */
export function cheminsDuDiff(sortie) {
  return sortie.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * Les chemins d'un `git status --porcelain` — deux caractères d'état, une
 * espace, puis le chemin. Les lignes se découpent AVANT tout nettoyage : c'est
 * l'espace de tête qui porte l'information « modifié, pas indexé ».
 *
 * Un renommage s'écrit « R␣␣ancien -> nouveau » : c'est le NOUVEAU chemin qui
 * compte, l'ancien n'existe plus dans l'arbre qu'on mesure.
 */
export function cheminsDuStatut(sortie) {
  return sortie
    .split("\n")
    .filter((l) => l.length > 3)
    .map((l) => l.slice(3))
    .map((c) => (c.includes(" -> ") ? c.split(" -> ")[1] : c))
    .map((c) => c.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
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
 * CE CHEMIN CHANGE-T-IL LE SOL SOUS TOUT LE MONDE ?
 *
 * **Exporté le 17 septembre 2026, à minuit passé**, pour une raison précise :
 * quand `main` avance sous un lot, ce qu'il apporte a DÉJÀ passé son propre
 * garde-fou. Sa gravité — l'argent, la sécurité — a donc déjà été éprouvée par
 * celui qui l'a écrite. Ce qui n'a jamais été mesuré, c'est la RENCONTRE, et
 * elle se rejoue par des suites, pas par une batterie entière.
 *
 * **Le plancher, lui, garde son pouvoir** : une migration change les DONNÉES
 * sous les suites, un gabarit racine porte tous les écrans, l'accès à la base
 * porte toutes les requêtes. Ceux-là ne se mesurent pas par une suite ciblée —
 * c'est déjà ce que dit `PLANCHER`, et c'est le seul cas où `main` doit faire
 * repartir la mesure entière (`ARCHITECTURE.md` §382).
 */
export function estUnPlancher(chemin) {
  return PLANCHER.some(([motif]) => motif.test(String(chemin).replace(/\\/g, "/")));
}

/** La gravité d'un chemin — l'argent ou la sécurité — sans rien décider avec. */
export function porteUneGravite(chemin) {
  const c = String(chemin).replace(/\\/g, "/");
  return teste(SÉCURITÉ, c) || teste(ARGENT, c);
}

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
  // `git -C <dossier> push …` vise `main` exactement comme `git push …` : le
  // dossier est retiré avant de lire le geste (17 septembre 2026 — sans cela,
  // une poussée depuis un dossier de session passait sous le garde-fou).
  const c = String(commande ?? "").replace(/\bgit\s+-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+/g, "git ");
  if (!/\bgit\s+push\b/.test(c)) return false;
  if (/:main(\s|$)/.test(c)) return true;
  if (/\bpush\s+(-\S+\s+)*origin\s+main(\s|$)/.test(c)) return true;
  if (brancheCourante === "main" && !/\s(HEAD|[\w./-]+:)/.test(c.replace(/\bgit\s+push\b/, ""))) {
    return /\bgit\s+push\s*(-\S+\s*)*(origin\s*)?$/.test(c.trim());
  }
  return false;
}

/**
 * LE DOSSIER QUE LA COMMANDE VISE — sa règle du 17 septembre 2026 : *« le
 * garde-fou lui-même doit fonctionner sur le LOT À FUSIONNER, pas sur
 * l'historique cumulé d'une branche de travail »*.
 *
 * Un lot isolé se prépare dans un dossier de session (`git worktree`) et se
 * pousse de là : `git -C <dossier> push origin HEAD:main`. Le garde-fou lisait
 * toujours le dossier principal (`CLAUDE_PROJECT_DIR`) — donc le diff, le
 * verdict et le niveau d'un AUTRE lot que celui qu'on pousse. C'est ainsi
 * qu'une planche de niveau 1 a été refusée au nom d'un lot d'argent voisin
 * (`TODO.md`, 14 septembre), et que douze commits se sont empilés derrière une
 * seule batterie le 16.
 *
 * Sans `-C`, rien ne change : le dossier par défaut reste celui d'avant.
 */
export function dossierDeLaCommande(commande, defaut) {
  const m = String(commande ?? "").match(/\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
  const dossier = m && (m[1] ?? m[2] ?? m[3]);
  return dossier ? path.resolve(defaut, cheminNatif(dossier)) : defaut;
}

/**
 * Un chemin écrit à la façon de Git Bash — `/c/Users/…` — redevient `C:\Users\…`.
 *
 * **Payé le 18 septembre 2026, et c'est un lot de niveau 3 qui est passé sous
 * le garde-fou.** La commande disait `git -C /c/Users/…/atlas-batterie push
 * origin HEAD:main` ; `path.resolve` sous Windows en a fait `C:\c\Users\…`, un
 * dossier qui n'existe pas. Rien à y mesurer, donc un lot « de niveau 1 », et
 * la porte s'est ouverte en silence. Sous Linux, un tel chemin est déjà natif
 * et ne bouge pas.
 */
function cheminNatif(dossier) {
  if (process.platform !== "win32") return dossier;
  const m = dossier.match(/^\/(?:cygdrive\/)?([a-zA-Z])(\/.*)?$/);
  return m ? `${m[1].toUpperCase()}:${(m[2] ?? "/").replace(/\//g, "\\")}` : dossier;
}

/**
 * Le verdict lu est-il celui de CET arbre, et d'un niveau suffisant ?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI A CHANGÉ LE 17 SEPTEMBRE 2026, ET CE QUE ÇA A COÛTÉ.**
 *
 * Sa colère : *« maintenant les sessions rejouent des batteries en boucle juste
 * parce qu'une a touché un fichier »*.
 *
 * Ce garde-fou comparait **la date de la dernière écriture** dans l'arbre à
 * l'instant du verdict. Or une fusion RÉÉCRIT les fichiers qu'elle apporte —
 * et, selon le geste git, jusqu'à ceux dont le contenu ne bouge pas. Toute
 * avancée de `main`, même à l'autre bout du produit, périmait donc le verdict
 * d'un lot vert, et le refus n'annonçait qu'une chose : la batterie entière,
 * cinquante minutes. Trois sessions côte à côte se la renvoyaient sans fin.
 *
 * **La date est morte, et rien ne la remplace en double** : ce qui décide est
 * le CONTENU, relevé par la seule fonction qui sache le dire dans ce dépôt
 * (`_empreinte-des-sources.mjs`, partagée avec la batterie). Un fichier réécrit
 * à l'identique n'a pas bougé — c'est déjà la leçon du 9 septembre, que ce
 * garde-fou-ci n'avait jamais apprise.
 *
 * **Et ce qui a bougé ne se vaut pas.** Deux cas, deux remèdes :
 *
 *   · **le LOT a changé** depuis sa vérification — ce n'est plus ce qui a été
 *     mesuré : on remesure, au niveau du lot ;
 *   · **seul ce que `main` a apporté** a changé — chacun de ces commits est
 *     passé par SON propre garde-fou ; ce qui n'a jamais été mesuré, c'est la
 *     RENCONTRE des deux. Elle se joue en une minute
 *     (`verifier-ce-qui-a-bouge.ts`), et le plus souvent elle est vide. **Jamais
 *     la batterie entière** : c'est sa règle du 17 septembre, *« le fait que
 *     main change […] ne doit jamais, à lui seul, provoquer une nouvelle
 *     batterie complète »*.
 *
 * Le remède se rend à l'appelant (`remede`) plutôt que d'être deviné par lui :
 * c'est cette phrase-là que la session lit, et elle décidait de cinquante
 * minutes.
 * ═══════════════════════════════════════════════════════════════════════════
 */
/**
 * @typedef {{ base?: string, suites?: Record<string, string> }} ReponsesSurMain
 * @param {{ quand: number, vert?: boolean, niveau?: number, rouges?: string[], rougesHorsSuites?: string[] } | null} verdict
 * @param {{ niveau: number, remues?: string[], fichiersDuLot?: string[] | null, mainABouge?: boolean, reponses?: ReponsesSurMain | null, base?: string | null }} options
 */
export function verdictSuffit(verdict, { niveau, remues = [], fichiersDuLot = null, mainABouge = true, reponses = null, base = null }) {
  if (!verdict) return { suffit: false, raison: "aucune vérification n'a été jouée", toleres: [], remede: "niveau" };
  let toleres = [];
  if (verdict.vert !== true) {
    const rouge = rougesToleres(verdict, reponses, base);
    if (!rouge.ok) return { suffit: false, raison: rouge.raison, toleres: [], remede: "niveau" };
    toleres = rouge.toleres;
  }
  if ((verdict.niveau ?? 0) < niveau) {
    return { suffit: false, raison: `la vérification jouée était de niveau ${verdict.niveau ?? "?"}`, toleres: [], remede: "niveau" };
  }
  const bouge = quiABouge(remues, fichiersDuLot, mainABouge);
  if (bouge) return { ...bouge, toleres: [] };
  return { suffit: true, raison: "", toleres, remede: null };
}

/** Le même chemin écrit d'une seule façon — une empreinte de Windows rend des « \ ». */
const meme = (chemin) => String(chemin).split("\\").join("/");

/**
 * CE QUI A BOUGÉ DEPUIS LE VERDICT, ET À QUI C'EST.
 *
 * `fichiersDuLot` est la liste que le garde-fou mesure déjà pour calculer le
 * niveau (`cheminsDuLot`) : ce que le lot ajoute à `main`, commité ou non. Un
 * fichier remué qui n'y figure pas n'a donc pas été écrit ici — il est arrivé
 * par la fusion.
 *
 * **`null` veut dire « on n'a pas su lire le lot »**, et cela ne s'absout pas :
 * on remesure au niveau du lot. Ne pas savoir n'est jamais « ça vient
 * d'ailleurs » (`.claude/rules/testing.md`).
 *
 * **`mainABouge` ferme un refus en cascade.** Le complément ne sait compléter
 * qu'un lot que `main` a dépassé : lui envoyer quelqu'un dont `main` n'a pas
 * bougé, c'est un refus qui renvoie à un refus qui renvoie à la batterie —
 * exactement la boucle qu'on vient de retirer. Ce cas-là existe : un fichier
 * ignoré de git, écrit sous `src/`, est remué sans appartenir au lot.
 *
 * @param {string[]} remues
 * @param {string[] | null} fichiersDuLot
 * @param {boolean} mainABouge
 */
function quiABouge(remues, fichiersDuLot, mainABouge) {
  if (remues.length === 0) return null;
  const trois = (l) => l.slice(0, 3).join(", ") + (l.length > 3 ? `, et ${l.length - 3} autre(s)` : "");
  if (!fichiersDuLot) {
    return { suffit: false, raison: `l'arbre a changé depuis la vérification (${trois(remues.map(meme))})`, remede: "niveau" };
  }
  const duLot = new Set(fichiersDuLot.map(meme));
  const ecritsIci = remues.map(meme).filter((f) => duLot.has(f));
  if (ecritsIci.length > 0) {
    return { suffit: false, raison: `le lot a changé depuis sa vérification (${trois(ecritsIci)})`, remede: "niveau" };
  }
  if (!mainABouge) {
    return {
      suffit: false,
      raison: `l'arbre a changé hors du lot, et « main » n'a pas bougé (${trois(remues.map(meme))})`,
      remede: "niveau",
    };
  }
  return {
    suffit: false,
    raison:
      `le lot n'a pas bougé, mais « main » a apporté ${remues.length} fichier(s) depuis la vérification ` +
      `(${trois(remues.map(meme))})`,
    remede: "complement",
  };
}

/**
 * UN VERDICT ROUGE PEUT-IL QUAND MÊME OUVRIR LA FUSION ? — sa règle du
 * 17 septembre 2026, qui remplace celle du 16 :
 *
 *   « Le garde doit répondre à une seule question : ce lot introduit-il une
 *     NOUVELLE régression ? […] Ne pas lancer toute la batterie sur main. Pour
 *     chaque contrôle rouge uniquement : rejouer CE contrôle sur une copie
 *     propre du commit de référence de main. »
 *
 * **CE QUI A ÉTÉ SUPPRIMÉ, et pourquoi.** La version du 16 septembre comparait
 * à un **état global de `main`** — les suites rouges relevées par une batterie
 * entière jouée sur un arbre propre. Tant que cette mesure n'existait pas, un
 * verdict rouge fermait la porte, même sur un rouge d'une autre zone du
 * produit : le seul remède coûtait trente à cinquante minutes, à repayer à
 * chaque `main` qui avance. Le 17 septembre, un lot du planning prêt depuis le
 * matin est resté bloqué par la porte du devis de l'accueil, cassée ailleurs.
 *
 * **Ce qui le remplace : la comparaison CIBLÉE** — chaque suite rouge rejouée
 * sur la base de `main`, elle seule (`_rouge-prealable.mjs`,
 * `verifier-rouge-prealable.ts`). Le commit git suffit ; aucun état global.
 *
 * **Ce qui ferme toujours la porte** :
 *   · un verdict d'avant le champ `rouges` — rien à comparer ;
 *   · une étape hors suites (types, lint, construction, connexion) ou un bilan
 *     qui ne tombe pas juste — un rouge sans nom est un rouge nouveau ;
 *   · une suite VERTE sur la base de `main` et rouge ici — la régression ;
 *   · une suite dont la réponse manque ou ne se détermine pas — bloquée sur ce
 *     cas-là seulement, jamais absoute.
 */
/**
 * @param {{ rouges?: string[], rougesHorsSuites?: string[], [autre: string]: unknown }} verdict
 * @param {{ base?: string, suites?: Record<string, string> } | null} reponses
 * @param {string | null} base  le commit de `main` d'où part le lot
 */
export function rougesToleres(verdict, reponses, base) {
  const rouges = verdict.rouges;
  if (!Array.isArray(rouges)) {
    return { ok: false, raison: "la dernière vérification était ROUGE, sans la liste de ses suites (à rejouer)" };
  }
  const horsSuites = verdict.rougesHorsSuites ?? [];
  if (horsSuites.length > 0) {
    return { ok: false, raison: `la dernière vérification était ROUGE hors des suites : ${horsSuites.join(", ")}` };
  }
  if (!base) {
    return { ok: false, raison: "la base de ce lot sur main ne se lit pas : rien ne peut être comparé" };
  }
  const decision = decisionSurLesRouges(rouges, surMainPourCetteBase(reponses, base));
  if (!decision.ok) return { ok: false, raison: decision.raison };
  return { ok: true, raison: "", toleres: decision.toleres };
}

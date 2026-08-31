import { existsSync, readFileSync } from "node:fs";
import { estBancDEssai } from "@/profil-banc";
import type { EtatVersionLente } from "@/lib/version-lente";

/**
 * Où en est la construction de la version rapide — dit à l'écran, pas au terminal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le signalement du patron, le 14 août 2026 :** *« La connexion est au
 * ralenti sur l'appli. Les nouvelles pages ne chargent mal ou pas du tout. »*
 * Puis, plus précis : *« Surtout la page équipe. »*
 *
 * **Rien n'était cassé.** Quand le code change, son banc sert d'abord en mode
 * développement et bâtit la version rapide à côté (`scripts/banc.mjs`). En mode
 * développement, un écran n'est compilé qu'au moment où on l'ouvre : mesuré à
 * 1,4–2,8 s ici sur quatre cœurs au repos, et des dizaines de secondes sur ses
 * deux cœurs pendant que la construction les occupe — au-delà de la minute que
 * le relais de GitHub accepte d'attendre.
 *
 * D'où la règle qui explique « surtout la page équipe » : **un écran déjà
 * ouvert répond ; un écran ouvert pour la première fois peut ne jamais
 * arriver.** Réglages — qui porte « Vos équipes » — est celui qu'il ouvre le
 * plus rarement, donc le moins souvent déjà compilé.
 *
 * **Ce qui manquait n'était pas de la vitesse, c'était une phrase.** Depuis son
 * téléphone, rien ne distingue « ça bâtit, patiente » de « c'est en panne ». Le
 * seul endroit qui le savait était le terminal de l'éditeur — c'est-à-dire
 * l'endroit où il ne va pas : *« Va regarder toi-même, je peux pas te
 * l'envoyer »* (9 août 2026).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le chiffre existait déjà, et n'était écrit nulle part.** `prechauffer.mjs`
 * porte un rappel `avancer` depuis le 9 août, `/api/health/banc` sait lire le
 * fichier qu'il devait produire — et **personne ne le lui passait**. La page de
 * diagnostic répondait donc « le préchauffage n'a pas encore commencé » du
 * début à la fin. Une fonction prévue, documentée, et jamais branchée.
 *
 * **Ce qui a été essayé et écarté, parce que mesuré :** faire bâtir en priorité
 * basse (`nice -n 19`). Sur deux cœurs, avec la construction et le serveur en
 * concurrence : connexion 16,2 s à priorité normale, **17,4 s en priorité
 * basse** ; construction 69 s contre 67 s. Aucun gain — la contention n'est pas
 * le processeur mais le disque, que Next.js signale lui-même comme lent. Une
 * réparation supposée présentée comme acquise coûte au patron l'essai puis
 * l'aller-retour (`AGENTS.md`) : elle n'est donc pas livrée.
 */

/** Ce que l'écran sait montrer. Jamais plus que ça. */
export type EtatConstructionBanc = {
  /** Écrans déjà compilés d'avance. */
  faits: number;
  /** Écrans à compiler. `0` quand le préchauffage n'a pas encore commencé. */
  total: number;
  /** Celui qui compile à cet instant, s'il est connu. */
  encours: string | null;
  /**
   * Sert-on la version rapide **PRÉCÉDENTE** pendant que la neuve se construit ?
   *
   * **Ce champ existe pour ne pas rouvrir le malentendu du 12 août 2026**, qui a
   * coûté deux heures : « le commit récupéré » et « le commit servi » ne sont
   * pas le même, et rien à l'écran ne le disait. Depuis le 31 août au soir,
   * `scripts/banc.mjs` garde la version d'avant en service pendant qu'il bâtit
   * — l'application est donc rapide, et en retard. Taire le second point
   * reviendrait à lui faire essayer une correction sur du code qui ne la porte
   * pas, ce qui est exactement la panne qu'on lui a déjà fait chercher.
   */
  versionDavant: boolean;
};

/** Où `scripts/prechauffer.mjs` dépose son avancement. */
export const FICHIER_ETAT = "/tmp/atlas-prechauffage.json";

/**
 * Transformer le dépôt du préchauffage en ce que le bandeau affiche.
 *
 * **Fonction pure** — elle reçoit le texte, jamais le fichier : c'est ce qui la
 * rend éprouvable sans banc, et c'est là que vivent les vrais pièges (un
 * fichier tronqué parce qu'on l'a lu pendant son écriture, un compte plus grand
 * que le total, un JSON qui n'en est pas un).
 *
 * Rend `null` quand il n'y a **rien à dire** : hors banc, ou une fois le
 * préchauffage terminé. À ce moment-là chaque écran s'ouvre du premier coup, et
 * un bandeau qui reste après que le problème a disparu apprend à ne plus être
 * lu.
 */
export function lireEtatConstruction(brut: string | null): EtatConstructionBanc | null {
  // Pas encore de fichier : le préchauffage n'a pas commencé, mais la
  // construction, elle, a bien démarré. On le dit — sans compte, puisqu'on ne
  // l'a pas. Inventer « 0 sur 19 » serait inventer un total.
  if (brut === null || brut.trim() === "") return { faits: 0, total: 0, encours: null, versionDavant: false };

  let objet: unknown;
  try {
    objet = JSON.parse(brut);
  } catch {
    // Lu pendant son écriture : le fichier est tronqué, et ce n'est pas une
    // panne. On retombe sur « ça travaille », jamais sur une erreur.
    return { faits: 0, total: 0, encours: null, versionDavant: false };
  }
  if (typeof objet !== "object" || objet === null)
    return { faits: 0, total: 0, encours: null, versionDavant: false };

  const etat = objet as Record<string, unknown>;
  if (etat.termine === true) return null;

  const entier = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0);
  const total = entier(etat.total);
  // Borné au total : « 21 écrans sur 19 » se lit comme un défaut de
  // l'application, et détourne du message.
  const faits = total === 0 ? entier(etat.faits) : Math.min(total, entier(etat.faits));
  const encours = typeof etat.encours === "string" && etat.encours !== "" ? etat.encours : null;

  // `versionDavant` ne sort JAMAIS de ce fichier-là : il dit l'avancement du
  // préchauffage, pas ce qui est servi. C'est `etatConstructionBanc` qui le
  // pose, et lui seul — deux sources pour une même réponse finiraient par se
  // contredire (`CLAUDE.md` §3).
  return { faits, total, encours, versionDavant: false };
}

/**
 * La version rapide est-elle encore en construction, ici et maintenant ?
 *
 * **Deux conditions, et les deux comptent.** Le banc d'essai (`ATLAS_PROFIL`),
 * parce qu'il n'y a rien à bâtir ailleurs — une application déployée ne montre
 * jamais ce bandeau. Et le mode développement, parce que `next start` impose
 * `NODE_ENV=production` : servir en production SUR un banc, c'est précisément
 * la preuve que la bascule a eu lieu et que tout est compilé.
 */
export function laVersionRapideSeConstruit(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!estBancDEssai({ ATLAS_PROFIL: env.ATLAS_PROFIL, ATLAS_BANC_ESSAI: env.ATLAS_BANC_ESSAI })) {
    return false;
  }
  return env.NODE_ENV !== "production";
}

/** Où `scripts/banc.mjs` dit qu'une construction est en cours, et laquelle. */
const TEMOIN_CONSTRUCTION =
  process.env.ATLAS_TEMOIN_CONSTRUCTION || "/tmp/atlas-construction-en-cours.json";

/**
 * Ce que le témoin de construction apprend, ou `null` s'il ne dit rien.
 *
 * **Fonction pure, et elle reçoit le verdict de vie du processus** plutôt que
 * de le demander elle-même : c'est ce qui la rend éprouvable sans banc, et
 * c'est là que vivent les pièges — un fichier tronqué parce qu'on l'a lu
 * pendant son écriture, un pid qui n'en est pas un, un reste d'un banc mort.
 *
 * **Le pid n'est pas une décoration.** Un banc tué en pleine construction —
 * ce qui arrive sur son espace, où le noyau abat ce qui prend trop de mémoire —
 * laisse son témoin derrière lui. Sans cette vérification, le bandeau
 * annoncerait une construction en cours pour toujours, et le patron
 * attendrait quelque chose que plus personne ne fait : c'est exactement la
 * faute du 20 août (`src/lib/version-lente.ts`).
 */
export function lireChantier(
  brut: string | null,
  vivant: (pid: number) => boolean
): { versionDavant: boolean } | null {
  if (brut === null || brut.trim() === "") return null;
  let objet: unknown;
  try {
    objet = JSON.parse(brut);
  } catch {
    return null;
  }
  if (typeof objet !== "object" || objet === null) return null;
  const chantier = objet as Record<string, unknown>;
  const pid = chantier.pid;
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return null;
  if (!vivant(pid)) return null;
  return { versionDavant: chantier.versionDavant === true };
}

/** Le chantier ouvert à cet instant sur CETTE machine, ou `null`. */
function chantierOuvert(): { versionDavant: boolean } | null {
  let brut: string | null = null;
  try {
    brut = readFileSync(TEMOIN_CONSTRUCTION, "utf8");
  } catch {
    return null; // Aucune construction en cours : le cas normal.
  }
  return lireChantier(brut, (pid) => {
    try {
      process.kill(pid, 0); // Ne tue rien : demande seulement s'il existe.
      return true;
    } catch {
      return false;
    }
  });
}

/** L'état à cet instant, ou `null` s'il n'y a rien à dire. */
export function etatConstructionBanc(): EtatConstructionBanc | null {
  // **La version bâtie servie n'est plus une preuve que tout est prêt.**
  // Depuis le 31 août 2026 au soir, `banc.mjs` garde la version rapide
  // précédente en service pendant qu'il bâtit la neuve : `NODE_ENV` vaut alors
  // `production`, et `laVersionRapideSeConstruit()` répond « non » — ce qui
  // était juste tant que servir bâti signifiait servir à jour. Le témoin de
  // chantier est le seul à connaître la différence.
  const chantier =
    estBancDEssai({
      ATLAS_PROFIL: process.env.ATLAS_PROFIL,
      ATLAS_BANC_ESSAI: process.env.ATLAS_BANC_ESSAI,
    }) && chantierOuvert();

  // On sert la version d'AVANT : il n'y a aucun préchauffage à raconter — les
  // écrans sortent déjà en quelques millisecondes. Ce qu'il faut dire tient en
  // un mot, et c'est le seul qui compte : ce n'est pas le code de tout à
  // l'heure.
  if (chantier && chantier.versionDavant) {
    return { faits: 0, total: 0, encours: null, versionDavant: true };
  }

  if (!laVersionRapideSeConstruit()) return null;
  let brut: string | null = null;
  try {
    brut = readFileSync(FICHIER_ETAT, "utf8");
  } catch {
    // Absent : le préchauffage n'a pas encore écrit une seule ligne. C'est une
    // information, pas une panne.
  }
  return lireEtatConstruction(brut);
}

/**
 * Le bandeau a-t-il quelque chose à dire sur cet écran ?
 *
 * **Une condition de plus que `laVersionRapideSeConstruit`, et elle a failli
 * manquer.** La disposition ne rendait le bandeau QUE sous `NODE_ENV`
 * développement. Depuis que le banc sert la version précédente pendant qu'il
 * bâtit, ce test-là répond « non » au moment exact où l'on a quelque chose à
 * dire : le composant n'aurait jamais été monté, et tout ce qu'il annonce
 * serait resté lettre morte. C'est la faute du 28 août — un geste écrit,
 * éprouvé, et injoignable faute d'une porte (`CLAUDE.md` §5 quater).
 */
export function leBandeauDoitParler(): boolean {
  return laVersionRapideSeConstruit() || etatConstructionBanc() !== null;
}

/** Le verrou du veilleur, tel que `.devcontainer/veiller.sh` le pose. */
const VERROU_VEILLEUR = "/tmp/atlas-veilleur.pid";

/** Le témoin qu'une construction est tombée (`scripts/banc.mjs`). */
const TEMOIN_ECHEC = process.env.ATLAS_TEMOIN_ECHEC || "/tmp/atlas-construction-echouee.txt";

/**
 * Le veilleur est-il là ?
 *
 * **Son verrou porte un identifiant de processus**, précisément pour qu'un
 * fichier resté d'un conteneur précédent ne mente pas (`veiller.sh`). On vérifie
 * donc que le processus vit, pas que le fichier existe.
 *
 * **Écrit ici plutôt que dans l'écran des réglages**, où il vivait seul : deux
 * endroits ont désormais besoin de cette réponse — la mise à jour, qui ne coupe
 * le serveur que si quelqu'un peut le relever, et le panneau « version lente »,
 * qui ne promet une version rapide que si quelqu'un la construit. Deux copies
 * auraient fini par diverger (`CLAUDE.md` §3).
 */
export function veilleurEnVie(): boolean {
  try {
    const pid = Number(readFileSync(VERROU_VEILLEUR, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0); // Ne tue rien : demande seulement s'il existe.
    return true;
  } catch {
    return false;
  }
}

/** Ce que l'écran doit savoir pour ne rien promettre qui n'arrivera pas. */
export function etatVersionLente(): EtatVersionLente {
  return {
    veilleurPresent: veilleurEnVie(),
    constructionEchouee: existsSync(TEMOIN_ECHEC),
  };
}

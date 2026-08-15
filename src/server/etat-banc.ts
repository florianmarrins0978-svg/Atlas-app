import { readFileSync } from "node:fs";
import { estBancDEssai } from "@/profil-banc";

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
  if (brut === null || brut.trim() === "") return { faits: 0, total: 0, encours: null };

  let objet: unknown;
  try {
    objet = JSON.parse(brut);
  } catch {
    // Lu pendant son écriture : le fichier est tronqué, et ce n'est pas une
    // panne. On retombe sur « ça travaille », jamais sur une erreur.
    return { faits: 0, total: 0, encours: null };
  }
  if (typeof objet !== "object" || objet === null) return { faits: 0, total: 0, encours: null };

  const etat = objet as Record<string, unknown>;
  if (etat.termine === true) return null;

  const entier = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0);
  const total = entier(etat.total);
  // Borné au total : « 21 écrans sur 19 » se lit comme un défaut de
  // l'application, et détourne du message.
  const faits = total === 0 ? entier(etat.faits) : Math.min(total, entier(etat.faits));
  const encours = typeof etat.encours === "string" && etat.encours !== "" ? etat.encours : null;

  return { faits, total, encours };
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

/** L'état à cet instant, ou `null` s'il n'y a rien à dire. */
export function etatConstructionBanc(): EtatConstructionBanc | null {
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

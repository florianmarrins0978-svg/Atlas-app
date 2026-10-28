import { jourComplet } from "./pour-mon-comptable";

/**
 * RENVOYER À CORRIGER — sa planche du 27 octobre 2026
 * (`appli/soignee/comptable-retour.html`).
 *
 * Sa demande : *« qu'il puisse nous le retourner à corriger si besoin, un peu
 * comme pour un devis. Et nous on le corrige, on lui renvoie corrigé, ou c'est
 * connecté ? »*. **C'est connecté** : une ligne rejetée que le patron reprend
 * repasse chez le comptable, sur le même lien, « corrigée ». Ce module ne dit
 * que ce qui manquait : le renvoi, sa carte, et quand prévenir le comptable.
 *
 * **Le comptable n'est prévenu que par l'appui du patron** (sa réponse du même
 * soir : « un e-mail ne peut pas partir sans mon geste »). « Prévenir mon
 * comptable » ouvre SA messagerie, le message prêt ; Atlas n'écrit jamais au
 * comptable.
 */

const MESSAGE_MAX = 1000;
const EMAIL_MAX = 200;

/** Le mot du comptable et son adresse, relus au serveur : il n'a pas de compte. */
export function lireLeRenvoi(brut: { message: unknown; email: unknown }): { ok: true; valeur: { message: string | null; email: string | null } } | { ok: false; raison: string } {
  const message = typeof brut.message === "string" ? brut.message.replace(/[ \t]+/g, " ").trim().slice(0, MESSAGE_MAX) : "";
  const email = typeof brut.email === "string" ? brut.email.trim().slice(0, EMAIL_MAX) : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, raison: "Cette adresse e-mail n'est pas lisible." };
  return { ok: true, valeur: { message: message || null, email: email || null } };
}

/** « 2 lignes à reprendre. » */
export function lignesAReprendre(n: number): string {
  return n === 1 ? "1 ligne à reprendre." : `${n} lignes à reprendre.`;
}

/**
 * Ce que Mes dossiers montre sous le compte du comptable :
 *
 * | | |
 * |---|---|
 * | `demande` | il a renvoyé, et des lignes restent rejetées |
 * | `corrige` | plus aucun rejet, des lignes l'attendent « corrigées » : il faut le prévenir |
 * | rien | pas de renvoi, ou une attestation signée depuis, ou il a tout revu |
 *
 * Une attestation signée APRÈS le renvoi le clôt : le comptable a repris la
 * main, la demande est de l'histoire.
 */
export function etatDuRetour(d: { renvoyeLe: Date | null; attestationSigneeLe: Date | null; rejets: number; corrigees: number }): "demande" | "corrige" | null {
  if (!d.renvoyeLe) return null;
  if (d.attestationSigneeLe && d.attestationSigneeLe.getTime() > d.renvoyeLe.getTime()) return null;
  if (d.rejets > 0) return "demande";
  return d.corrigees > 0 ? "corrige" : null;
}

/**
 * L'avis au patron, qui lui est adressé à lui seul. **Rien du dossier n'y
 * voyage** : ni une ligne, ni un montant, ni le mot du comptable, qu'il a pu
 * écrire avec des libellés de banque. Le mot se lit dans Atlas.
 */
export function courrielDuRetour(d: { du: string; au: string; rejetees: number }): { objet: string; texte: string } {
  return {
    objet: "Votre comptable demande une correction",
    texte:
      `Bonjour,\n\nVotre comptable vous renvoie le dossier justifié du ${jourComplet(d.du)} au ${jourComplet(d.au)} : ${lignesAReprendre(d.rejetees).replace(/\.$/, "")}.\n\n` +
      "Les lignes et son mot sont dans Atlas : Terminés, Pour mon comptable, Mes dossiers justifiés.\n\nAtlas",
  };
}

/**
 * Le message que le patron envoie de SA messagerie, quand tout est corrigé.
 * Le lien n'y est pas : le comptable a le sien, et la base n'en garde que
 * l'empreinte (0145).
 */
export function messageAuComptable(d: { du: string; au: string }): { objet: string; corps: string } {
  return {
    objet: "Dossier justifié corrigé",
    corps:
      `Bonjour,\n\nJ’ai repris les lignes que vous aviez rejetées dans mon dossier justifié du ${jourComplet(d.du)} au ${jourComplet(d.au)}. ` +
      "Elles vous attendent sur le même lien.\n\nBonne journée",
  };
}

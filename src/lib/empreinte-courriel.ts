import { createHmac } from "node:crypto";

/**
 * L'empreinte d'une adresse e-mail, telle qu'elle s'écrit dans le journal.
 *
 * **Sa décision du 25 octobre 2026** : l'adresse ne part plus en clair dans les
 * journaux, qui sont copiés chez l'hébergeur, chez Sentry et dans les
 * sauvegardes. Une fuite y livrait la liste des comptes et l'heure de leurs
 * échecs de connexion. L'empreinte garde ce qui servait : devant « je n'arrive
 * pas à entrer », on calcule celle de son adresse (`npm run empreinte`) et l'on
 * retrouve ses tentatives. Aucune tentative trouvée dit déjà qu'il a tapé
 * autre chose.
 *
 * **Avec une clé, pas un simple condensat** : sans clé, il suffirait de
 * calculer l'empreinte d'une liste d'adresses connues pour lire le journal.
 * Même casse et mêmes espaces ignorés que la connexion, sans quoi une majuscule
 * ferait deux personnes. Seize caractères suffisent à distinguer les comptes
 * d'une même instance, et ne se remontent pas.
 */
export function empreinteCourriel(adresse: string, cle: string): string {
  const normalisee = adresse.trim().toLowerCase();
  const code = createHmac("sha256", cle).update(`atlas-journal-courriel\0${normalisee}`).digest("hex");
  return `courriel:${code.slice(0, 16)}`;
}

/** Une clé de journal qui porte une adresse : `email`, `emailPro`, `courriel`… */
export function estCleDeCourriel(cle: string): boolean {
  const c = cle.toLowerCase();
  return c.includes("email") || c.includes("courriel");
}

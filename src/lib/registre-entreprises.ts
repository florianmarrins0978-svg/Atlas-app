/**
 * CE QUE LE REGISTRE DES ENTREPRISES DIT D'UN SIRET — sa question du
 * 23 novembre 2026 : *« il n'y a pas moyen de tricher, de taper un numéro au
 * pif ? »*. La clé de Luhn (`siretBienForme`) arrête neuf numéros inventés sur
 * dix ; le registre arrête le dixième.
 *
 * La source est le service public « Recherche d'entreprises »
 * (`recherche-entreprises.api.gouv.fr`, gratuit, sans clé). Sa réponse a été
 * relevée le 23 novembre 2026 : `results[]`, et dans chaque résultat `siren`,
 * `nom_complet`, `statut_diffusion`, `siege` et `matching_etablissements`
 * (chacun avec `siret`, `adresse`, `etat_administratif`). Un SIRET inconnu rend
 * `{"results":[],"total_results":0,…}`.
 *
 * **Fonction pure, et c'est ce qui la rend sûre** : le serveur va chercher, ce
 * fichier lit. Toute forme qu'il ne reconnaît pas rend `illisible`, jamais
 * `inconnu` : une réponse qu'on ne comprend pas n'accuse personne d'avoir
 * inventé son numéro.
 */
export type ReponseDuRegistre =
  | { etat: "trouve"; nom: string | null; adresse: string | null }
  | { etat: "inconnu" }
  | { etat: "ferme" }
  | { etat: "illisible" };

type Etablissement = { siret?: unknown; adresse?: unknown; etat_administratif?: unknown };

const texte = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  // Une entreprise en diffusion partielle a demandé à ne pas être publiée : le
  // registre écrit alors ce mot à la place de son nom ou de son adresse.
  if (t === "" || /NON[- ]DIFFUSIBLE/i.test(t)) return null;
  return t;
};

export function lireLeRegistre(reponse: unknown, siret: string): ReponseDuRegistre {
  const chiffres = siret.replace(/\D/g, "");
  if (typeof reponse !== "object" || reponse === null) return { etat: "illisible" };
  const resultats = (reponse as { results?: unknown }).results;
  if (!Array.isArray(resultats)) return { etat: "illisible" };

  const siren = chiffres.slice(0, 9);
  const entreprise = resultats.find(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null && (r as { siren?: unknown }).siren === siren
  );
  if (!entreprise) return { etat: "inconnu" };

  // La recherche est plein texte : on ne retient que l'établissement dont le
  // SIRET est EXACTEMENT celui tapé, le siège ou un autre.
  const candidats: Etablissement[] = [
    ...(Array.isArray(entreprise.matching_etablissements) ? (entreprise.matching_etablissements as Etablissement[]) : []),
    ...(typeof entreprise.siege === "object" && entreprise.siege !== null ? [entreprise.siege as Etablissement] : []),
  ];
  const etablissement = candidats.find((e) => e && e.siret === chiffres);
  if (!etablissement) return { etat: "inconnu" };
  if (etablissement.etat_administratif !== "A") return { etat: "ferme" };

  const diffusible = entreprise.statut_diffusion === undefined || entreprise.statut_diffusion === "O";
  return {
    etat: "trouve",
    nom: diffusible ? texte(entreprise.nom_complet) : null,
    adresse: diffusible ? texte(etablissement.adresse) : null,
  };
}

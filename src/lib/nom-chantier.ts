import { jourLisible } from "./jour";

// Comment un chantier s'appelle, quand personne ne le nomme.
//
// **Pourquoi ce fichier existe.** Le patron, le 5 août 2026 : « dans la
// catégorie chantier, retire la case nom du chantier ». C'était le seul champ
// obligatoire de la création, et le seul qui lui demandait d'inventer quelque
// chose : un élagueur ne baptise pas ses chantiers, il dit « chez M. Bernard »
// ou « rue des Lilas ». Lui faire trouver un titre avant de pouvoir commencer,
// c'était une porte fermée à clé devant une maison ouverte.
//
// **Ce n'est pas inventer une donnée** (`CLAUDE.md` §4) : rien n'est fabriqué
// ici, tout est repris de ce qu'il a saisi. Ce nom est une **étiquette** — ce
// qui s'affiche en tête de la fiche et dans sa liste — et non une information
// sur le chantier. Quand il n'a rien donné du tout, la date du jour reste vraie.
//
// L'ordre suit la façon dont il en parle : le client d'abord, le lieu ensuite,
// la date en dernier recours.

export type SourceNomChantier = {
  nomClient?: string | null;
  adresseChantier?: string | null;
  /** Jour de création, au format « AAAA-MM-JJ ». */
  jour: string;
};

export function nomDuChantier({ nomClient, adresseChantier, jour }: SourceNomChantier): string {
  // « Chez M. Bernard » : c'est la phrase de l'artisan, pas celle d'un logiciel.
  const client = nomClient?.trim();
  if (client) return `Chez ${client}`;

  // Pas de client nommé : le lieu identifie le chantier aussi bien.
  const adresse = adresseChantier?.trim();
  if (adresse) return adresse;

  // Ni client ni adresse : la date est la seule chose vraie qui reste. Elle
  // vaut mieux qu'un « Sans titre », qui n'aide à distinguer aucun chantier
  // d'un autre le jour où il y en a trois.
  return `Chantier du ${jourLisible(jour)}`;
}

/**
 * « M. Bernard — Abattage de chêne », ou le nom seul quand il porte déjà le
 * client.
 *
 * **Né d'une capture, le 12 août 2026.** La feuille « Y aller » affichait
 * « M. Bernard — Chez M. Bernard » : elle collait le nom du client devant le
 * nom du chantier, sans savoir que `nomDuChantier` ci-dessus fabrique justement
 * ce nom À PARTIR du client. Le cas le plus courant du produit — un chantier
 * qu'on n'a pas nommé — était donc le plus laid.
 *
 * La comparaison est faite sans les accents ni la casse : le nom du client est
 * saisi une fois, recopié dans le nom du chantier, mais l'un peut avoir été
 * corrigé depuis (« M. BERNARD » d'un côté, « M. Bernard » de l'autre) et deux
 * graphies du même homme se liraient alors en double.
 */
export function intituleDuChantier(nomClient: string | null | undefined, nomChantier: string): string {
  const client = nomClient?.trim();
  if (!client) return nomChantier;

  const aplati = (t: string) =>
    t
      .normalize("NFD")
      // Les signes combinants, écrits en clair : la même classe posée avec de
      // vrais accents ne se relit pas, et se casse au premier outil qui
      // normalise le fichier.
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  if (aplati(nomChantier).includes(aplati(client))) return nomChantier;
  return `${client} — ${nomChantier}`;
}

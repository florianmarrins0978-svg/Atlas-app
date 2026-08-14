import { jourLisible } from "./jour";
import { avecCivilite, type CiviliteChoisie } from "./civilite";

// Comment un chantier s'appelle, quand personne ne le nomme.
//
// **Pourquoi ce fichier existe.** Le patron, le 5 août 2026 : « dans la
// catégorie chantier, retire la case nom du chantier ». C'était le seul champ
// obligatoire de la création, et le seul qui lui demandait d'inventer quelque
// chose : un élagueur ne baptise pas ses chantiers, il dit « chez M. Bernard »
// ou « rue des Lilas ». Lui faire trouver un titre avant de pouvoir commencer,
// c'était une porte fermée à clé devant une maison ouverte.
//
// Ce nom est une **étiquette** — ce qui s'affiche en tête de la fiche et dans sa
// liste — et non une information sur le chantier. Quand il n'a rien donné du
// tout, la date du jour reste vraie.
//
// **Une réserve levée par lui le 13 août 2026, et qu'il faut connaître.**
// Jusque-là, ce fichier tenait que rien n'était fabriqué : chaque mot du nom
// venait de la saisie. La civilité rompt cette règle — « Mr. » n'est pas
// une donnée du client, c'est un défaut. Le patron l'a demandé en sachant qu'il
// n'avait tapé que « Martins ». Ce que ça coûte, et les deux cas où ça se voit
// (une cliente, une société sous un nom nu), sont écrits dans
// `src/lib/civilite.ts`. Ne pas « rétablir » l'ancienne règle sans lui : elle a
// été levée, pas oubliée.
//
// L'ordre suit la façon dont il en parle : le client d'abord, le lieu ensuite,
// la date en dernier recours.

export type SourceNomChantier = {
  nomClient?: string | null;
  /** Ce qu'il a choisi au-dessus du nom. Absent : la règle d'avant s'applique. */
  civilite?: CiviliteChoisie;
  adresseChantier?: string | null;
  /** Jour de création, au format « AAAA-MM-JJ ». */
  jour: string;
};

export function nomDuChantier({ nomClient, civilite, adresseChantier, jour }: SourceNomChantier): string {
  // **« Mr. Bernard », et non plus « Chez M. Bernard ».** Le patron, le
  // 13 août 2026, devant son devis : *« il faut qu'il y ait écrit monsieur
  // Martins et pas chez Martins »*. « Chez » est la phrase par laquelle un
  // artisan désigne un chantier ; sur un document qui part chez le client, on
  // s'adresse à quelqu'un. Le nom du chantier étant ce qui s'écrit en tête de
  // cet écran, c'est ici qu'il fallait le corriger — pas à l'affichage, où la
  // règle se serait dédoublée (`CLAUDE.md` §3).
  //
  // La civilité vit dans `src/lib/civilite.ts`, avec ce qu'elle suppose et ce
  // qu'elle ne peut pas savoir. Un nom qui la porte déjà ne la reçoit pas deux
  // fois, une raison sociale ne la reçoit pas du tout.
  const client = nomClient?.trim();
  if (client) return avecCivilite(client, civilite);

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

/**
 * Ce qui s'écrit sous le nom, dans la liste : le lieu — jamais le nom deux fois.
 *
 * **Né du retrait de « Chez », le 13 août 2026.** Le titre valait « Chez
 * Martins » et la ligne du dessous « Martins » : proches, mais distincts. Le
 * titre étant devenu « Mr. Martins », un chantier SANS adresse affichait
 * deux fois le même homme, à une civilité près — vu à l'œil sur une capture,
 * jamais par un contrôle.
 *
 * **La comparaison est un `includes`, pas une égalité**, et c'est tout le
 * point : le titre PORTE le nom du client sans lui être identique, puisqu'il
 * lui ajoute sa civilité (`avecCivilite`). Une égalité stricte aurait laissé
 * le doublon passer, et ce fichier a déjà payé cette leçon une fois —
 * `intituleDuChantier`, juste au-dessus, compare de la même façon.
 *
 * Quand il n'y a pas d'adresse, dire qu'elle manque vaut mieux que répéter :
 * c'est une information, et elle appelle un geste.
 */
export function lieuDuChantier(
  nomChantier: string,
  adresseChantier?: string | null,
  nomClient?: string | null
): string {
  const adresse = adresseChantier?.trim();
  if (adresse) return adresse;

  // Le repli sur le client ne vaut que s'il apprend quelque chose. Casse et
  // accents ignorés, comme `intituleDuChantier` : « M. BERNARD » et
  // « M. Bernard » sont le même homme.
  const client = nomClient?.trim();
  const aplati = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (client && !aplati(nomChantier).includes(aplati(client))) return client;

  return "Adresse non renseignée";
}

/**
 * Ce que l'application dit au patron quand il revient de sa messagerie.
 *
 * Le patron, le 7 août 2026 : *« lorsque j'envoie le SMS et que je reviens sur
 * la page, il faut que la page se remette sur la première page automatiquement,
 * avec un petit message : SMS envoyé, ou document envoyé. »*
 *
 * **Pourquoi « transmis » et non « envoyé ».** Atlas ne peut pas savoir si le
 * message est réellement parti : il ouvre la messagerie, et ce qui s'y passe
 * ensuite lui échappe. Le patron a pu changer d'avis et revenir. Écrire
 * « envoyé » serait affirmer ce qu'on n'a pas vu — la seule chose qu'on tient,
 * c'est que le document lui a été transmis, c'est-à-dire mis entre ses mains.
 *
 * Le patron a choisi cette formulation le même jour, entre les deux qui lui
 * étaient proposées : *« oui la B »*.
 *
 * **Un devis attend une réponse, une facture non.** C'est ce qui rend ces deux
 * phrases différentes, et c'est assez fin pour mériter d'être écrit une fois
 * plutôt que recopié sur deux écrans — deux formulations finiraient par
 * diverger, et c'est celle qu'on relit le moins qui resterait fausse
 * (`CLAUDE.md` §3).
 */
export type Transmission = {
  quoi: "devis" | "facture";
  /** Le nom du client, tel qu'il figure sur sa fiche. */
  client: string;
};

export function annonceTransmission(t: Transmission): string {
  const client = t.client.trim();
  // Sans nom, la phrase reste vraie et ne fabrique personne : « Devis transmis »
  // vaut mieux que « Devis transmis à Client non renseigné ».
  const destinataire = client ? ` à ${client}` : "";

  if (t.quoi === "facture") {
    // Pas d'« en attente de sa réponse » : une facture ne se négocie pas, elle
    // se règle. Le laisser ferait attendre au patron une réponse qui ne viendra
    // jamais, et lui ferait relancer un client qui n'a rien à répondre.
    return `Facture transmise${destinataire}.`;
  }

  return `Devis transmis${destinataire} — en attente de sa réponse.`;
}

/**
 * La clé sous laquelle le passage par la messagerie est mémorisé, le temps de
 * revenir dans l'application.
 *
 * `sessionStorage` plutôt qu'un paramètre d'adresse : le patron quitte
 * l'application pour Messages et y revient par le multitâche, pas par un lien.
 * Aucune adresse ne transporterait l'information, et une adresse qui traînerait
 * réafficherait le bandeau à chaque retour sur l'accueil.
 */
export const CLE_TRANSMISSION = "atlas.transmission";

/**
 * Faut-il préparer le devis à partir de la dictée, en arrivant dessus ?
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa panne du 21 août 2026, et c'est lui qui la raconte le mieux :** *« j'ai
 * ouvert un chantier, Madame Lucie, j'ai rentré les informations, j'ai appuyé
 * sur la note vocale, j'ai dicté la prestation, j'ai rappuyé, ça a enregistré.
 * J'ai quitté l'application. J'y suis retourné, j'ai cliqué sur Madame Lucie —
 * or je ne suis pas arrivé directement sur la page du devis comme demandé,
 * avec mes informations déjà remplies. »*
 *
 * **Deux défauts, pas un.** Le premier était le chemin : la liste le renvoyait
 * sur l'écran « Informations » (`chantier-etat.ts`, corrigé le même jour). Le
 * second est celui-ci, et c'est le plus grave : **enregistrer une dictée ne
 * fabrique aucun devis.** La chaîne — transcription, prestations, tarifs,
 * lignes — n'a jamais tourné toute seule ; elle attendait qu'il appuie sur
 * « Mon devis → ». Il ne l'a pas fait : il était chez sa cliente, il a fermé
 * l'application. Le corriger uniquement au chemin l'aurait emmené droit sur
 * une feuille vide.
 *
 * **Pourquoi ici, et pourquoi à l'ARRIVÉE plutôt qu'au moment du geste.** On
 * pourrait lancer la chaîne dès qu'il relâche l'anneau — et ce serait plus
 * rapide, quand ça marche. Mais il quitte l'application dans la seconde qui
 * suit : l'appel part avec l'onglet, et il n'en reste rien. Le seul moment où
 * l'on est SÛR qu'un navigateur est là pour attendre le résultat, c'est celui
 * où il rouvre le devis. La préparation vit donc là, et elle survit à tout ce
 * qu'il peut fermer entre-temps.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Fonction pure, éprouvée sans base ni navigateur (`CLAUDE.md` §3) : l'écran
 * n'a rien à décider, il affiche le résultat.
 */
export function devisAPreparer(chantier: {
  /** Une note vocale est enregistrée sur ce chantier. */
  aUneNoteVocale: boolean;
  /** Ce que porte déjà le devis. Une seule ligne suffit à dire que la chaîne a tourné. */
  nombreDeLignes: number;
  /** `"envoye"` : le devis est parti, il est immuable. */
  statutDevis: string;
}): boolean {
  // Sans dictée, il n'y a rien à reprendre — et le devis vide est alors un
  // choix, le sien : c'est le bouton « Je rédige mon devis ».
  if (!chantier.aUneNoteVocale) return false;

  // **Un devis parti ne se refait jamais.** Le client a reçu ce document ; le
  // réécrire derrière son dos donnerait deux versions du même numéro.
  if (chantier.statutDevis === "envoye") return false;

  // **La présence d'une ligne suffit, et c'est délibéré.** La chaîne écrit
  // toujours quelque chose quand elle aboutit — les prestations à 0 € quand
  // elle refuse de deviner un prix (`devis-depuis-dictee.ts` §3 bis). Une
  // feuille vide en face d'une dictée ne peut donc signifier qu'une chose :
  // la chaîne n'a pas tourné.
  return chantier.nombreDeLignes === 0;
}

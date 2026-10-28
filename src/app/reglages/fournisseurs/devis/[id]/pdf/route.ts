/**
 * La même pièce reçue, à une adresse qui finit par `/pdf`.
 *
 * La visionneuse n'accepte qu'un fichier dont l'adresse finit ainsi
 * (`fichierAccepteParLaVisionneuse`) ; l'assistant, qui joint une facture de
 * fournisseur (27 octobre 2026), l'y ouvre par ici. Mêmes contrôles, même
 * code : c'est la route d'à côté, rien de plus.
 */
export { GET } from "../route";

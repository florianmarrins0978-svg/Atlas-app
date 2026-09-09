/**
 * L'adresse à laquelle un artisan écrit à Atlas.
 *
 * **Sa demande du 9 septembre 2026 :** *« tu dis "écrivez-nous", du coup il faut
 * mettre mon contact — prépare-le, on changera l'adresse le jour où j'aurai créé
 * une pour l'appli »*.
 *
 * **Elle vit à UN seul endroit, et c'est tout l'intérêt de ce fichier.**
 * Recopiée dans deux écrans, elle divergerait le jour du changement : l'un des
 * deux enverrait vers une boîte que plus personne ne relève, et le client qui a
 * demandé l'effacement de son compte n'aurait jamais de réponse. Le jour venu,
 * une ligne change ici.
 *
 * **Pourquoi ce n'est PAS une variable d'environnement.** Une adresse de contact
 * n'est pas un secret, et elle doit rester lisible dans le code : posée en
 * variable, elle serait vide sur un espace mal configuré — et l'écran afficherait
 * « écrivez à » suivi de rien, ce qui est pire que de ne rien dire.
 */
export const CONTACT_ATLAS = "edennature.contact@gmail.com";

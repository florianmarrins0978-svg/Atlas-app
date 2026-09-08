/**
 * L'identité d'une personne d'Atlas : sa civilité, son prénom, son nom.
 *
 * **Pourquoi une fonction pure plutôt qu'une concaténation à l'écran.** Le nom
 * d'une personne s'affiche à quatre endroits — « Mon compte », la liste de
 * l'équipe, les appareils reconnus, et le rond des initiales. Quatre
 * concaténations finiraient par diverger, et c'est exactement ce que
 * `CLAUDE.md` §3 interdit : *« jamais de règle dupliquée »*.
 *
 * **LE CAS QUI COMMANDE TOUT : LES COMPTES D'AVANT.** Jusqu'à la migration
 * 0077, `users` n'avait qu'un champ `nom`, qui portait le nom COMPLET — « Anne
 * Amiot ». Ces lignes-là n'ont pas été découpées, et elles ne le seront pas :
 * « Jean-Pierre de La Fontaine » ne se coupe pas par un espace. Elles ont donc
 * `prenom` à NULL, et tout ce qui suit doit retomber sur ce qu'il affichait
 * hier — sans quoi une mise à jour aurait renommé des comptes qui marchaient.
 *
 * Éprouvé sans base ni navigateur : `scripts/test-identite-personne.ts`.
 */

import { CIVILITES } from "./civilite";

export type IdentitePersonne = {
  civilite?: "mr" | "mme" | null;
  prenom?: string | null;
  nom?: string | null;
};

const propre = (v: string | null | undefined): string => (v ?? "").trim();

/**
 * Le nom à afficher : « Anne Amiot ».
 *
 * Rend une chaîne vide quand on ne sait rien — l'appelant décide alors quoi
 * montrer à la place, et c'est presque toujours l'e-mail.
 */
export function nomAffiche(personne: IdentitePersonne): string {
  return [propre(personne.prenom), propre(personne.nom)].filter(Boolean).join(" ");
}

/**
 * Le nom précédé de la civilité : « Mme Anne Amiot ».
 *
 * **La civilité seule ne s'affiche jamais.** « Mme » tout court ne désigne
 * personne, et sur un compte dont on ignore le nom on montre l'e-mail.
 */
export function nomAvecCivilite(personne: IdentitePersonne): string {
  const nom = nomAffiche(personne);
  if (nom === "") return "";
  const civilite = personne.civilite ? CIVILITES[personne.civilite] : "";
  return civilite === "" ? nom : civilite + " " + nom;
}

/**
 * Deux lettres, pour le rond qui remplace un portrait.
 *
 * `users.image` existe et reste vide — personne ne téléverse une photo depuis
 * un chantier, et un rond vide se lit comme un écran cassé.
 *
 * **Le prénom et le nom donnent une initiale chacun** quand les deux sont là.
 * Sur un compte d'avant, dont `nom` porte le nom complet, on retombe sur le
 * découpage par espaces — celui qui était en place avant la migration 0077.
 */
export function initialesDe(personne: IdentitePersonne, email: string): string {
  const prenom = propre(personne.prenom);
  const nom = propre(personne.nom);

  if (prenom !== "" && nom !== "") return (prenom[0] + nom[0]).toUpperCase();

  const mots = (prenom || nom).split(/\s+/).filter(Boolean);
  if (mots.length >= 2) return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();

  // Plus rien : l'e-mail. Un compte tout neuf n'a pas encore dit son nom, et
  // deux lettres valent mieux qu'un rond vide.
  //
  // **Ce qui précède l'arobase, jamais l'adresse entière** — « a@essai.local »
  // donnerait « A@ ». Comportement repris tel quel de l'ancienne fonction,
  // qui vivait dans `reglages/compte/CompteClient.tsx`.
  const avant = propre(email).split("@")[0] ?? "";
  return (avant.slice(0, 2) || "?").toUpperCase();
}

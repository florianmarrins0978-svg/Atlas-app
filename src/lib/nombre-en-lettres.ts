/**
 * Le compte des chantiers, écrit en toutes lettres.
 *
 * **Pourquoi.** L'écran retenu par le patron le 10 août 2026 n'affiche aucun
 * chiffre dans son en-tête : « HUIT EN COURS », pas « 8 en cours ». Un chiffre
 * isolé dans un bandeau de capitales espacées se lit comme une donnée de
 * tableau de bord — exactement ce qu'il refuse. En lettres, la ligne redevient
 * une phrase.
 *
 * **Et pourquoi ça s'arrête à seize.** Au-delà, le mot devient plus long que la
 * ligne (« dix-sept » tient, « quatre-vingt-dix-neuf » non) et la lecture
 * s'inverse : le chiffre redevient plus rapide. Le seuil n'est pas
 * arithmétique, il est typographique — c'est la largeur de la colonne qui le
 * fixe. Un artisan qui prépare plus de seize chantiers à la fois lit un nombre,
 * et c'est très bien ainsi.
 */

const LETTRES = [
  "Zéro",
  "Un",
  "Deux",
  "Trois",
  "Quatre",
  "Cinq",
  "Six",
  "Sept",
  "Huit",
  "Neuf",
  "Dix",
  "Onze",
  "Douze",
  "Treize",
  "Quatorze",
  "Quinze",
  "Seize",
] as const;

export function nombreEnLettres(n: number): string {
  // Un compte négatif ou fractionnaire ne vient d'aucun chemin réel ; s'il
  // arrivait, mieux vaut afficher le nombre reçu que de le maquiller en mot.
  if (!Number.isInteger(n) || n < 0 || n >= LETTRES.length) return String(n);
  return LETTRES[n];
}

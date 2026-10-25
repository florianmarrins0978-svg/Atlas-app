// L'empreinte d'une adresse, telle que le journal l'écrit — pour retrouver les
// tentatives de connexion d'une personne (sa décision du 25 octobre 2026).
//
//   npm run empreinte -- jean.dupont@exemple.fr
//
// À jouer là où tourne Atlas : la clé est son AUTH_SECRET, et une autre clé
// donne une autre empreinte. Rien ne s'affiche que l'empreinte.

import { empreinteCourriel } from "../src/lib/empreinte-courriel";

const adresse = process.argv[2];
if (!adresse) {
  console.error("Donner l'adresse : npm run empreinte -- jean.dupont@exemple.fr");
  process.exit(1);
}
if (!process.env.AUTH_SECRET) {
  console.error("AUTH_SECRET absent : l'empreinte ne correspondrait pas à celle du journal. À jouer dans l'espace d'Atlas.");
  process.exit(1);
}
console.log(empreinteCourriel(adresse, process.env.AUTH_SECRET));

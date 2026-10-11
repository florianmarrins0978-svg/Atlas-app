import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * UN MOT LONG NE DOIT JAMAIS SORTIR DE SON CADRE.
 *
 * **Le patron, le 7 septembre 2026 :** *« si le client écrit un message trop
 * long avant de retourner le devis, ça fait bugger le message de retour, le
 * texte sort du cadre »*.
 *
 * ─── CE QU'IL A VU, ET CE QUE C'ÉTAIT VRAIMENT ──────────────────────────────
 *
 * Il croyait qu'il fallait brider le nombre de lettres. **Le champ du client
 * est déjà bridé à 500 caractères** (`src/app/devis/[jeton]/formulaire.tsx`) :
 * le brider davantage n'aurait rien réglé. Le débordement n'a rien à voir avec
 * la LONGUEUR — il arrive dès qu'il y a un mot long **sans espace** : quelqu'un
 * qui écrit vite sans ponctuation, une adresse internet collée, un numéro à
 * rallonge.
 *
 * La cause : `whitespace-pre-wrap` sans autorisation de couper un mot. Le
 * navigateur refuse alors de casser la ligne et le texte part droit devant.
 *
 * **Mesuré à 390 px, sur la carte de l'accueil :** le texte occupait 2 440 px
 * dans une carte de 342 — 2 140 px dehors —, et la page entière passait à
 * 2 486 px de large. Tout l'écran se mettait à défiler en travers. Avec
 * `break-words` : zéro pixel dehors.
 *
 * ─── POURQUOI CE CONTRÔLE EXISTE ────────────────────────────────────────────
 *
 * Le défaut ne vivait pas à UN endroit mais à CINQ, et rien ne les reliait :
 * la carte de l'accueil, l'écran d'envoi du devis, la note du planning,
 * l'aperçu du message dans les Réglages, la dictée transcrite. Corriger les
 * cinq sans poser de garde-fou, c'est attendre le sixième — c'est exactement ce
 * que le dépôt a déjà payé avec les barres de défilement, où chaque zone
 * portait sa règle chez elle et où personne ne comptait les zones
 * (`globals.css`, `.atlas-fil-defile`).
 *
 * **La règle : tout bloc qui affiche du texte TAPÉ PAR QUELQU'UN doit pouvoir
 * couper un mot.** `whitespace-pre-wrap` conserve les retours à la ligne — on
 * s'en sert justement pour du texte humain —, il désigne donc exactement ces
 * blocs-là.
 */

const RACINE = path.join(__dirname, "..", "src");

/**
 * Ce qui affiche du texte que PERSONNE ne tape, et n'a donc rien à couper.
 *
 * Une exception se déclare avec sa raison, jamais en silence : sans cela, le
 * jour où l'on ajoutera un bloc, on ne saura pas s'il est là par choix ou par
 * oubli — et c'est l'oubli qu'on cherche à attraper.
 */
const AUTORISES: { fichier: string; pourquoi: string }[] = [
  {
    fichier: "src/app/documents-legaux/formulaire.tsx",
    pourquoi:
      "les mentions légales sont NOTRE texte, écrit et relu ici — aucun mot n'y arrive " +
      "d'un clavier qu'on ne contrôle pas, et la coupure abîmerait une référence de loi",
  },
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx$/.test(nom) ? [chemin] : [];
  });
}

console.log("=== Un mot long ne sort pas de son cadre ===\n");

const coupables: string[] = [];
let lignesLues = 0;
let blocsTrouves = 0;

for (const chemin of fichiers(RACINE)) {
  const relatif = path.relative(path.join(__dirname, ".."), chemin).replace(/\\/g, "/");
  const lignes = readFileSync(chemin, "utf8").split("\n");
  lignesLues += lignes.length;

  lignes.forEach((ligne, i) => {
    if (!ligne.includes("whitespace-pre-wrap")) return;
    blocsTrouves++;
    if (AUTORISES.some((a) => a.fichier === relatif)) return;
    // `break-words` (le mot se coupe s'il ne tient pas) ou `break-all` (il se
    // coupe toujours) : les deux ferment le défaut, et le choix appartient à
    // l'écran.
    if (/break-words|break-all/.test(ligne)) return;
    coupables.push(`${relatif}:${i + 1} — ${ligne.trim().slice(0, 90)}`);
  });
}

/* **Un contrôle qui ne mesure rien rend un vert qui ne prouve rien**
   (`CLAUDE.md` §5). Si la lecture échouait, la liste serait vide et la suite
   passerait au vert sans avoir rien regardé. */
assert.ok(lignesLues > 10_000, `seulement ${lignesLues} lignes lues : la lecture de src/ a échoué`);
assert.ok(blocsTrouves >= 5, `seulement ${blocsTrouves} bloc(s) trouvés : le motif ne décrit plus rien`);

if (coupables.length > 0) {
  console.log("❌ Ces blocs affichent du texte tapé par quelqu'un et ne peuvent pas couper un mot :\n");
  for (const c of coupables) console.log(`   ${c}`);
  console.log(
    "\n   Un mot long sans espace — une adresse collée, un message écrit sans" +
      "\n   ponctuation — sort alors du cadre et fait défiler TOUT l'écran en" +
      "\n   travers. Mesuré le 7 septembre 2026 : 2 140 px dehors sur la carte de" +
      "\n   l'accueil, et une page de 2 486 px de large au lieu de 390." +
      "\n\n   Ajouter `break-words` à la classe. Si le bloc n'affiche vraiment aucun" +
      "\n   texte humain, l'inscrire dans AUTORISES, avec sa raison."
  );
  process.exit(1);
}

console.log(
  `✅ ${lignesLues} lignes lues, ${blocsTrouves} bloc(s) de texte humain, ` +
    `${AUTORISES.length} exception(s) nommée(s) — aucun ne peut déborder.`
);

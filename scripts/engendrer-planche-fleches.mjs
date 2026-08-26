/* =======================================================================
   La planche des flèches retirées, à partir des vraies captures.

   **Sa demande du 25 août 2026 :** *« fais-moi une photo de chaque flèche
   que tu as supprimée »* — pour distinguer celles qui décoraient un
   bouton de celles qui ouvrent une page.

   Les images viennent de `capture-fleches-retirees.mts`, jouées sur
   l'application qui tourne : rien n'est dessiné à la main ici. Elles sont
   posées **dans la page** (base64) plutôt qu'à côté — GitHub Pages ne
   publie que `appli/`, et une planche qui pointe vers des fichiers
   absents lui montre des cadres vides depuis son téléphone.

   Usage :
     node scripts/engendrer-planche-fleches.mjs <dossier-des-captures>
   ======================================================================= */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: engendrer-planche-fleches.mjs <dossier-des-captures>");
  process.exit(1);
}
const releve = JSON.parse(readFileSync(path.join(dossier, "releve.json"), "utf8"));

/* Un relevé vide rendrait une planche vide, qui se lit comme « il n'y avait
   rien à retirer ». Mieux vaut refuser que publier ça. */
if (!Array.isArray(releve) || releve.length === 0) {
  console.error("Le relevé est vide : la capture n'a rien produit, la planche mentirait.");
  process.exit(1);
}

const enBase64 = (nom) => {
  const p = path.join(dossier, nom);
  return existsSync(p) ? `data:image/png;base64,${readFileSync(p).toString("base64")}` : null;
};

const echapper = (t) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const carte = (r) => `      <figure class="carte">
        <img src="${enBase64(r.image)}" alt="${echapper(r.libelle)}">
        <figcaption>
          <span class="avant">${echapper(r.avant)}</span>
          <span class="ou">${echapper(r.ecran)}</span>
        </figcaption>
      </figure>`;

/**
 * Ceux qu'on n'a pas pu photographier, en liste plutôt qu'en cartes vides.
 *
 * Une carte sans image occupe autant de place qu'une vraie et ne montre
 * rien : sept d'entre elles noyaient les dix qui, elles, se regardent.
 */
const sansImage = (liste) => {
  const absents = liste.filter((r) => !r.image);
  if (!absents.length) return "";
  return `  <p class="reste">Ces libellés existent mais leur écran ne s'atteint pas depuis ce banc d'essai :
    ${absents.map((r) => `<b>${echapper(r.avant)}</b>`).join(", ")}.</p>`;
};

const boutons = releve.filter((r) => r.genre === "bouton");
const liens = releve.filter((r) => r.genre === "lien");

/* Ce qui n'a PAS été touché. Écrit à la main, et c'est assumé : ces
   flèches-là ne sont pas dans le relevé, puisqu'on ne les a pas retirées. */
const GARDEES = [
  ["‹ en haut à gauche", "revenir en arrière", "tous les écrans"],
  ["‹ ›", "feuilleter les mois, les semaines, les chantiers terminés", "calendriers, planning"],
  ["← T1 2026 · T3 2026 →", "période de TVA précédente et suivante", "Terminés · TVA"],
  ["← Aujourd'hui", "revenir au mois courant", "carte du mois"],
  ["↑", "envoyer sa question sur le plan d'arrosage", "Paysage · arrosage"],
  ["250 € → 350 €", "dit avant et après une correction", "assistant du devis"],
];

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Les flèches retirées</title>
<style>
  :root { --fond:#efece6; --encre:#221f1a; --doux:#6b665c; --or:#8a7452; --carte:#f7f5f0; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--fond); color:var(--encre);
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; line-height:1.5; }
  main { max-width:760px; margin:0 auto; padding:28px 18px 64px; }
  h1 { font-family:Georgia,"Times New Roman",serif; font-weight:600; font-size:30px; margin:0 0 6px; }
  .chapeau { color:var(--doux); font-size:15px; margin:0 0 30px; }
  h2 { font-size:13px; letter-spacing:.16em; text-transform:uppercase; color:var(--or);
       margin:38px 0 4px; font-weight:600; }
  .sous { color:var(--doux); font-size:14px; margin:0 0 16px; }
  .grille { display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); }
  .carte { margin:0; background:var(--carte); border-radius:14px; overflow:hidden;
           box-shadow:0 1px 3px rgba(0,0,0,.06); }
  .carte img { display:block; width:100%; height:auto; }
  .reste { margin:14px 0 0; font-size:14px; color:var(--doux); }
  .reste b { color:var(--encre); font-weight:600; }
  figcaption { padding:10px 14px 13px; }
  .avant { display:block; font-size:15px; font-weight:600; }
  .ou { display:block; font-size:12.5px; color:var(--doux); margin-top:2px; word-break:break-all; }
  table { width:100%; border-collapse:collapse; font-size:14.5px; margin-top:8px; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid rgba(34,31,26,.10); vertical-align:top; }
  th { font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--doux); font-weight:600; }
</style>
</head>
<body>
<main>
  <h1>Les flèches retirées</h1>
  <p class="chapeau">Ce qui est parti, écran par écran. Ce qui sert à revenir ou à feuilleter n'a pas été touché.</p>

  <h2>Sur un bouton</h2>
  <p class="sous">Ce que vous avez demandé de retirer.</p>
  <div class="grille">
${boutons.filter((r) => r.image).map(carte).join("\n")}
  </div>
${sansImage(boutons)}

  <h2>Sur un lien qui ouvre une page</h2>
  <p class="sous">Dites si vous voulez la flèche de retour sur ceux-là.</p>
  <div class="grille">
${liens.filter((r) => r.image).map(carte).join("\n")}
  </div>
${sansImage(liens)}

  <h2>Pas touchées</h2>
  <table>
    <tr><th>Flèche</th><th>Ce qu'elle fait</th><th>Où</th></tr>
${GARDEES.map(([f, q, o]) => `    <tr><td>${echapper(f)}</td><td>${echapper(q)}</td><td>${echapper(o)}</td></tr>`).join("\n")}
  </table>
</main>
</body>
</html>
`;

const sortie = path.join(process.cwd(), "appli", "fleches-retirees.html");
writeFileSync(sortie, html);
const vues = releve.filter((r) => r.image).length;
console.log(`Planche écrite : ${sortie}`);
console.log(`  ${vues}/${releve.length} libellés avec image · ${Math.round(html.length / 1024)} Ko`);

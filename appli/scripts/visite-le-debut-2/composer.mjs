// Assemble `appli/visite-guidee-le-debut-2.html` : les QUATRE vrais écrans figés,
// repris tels quels de `appli/visite-guidee.html`, et le guide de ce dossier
// par-dessus (`guide.css`, `guide.html`, `guide.js`). Aucun serveur, aucune base :
//   node appli/scripts/visite-le-debut-2/composer.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ici = path.dirname(fileURLToPath(import.meta.url));
const depot = path.join(ici, "..", "..", "..");
const source = readFileSync(path.join(depot, "appli/visite-guidee.html"), "utf8");

// Les feuilles de l'appli : le premier bloc de style, entier.
const debut = source.indexOf("<style>");
const finStyle = source.indexOf("</style>", debut);
const feuilles = source.slice(debut, finStyle + "</style>".length);
const tete = source.slice(0, debut).replace(/<title>[^<]*<\/title>\s*/, "");

const ECRANS = ["01-accueil", "02-clients", "02b-client-devis", "02c-client-factures"];
const lignes = source.split("\n");
const blocs = ECRANS.map((nom, i) => {
  const ligne = lignes.find((l) => l.startsWith(`<div class="visite-ecran" data-ecran="${nom}"`));
  if (!ligne) throw new Error(`écran introuvable dans la visite : ${nom}`);
  // Le premier écran se voit sans script : une page qui ne charge pas son script ne reste pas blanche.
  return i === 0 ? ligne.replace(/^(<div class="visite-ecran"[^>]*?) hidden>/, "$1>") : ligne;
});

const lire = (f) => readFileSync(path.join(ici, f), "utf8").trimEnd();
const html = `${tete}<title>Visite de Cause, le début, seconde proposition</title>
${feuilles}<style>
${lire("guide.css")}
</style></head>
<body class="font-body antialiased">
${blocs.join("\n")}
${lire("guide.html")}
<script>
${lire("guide.js")}
</script>
</body></html>
`;
const sortie = path.join(depot, "appli/visite-guidee-le-debut-2.html");
writeFileSync(sortie, html);
console.log(`${path.relative(depot, sortie)} : ${Buffer.byteLength(html)} octets, ${blocs.length} écrans`);

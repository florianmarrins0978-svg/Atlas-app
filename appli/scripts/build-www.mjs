/* =======================================================================
   Assemble le bundle web de l'APPLI (dossier www/) pour la coque Capacitor.
   Source unique de vérité : les fichiers .html/.js à la racine du dépôt.
   www/ est régénéré à chaque fois — ne pas l'éditer à la main (il est ignoré
   par git). La version web publiée (GitHub Pages) n'est pas affectée.
   ======================================================================= */
import { mkdir, rm, copyFile, writeFile, cp, access } from 'node:fs/promises';

// Écrans embarqués dans l'app native (l'appli, pas le site vitrine).
const APP_FILES = [
  'app.html',
  'devis-vocal.html',
  'devis-modele.html',
  'facture-modele.html',
  'tva-modele.html',
  'mes-tarifs.html',
  'nav.js',
];

await rm('www', { recursive: true, force: true });
await mkdir('www', { recursive: true });

for (const f of APP_FILES) {
  await copyFile(f, `www/${f}`);
}

// Copie le dossier images/ s'il existe (au cas où de futurs écrans en utilisent).
try {
  await access('images');
  await cp('images', 'www/images', { recursive: true });
} catch { /* pas de dossier images : rien à copier */ }

// index.html requis par Capacitor comme point d'entrée → redirige vers l'accueil de l'appli.
await writeFile('www/index.html',
  '<!doctype html><html lang="fr"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta http-equiv="refresh" content="0; url=app.html">' +
  '<title>Arborea</title></head><body>' +
  '<script>location.replace("app.html");</script></body></html>\n');

console.log(`www/ prêt : ${APP_FILES.length} écrans + index de redirection.`);

// Fige le VRAI écran Mon entreprise (`/reglages/identite`) du compte de
// démonstration, pour la planche « L'identité attachée au SIRET ». Sa remarque
// du 23 novembre 2026 : « s'il utilise le SIRET d'un autre, après, dans ses
// réglages, il peut tout modifier, le nom de la boîte… ça le bloque sans le
// bloquer ». Usage, serveur lancé sur la base de démonstration :
//   ATLAS_ADRESSE=http://localhost:3000 node appli/scripts/identite-au-registre/figer.mjs <dossier>
import { mkdirSync, writeFileSync } from "node:fs";
import { ouvrir, feuilles, corps, BASE } from "../../../scripts/planche-figee/figer.mjs";

const [SORTIE] = process.argv.slice(2);
mkdirSync(SORTIE, { recursive: true });
const { nav, contexte, page } = await ouvrir();
await page.goto(`${BASE}/reglages/identite`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
writeFileSync(`${SORTIE}/css.txt`, await feuilles(page, contexte));
writeFileSync(`${SORTIE}/identite.json`, JSON.stringify(await corps(page, contexte)));
console.log("figé /reglages/identite");
await nav.close();

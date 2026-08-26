// Capture la page PUBLIQUE de la facture — celle que le CLIENT voit — pour la
// regarder aux couleurs de l'application, avec son bouton de téléchargement
// (sa demande du 25 août 2026). §5 : on regarde l'écran.
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const jeton = process.env.JETON;
const dossier = process.argv[2] ?? "/tmp/captures-facture-pub";
if (!jeton) throw new Error("JETON manquant");
mkdirSync(dossier, { recursive: true });

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await contexte.newPage();
await page.goto(`${BASE}/factures/${jeton}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/facture-publique.png`, fullPage: true });
console.log("capturé");
await navigateur.close();

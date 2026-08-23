import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { dessinerPlan, type ZoneDessinee } from "../src/lib/arrosage/plan-dessine";
import PlanDessine from "../src/app/paysage/arrosage/PlanDessine";

/**
 * REGARDER LE PLAN — sans serveur, sans base, sans clé d'IA.
 *
 * **Pourquoi ce script existe.** `CLAUDE.md` §5 le dit sans détour : *« et
 * surtout, regarder l'écran »*. Trois défauts réels de ce projet ont été
 * trouvés sur une capture et par aucun test vert. Le plan d'arrosage ne peut
 * pourtant pas s'atteindre normalement ici : il faut une photo de croquis et un
 * fournisseur de vision, dont cet environnement n'a pas la clé.
 *
 * Ce script court-circuite le parcours et rend le SEUL composant du dessin,
 * avec les données que le calcul produit vraiment. Ce qu'il montre est donc ce
 * que l'écran montrera — à la feuille de style près, remplacée ici par un
 * substitut minimal, puisque Tailwind ne tourne pas hors du serveur.
 *
 * **Ce qu'il a déjà attrapé, le 23 août 2026** — aucun test ne les voyait :
 *   · les cercles de portée débordaient de la pelouse et noyaient le dessin ;
 *   · le mot « nourrice » tombait sur la cote du côté, illisible ;
 *   · deux réseaux qui partagent une tranchée dessinaient le même trait, et le
 *     second effaçait le premier ;
 *   · la ligne du troisième réseau se confondait avec la tranchée qui la porte.
 *
 *   npx tsx scripts/capture-plan-arrosage.ts <dossier>
 *
 * **En `.ts` et non en `.mts`, à dessein** : le calcul repris (`calcul.js`) est
 * un module CommonJS, et un fichier `.mts` n'en tire pas les exports nommés.
 */

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-plan-arrosage.ts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`)
    ? `${racine}/${sous}/chrome-linux/chrome`
    : undefined;
}

type Zone = { id: number; type: string; nom: string; x: number; y: number; L: number; l: number };

/** Les classes de l'application, en substitut : le dessin doit tenir en 390 px. */
const FEUILLE = `
body{margin:0;background:#f5f3ee;font-family:Helvetica,Arial,sans-serif;width:390px;color:#1c1c1a}
p{margin:0}
[class*="mx-[22px]"]{margin-left:22px;margin-right:22px}
[class*="mt-7"]{margin-top:28px}
[class*="mt-3"]{margin-top:12px}
[class*="mt-2"]{margin-top:8px}
[class*="mt-1 "]{margin-top:4px}
[class*="p-3"]{padding:12px}
[class*="px-4"]{padding-left:16px;padding-right:16px}
[class*="py-3"]{padding-top:12px;padding-bottom:12px}
[class*="py-[14px]"]{padding-top:14px;padding-bottom:14px}
[class*="py-[5px]"]{padding-top:5px;padding-bottom:5px}
[class*="rounded-[12px]"]{border-radius:12px}
[class*="rounded-[3px]"]{border-radius:3px}
[class*="block"]{display:block}
[class*="w-full"]{width:100%}
[class*="flex "]{display:flex}
[class*="items-center"]{align-items:center}
[class*="gap-2.5"]{gap:10px}
span[class*="flex-none"]{flex:none}
span[class*="flex-1"]{flex:1;min-width:0}
span[class*="h-[11px]"]{height:11px;width:11px;display:block}
svg[class*="h-[15px]"]{height:15px;width:15px;flex:none}
[class*="text-[13.5px]"]{font-size:13.5px}
[class*="text-[12.5px]"]{font-size:12.5px}
`;

function page(zones: Zone[], nourrice: { x: number; y: number }) {
  const p = calculerPlan({
    seau: 10, temps: 19, pression: 2.5, compteur: "oui", zones,
  } as never) as never as { dessin: ZoneDessinee[]; couleurs: string[] };
  const r = dessinerPlan(p.dessin, nourrice, p.couleurs);
  if (!r.ok) throw new Error(`le plan a été refusé : ${r.raison}`);
  for (const x of r.reserves) console.log(`    réserve : ${x}`);
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=390">
<style>${FEUILLE}</style>
${renderToStaticMarkup(React.createElement(PlanDessine, { dessin: r.dessin }))}`;
}

const CAS: { nom: string; zones: Zone[]; nourrice: { x: number; y: number } }[] = [
  {
    // Son jardin du croquis du 21 août 2026 : la pelouse en L.
    nom: "plan-jardin-en-L",
    zones: [
      { id: 1, type: "gazon", nom: "Pelouse", x: 0, y: 0, L: 12, l: 12 },
      { id: 2, type: "gazon", nom: "Bande du haut", x: 12, y: 0, L: 8, l: 4 },
    ],
    nourrice: { x: 0, y: 4 },
  },
  {
    // Le cas le plus courant, et le plus piégeux : deux pelouses séparées par
    // la maison. Le cheminement entre les deux n'est pas sur le croquis.
    nom: "plan-deux-pelouses",
    zones: [
      { id: 1, type: "gazon", nom: "Devant", x: 0, y: 0, L: 10, l: 6 },
      { id: 2, type: "gazon", nom: "Derrière", x: 0, y: 14, L: 12, l: 8 },
    ],
    nourrice: { x: 13, y: 10 },
  },
  {
    // **Depuis le 23 août, une vanne peut porter deux buses** : le patron a
    // retiré la pluviométrie de la clé de secteur. Une grande pelouse et une
    // petite ne reçoivent pas la même buse, et se retrouvent pourtant sur la
    // même voie — la carte du réseau doit donc les NOMMER toutes les deux.
    nom: "plan-deux-buses-sur-une-vanne",
    zones: [
      { id: 1, type: "gazon", nom: "Grande", x: 0, y: 0, L: 14, l: 14 },
      { id: 2, type: "gazon", nom: "Petite", x: 14, y: 0, L: 5, l: 5 },
    ],
    nourrice: { x: 0, y: 7 },
  },
];

async function capturer() {
  const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const onglet = await contexte.newPage();

  for (const cas of CAS) {
    console.log(`  · ${cas.nom}`);
    const fichier = `${dossier}/${cas.nom}.html`;
    writeFileSync(fichier, page(cas.zones, cas.nourrice));
    await onglet.goto(`file://${fichier}`);
    await onglet.screenshot({ path: `${dossier}/${cas.nom}.png`, fullPage: true });
  }

  await navigateur.close();
  console.log(`\n✅ ${CAS.length} captures dans ${dossier}`);
}

capturer().catch((e) => {
  console.error(e);
  process.exit(1);
});

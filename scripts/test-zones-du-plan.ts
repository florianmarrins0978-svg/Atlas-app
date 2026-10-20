import { ajouterUneZone, glisserLaZone, modifierLaZone, supprimerLaZone } from "../src/lib/arrosage/zones-du-plan";
import { calculerEtDessiner } from "../src/lib/arrosage/le-plan";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";

// CE QUE L'IA A MAL LU SE CORRIGE À LA MAIN — « la A », sa réponse du
// 20 octobre 2026 (`appli/arrosage-cotes-des-zones.html`) : modifier la
// longueur et la largeur d'une zone, la supprimer (« lue à tort ou qu'on ne
// voudrait plus »), en ajouter une que l'IA n'a pas lue, et la glisser au doigt
// sur le plan avec l'aimant de 50 cm. Le calcul refait le plan à chaque geste.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

// Sa seconde photo du 20 octobre : la pelouse à arroseurs, et le parking lu à tort.
const LU: ParametresPlan = {
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 5, amenee: 10,
  zones: [
    { id: 1, type: "gazon", nom: "Arroseurs", L: 12, l: 10, x: 0, y: 0 },
    { id: 2, type: "massif", nom: "Parking", L: 8, l: 2.6, x: 12, y: 3.7, sortieGoutte: "boucle" },
  ],
  nourrice: { x: 1, y: -1 },
};

console.log("=== Corriger les zones lues ===\n");

// ── Modifier ────────────────────────────────────────────────────────────────
{
  const r = modifierLaZone(LU, 1, { L: 14, l: 10 });
  dire(r.ok && r.parametres.zones[0].L === 14 && r.parametres.zones[0].l === 10, "la longueur corrigée entre dans les paramètres");
  dire(LU.zones[0].L === 12, "les paramètres d'origine ne bougent pas");
  dire(!modifierLaZone(LU, 1, { L: 0, l: 10 }).ok, "une longueur nulle est refusée");
  dire(!modifierLaZone(LU, 1, { L: 1000, l: 10 }).ok, "mille mètres sont refusés, comme à la lecture du croquis");
  dire(!modifierLaZone(LU, 99, { L: 5, l: 5 }).ok, "une zone qui n'existe pas est refusée");
  const haie = modifierLaZone({ ...LU, zones: [...LU.zones, { id: 3, type: "haie", nom: "Haie", ml: 6, x: 0, y: 11 }] }, 3, { ml: 9 });
  dire(haie.ok && haie.parametres.zones[2].ml === 9, "une haie se corrige en longueur seule");
}

// ── Supprimer ───────────────────────────────────────────────────────────────
{
  const r = supprimerLaZone(LU, 2);
  dire(r.ok && r.parametres.zones.length === 1 && r.parametres.zones[0].nom === "Arroseurs", "le parking lu à tort se supprime");
  dire(r.ok && calculerEtDessiner(r.parametres, null).plan.secteurs.length === calculerEtDessiner(LU, null).plan.secteurs.length - 1, "et son réseau part avec lui");
  dire(!supprimerLaZone({ ...LU, zones: [LU.zones[0]] }, 1).ok, "la dernière zone ne se supprime pas : sans zone, aucun plan");
}

// ── Ajouter, puis glisser ───────────────────────────────────────────────────
{
  const r = ajouterUneZone(LU, { nom: "Goutte à goutte", arrosage: "goutte", L: 6, l: 1 });
  const z = r.ok ? r.parametres.zones[r.parametres.zones.length - 1] : null;
  dire(r.ok && z !== null && z.type === "massif" && z.L === 6 && z.l === 1 && z.id === 3, "une zone en goutte-à-goutte s'ajoute, avec un numéro neuf");
  dire(z?.aPlacer === true, "elle est marquée à placer tant qu'il ne l'a pas glissée");
  dire(z !== null && z.y! >= 10.5, "elle se pose sous les autres, jamais par-dessus une zone lue");
  dire(z?.sortieGoutte === "boucle", "elle reprend la sortie de goutte-à-goutte déjà choisie sur ce plan");
  const arr = ajouterUneZone(LU, { nom: "Pelouse", arrosage: "arroseurs", L: 6, l: 5 });
  dire(arr.ok && arr.parametres.zones[2].type === "gazon", "une zone à arroseurs est une pelouse");
  dire(!ajouterUneZone(LU, { nom: "", arrosage: "arroseurs", L: 0, l: 5 }).ok, "une zone sans cote ne s'ajoute pas");
  if (r.ok) {
    const plan = calculerEtDessiner(r.parametres, null).plan;
    dire(plan.reserves.some((x) => /Goutte à goutte/.test(x) && /glissez/.test(x)), "le plan dit qu'elle n'est pas placée, et quoi faire");
    // Glissée à 30 cm du bord haut de la pelouse : l'aimant la colle au bord.
    const g = glisserLaZone(r.parametres, 3, -0.2, -1.3);
    const zg = g.ok ? g.parametres.zones[2] : null;
    dire(zg !== null && Math.abs(zg.x! - 0) < 1e-9 && Math.abs(zg.y! + 1) < 1e-9, `l'aimant de 50 cm la colle au coin de la pelouse (lu : ${zg?.x}, ${zg?.y})`);
    dire(zg?.aPlacer === false, "glissée, elle n'est plus à placer");
    const plan2 = calculerEtDessiner(g.ok ? g.parametres : r.parametres, null).plan;
    dire(!plan2.reserves.some((x) => /glissez/.test(x)), "et la réserve se tait");
    const loin = glisserLaZone(r.parametres, 3, 5000, 5000);
    dire(!loin.ok, "une place à cinq kilomètres est refusée");
  }
}

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);

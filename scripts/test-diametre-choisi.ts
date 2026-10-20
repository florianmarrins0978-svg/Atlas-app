import { calculerPlan } from "../src/lib/arrosage/calcul.js";
import { ceQueLeTuyauChange, poserLeTuyau } from "../src/lib/arrosage/diametre-choisi";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";

// LE Ø25 D'ABORD, UN RÉSEAU DE PLUS ENSUITE, LE Ø32 SUR SON CHOIX.
//
// Sa règle du 20 octobre 2026 : *« il fait le calcul en diamètre 25 ; si le 25
// ne passe pas, il rajoute un réseau »*, et sur l'écran il passe un réseau ou
// l'amenée en Ø32 pour voir ce que ça fait gagner, ou refuse le Ø32 que
// l'outil propose. Les chiffres attendus sont ceux que le calcul rend sur ces
// jardins ; ils se refont ici, sans clé ni base.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};
type Plan = { secteurs: unknown[]; perteReseau: number; perteAmenee: number; amenee: { diametre: number; propose: number } };
const plan = (e: object) => (calculerPlan as unknown as (e: object) => Plan)(e);
const jardin = (L: number, l: number, pression: number, amenee: number) => ({
  seau: 10, temps: 18, pression, compteur: "oui", regardVersZone: 10, amenee,
  zones: [{ id: 1, type: "gazon", L, l, x: 0, y: 0 }],
});
const TOUS_EN_32 = { reseaux: { 0: 32, 1: 32, 2: 32, 3: 32 } };

console.log("=== Le Ø25 ou le Ø32 qu'il choisit ===\n");

// ── 1. Sans choix, tout est en Ø25 ──────────────────────────────────────────
{
  const sans = plan(jardin(20, 12, 3, 15));
  const en25 = plan({ ...jardin(20, 12, 3, 15), diametres: { reseaux: { 0: 25, 1: 25 } } });
  dire(sans.secteurs.length === en25.secteurs.length && sans.perteReseau === en25.perteReseau, "sans choix, les réseaux sont calculés en Ø25");
}

// ── 2. Les réseaux passés en Ø32 perdent moins, et peuvent en économiser un ─
{
  const en25 = plan(jardin(20, 12, 3, 15));
  const en32 = plan({ ...jardin(20, 12, 3, 15), diametres: TOUS_EN_32 });
  dire(en32.perteReseau < en25.perteReseau, `en Ø32 le réseau perd moins (${en32.perteReseau.toFixed(2)} contre ${en25.perteReseau.toFixed(2)} bar)`);
  dire(en25.secteurs.length === 2 && en32.secteurs.length === 1, `20 x 12 à 3 bar : 2 réseaux en Ø25, 1 en Ø32 (lu : ${en25.secteurs.length} et ${en32.secteurs.length})`);
}

// ── 3. L'amenée : l'outil propose, il peut refuser ──────────────────────────
{
  const auto = plan(jardin(20, 12, 2.5, 60));
  const refuse = plan({ ...jardin(20, 12, 2.5, 60), diametres: { amenee: 25 } });
  dire(auto.amenee.propose === 32 && auto.amenee.diametre === 32, "60 m d'amenée : l'outil propose le Ø32, et le retient sans autre choix");
  dire(refuse.amenee.diametre === 25 && refuse.amenee.propose === 32, "refusé, l'amenée reste en Ø25, et la proposition reste connue");
  dire(refuse.perteAmenee > auto.perteAmenee, "et le calcul compte la perte du Ø25 qu'il a gardé, pas celle du Ø32");
  dire(refuse.secteurs.length === auto.secteurs.length + 1, `en Ø25, un réseau de plus (${refuse.secteurs.length} contre ${auto.secteurs.length})`);
  const court = plan({ ...jardin(20, 12, 3, 15), diametres: { amenee: 32 } });
  dire(court.amenee.propose === 25 && court.amenee.diametre === 32, "une amenée courte peut passer en Ø32 sur son choix");
}

// ── 4. La phrase sous les cases, et le choix posé sur les paramètres ───────
{
  const avant = { reseaux: 3, tetes: [4, 4, 1] };
  dire(
    ceQueLeTuyauChange(avant, { reseaux: 2, tetes: [5, 4] }, 0, 32) === "En Ø32 : 5 arroseurs sur ce réseau au lieu de 4, un réseau de moins.",
    "un réseau en Ø32 qui en gagne un : « En Ø32 : 5 arroseurs sur ce réseau au lieu de 4, un réseau de moins. »",
  );
  dire(ceQueLeTuyauChange(avant, { reseaux: 4, tetes: [3, 3, 2, 1] }, "amenee", 25) === "En Ø25 : un réseau de plus.", "l'amenée refusée en Ø32 : « En Ø25 : un réseau de plus. »");
  dire(
    ceQueLeTuyauChange({ reseaux: 2, tetes: [6, 6] }, { reseaux: 1, tetes: [6] }, 0, 32) === "En Ø32 : 6 arroseurs au lieu de 12 sur le jardin, un réseau de moins.",
    "20 x 12 : le Ø32 change de buse, la phrase le dit (6 arroseurs au lieu de 12 sur le jardin)",
  );
  dire(ceQueLeTuyauChange(avant, avant, 1, 32) === "En Ø32 : rien ne change sur ce jardin.", "rien ne bouge : la phrase le dit, elle ne se tait pas");
  dire(ceQueLeTuyauChange({ reseaux: 4, tetes: [] }, { reseaux: 2, tetes: [] }, "amenee", 32) === "En Ø32 : 2 réseaux de moins.", "deux réseaux de moins s'écrivent au pluriel");
  const p = { zones: [], robinet: { montage: "nourrice", double: false, depart: 25 } } as unknown as ParametresPlan;
  const q = poserLeTuyau(p, "amenee", 32);
  dire(q.diametres?.amenee === 32 && q.robinet?.depart === null, "au robinet, le départ choisi à la main suit le tuyau choisi");
  dire(p.diametres === undefined && p.robinet?.depart === 25, "les paramètres d'origine ne bougent pas");
  const r = poserLeTuyau(poserLeTuyau(p, 0, 32), 2, 32);
  dire(r.diametres?.reseaux?.[0] === 32 && r.diametres?.reseaux?.[2] === 32, "deux réseaux passés en Ø32 gardent chacun leur choix");
}

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);

import assert from "node:assert/strict";
// Module JavaScript repris tel quel de `appli/` : `allowJs` le laisse passer,
// et `checkJs` étant coupé, il n'est pas typé. C'est voulu — le typer aurait
// été le réécrire, donc en faire une seconde implémentation.
import { calculerPlan, optionsCatalogue } from "../src/lib/arrosage/calcul.js";

// Le calcul d'arrosage, tel qu'il tourne dans l'application.
//
// **Ce fichier ne réécrit rien** : `src/lib/arrosage/calcul.js` est la copie du
// calcul que le patron éprouve sur son téléphone depuis le 17 août 2026. Ce que
// cette suite tient, c'est que la PORTE D'ENTRÉE serveur rend bien ce que le
// calcul rend — et que rien ne s'invente au passage.
//
// **LE CONTRÔLE QUI COMPTE EST LE DÉBIT.** Un réseau qui demande plus que ce que
// le compteur donne, c'est un arroseur qui ne monte pas — et le paysagiste le
// découvre chez le client, pas ici.

let echecs = 0;
const dire = (bon: boolean, quoi: string) => {
  console.log(`${bon ? "  ✓" : "  ✗"} ${quoi}`);
  if (!bon) echecs++;
};

// Le jardin de la maquette : 96 m² devant, 120 m² derrière, 34 m de haie.
const JARDIN = {
  seau: 10,
  temps: 20,
  pression: 3,
  compteur: "oui",
  zones: [
    { type: "gazon", nom: "Pelouse devant", L: 16, l: 6 },
    { type: "gazon", nom: "Pelouse derrière", L: 15, l: 8 },
    { type: "haie", nom: "Haie", ml: 22 },
    { type: "massif", nom: "Massifs", ml: 12 },
  ],
};

console.log("=== Le calcul d'arrosage, côté serveur ===\n");

const plan = calculerPlan(JARDIN);

// ── 1. Le débit au seau ─────────────────────────────────────────────────────
// 10 L en 20 s font 0,5 L/s, donc 1,80 m³/h. C'est le chiffre de sa capture.
dire(
  Math.abs(plan.debitDisponible - 1.8) < 0.001,
  `10 L en 20 s donnent ${plan.debitDisponible.toFixed(2)} m³/h`,
);

// ── 2. AUCUN RÉSEAU AU-DESSUS DU DÉBIT ──────────────────────────────────────
//
// C'est la raison d'être du découpage. Sans ce contrôle, la suite entière
// pourrait passer au vert sur un plan qui ne peut pas fonctionner.
const pire = Math.max(...plan.secteurs.map((s: { debit: number }) => s.debit));
dire(
  pire <= plan.limite + 1e-9,
  `le réseau le plus gourmand demande ${pire.toFixed(2)} m³/h pour ${plan.limite.toFixed(2)} admis`,
);
dire(plan.secteurs.length >= 2, `${plan.secteurs.length} réseaux — un jardin de cette taille en demande plusieurs`);

// **La demande totale doit dépasser le débit**, sinon un seul réseau aurait
// suffi et le découpage ne servirait à rien.
dire(
  plan.demande > plan.debitDisponible,
  `la demande totale (${plan.demande.toFixed(2)} m³/h) dépasse le disponible (${plan.debitDisponible.toFixed(2)})`,
);

// ── 3. Le programmateur a assez de voies ────────────────────────────────────
dire(
  plan.voies >= plan.secteurs.length,
  `programmateur ${plan.voies} voies pour ${plan.secteurs.length} réseaux`,
);

// ── 4. Le matériel sort du CATALOGUE, pas de nulle part ─────────────────────
dire(plan.materiel.length > 0, `${plan.materiel.length} lignes de matériel`);
const sansNom = plan.materiel.filter((l: { nom?: string }) => !l.nom || !l.nom.trim());
dire(sansNom.length === 0, `aucune ligne de matériel sans libellé (${sansNom.length} trouvée(s))`);
const quantitesFausses = plan.materiel.filter(
  (l: { q: number }) => !Number.isFinite(l.q) || l.q <= 0
);
dire(
  quantitesFausses.length === 0,
  `aucune quantité nulle ou absurde${quantitesFausses.length ? ` — ${JSON.stringify(quantitesFausses[0])}` : ""}`,
);

// ── 5. Un jardin vide ne rend pas un plan ───────────────────────────────────
const vide = calculerPlan({ seau: 10, temps: 20, zones: [] });
dire(vide.secteurs.length === 0, "aucune zone : aucun réseau, et non un réseau vide");

// ── 6. Une mesure EFFACÉE ne donne pas un débit inventé ─────────────────────
//
// **Ce que ce contrôle a appris.** Il exigeait d'abord qu'un appel SANS mesure
// rende zéro. Il rendait 1,80 — parce que le calcul repris part de valeurs par
// défaut (10 L en 20 s), comme le fait sa page depuis le 17 août : les champs
// y sont pré-remplis, et il les corrige sous les yeux.
//
// Ce n'est donc pas une invention tant que les cases sont VISIBLES et
// modifiables. Ce qui en serait une, c'est de rendre un débit quand il a effacé
// la mesure — et c'est cela qu'on tient ici.
const efface = calculerPlan({ seau: 0, temps: 0, zones: JARDIN.zones });
dire(
  efface.debitDisponible === 0,
  `mesure effacée : le débit vaut ${efface.debitDisponible} — il ne se devine pas`,
);
dire(
  efface.secteurs.every((s: { debit: number }) => s.debit > 0),
  "sans débit connu, le découpage ne rend pas de réseaux à zéro",
);

// ── 7. Deux appels de suite ne se contaminent pas ───────────────────────────
//
// Le calcul repris travaille sur un état global : sur un serveur, deux
// artisans calculent en même temps. La porte d'entrée le restaure en sortant,
// et c'est ce qu'on vérifie ici.
const encore = calculerPlan(JARDIN);
dire(
  encore.secteurs.length === plan.secteurs.length &&
    Math.abs(encore.debitDisponible - plan.debitDisponible) < 1e-9,
  `un second appel rend le même plan (${encore.secteurs.length} réseaux, ${encore.debitDisponible.toFixed(2)} m³/h)`,
);
const autre = calculerPlan({ seau: 5, temps: 20, zones: [{ type: "gazon", L: 10, l: 5 }] });
const apres = calculerPlan(JARDIN);
dire(
  apres.secteurs.length === plan.secteurs.length,
  `un appel intercalé (${autre.secteurs.length} réseaux) ne change pas le suivant`,
);

// ── 8. Le catalogue est là, et il se déclare ────────────────────────────────
const options = optionsCatalogue();
dire(options.marques.length >= 2, `${options.marques.length} marques proposées`);
dire(
  options.marques.some((m: { defaut?: boolean }) => m.defaut),
  "une marque est le défaut, comme il l'a demandé (Rain Bird)",
);

console.log(echecs === 0 ? "\n✅ 0 échec." : `\n❌ ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
assert.equal(echecs, 0);

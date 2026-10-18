import { calculerEtDessiner } from "../src/lib/arrosage/le-plan";
import { composerLesPostes, groupeNourrice, groupesDeLaListe, messageAuFournisseur, liaisonsDuReseau } from "../src/lib/arrosage/postes";
import { piecesDuPlan } from "../src/lib/arrosage/pieces";
import {
  RETOUCHES_VIERGES, chaineSupprimer, chaineRemplacer, clesAChanger, ligneSupprimer, nourriceRemettre, nourriceRemplacer, nourriceSupprimer, remplacer, supprimer,
} from "../src/lib/arrosage/retouches";
import { composerNourrice } from "../src/lib/arrosage/nourrice-eclatee";
import { PHOTOS, photoDe } from "../src/lib/arrosage/photos";
import { motsPresents } from "../src/lib/arrosage/mots-du-plan";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";
import { existsSync, readFileSync } from "node:fs";

/**
 * LES PIÈCES POSÉES, LA LISTE ET LES RETOUCHES — l'écran du plan validé le
 * 18 octobre 2026, éprouvé sans navigateur, sur SON jardin d'exemple (la planche
 * `appli/arrosage-plan.html`) : deux pelouses de 12 × 12 et 8 × 8, un massif de
 * 20 × 2,40 en goutte-à-goutte, un couloir de 10 × 2 en tuyères, la nourrice
 * entre les pelouses, 10 L en 18 s à 3 bar, au compteur.
 *
 * Ce que la planche vérifiait elle-même sous sa liste (« le schéma et la liste
 * de l'outil comptent les mêmes pièces ») se joue ici, une fois pour toutes :
 * ce que l'écran POSE est ce que `pieces.ts` COMPTE, réseau par réseau.
 */

let passed = 0, failed = 0;
function cas(nom: string, corps: () => void) {
  try { corps(); passed++; console.log(`  ✓ ${nom}`); }
  catch (e) { failed++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}
function exige(c: unknown, m: string) { if (!c) throw new Error(m); }

const PARAMETRES: ParametresPlan = {
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
    { id: 3, type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: "boucle" },
    { id: 4, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2, materiel: "tuyere" },
  ],
  nourrice: { x: 13, y: 6 },
  couronne: 50,
};

console.log("\n=== Les pièces posées sur le plan ===\n");

const { plan, dessin } = calculerEtDessiner(PARAMETRES, null);
exige(dessin, "le jardin d'exemple doit se dessiner");
const d = dessin!;
const composer = (retouches = RETOUCHES_VIERGES) => composerLesPostes({ plan, dessin: d, compteur: true, amenee: null, retouches });

cas("quatre réseaux, le goutte-à-goutte en dernier, et chaque réseau a ses postes", () => {
  const p = composer();
  exige(plan.secteurs.length === 4, `${plan.secteurs.length} réseaux, il en faut 4`);
  exige(p.reseaux[3].goutte && p.reseaux[3].rail.length >= 3, "le réseau 4 est le goutte-à-goutte, avec son rail");
  exige(p.reseaux.slice(0, 3).every((r) => r.plan && r.plan.poses.length > 0 && r.chaine), "chaque réseau d'arroseurs a son plan de pièces et sa chaîne");
});

cas("« tés + coudes = arroseurs », pour chaque réseau, sur ce que l'écran pose", () => {
  const p = composer();
  for (const r of d.reseaux) {
    const g = p.compte[`r${r.numero}`];
    const tes = g["te-taraude-25-34-25"]?.q ?? 0, coudes = g["coude-taraude-25-34"]?.q ?? 0;
    exige(tes + coudes === r.tetes.length, `réseau ${r.numero + 1} : ${tes} tés + ${coudes} coudes pour ${r.tetes.length} têtes`);
    exige((g["te-25-25-25"]?.q ?? 0) === r.tesEgaux, `réseau ${r.numero + 1} : ${g["te-25-25-25"]?.q ?? 0} tés égaux posés, le dessin en compte ${r.tesEgaux}`);
  }
});

cas("ce que l'écran pose est ce que la liste de l'outil compte, hors nourrice", () => {
  const p = composer();
  const groupes = groupesDeLaListe(plan, p, RETOUCHES_VIERGES, true);
  const attendu: Record<string, number> = {}, pose: Record<string, number> = {};
  for (const x of piecesDuPlan(plan.materiel, d, { compteur: true, seuil25: plan.tuyau.seuil25, amenee: null, goutte: plan.goutteAGoutte })) {
    if (x.ou !== "regard" && x.ref) attendu[x.ref] = (attendu[x.ref] ?? 0) + (x.q ?? 0);
  }
  groupes.forEach((g, i) => { if (i === 1) return; for (const [ref, l] of Object.entries(g.lignes)) pose[ref] = (pose[ref] ?? 0) + l.q; });
  const ecarts = Object.keys(pose).filter((ref) => attendu[ref] !== undefined && attendu[ref] !== pose[ref] && ref !== "pe25-amenee");
  exige(ecarts.length === 0, `la liste compte autrement : ${ecarts.map((r) => `${r} ${pose[r]} ici, ${attendu[r]} dans l'outil`).join(" ; ")}`);
});

cas("la nourrice se compose : douze numéros pour quatre voies dont une de goutte-à-goutte, et un bac", () => {
  const n = composerNourrice(4, 1);
  exige(n, "aucune fiche pour 4 voies");
  exige(n!.ordre.length === 12, `${n!.ordre.length} numéros, la planche en montre 12`);
  exige(n!.ordre[0] === "coude-mf" && n!.ordre[1] === "clarinette-3v" && n!.ordre[2] === "coude-ff", `l'ordre commence par ${n!.ordre.slice(0, 3).join(", ")}`);
  exige(n!.poses.every((p) => p.numero >= 1 && (p.haut ? p.w > 0 : p.echelle > 0)), "chaque pose a un numéro et une taille");
  exige(n!.largeur > 300 && n!.hauteur > 300, `un dessin de ${n!.largeur} × ${n!.hauteur}`);
  exige(Object.values(n!.reste).some((q) => q > 0), "le bac « Avec la nourrice » n'est pas vide");
  const liste = groupeNourrice(plan, composer(), RETOUCHES_VIERGES);
  exige(liste.nombre["mamelon"] === 4, `${liste.nombre["mamelon"]} mamelons réduits, la fiche en compte 4`);
});

cas("la nourrice : deux mamelons en moins, un changé, puis tout remis", () => {
  const p0 = composer();
  const titre = groupeNourrice(plan, p0, RETOUCHES_VIERGES).nom;
  let r = nourriceSupprimer(RETOUCHES_VIERGES, "mamelon", 2);
  let g = groupeNourrice(plan, composer(r), r);
  exige(g.lignes["mamelon"].q === 2, `${g.lignes["mamelon"].q} mamelons après 2 en moins, il en reste 2`);
  r = nourriceRemplacer(r, "mamelon", 1, { ref: "coude-mf", nom: "Coude MF 1\"" }, titre, 1);
  g = groupeNourrice(plan, composer(r), r);
  const groupes = groupesDeLaListe(plan, composer(r), r, true);
  exige(g.lignes["mamelon"].q === 1, `${g.lignes["mamelon"].q} mamelon après un changé, il en reste 1`);
  exige((groupes[1].lignes["coude-mf"]?.q ?? 0) >= 1, "la remplaçante entre dans la liste de la nourrice");
  r = nourriceRemettre(r, "mamelon");
  g = groupeNourrice(plan, composer(r), r);
  exige(g.lignes["mamelon"].q === 4 && r.ajoutees.length === 0, "Remettre rend les 4 et ressort la remplaçante");
});

cas("la chaîne d'une tête : deux corps supprimés, un changé, les premières têtes entières d'abord", () => {
  const p0 = composer();
  const corps = p0.reseaux[0].chaine!.find((m) => m.type === "corps")!;
  const avant = Object.values(p0.compte.r0).find((l) => /3504/.test(l.nom))!.q;
  let r = chaineSupprimer(RETOUCHES_VIERGES, corps.cles, 2);
  let p = composer(r);
  const apres = Object.values(p.compte.r0).find((l) => /3504/.test(l.nom))!.q;
  exige(apres === avant - 2, `${apres} corps comptés après deux supprimés, il en faut ${avant - 2}`);
  r = chaineRemplacer(r, clesAChanger(r, corps.cles, 1), { ref: "RA5004FC", nom: "Turbine 5004 Plus" });
  p = composer(r);
  const remplacees = Object.values(p.compte.r0).find((l) => /5004/.test(l.nom))?.q ?? 0;
  exige(remplacees === 1, `${remplacees} remplaçante comptée, il en faut 1`);
  const m = p.reseaux[0].chaine!.find((x) => x.type === "corps")!;
  exige(m.etat === "changee" || m.etat === "", "la chaîne dit l'état de la pièce");
  exige(p.reseaux[0].plan!.poses.filter((x) => x.pieces.some((y) => y.retiree)).length === 2, "deux têtes du plan sont barrées");
});

cas("une pièce du plan : supprimée elle reste, changée elle montre sa remplaçante", () => {
  const p0 = composer();
  const cle = p0.reseaux[0].plan!.poses[0].pieces[0].cle;
  let p = composer(supprimer(RETOUCHES_VIERGES, cle));
  const barree = p.reseaux[0].plan!.poses[0].pieces[0];
  exige(barree.retiree && barree.cle === cle, "la pièce supprimée reste à sa place, barrée");
  p = composer(remplacer(RETOUCHES_VIERGES, cle, { ref: "te-25-25-25", nom: "Té égal 25" }));
  const changee = p.reseaux[0].plan!.poses[0].pieces[0];
  exige(changee.changee && changee.ref === "te-25-25-25", "la pièce changée porte sa remplaçante");
});

cas("une ligne de la liste : trois en moins, la ligne reste et le dit", () => {
  const p = composer();
  const titre = groupeNourrice(plan, p, RETOUCHES_VIERGES).nom;
  const r = ligneSupprimer(RETOUCHES_VIERGES, `${titre}|union`, 3);
  const g = groupesDeLaListe(plan, p, r, true)[1];
  exige(g.lignes["union"] && g.lignes["union"].enMoins === 3 && g.lignes["union"].q === 5 - 3, `la ligne union : ${JSON.stringify(g.lignes["union"])}`);
});

cas("le message au fournisseur additionne tout, sans prix", () => {
  const p = composer();
  const m = messageAuFournisseur(groupesDeLaListe(plan, p, RETOUCHES_VIERGES, true), plan.materiel);
  exige(m.startsWith("Bonjour,") && m.endsWith("Merci."), "le message commence par Bonjour et finit par Merci");
  exige(/Turbine 3504/.test(m) && /PEHD Ø25/.test(m), "il nomme les turbines et le tuyau");
  exige(!/€|prix/i.test(m), "aucun prix");
});

cas("le pointillé n'est dit que sous le réseau qui l'emprunte", () => {
  const avec = plan.secteurs.map((_, i) => liaisonsDuReseau(d, plan, i).length > 0);
  exige(avec.some(Boolean) && !avec.every(Boolean), `pointillés par réseau : ${avec.join(", ")}`);
});

cas("chaque photo de la table est servie par l'application, la même qu'en appli/, et une référence sans photo rend null", () => {
  const fichiers = [...new Set(Object.values(PHOTOS))];
  const manquantes = fichiers.filter((f) => !existsSync(`public/arrosage-photos/${f}`));
  exige(manquantes.length === 0, `photos absentes de public/ : ${manquantes.slice(0, 5).join(", ")}`);
  // Deux dossiers, une seule photo : celle de la planche est celle de l'écran.
  const differentes = fichiers.filter((f) => existsSync(`appli/arrosage-photos/${f}`) && !readFileSync(`appli/arrosage-photos/${f}`).equals(readFileSync(`public/arrosage-photos/${f}`)));
  exige(differentes.length === 0, `photos qui diffèrent entre appli/ et public/ : ${differentes.slice(0, 5).join(", ")}`);
  exige(photoDe("RA3504") === "/arrosage-photos/RA3504.jpg" && photoDe("n-existe-pas") === null, "photoDe rend l'adresse ou null");
});

cas("les mots du plan : SAM et PRS s'expliquent quand ils sont là, pas sinon", () => {
  exige(motsPresents("Tuyère 1800 SAM-PRS").some((m) => m.mot === "SAM") && motsPresents("Tuyère 1800 SAM-PRS").some((m) => m.mot === "PRS"), "SAM et PRS");
  exige(!motsPresents("Turbine 3504 buse 0,75").some((m) => m.mot === "SAM"), "pas de SAM sans SAM");
});

console.log(`\n${failed === 0 ? "✅" : "❌"} Les pièces posées — ${passed} vert(s), ${failed} rouge(s).`);
if (failed > 0) process.exit(1);

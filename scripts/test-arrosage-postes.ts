import { calculerEtDessiner } from "../src/lib/arrosage/le-plan";
import { composerLesPostes, groupeNourrice, groupesDeLaListe, lienDuMail, listeAuFournisseur, messageAuFournisseur, liaisonsDuReseau } from "../src/lib/arrosage/postes";
import { piecesDuPlan } from "../src/lib/arrosage/pieces";
import {
  RETOUCHES_VIERGES, blocSupprimer, chaineSupprimer, chaineRemplacer, clesAChanger, ligneSupprimer, nourriceRemettre, nourriceRemplacer, nourriceSupprimer, remplacer, supprimer,
} from "../src/lib/arrosage/retouches";
import { composerNourrice, etatsDesPoses } from "../src/lib/arrosage/nourrice-eclatee";
import { PHOTOS, photoDe } from "../src/lib/arrosage/photos";
import { motsPresents } from "../src/lib/arrosage/mots-du-plan";
import { euros, prixDeLigne, totalDeLaListe } from "../src/lib/arrosage/prix-de-la-liste";
import { ROBINET, departDeLOutil, departRetenu, departsPossibles, libelleDepart, phraseDuManque, voiesManquantes, type Depart, type Montage } from "../src/lib/arrosage/robinet";
import { CATALOGUE } from "../src/lib/arrosage/catalogue.js";
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

cas("« Sur ce plan » nomme aussi les SBE, pour chaque réseau : 7 têtes au couloir, 7 SBE 3/4\" et 7 SBE 1/2\"", () => {
  const p = composer();
  for (const x of p.reseaux.filter((x) => x.plan)) exige(x.compteDuPlan?.includes('x SBE 3/4"'), `réseau ${x.i + 1} : « ${x.compteDuPlan} » ne nomme pas les SBE`);
  const couloir = p.reseaux.find((x) => x.nom === "Couloir");
  exige(couloir?.compteDuPlan?.includes('7x SBE 3/4"') && couloir.compteDuPlan.includes('7x SBE 1/2"'), `le couloir : « ${couloir?.compteDuPlan} »`);
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

cas("sur le dessin de la nourrice, deux unions en moins se grisent, une changée se dore, dans l'ordre du dessin", () => {
  const n = composerNourrice(4, 1)!;
  const unions = n.poses.map((p, i) => [p.ref, i] as const).filter(([ref]) => ref === "union").map(([, i]) => i);
  exige(unions.length === 5, `${unions.length} unions dessinées pour 4 voies, il en faut 5`);
  const deuxEnMoins = nourriceSupprimer(RETOUCHES_VIERGES, "union", 2);
  const e1 = etatsDesPoses(n.poses, deuxEnMoins);
  exige(e1[unions[0]] === "retiree" && e1[unions[1]] === "retiree" && e1[unions[2]] === "" && e1.filter((x) => x === "retiree").length === 2, `deux en moins : ${unions.map((i) => e1[i] || "·").join(",")}`);
  const uneChangee = nourriceRemplacer(deuxEnMoins, "union", 1, { ref: "union-ff", nom: "Union FF" }, "Nourrice 4 voies", 7);
  const e2 = etatsDesPoses(n.poses, uneChangee);
  exige(e2[unions[0]] === "retiree" && e2[unions[1]] === "retiree" && e2[unions[2]] === "changee" && e2[unions[3]] === "", `deux en moins puis une changée : ${unions.map((i) => e2[i] || "·").join(",")}`);
  exige(etatsDesPoses(n.poses, nourriceRemettre(uneChangee, "union")).every((x) => x === ""), "tout remis : plus rien de grisé");
  exige(etatsDesPoses(n.poses, supprimer(RETOUCHES_VIERGES, "nr:union")).filter((x) => x === "retiree").length === 5, "le numéro entier supprimé : les cinq se grisent");
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

cas("SON début et SA fin entourent la liste, qui reste celle de l'outil", () => {
  const g = groupesDeLaListe(plan, composer(), RETOUCHES_VIERGES, true);
  const liste = listeAuFournisseur(g, plan.materiel);
  const m = messageAuFournisseur(g, plan.materiel, "Bonjour Julien,", "Merci, Florian");
  exige(m === `Bonjour Julien,\n\n${liste}\n\nMerci, Florian`, `le message : ${m.slice(0, 120)}`);
  exige(!/Bonjour|Merci/.test(liste) && /Turbine 3504/.test(liste), "la liste ne porte que les pièces");
});

cas("le mail s'ouvre avec son adresse, l'objet et tout le message", () => {
  const l = lienDuMail(" commande@aquaplus.fr ", "Bonjour Julien,\n\n3x Té & coude");
  exige(l === "mailto:commande@aquaplus.fr?subject=Commande%20arrosage&body=Bonjour%20Julien%2C%0A%0A3x%20T%C3%A9%20%26%20coude", l);
  exige(lienDuMail(null, "x").startsWith("mailto:?subject="), "sans adresse, sans destinataire");
});

cas("le pointillé n'est dit que sous le réseau qui l'emprunte", () => {
  const avec = plan.secteurs.map((_, i) => liaisonsDuReseau(d, plan, i).length > 0);
  exige(avec.some(Boolean) && !avec.every(Boolean), `pointillés par réseau : ${avec.join(", ")}`);
});

cas("chaque photo de la table est servie par l'application, la même qu'en appli/, et une référence sans photo rend null", () => {
  // Un fichier qui porte son dossier (les photos du robinet) se lit à la racine de public/ et d'appli/.
  const chemin = (f: string) => (f.includes("/") ? f : `arrosage-photos/${f}`);
  const fichiers = [...new Set(Object.values(PHOTOS))];
  const manquantes = fichiers.filter((f) => !existsSync(`public/${chemin(f)}`));
  exige(manquantes.length === 0, `photos absentes de public/ : ${manquantes.slice(0, 5).join(", ")}`);
  // Deux dossiers, une seule photo : celle de la planche est celle de l'écran.
  const differentes = fichiers.filter((f) => existsSync(`appli/${chemin(f)}`) && !readFileSync(`appli/${chemin(f)}`).equals(readFileSync(`public/${chemin(f)}`)));
  exige(differentes.length === 0, `photos qui diffèrent entre appli/ et public/ : ${differentes.slice(0, 5).join(", ")}`);
  exige(photoDe("RA3504") === "/arrosage-photos/RA3504.jpg" && photoDe("n-existe-pas") === null, "photoDe rend l'adresse ou null");
});

// ═══ LE MONTAGE AU ROBINET — sa planche validée le 18 octobre 2026 au soir ═══

const AU_ROBINET = (montage: Montage, double = false, depart: Depart | null = null): ParametresPlan => ({
  ...PARAMETRES, compteur: "non", piquage: { x: 14, y: 6 }, robinet: { montage, double, depart },
});

cas("au nez de robinet, les réseaux partent du robinet ; avec la nourrice, du regard", () => {
  const nez = calculerEtDessiner(AU_ROBINET("nez"), null);
  exige(nez.dessin && nez.dessin.nourrice.x === 14 && nez.dessin.nourrice.y === 6, `au nez de robinet, le départ est ${JSON.stringify(nez.dessin?.nourrice)}, le robinet est en 14, 6`);
  const avec = calculerEtDessiner(AU_ROBINET("nourrice"), null);
  exige(avec.dessin && avec.dessin.nourrice.x === 13 && avec.dessin.nourrice.y === 6, "avec la nourrice, le départ est le regard, en 13, 6");
  // Sans robinet situé, le plan se calcule et n'est pas dessiné : rien n'est supposé.
  const sans = calculerEtDessiner({ ...AU_ROBINET("nez"), piquage: null }, null);
  exige(sans.dessin === null && sans.plan.reserves.some((x) => x.includes("ne situe pas le robinet")), "sans robinet situé, pas de dessin, et la réserve le dit");
  // Le calcul, lui, ne bouge pas d'un montage à l'autre.
  exige(nez.plan.secteurs.length === avec.plan.secteurs.length && nez.plan.pressionAuxArroseurs === avec.plan.pressionAuxArroseurs, "le calcul est le même dans les deux montages");
});

cas("la pile au nez de robinet : programmateur, raccord, tuyau ; pas de nourrice dans la liste ; il manque 3 voies", () => {
  const { plan: p, dessin: dd } = calculerEtDessiner(AU_ROBINET("nez"), null);
  const robinet = { montage: "nez" as const, double: false, depart: null };
  const postes = composerLesPostes({ plan: p, dessin: dd, compteur: false, amenee: null, robinet, retouches: RETOUCHES_VIERGES });
  exige(postes.amenee.map((x) => x.cle).join(",") === "am:prog,am:raccord,am:pe", `la pile : ${postes.amenee.map((x) => x.cle).join(",")}`);
  exige(postes.amenee[0].ref === "SP1151" && postes.amenee[1].ref === "OPL70302520", "le Solem BL-NR, puis le raccord femelle 25 x 3/4\" : il y a des arroseurs, donc du Ø25");
  exige(postes.amenee[2].detail === "PEHD Ø25, à mesurer" && postes.amenee[2].q === 0, `le tuyau jusqu'au réseau n'est pas compté : « ${postes.amenee[2].detail} »`);
  const groupes = groupesDeLaListe(p, postes, RETOUCHES_VIERGES, false, robinet);
  exige(groupes[0].titre === "Au robinet" && !groupes.some((g) => g.titre.startsWith("Nourrice")), `les groupes : ${groupes.map((g) => g.titre).join(" | ")}`);
  exige(groupes[0].lignes.SP1151?.q === 1 && groupes[0].lignes.OPL70302520?.q === 1, "le programmateur et le raccord se comptent une fois");
  exige(voiesManquantes(p, "nez") === 3 && phraseDuManque(p, "nez") === "Il manque 3 voies : il en a 1, ce jardin demande 4 réseaux.", `le manque : ${phraseDuManque(p, "nez")}`);
  exige(voiesManquantes(p, "nourrice") === 0, "avec la nourrice, aucune voie ne manque");
});

cas("avec la nourrice au robinet, la double sortie cochée et le Ø32 choisi : double, raccord 32, tuyau Ø32 jusqu'à la nourrice", () => {
  const { plan: p, dessin: dd } = calculerEtDessiner(AU_ROBINET("nourrice", true, 32), null);
  const robinet = { montage: "nourrice" as const, double: true, depart: 32 as const };
  const postes = composerLesPostes({ plan: p, dessin: dd, compteur: false, amenee: 7.4, robinet, retouches: RETOUCHES_VIERGES });
  exige(postes.amenee.map((x) => x.ref).join(",") === "BRO3493,OPL70303220,pe25-amenee", `la pile : ${postes.amenee.map((x) => x.ref).join(",")}`);
  exige(postes.amenee[2].detail === "PEHD Ø32, 8 m" && postes.amenee[2].q === 8, `l'amenée calculée sur le croquis, au mètre supérieur : « ${postes.amenee[2].detail} »`);
  const groupes = groupesDeLaListe(p, postes, RETOUCHES_VIERGES, false, robinet);
  exige(groupes[0].titre === "Du robinet à la nourrice" && groupes[1].titre === groupeNourrice(p, postes, RETOUCHES_VIERGES).nom, `les groupes : ${groupes.map((g) => g.titre).join(" | ")}`);
  // Le départ : l'outil choisit le Ø25 (des arroseurs, et le Ø25 tient) ; le Ø16 ne se propose pas.
  exige(departDeLOutil(p) === 25 && departsPossibles(p).join(",") === "25,32" && departRetenu(p, 16) === 25, "des arroseurs : Ø25 ou Ø32, jamais le Ø16, et un Ø16 choisi avant retombe sur l'outil");
  // Tout en goutte-à-goutte : le Ø16 rigide, et les quatre départs.
  const goutte = calculerEtDessiner({ ...AU_ROBINET("nourrice"), zones: [{ id: 3, type: "massif", nom: "Massif", x: 0, y: 0, L: 20, l: 2.4, sortieGoutte: "boucle" }], nourrice: { x: 0, y: 1 }, piquage: { x: 0, y: 1 } }, null).plan;
  exige(departDeLOutil(goutte) === 16 && departsPossibles(goutte).length === 4, `tout en goutte-à-goutte : ${libelleDepart(departDeLOutil(goutte))}, ${departsPossibles(goutte).length} départs`);
  const pile16 = composerLesPostes({ plan: goutte, dessin: null, compteur: false, amenee: null, robinet: { montage: "nez", double: false, depart: "16s" }, retouches: RETOUCHES_VIERGES });
  exige(pile16.amenee[1].ref === "MID6362" && pile16.amenee[2].nom.startsWith("Ø16 souple"), "le Ø16 souple part par l'embout Palaplast MID6362");
});

cas("les pièces du robinet portent les noms du catalogue, et leurs photos sont servies, les mêmes qu'en appli/", () => {
  const cat = CATALOGUE as unknown as { pieceAjoutable(ref: string): { nom: string } | null; raccords16Rigide: { ref: string; nom: string }[] };
  for (const p of [ROBINET.programmateur, ROBINET.raccord[25], ROBINET.raccord[32], ROBINET.raccord["16s"]]) {
    exige(cat.pieceAjoutable(p.ref)?.nom === p.nom, `${p.ref} : « ${p.nom} » n'est pas le nom du catalogue`);
  }
  exige(cat.raccords16Rigide.find((x) => x.ref === ROBINET.raccord[16].ref)?.nom === ROBINET.raccord[16].nom, "le raccord du Ø16 rigide est celui de sa gamme Plasson");
  for (const p of [ROBINET.double, ROBINET.programmateur, ...Object.values(ROBINET.raccord)]) {
    exige(existsSync(`public/arrosage-robinet-photos/${p.photo}`), `photo absente de public/ : ${p.photo}`);
    exige(readFileSync(`public/arrosage-robinet-photos/${p.photo}`).equals(readFileSync(`appli/arrosage-robinet-photos/${p.photo}`)), `photo qui diffère entre appli/ et public/ : ${p.photo}`);
  }
  exige(photoDe("BRO3493") === "/arrosage-robinet-photos/BRO3493.jpg", "la double sortie a sa photo, servie depuis son dossier");
});

// ═══ SES DEMANDES DU 19 OCTOBRE 2026 : barrer, supprimer un bloc, une voie de moins, les prix ═══

cas("une pièce supprimée sur le plan reste dans la liste, barrée, et sort du message", () => {
  const r = supprimer(RETOUCHES_VIERGES, "r0:t0:corps");
  const p = composer(r);
  const g = groupesDeLaListe(plan, p, r, true);
  const r1 = g.find((x) => x.bloc === "0")!;
  exige(Object.values(r1.barrees).some((l) => l.q === 1 && /3504/.test(l.nom)), `réseau 1 barré : ${JSON.stringify(r1.barrees)}`);
  const avant = groupesDeLaListe(plan, composer(), RETOUCHES_VIERGES, true).find((x) => x.bloc === "0")!;
  const turbines = (gr: typeof r1) => Object.values(gr.lignes).find((l) => /3504/.test(l.nom))?.q ?? 0;
  exige(turbines(r1) === turbines(avant) - 1, `turbines comptées : ${turbines(r1)} au lieu de ${turbines(avant) - 1}`);
});

cas("un réseau supprimé : ses pièces barrées, la liste vide, la nourrice passe de 4 à 3 voies avec le collecteur du dessous", () => {
  const r = blocSupprimer(RETOUCHES_VIERGES, "1");
  const p = composer(r);
  const g = groupesDeLaListe(plan, p, r, true);
  const r2 = g.find((x) => x.bloc === "1")!;
  exige(Object.keys(r2.lignes).length === 0 && Object.keys(r2.barrees).length > 3, `réseau 2 : ${Object.keys(r2.lignes).length} lignes vivantes, ${Object.keys(r2.barrees).length} barrées`);
  exige(p.reseaux[1].plan!.poses.every((x) => x.pieces.every((q) => q.retiree)), "sur le plan, ses pièces sont grisées");
  const n4 = groupeNourrice(plan, composer(), RETOUCHES_VIERGES), n3 = groupeNourrice(plan, p, r);
  exige(/4 voies/.test(n4.nom) && /3 voies/.test(n3.nom), `nourrice : ${n4.nom} puis ${n3.nom}`);
  exige(n3.voies.join(",") === "0,2,3", `les voies gardent leur réseau : ${n3.voies.join(",")}`);
  const ev = (n: typeof n4) => Object.values(n.lignes).filter((l) => /Électrovanne/.test(l.nom)).reduce((s, l) => s + l.q, 0);
  exige(ev(n3) === ev(n4) - 1, `électrovannes : ${ev(n4)} puis ${ev(n3)}`);
  exige(composerNourrice(n3.voies.length, 1)!.etiquettes.filter((e) => "reseau" in e).length === 3, "trois voies dessinées");
});

cas("le piquage et la nourrice se suppriment d'un bloc, et tout sort du message", () => {
  const r = blocSupprimer(blocSupprimer(RETOUCHES_VIERGES, "amenee"), "nourrice");
  const p = composer(r);
  const g = groupesDeLaListe(plan, p, r, true);
  const am = g.find((x) => x.bloc === "amenee")!, nr = g.find((x) => x.bloc === "nourrice")!;
  exige(Object.keys(am.lignes).length === 0 && Object.keys(am.barrees).length > 0, "le piquage est barré");
  exige(Object.keys(nr.lignes).length === 0 && Object.keys(nr.barrees).length > 10, `la nourrice est barrée : ${Object.keys(nr.barrees).length} lignes`);
  const msg = messageAuFournisseur(g, plan.materiel);
  // Ni la nourrice (collecteur, électrovannes), ni le té qui coupe la ligne au compteur (le té égal des réseaux, lui, reste).
  const teEgaux = (gr: typeof g) => gr.filter((x) => x.bloc !== "amenee").reduce((s, x) => s + (x.lignes["te-25-25-25"]?.q ?? 0), 0);
  exige(!/Collecteur|Électrovanne/.test(msg), `le message garde la nourrice : ${msg.slice(0, 200)}`);
  exige((msg.match(/(\d+)x Plasson Té 90° 25×25×25/)?.[1] ?? "0") === String(teEgaux(g)), "le té du compteur sort du message");
  const n = composerNourrice(4, 1)!;
  exige(etatsDesPoses(n.poses, r).every((x) => x === "retiree"), "sur le dessin, chaque pièce de la nourrice est grisée");
});

cas("le prix à droite et le total : sans prix relevé, 0 € et le compte des pièces sans prix ; avec, la somme exacte", () => {
  const g = groupesDeLaListe(plan, composer(), RETOUCHES_VIERGES, true);
  const vide = totalDeLaListe(g, {});
  exige(vide.total === 0 && vide.sansPrix === vide.pieces && vide.pieces > 30, `sans prix : ${JSON.stringify(vide)}`);
  const turbines = g.flatMap((x) => Object.entries(x.lignes)).filter(([, l]) => /3504/.test(l.nom)).reduce((s, [, l]) => s + l.q, 0);
  const ref3504 = g.flatMap((x) => Object.entries(x.lignes)).find(([, l]) => /3504/.test(l.nom))![0];
  const t = totalDeLaListe(g, { [ref3504]: 12.5 });
  exige(t.total === Math.round(turbines * 12.5 * 100) / 100 && t.sansPrix === vide.pieces - g.filter((x) => x.lignes[ref3504]).length, `avec un prix : ${JSON.stringify(t)}, ${turbines} turbines`);
  exige(euros(1234.5) === "1 234,50 €" || euros(1234.5) === "1 234,50 €", `euros : ${euros(1234.5)}`);
  exige(prixDeLigne("pe25", { nom: "PEHD", q: 0, u: "ml" }, { pe25: 1 }) === null, "une longueur à mesurer n'a pas de prix");
});

cas("les mots du plan : SAM et PRS s'expliquent quand ils sont là, pas sinon", () => {
  exige(motsPresents("Tuyère 1800 SAM-PRS").some((m) => m.mot === "SAM") && motsPresents("Tuyère 1800 SAM-PRS").some((m) => m.mot === "PRS"), "SAM et PRS");
  exige(!motsPresents("Turbine 3504 buse 0,75").some((m) => m.mot === "SAM"), "pas de SAM sans SAM");
});

console.log(`\n${failed === 0 ? "✅" : "❌"} Les pièces posées — ${passed} vert(s), ${failed} rouge(s).`);
if (failed > 0) process.exit(1);

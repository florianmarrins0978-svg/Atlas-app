/**
 * LE PDF D'UN PLAN D'ARROSAGE ENREGISTRÉ (`src/server/pdf/plan-arrosage-pdf.ts`)
 * — ses demandes du 21 novembre 2026, sur la planche `appli/arrosage-dossiers.html`.
 *
 * Ce qu'il doit tenir, lu dans le PDF produit (son texte, ses pages) :
 *   1. une page de garde, UNE PAGE PAR RÉSEAU, puis la liste ;
 *   2. AUCUNE réserve, ni la phrase « Nous ne garantissons pas… », ni pied de page ;
 *   3. chaque pièce de la liste y est, avec sa quantité ;
 *   4. le dessin de l'écran passe ENTIER : aucun élément de `PlanDessine`
 *      laissé de côté par le traceur, sans quoi un trait manquerait en silence ;
 *   5. aucun caractère sans glyphe dans les polices embarquées : il
 *      s'imprimerait en case vide (le « ≤ » de la fiche de sécurité, 2026) ;
 *   6. le plan en couleur est GRAND (sa demande du 22 novembre 2026), et au
 *      milieu de la page rien ne se chevauche, même sur une page serrée ;
 *   7. LA NOURRICE A SA PAGE, juste après la page de garde (sa demande du
 *      22 novembre 2026 : « il manque la nourrice ») : son nom, la photo de
 *      son éclaté vu du dessus, ses pièces. Au nez de robinet, il n'y en a pas ;
 *   8. CHAQUE PAGE DIT À QUOI CORRESPOND CHAQUE LIGNE (sa demande du même
 *      soir) : la nourrice et chaque réseau portent la liste de leurs pièces,
 *      numérotée, et toute pièce montrée sur la page porte le numéro de sa ligne ;
 *      toute ligne numérotée a sa pièce montrée.
 *
 * `--images <dossier>` écrit aussi chaque page en PNG, pour la regarder.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { donneesDuPdf } from "../src/app/paysage/dossiers-arrosage/donnees-du-pdf";
import { figerLePlan, type SaisieDuPlan } from "../src/lib/arrosage/plan-enregistre";
import { RETOUCHES_VIERGES } from "../src/lib/arrosage/retouches";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";
import { composerLePdfDuPlan, disposerLeMilieu } from "../src/server/pdf/plan-arrosage-pdf";
import { FICHIER_DES_PLACES, photoDeLaNourrice } from "../src/lib/arrosage/nourrice-en-photo";
import { composerNourrice } from "../src/lib/arrosage/nourrice-eclatee";
import { voiesEnGoutte } from "../src/lib/arrosage/postes";
import { empreinteDeLaNourrice3D, FICHIER_D_EMPREINTE } from "./_nourrice-3d";
import { tracerSvg, type NoeudSvg } from "../src/server/pdf/svg-vers-pdf";
import { pourLePapier } from "../src/lib/texte-pdf";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

// Le jardin de la planche : deux pelouses, un massif, un couloir, au compteur.
const JARDIN = {
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
    { id: 3, type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4, sortieGoutte: "boucle" },
    { id: 4, type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2, materiel: "tuyere" },
  ],
  nourrice: { x: 13, y: 6 },
  couronne: 50,
} as unknown as ParametresPlan;

const RESERVE_DU_CROQUIS = "Amenée de 5,5 m, du piquage à la nourrice, calculée sur le croquis.";
const saisie: SaisieDuPlan = { parametres: JARDIN, retouches: RETOUCHES_VIERGES, reservesDuCroquis: [RESERVE_DU_CROQUIS], sansDessin: null, lecture: null };

async function texteDuPdf(octets: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const contenu = await (await doc.getPage(i)).getTextContent();
    pages.push(contenu.items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "));
  }
  return pages;
}

async function main() {
  console.log("=== Le PDF d'un plan d'arrosage enregistré ===\n");
  const fige = figerLePlan(saisie);
  const donnees = donneesDuPdf({ entreprise: "Atelier Démo", dossier: "Plan d’arrosage de Madame Intel", enregistreLe: new Date("2026-11-21T08:41:00Z"), saisie, fige });
  const octets = await composerLePdfDuPlan(donnees);
  const pages = await texteDuPdf(octets);
  const tout = pages.join("\n");

  await cas("une page de garde, une page par réseau, puis la liste", () => {
    assert.ok(fige.plan.secteurs.length >= 3, "le jardin d'essai a perdu ses réseaux : le contrôle ne mesure rien");
    assert.match(pages[0], /Plan d.arrosage/);
    // Les surtitres sont espacés : un lecteur de PDF y voit des espaces entre les lettres.
    const serre = (t: string) => t.replace(/\s/g, "");
    assert.ok(serre(pages[0]).includes("LIRELESPLANS"), "pas de légende en page 1");
    // Page 2 : la nourrice ; tout part d'elle (sa règle du 21 août).
    assert.ok(serre(pages[1]).includes("LANOURRICE"), "la page 2 n'est pas celle de la nourrice");
    fige.postes.reseaux.forEach((r, k) => assert.match(pages[2 + k], new RegExp(`Réseau ${r.i + 1}`), `page ${k + 3} : pas le réseau ${r.i + 1}`));
    assert.ok(serre(pages[2 + fige.postes.reseaux.length]).includes("LALISTEDESPIÈCES"), "la liste ne suit pas les réseaux");
  });

  await cas("aucune réserve, ni la phrase « Nous ne garantissons pas… », ni pied de page", () => {
    assert.ok(fige.reserves.length > 1, "le plan d'essai n'a pas de réserve : le contrôle ne mesure rien");
    for (const r of fige.reserves) assert.ok(!tout.includes(pourLePapier(r).texte.slice(0, 40)), `réserve imprimée : ${r.slice(0, 60)}`);
    assert.ok(!/garantissons/i.test(tout));
    assert.ok(!/Page \d+ sur \d+|Empreinte/i.test(tout));
  });

  await cas("chaque pièce de la liste y est, avec sa quantité", () => {
    const lignes = donnees.groupes.flatMap((g) => g.lignes);
    assert.ok(lignes.length > 10);
    for (const l of lignes) {
      const nom = pourLePapier(l.nom).texte;
      assert.ok(tout.includes(nom.split(" ").slice(0, 3).join(" ")), `absente : ${l.quantite} ${nom}`);
    }
  });

  await cas("le dessin de l'écran passe entier : le traceur ne laisse rien de côté", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const police = await doc.embedFont(readFileSync("src/server/pdf/polices/inter-400.ttf"));
    const page = doc.addPage();
    let tracees = 0;
    for (const r of donnees.reseaux) {
      assert.ok(r.plan, `${r.titre} : pas de dessin`);
      const t = tracerSvg(page, r.plan as NoeudSvg, { gauche: 0, haut: 800, largeur: 200, hauteur: 150 }, { texte: police, titres: police });
      assert.deepEqual(t.ignores, [], `${r.titre} : éléments ignorés ${t.ignores.join(", ")}`);
      tracees++;
    }
    for (const l of donnees.legende) assert.deepEqual(tracerSvg(page, l.symbole, { gauche: 0, haut: 10, largeur: 10, hauteur: 10 }, { texte: police, titres: police }).ignores, []);
    assert.equal(tracees, fige.postes.reseaux.length);
  });

  await cas("aucun caractère sans glyphe dans les polices du PDF", () => {
    const textes = [
      donnees.entreprise, donnees.dossier, donnees.date, donnees.resume, "Plan d’arrosage", "LIRE LES PLANS", "LES PIÈCES", "UNE TÊTE, DE BAS EN HAUT", "LA LISTE DES PIÈCES, SUITE", "LA NOURRICE",
      "SES PIÈCES", "AVEC LA NOURRICE",
      ...(donnees.nourrice ? [donnees.nourrice.titre, donnees.nourrice.phrase, ...[...donnees.nourrice.numerotees, ...donnees.nourrice.avec].flatMap((l) => [l.quantite ?? "", l.nom])] : []),
      ...donnees.legende.flatMap((l) => l.texte.map((s) => s.texte)),
      ...donnees.reseaux.flatMap((r) => [r.titre, ...r.zones, ...r.lignes.flatMap((l) => [l.quantite ?? "", l.texte]), r.tuyau.texte, ...(r.chaine ?? []).map((m) => m.libelle), ...r.rail.map((p) => p.detail || p.nom)]),
      ...donnees.groupes.flatMap((g) => [g.titre, ...g.lignes.flatMap((l) => [l.quantite, l.nom])]),
    ];
    for (const f of ["inter-400.ttf", "inter-700.ttf", "atlas-archive-serif-400.ttf"]) {
      const police = fontkit.create(readFileSync(path.join("src/server/pdf/polices", f)));
      const manque = new Set<string>();
      for (const t of textes) for (const c of pourLePapier(t).texte) if (c.trim() && !police.hasGlyphForCodePoint(c.codePointAt(0) as number)) manque.add(c);
      assert.deepEqual([...manque], [], `${f} n'a pas : ${[...manque].join(" ")}`);
    }
  });

  await cas("le plan en couleur est grand, et rien ne se chevauche au milieu de la page", () => {
    // Sa demande du 22 novembre 2026 : « agrandis le plan d'arrosage où il n'y a
    // pas la photo des pièces, et même sur celle où il n'y a pas vraiment la
    // place ». Avant, il logeait dans 200 points de large, en haut à droite.
    const AVANT = 200, UTILE = 595.28 - 2 * 42, GAUCHE = 42, DROITE = 42 + UTILE;
    // Le milieu d'une page de réseau de ce jardin : sous l'en-tête, au-dessus
    // d'une tête à deux lignes de libellés. Puis une page bien plus serrée.
    const HAUT = 680, BAS_REEL = 137, BAS_SERRE = 330;
    const proportion = (n: NoeudSvg) => {
      const [, , w, h] = String(n.props.viewBox).split(/[\s,]+/).map(Number);
      return h / w;
    };
    let pleineLargeur = 0;
    for (const r of donnees.reseaux) {
      assert.ok(r.plan, `${r.titre} : pas de dessin, le contrôle ne mesure rien`);
      for (const bas of [BAS_REEL, BAS_SERRE]) {
        const m = disposerLeMilieu({ proportionDuPlan: proportion(r.plan as NoeudSvg), pieces: r.pieces, rail: r.rail.length + r.ajoutees.length, haut: HAUT, bas });
        const ici = `${r.titre}, bas à ${bas}`;
        assert.ok(m.plan && m.plan.largeur > 0 && m.plan.hauteur > 0, `${ici} : plan sans taille`);
        assert.ok(m.plan.haut <= HAUT && m.plan.gauche >= GAUCHE - 0.5 && m.plan.gauche + m.plan.largeur <= DROITE + 0.5, `${ici} : le plan sort de la page`);
        assert.ok(m.plan.haut - m.plan.hauteur - m.rubrique >= 10, `${ici} : « Les pièces » touche le plan`);
        // Chaque vignette se replace ICI, comme la page la pose : relire `occupe`
        // ferait vérifier la fonction par elle-même, et une vignette oubliée
        // dans son compte passerait au vert.
        const boites: { x0: number; x1: number; y0: number; y1: number }[] = [];
        if (r.pieces && m.pieces) {
          const { gauche: ox, haut: oy, largeur: w, hauteur: h, taille: t } = m.pieces;
          for (const pose of r.pieces.poses) {
            const cx = ox + (pose.gauche / 100) * w, cy = oy - (pose.haut / 100) * h;
            if (pose.egal) boites.push({ x0: cx - t / 2, x1: cx + t / 2, y0: cy - t / 2, y1: cy + t / 2 });
            if (pose.pieces.length) {
              const rangee = pose.pieces.length * t + (pose.pieces.length - 1) * 2;
              const yh = cy + t / 2 - (pose.egal ? t * 1.12 : 0);
              boites.push({ x0: cx - rangee / 2, x1: cx + rangee / 2, y0: yh - t, y1: yh });
            }
          }
        } else if (m.rail) {
          boites.push({ x0: m.rail.gauche, x1: m.rail.gauche + m.rail.largeur, y0: m.rail.haut - m.rail.hauteur, y1: m.rail.haut });
        }
        assert.ok(boites.length, `${ici} : ni pièces ni rail, le contrôle ne mesure rien`);
        for (const b of boites) {
          assert.ok(m.rubrique - b.y1 >= 8, `${ici} : une vignette touche le surtitre « Les pièces »`);
          assert.ok(b.y0 >= bas - 0.5, `${ici} : une vignette descend sur la tête du bas`);
          assert.ok(b.x0 >= GAUCHE - 0.5 && b.x1 <= DROITE + 0.5, `${ici} : une vignette sort de la page`);
        }
        if (bas === BAS_REEL) {
          assert.ok(m.plan.largeur >= 1.5 * AVANT, `${ici} : plan de ${Math.round(m.plan.largeur)} points, pas agrandi`);
          if (m.plan.largeur >= UTILE - 0.5) pleineLargeur++;
        }
      }
    }
    // Le couloir et le goutte-à-goutte laissent la place : le plan la prend.
    assert.ok(pleineLargeur >= 2, `${pleineLargeur} page(s) seulement où le plan prend toute la largeur`);
  });

  await cas("la nourrice a sa page : son nom, l'éclaté vu du dessus, chacune de ses pièces", async () => {
    const lignes = Object.values(fige.nourrice.lignes);
    assert.ok(lignes.length > 5, "le jardin d'essai n'a pas de nourrice : le contrôle ne mesure rien");
    assert.ok(pages[1].includes(pourLePapier(fige.nourrice.nom).texte), `la page ne dit pas « ${fige.nourrice.nom} »`);
    for (const l of lignes) {
      const nom = pourLePapier(l.nom).texte.split(" ").slice(0, 3).join(" ");
      assert.ok(pages[1].includes(nom), `pièce absente de la page de la nourrice : ${l.nom}`);
    }
    // La photo est posée sur la page, et c'est celle de CETTE nourrice.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(octets), useSystemFonts: false }).promise;
    const ops = await (await doc.getPage(2)).getOperatorList();
    assert.ok(ops.fnArray.includes(pdfjs.OPS.paintImageXObject), "aucune image sur la page de la nourrice");
    assert.ok(donnees.nourrice?.photo === photoDeLaNourrice(fige.nourrice.voies.length, voiesEnGoutte(fige.plan, fige.nourrice.voies)), "la photo n'est pas celle de ses voies");
  });

  await cas("au nez de robinet, pas de nourrice, donc pas de page", async () => {
    const nez: SaisieDuPlan = { ...saisie, parametres: { ...JARDIN, compteur: "non", robinet: { montage: "nez", double: false, depart: null } } as ParametresPlan };
    const fNez = figerLePlan(nez);
    const dNez = donneesDuPdf({ entreprise: "Atelier Démo", dossier: "Au robinet", enregistreLe: new Date("2026-11-21T08:41:00Z"), saisie: nez, fige: fNez });
    assert.equal(dNez.nourrice, null);
    const p = await texteDuPdf(await composerLePdfDuPlan(dNez));
    assert.ok(!p.some((t) => t.replace(/\s/g, "").includes("LANOURRICE")), "une page de nourrice au nez de robinet");
  });

  await cas("une photo de l'éclaté pour chaque nourrice possible, à jour des pièces de la 3D", async () => {
    for (let voies = 1; voies <= 6; voies++) {
      for (let goutte = 0; goutte <= voies; goutte++) assert.ok(existsSync(path.join("public", photoDeLaNourrice(voies, goutte))), `pas de photo pour ${voies} voies dont ${goutte} en goutte-à-goutte`);
    }
    const gardee = JSON.parse(readFileSync(FICHIER_D_EMPREINTE, "utf8")).empreinte;
    assert.equal(gardee, await empreinteDeLaNourrice3D(), "les pièces de la 3D ont changé depuis les photos : rejouer npx tsx scripts/rendre-nourrice-eclatee.mts");
  });

  await cas("la nourrice : chaque pièce de la photo a son numéro, dans l'ordre de la légende de l'écran", () => {
    const n = donnees.nourrice;
    assert.ok(n, "pas de nourrice : le contrôle ne mesure rien");
    const toutes = JSON.parse(readFileSync(path.join("public", FICHIER_DES_PLACES), "utf8")) as Record<string, { ref: string }[]>;
    const places = toutes[n.places];
    assert.ok(places?.length > 10, `pas de places relevées pour ${n.places}`);
    const numerotees = new Set(n.numerotees.map((l) => l.ref));
    for (const q of places) if (q.ref !== "pehd") assert.ok(numerotees.has(q.ref), `la photo montre ${q.ref} sans numéro`);
    for (const l of n.numerotees) assert.ok(places.some((q) => q.ref === l.ref), `le numéro ${l.numero} (${l.nom}) n'est sur aucune pièce de la photo`);
    const ordre = composerNourrice(fige.nourrice.voies.length, voiesEnGoutte(fige.plan, fige.nourrice.voies))?.ordre.filter((r) => r !== "pehd") ?? [];
    assert.deepEqual(n.numerotees.map((l) => l.ref), ordre, "les numéros ne suivent pas l'ordre de la légende de l'écran");
    assert.ok(n.avec.some((l) => /Regard/i.test(l.nom)), "le regard n'est pas avec la nourrice");
    // Toutes les nourrices possibles ont leurs places, et rien que des pièces de leur fiche.
    for (let v = 1; v <= 6; v++) {
      for (let g = 0; g <= v; g++) {
        const ici = toutes[`${v}-${g}`];
        assert.ok(ici?.length, `pas de places pour ${v} voies dont ${g} en goutte-à-goutte`);
        const sa = new Set(composerNourrice(v, g)?.ordre ?? []);
        for (const q of ici) assert.ok(sa.has(q.ref), `${v}-${g} : ${q.ref} n'est pas dans la nourrice`);
      }
    }
  });

  await cas("chaque réseau : sa liste numérotée est son groupe de la liste, et chaque photo porte son numéro", () => {
    for (const r of donnees.reseaux) {
      const groupe = fige.groupes.find((g) => g.titre.startsWith(`${r.titre},`));
      assert.ok(groupe && r.liste.length > 0, `${r.titre} : pas de liste`);
      assert.deepEqual(r.liste.map((l) => l.nom), Object.values(groupe.lignes).map((l) => l.nom), `${r.titre} : la liste n'est pas son groupe`);
      // Ce que la page montre : le tuyau, les vignettes du dessin ou du rail, la chaîne d'une tête.
      const montrees = new Set<string>([r.tuyau.poste.ref]);
      for (const pose of r.pieces?.poses ?? []) for (const x of [pose.egal, ...pose.pieces]) if (x) montrees.add(x.changee?.ref ?? x.ref);
      for (const x of [...r.rail, ...r.ajoutees]) montrees.add(x.changee?.ref ?? x.ref);
      for (const m of r.chaine ?? []) for (const ref of m.refs) montrees.add(ref);
      for (const ref of montrees) if (r.liste.some((l) => l.ref === ref)) assert.ok(r.numeros[ref], `${r.titre} : ${ref} montrée sans numéro`);
      for (const l of r.liste) assert.ok(montrees.has(l.ref), `${r.titre} : le numéro ${l.numero} (${l.nom}) n'est sur aucune photo de la page`);
    }
  });

  const i = process.argv.indexOf("--images");
  if (i > 0) {
    const dossier = process.argv[i + 1];
    mkdirSync(dossier, { recursive: true });
    writeFileSync(path.join(dossier, "plan.pdf"), octets);
    execFileSync("pdftoppm", ["-r", "70", "-png", path.join(dossier, "plan.pdf"), path.join(dossier, "page")]);
    console.log(`\n  ${pages.length} pages écrites dans ${dossier}`);
  }

  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ Le PDF du plan : un réseau par page, sans réserve, rien de perdu.");
  process.exit(echecs ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

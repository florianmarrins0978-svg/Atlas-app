import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lancerNavigateur } from "./e2e-browser";
import { getConfigIA } from "../src/server/ai/config";
import { etatVision } from "../src/lib/etat-ia";
import { lireCroquis } from "../src/server/ai/services/lire-croquis";

/**
 * **Le croquis, lu POUR DE BON** — la commande qui manquait.
 *
 * `lire-croquis.ts` le disait de lui-même : « l'appel au fournisseur n'est pas
 * éprouvé dans cet environnement ; il devra l'être sur le banc du patron, avec
 * un vrai croquis — et tant que ce n'est pas fait, ça s'écrit non vérifié ».
 * Cette commande est ce banc-là.
 *
 * **Pourquoi elle vit hors de la batterie de livraison.** Il n'y a aucune clé
 * ici, ni en intégration continue. Un contrôle qui mesure zéro est pire
 * qu'absent (`CLAUDE.md` §5) : celui-ci refuse donc de rendre un vert quand il
 * n'a rien appelé, et le dit en nommant ce qui manque.
 *
 *   npm run verifier:croquis     depuis son espace, où ses clés sont posées
 *
 * **Le croquis est DESSINÉ ici, il n'est pas stocké.** Une image de référence
 * dans le dépôt vieillirait sans que personne ne s'en aperçoive, et un croquis
 * pris en photo porterait un jardin réel. Celui-ci est tracé à la volée dans un
 * navigateur — le même que celui des suites — puis photographié : ce que le
 * modèle reçoit est bien une PHOTO d'un dessin, pas un texte déguisé.
 *
 * La règle de lecture, elle, est éprouvée sans clé et sait rougir :
 * `scripts/test-lecture-croquis.ts`.
 */

// Même chargement de clés que `verifier-dictee-devis.mts` : le modèle de
// `.env.local` contient des lignes vides qui écraseraient des clés déjà posées.
try {
  const script = new URL("../.devcontainer/charger-cles.sh", import.meta.url).pathname;
  const fichier = new URL("../.env.local", import.meta.url).pathname;
  for (const ligne of execFileSync("bash", [script, fichier], { encoding: "utf8" }).split("\n")) {
    const separateur = ligne.indexOf("=");
    if (separateur > 0) process.env[ligne.slice(0, separateur)] = ligne.slice(separateur + 1);
  }
} catch {
  // Hors de son espace, ce fichier n'existe pas : ce n'est pas une anomalie.
}

/**
 * Le croquis d'un jardin, comme il en dessine un sur un coin de table.
 *
 * **Ce qu'il porte est choisi pour piéger la lecture, pas pour la flatter :**
 * deux surfaces aux cotes différentes, une haie donnée en mètres linéaires (et
 * non en surface), un massif, et le point d'eau nommé. Un modèle qui rendrait
 * « une zone de 10 × 5 par défaut » se ferait prendre.
 */
/**
 * **La nourrice EST dessinée sur ce croquis d'essai**, au milieu du côté gauche
 * du gazon. Sans elle, l'outil refuse tout plan (CLAUDE.md §4 bis) : un croquis
 * d'essai qui ne la porterait pas éprouverait un cas que le patron n'aura
 * jamais, et laisserait le vrai — la lecture de son emplacement — sans contrôle.
 *
 * *Attention en modifiant ce dessin :* c'est un gabarit, donc **aucune
 * apostrophe inversée à l'intérieur** — elle refermerait la chaîne, et l'erreur
 * de compilation qui s'ensuit accuse une ligne de HTML.
 */
const CROQUIS = `
<div style="font-family: Georgia, serif; background:#fff; width:760px; padding:28px">
  <div style="font-size:22px; margin-bottom:18px">Jardin — M. Martins</div>
  <div style="display:flex; gap:14px; align-items:flex-start">
    <div style="border:3px solid #222; width:340px; height:240px; position:relative">
      <div style="position:absolute; top:96px; left:96px; font-size:20px">GAZON</div>
      <div style="position:absolute; bottom:-30px; left:120px; font-size:19px">12 m</div>
      <div style="position:absolute; top:96px; right:-58px; font-size:19px">8 m</div>
      <div style="position:absolute; top:104px; left:-16px; width:26px; height:34px; border:3px solid #222; background:#fff"></div>
      <div style="position:absolute; top:146px; left:-42px; font-size:17px">NOURRICE</div>
    </div>
    <div style="border:3px solid #222; width:190px; height:150px; position:relative">
      <div style="position:absolute; top:58px; left:34px; font-size:20px">POTAGER</div>
      <div style="position:absolute; bottom:-30px; left:66px; font-size:19px">6 m</div>
      <div style="position:absolute; top:58px; right:-58px; font-size:19px">4 m</div>
    </div>
  </div>
  <div style="margin-top:52px; font-size:20px">HAIE le long du mur — 18 ml</div>
  <div style="margin-top:14px; font-size:20px">MASSIF devant la maison — 7 ml</div>
  <div style="margin-top:22px; font-size:20px">Point d'eau : compteur</div>
  <div style="margin-top:8px; display:flex; align-items:center; gap:10px">
    <div style="width:22px; height:22px; border-radius:50%; border:3px solid #222"></div>
    <div style="font-size:18px">COMPTEUR (piquage), en bas à gauche du gazon</div>
  </div>
</div>`;

/**
 * **Son croquis du 27 octobre 2026, redessiné** : un massif de goutte-à-goutte
 * DANS la pelouse, coté 6 m sur 3 m, et une bande « GAG » sur tout le haut,
 * le long d'un bord coté « 7,50 » puis « 4,50 ». Le modèle avait rendu le
 * massif en 9 × 10 (il l'avait étendu « sur toute la hauteur de la pelouse »,
 * l'exemple même que lui donnait sa consigne) et la bande en 7 m (la première
 * cote seule). Ce gabarit tient les deux pièges, sans porter son jardin.
 */
const CROQUIS_DANS_LA_PELOUSE = `
<div style="font-family: Georgia, serif; background:#fff; width:760px; padding:28px">
  <div style="position:relative; width:560px; height:470px; margin-left:60px">
    <div style="position:absolute; top:0; left:0; width:520px; height:46px; border:3px solid #222"></div>
    <div style="position:absolute; top:8px; left:200px; font-size:22px">GAG</div>
    <div style="position:absolute; top:56px; left:120px; font-size:19px">7,50</div>
    <div style="position:absolute; top:56px; left:400px; font-size:19px">4,50</div>
    <div style="position:absolute; top:86px; left:0; width:520px; height:360px; border:3px solid #222"></div>
    <div style="position:absolute; top:240px; left:300px; font-size:22px">ARROSEUR</div>
    <div style="position:absolute; top:250px; left:534px; font-size:19px">10 m</div>
    <div style="position:absolute; top:452px; left:250px; font-size:19px">12</div>
    <div style="position:absolute; top:150px; left:3px; width:130px; height:220px; border:3px solid #222; border-radius:0 40px 40px 0"></div>
    <div style="position:absolute; top:200px; left:12px; font-size:16px">Goutte à goutte</div>
    <div style="position:absolute; top:250px; left:20px; font-size:17px">6 m</div>
    <div style="position:absolute; top:290px; left:20px; font-size:15px">H 0,30</div>
    <div style="position:absolute; top:376px; left:50px; font-size:17px">3 m</div>
    <div style="position:absolute; top:100px; left:200px; width:26px; height:34px; border:3px solid #222; background:#fff"></div>
    <div style="position:absolute; top:104px; left:234px; font-size:15px">NOURRICE</div>
    <div style="position:absolute; top:4px; left:530px; width:22px; height:22px; border-radius:50%; border:3px solid #222"></div>
    <div style="position:absolute; top:30px; left:528px; font-size:15px">COMPTEUR</div>
  </div>
</div>`;

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void): Promise<void> {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const config = getConfigIA();
  const vision = etatVision(config);
  if (!vision.prete) {
    // **Le refus nomme le coupable exact**, plutôt qu'un « aucune clé » qui
    // envoie chercher partout (`CLAUDE.md` §5). C'est le même motif que celui
    // que l'écran affiche : une seule règle, jamais deux façons de la dire.
    console.error(
      "\n❌ AUCUNE LECTURE D'IMAGE — ce contrôle n'a RIEN vérifié.\n" +
        `   ${vision.raison}\n` +
        "   Rendre un vert ici ferait croire que le croquis a été lu.\n" +
        "   Jouez-le depuis votre espace de travail, où vos clés sont posées.\n"
    );
    process.exit(1);
  }

  console.log(`\n=== Un croquis de jardin, lu par « ${vision.fournisseur} » ===\n`);

  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 820, height: 620 } })).newPage();
  await page.setContent(CROQUIS);
  const png = await page.locator("div").first().screenshot();
  await navigateur.close();

  const lu = await lireCroquis(png.toString("base64"), "image/png");
  assert.equal(lu.ok, true, `la lecture a échoué : ${lu.ok ? "" : lu.raison}`);
  if (!lu.ok) return;
  console.log(`  Ce que le modèle a rendu :\n${JSON.stringify(lu.croquis, null, 2).replace(/^/gm, "    ")}\n`);

  const zones = lu.croquis.zones;
  const parType = (t: string) => zones.filter((z) => z.type === t);

  await cas("le gazon est lu, avec SES cotes — 12 × 8", () => {
    const g = parType("gazon");
    assert.equal(g.length, 1, `${g.length} zone(s) de gazon au lieu d'une`);
    assert.deepEqual([g[0].L, g[0].l].sort((a, b) => (b ?? 0) - (a ?? 0)), [12, 8], "les cotes du gazon");
  });

  await cas("le potager est lu, et ses cotes ne sont pas celles du gazon", () => {
    const p = parType("potager");
    assert.equal(p.length, 1, `${p.length} zone(s) de potager au lieu d'une`);
    assert.deepEqual([p[0].L, p[0].l].sort((a, b) => (b ?? 0) - (a ?? 0)), [6, 4], "les cotes du potager");
  });

  // **Une haie se donne en mètres LINÉAIRES.** Un modèle qui la rendrait en
  // surface ferait commander des arroseurs pour une bande de deux mètres de
  // large qui n'existe pas.
  await cas("la haie fait 18 ml, et non une surface", () => {
    const h = parType("haie");
    assert.equal(h.length, 1, `${h.length} haie(s) au lieu d'une`);
    assert.equal(h[0].ml, 18, `${h[0].ml} ml au lieu de 18`);
    assert.equal(h[0].L, null, "la haie a reçu une longueur de surface");
  });

  await cas("le massif fait 7 ml", () => {
    const m = parType("massif");
    assert.equal(m.length, 1, `${m.length} massif(s) au lieu d'un`);
    assert.equal(m[0].ml, 7, `${m[0].ml} ml au lieu de 7`);
  });

  await cas("le point d'eau est lu : le compteur", () => {
    assert.equal(lu.croquis.pointDEau, "compteur", `point d'eau lu : ${lu.croquis.pointDEau}`);
  });

  // **Rien n'a été inventé.** Une zone de plus est plus grave qu'une zone de
  // moins : celle qui manque se rajoute à la main, celle qui est de trop fait
  // commander des pièces pour un morceau de jardin qui n'existe pas.
  // ── OÙ LES CHOSES SONT, ajouté le 23 août 2026 ────────────────────────────
  //
  // **C'est ce qui décide si le plan peut être dessiné.** Les cotes seules
  // permettent de compter les arroseurs ; sans position, on ne sait pas où les
  // poser ni par où passe la tranchée. Les bornes sont larges à dessein : ce
  // qu'on éprouve, c'est que le modèle tient un REPÈRE cohérent, pas qu'il
  // lise au centimètre un dessin fait à main levée.
  await cas("les zones sont situées l'une par rapport à l'autre", () => {
    const g = parType("gazon")[0];
    const pot = parType("potager")[0];
    assert.ok(g.x !== null && g.y !== null, "le gazon n'a aucune position");
    assert.ok(pot.x !== null && pot.y !== null, "le potager n'a aucune position");
    assert.ok(
      (pot.x ?? 0) >= (g.x ?? 0) + 8,
      `le potager est à droite du gazon sur le croquis, il est lu en x=${pot.x} contre ${g.x}`,
    );
  });

  // **La nourrice n'est jamais déduite, mais elle doit être LUE quand elle est
  // là.** Deux défauts opposés, et celui-ci est le moins visible : un refus
  // permanent ferait croire que l'outil ne marche pas.
  await cas("la nourrice dessinée est lue", () => {
    assert.notEqual(lu.croquis.nourrice, null, "la nourrice est sur le croquis et n'a pas été lue");
  });

  // **Le piquage aussi, depuis le 11 septembre 2026** — sa règle : l'amenée se
  // calcule du piquage à la nourrice, ni lue ni supposée. Sans sa place, aucun
  // plan ; ce croquis d'essai le porte donc, marqué « COMPTEUR (piquage) ».
  await cas("le piquage dessiné est lu, en fraction", () => {
    assert.notEqual(lu.croquis.piquage, null, "le piquage est sur le croquis et n'a pas été lu");
  });

  await cas("aucune zone n'a été inventée", () => {
    assert.equal(zones.length, 4, `${zones.length} zones au lieu de 4 : ${zones.map((z) => z.type).join(", ")}`);
  });

  await lireLeSecond();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Les croquis lus par le modèle — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

/** Le second croquis : un massif dans la pelouse, une bande cotée en deux fois. */
async function lireLeSecond() {
  console.log("\n=== Un massif dessiné DANS la pelouse ===\n");
  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 820, height: 620 } })).newPage();
  await page.setContent(CROQUIS_DANS_LA_PELOUSE);
  const png = await page.locator("div").first().screenshot();
  await navigateur.close();

  const lu = await lireCroquis(png.toString("base64"), "image/png");
  assert.equal(lu.ok, true, `la lecture a échoué : ${lu.ok ? "" : lu.raison}`);
  if (!lu.ok) return;
  console.log(`  Ce que le modèle a rendu :\n${JSON.stringify(lu.croquis, null, 2).replace(/^/gm, "    ")}\n`);
  const zones = lu.croquis.zones;
  const tailles = (z: (typeof zones)[number]) => [z.L, z.l].sort((a, b) => (b ?? 0) - (a ?? 0));

  await cas("la pelouse fait 12 × 10 : 7,50 et 4,50 bout à bout", () => {
    const g = zones.filter((z) => z.type === "gazon");
    assert.equal(g.length, 1, `${g.length} pelouse(s) au lieu d'une`);
    assert.deepEqual(tailles(g[0]), [12, 10], "les cotes de la pelouse");
  });

  // **La cote écrite passe avant la déduction** : le massif ne longe pas toute
  // la pelouse, il porte « 6 m ». L'étendre à 10 m faisait poser 16 lignes.
  await cas("le massif garde ses cotes écrites, 6 × 3, et non la hauteur de la pelouse", () => {
    const m = zones.filter((z) => z.type === "massif");
    assert.equal(m.length, 1, `${m.length} massif(s) au lieu d'un : ${zones.map((z) => `${z.type} ${z.L}×${z.l}`).join(", ")}`);
    assert.deepEqual(tailles(m[0]), [6, 3], "les cotes du massif");
  });

  await cas("la bande GAG mesure la somme des cotes de son bord, 12 m", () => {
    const h = zones.filter((z) => z.type === "haie");
    assert.equal(h.length, 1, `${h.length} bande(s) au lieu d'une`);
    assert.equal(h[0].ml, 12, `${h[0].ml} m au lieu de 12`);
  });

  // **Le massif est DANS la pelouse** : son centre tombe dans le cadre qu'elle
  // occupe. Le posé côte à côte gonflait le terrain à 33,5 × 31 m.
  await cas("le massif est lu à l'intérieur de la pelouse", () => {
    const g = zones.find((z) => z.type === "gazon");
    const m = zones.find((z) => z.type === "massif");
    assert.ok(g && m && g.x !== null && g.y !== null && m.x !== null && m.y !== null, "une place manque");
    const dedans = (v: number, c: number, t: number | null) => t !== null && Math.abs(v - c) <= t / 2 + 0.02;
    assert.ok(dedans(m!.x!, g!.x!, g!.largeurFraction) && dedans(m!.y!, g!.y!, g!.hauteurFraction), `massif en (${m!.x}, ${m!.y}), pelouse en (${g!.x}, ${g!.y})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

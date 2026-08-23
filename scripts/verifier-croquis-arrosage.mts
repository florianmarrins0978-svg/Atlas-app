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
const CROQUIS = `
<div style="font-family: Georgia, serif; background:#fff; width:760px; padding:28px">
  <div style="font-size:22px; margin-bottom:18px">Jardin — M. Martins</div>
  <div style="display:flex; gap:14px; align-items:flex-start">
    <div style="border:3px solid #222; width:340px; height:240px; position:relative">
      <div style="position:absolute; top:96px; left:96px; font-size:20px">GAZON</div>
      <div style="position:absolute; bottom:-30px; left:120px; font-size:19px">12 m</div>
      <div style="position:absolute; top:96px; right:-58px; font-size:19px">8 m</div>
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
  await cas("aucune zone n'a été inventée", () => {
    assert.equal(zones.length, 4, `${zones.length} zones au lieu de 4 : ${zones.map((z) => z.type).join(", ")}`);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le croquis lu par le modèle — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

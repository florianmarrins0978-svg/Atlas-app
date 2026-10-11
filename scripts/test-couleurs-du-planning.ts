import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, getEntreprise, mettreAJourEntreprise } from "../src/server/repositories/entreprises";
import { charte, contraste } from "../src/lib/chartes";
import {
  AUCUNE_COULEUR_CHOISIE,
  choixAEcrire,
  couleurDApparence,
  couleursDepuisColonnes,
  variablesDesEtats,
} from "../src/lib/couleurs-planning";

/**
 * LES COULEURS DU PLANNING — sa demande du 29 septembre 2026.
 *
 * Planche `appli/couleurs-du-planning.html`, validée : « tout l'entreprise »,
 * et « la même chose que pour les couleurs des devis ». Ce qui se tient ici :
 * rien ne bouge tant qu'il n'a rien choisi ; son choix sort intact sur une
 * apparence claire ; il reste visible sur Nuit ; la couleur d'aujourd'hui
 * s'écrit vide ; une entreprise ne voit pas les couleurs d'une autre.
 */

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function monter(nom: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom },
    { email: `coul-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== Les couleurs du planning ===\n");

  await essai("RIEN DE CHOISI, RIEN NE BOUGE : aucune variable n'est posée", () => {
    // Une variable absente laisse `fondDeLEtat` sur la couleur d'avant, au
    // pixel près : c'est ce qui garantit que le lot ne repeint rien d'office.
    for (const nom of ["origine", "nuit", "sylve", "brume"]) {
      assert.deepEqual(variablesDesEtats(AUCUNE_COULEUR_CHOISIE, charte(nom)), {}, nom);
    }
  });

  await essai("sur une apparence claire, sa couleur sort INTACTE", () => {
    const v = variablesDesEtats({ libre: "#ffffff", dispo: "#d0782a", plein: "#1c1c1a", dela: "#b8322a" }, charte("origine"));
    assert.deepEqual(v, {
      "--atlas-etat-libre": "#ffffff",
      "--atlas-etat-dispo": "#d0782a",
      "--atlas-etat-plein": "#1c1c1a",
      "--atlas-etat-dela": "#b8322a",
    });
  });

  await essai("SUR NUIT ET SYLVE, une couleur sombre s'éclaircit jusqu'à se voir", () => {
    // Le noir sur le fond de Nuit : 1,1 de contraste, invisible. Le seuil est
    // celui que la charte applique à son propre bordeaux.
    for (const nom of ["nuit", "sylve"]) {
      const c = charte(nom);
      const v = variablesDesEtats({ ...AUCUNE_COULEUR_CHOISIE, plein: "#1c1c1a" }, c)["--atlas-etat-plein"];
      assert.ok(v && v !== "#1c1c1a", `${nom} : le noir n'a pas bougé`);
      assert.ok(contraste(v, c.jetons.cream) >= 3, `${nom} : ${v} reste invisible sur le fond`);
      assert.ok(contraste(v, c.jetons.card) >= 3, `${nom} : ${v} reste invisible sur la plage`);
    }
  });

  await essai("la couleur de l'apparence, choisie au nuancier, s'écrit VIDE", () => {
    // Sinon elle serait figée : il passerait sur Nuit, et « complet » resterait
    // le vert pin d'Origine, invisible sur le noir.
    const origine = charte("origine");
    assert.equal(choixAEcrire("plein", couleurDApparence("plein", origine), origine), null);
    assert.equal(choixAEcrire("dela", "#6E2433", origine), null, "le bordeaux d'origine en majuscules");
    assert.equal(choixAEcrire("dela", "#b8322a", origine), "#b8322a");
    assert.equal(choixAEcrire("dela", "pas une couleur", origine), null);
  });

  await essai("une couleur choisie se relit en base, telle quelle", async () => {
    await nettoyerBase();
    const ctx = await monter("Chez Dupont");
    await mettreAJourEntreprise(ctx, { couleursPlanning: { plein: "#1c1c1a", dela: "#B8322A" } });
    const lues = couleursDepuisColonnes(await getEntreprise(ctx));
    assert.deepEqual(lues, { libre: null, dispo: null, plein: "#1c1c1a", dela: "#b8322a" });
  });

  await essai("UN ÉTAT ABSENT N'EST PAS TOUCHÉ, null le rend à l'apparence", async () => {
    await nettoyerBase();
    const ctx = await monter("Chez Durand");
    await mettreAJourEntreprise(ctx, { couleursPlanning: { plein: "#1c1c1a", dela: "#b8322a" } });
    await mettreAJourEntreprise(ctx, { couleursPlanning: { dela: null } });
    const lues = couleursDepuisColonnes(await getEntreprise(ctx));
    assert.equal(lues.plein, "#1c1c1a", "changer « au-delà » a effacé « complet »");
    assert.equal(lues.dela, null);
  });

  await essai("ce qui n'est pas une couleur n'entre pas", async () => {
    await nettoyerBase();
    const ctx = await monter("Chez Petit");
    await mettreAJourEntreprise(ctx, { couleursPlanning: { dispo: "#7d9a6d" } });
    await mettreAJourEntreprise(ctx, { couleursPlanning: { dispo: "red;background:url(x)" } });
    const lues = couleursDepuisColonnes(await getEntreprise(ctx));
    assert.equal(lues.dispo, "#7d9a6d", "une valeur qui n'est pas une couleur a remplacé la sienne");
  });

  await essai("UNE ENTREPRISE NE VOIT PAS LES COULEURS D'UNE AUTRE", async () => {
    await nettoyerBase();
    const a = await monter("Chez Dupont");
    const b = await monter("Chez Martin");
    await mettreAJourEntreprise(a, { couleursPlanning: { plein: "#1c1c1a" } });
    assert.deepEqual(couleursDepuisColonnes(await getEntreprise(b)), AUCUNE_COULEUR_CHOISIE, "B porte les couleurs de A");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});

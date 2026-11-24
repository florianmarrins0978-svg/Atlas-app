import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CHOIX_PAR_DEFAUT,
  doitPoserSaCarte,
  joursDEssaiAuPaiement,
  ligneDeLEssaiPose,
  ligneDeLaFormule,
  lignesDeLEssai,
  phraseArreter,
  phraseSansCarte,
  resumeDeLEssai,
} from "../src/lib/essai-avec-carte";
import { FORMULES, etatAffiche } from "../src/lib/abonnements";

/**
 * L'ESSAI AVEC LA CARTE — le modèle A, ses décisions du 24 novembre 2026
 * (planche `appli/soignee/essai-avec-carte.html`).
 *
 * Ce que ce contrôle tient : **ce que « Votre essai » annonce est ce que le
 * prestataire débitera** (la même règle sert l'écran et l'action), les mots de
 * la planche à la lettre, et la fermeture de l'appli bornée aux seuls comptes
 * nés avec la carte à poser. Un compte d'avant ne se ferme jamais.
 */
let echecs = 0;
async function cas(nom: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

const RACINE = path.join(__dirname, "..");
const lire = (f: string) => readFileSync(path.join(RACINE, f), "utf8");
const MAINTENANT = new Date("2026-11-24T10:00:00Z");

async function main() {
  console.log("=== Qui doit poser sa carte ===\n");

  await cas("un compte né avec la carte à poser, sans abonnement chez le prestataire : fermé", () => {
    assert.equal(doitPoserSaCarte({ carteRequise: true, abonnementPrestataire: null, essaiDejaPris: false }), true);
  });
  await cas("la carte posée (un abonnement chez le prestataire) : ouvert, même résilié ensuite", () => {
    assert.equal(doitPoserSaCarte({ carteRequise: true, abonnementPrestataire: "sub_1", essaiDejaPris: false }), false);
  });
  await cas("UN COMPTE D'AVANT NE SE FERME JAMAIS : sans carte requise, ni ligne, rien ne bloque", () => {
    assert.equal(doitPoserSaCarte({ carteRequise: false, abonnementPrestataire: null, essaiDejaPris: false }), false);
    assert.equal(doitPoserSaCarte(null), false);
    assert.equal(doitPoserSaCarte(undefined), false);
  });
  await cas("quinze jours d'essai, zéro pour un SIREN qui l'a déjà eu", () => {
    assert.equal(joursDEssaiAuPaiement({ essaiDejaPris: false }), 15);
    assert.equal(joursDEssaiAuPaiement({ essaiDejaPris: true }), 0);
  });
  await cas("sans choix venu du site, la formule la moins chère, au mois, sans outils", () => {
    const moinsChere = [...FORMULES].sort((a, b) => a.prixMensuel - b.prixMensuel)[0];
    assert.equal(CHOIX_PAR_DEFAUT.formule, moinsChere.code);
    assert.equal(CHOIX_PAR_DEFAUT.periodicite, "mensuelle");
    assert.deepEqual([...CHOIX_PAR_DEFAUT.modules], []);
  });

  console.log("\n=== « Votre essai », mot pour mot ===\n");

  const r = resumeDeLEssai({ formule: "artisan", periodicite: "mensuelle", modules: ["paysage"] }, 15, MAINTENANT)!;

  await cas("le relevé de la planche : formule, outils, aujourd'hui, premier prélèvement", () => {
    assert.deepEqual(lignesDeLEssai(r), [
      { intitule: "Votre formule", valeur: "Artisan", sous: "39 € HT par mois", changer: true },
      { intitule: "Les outils de paysage", valeur: "Ajoutés", sous: "6 € HT par mois" },
      { intitule: "Aujourd’hui", valeur: "0 €", sous: null },
      { intitule: "Premier prélèvement", valeur: "Le 9 décembre 2026", sous: "45 € HT par mois, soit 54 € TTC, puis chaque mois" },
    ]);
  });
  await cas("la phrase pour arrêter, et la date est celle du premier prélèvement", () => {
    assert.equal(phraseArreter(r.premierPrelevement), "Arrêtez avant le 9 décembre : vous ne payez rien. Il suffit de toucher « Résilier » dans Réglages, Abonnement.");
  });
  await cas("« Il manque votre carte » : sa phrase du 24 novembre, et la formule avec ses outils", () => {
    assert.equal(
      phraseSansCarte(15),
      "Votre essai démarre dès qu’elle est enregistrée. Rien n’est débité avant 15 jours. Pour arrêter avant et ne rien payer, touchez « Résilier » dans Réglages, Abonnement."
    );
    assert.deepEqual(ligneDeLaFormule(r), { intitule: "Votre formule", valeur: "Artisan avec les outils", sous: "45 € HT par mois" });
  });
  await cas("sans essai (le SIREN l'a eu), aujourd'hui porte le débit, et aucun premier prélèvement à venir", () => {
    const sans = resumeDeLEssai({ formule: "entreprise", periodicite: "annuelle", modules: [] }, 0, MAINTENANT)!;
    assert.equal(sans.essai, false);
    assert.equal(sans.premierPrelevement.getTime(), MAINTENANT.getTime());
    const lignes = lignesDeLEssai(sans);
    assert.equal(lignes.some((l) => l.intitule === "Premier prélèvement"), false);
    assert.deepEqual(lignes.at(-1), { intitule: "Aujourd’hui", valeur: "708 € TTC", sous: "Puis chaque année" });
    assert.match(phraseSansCarte(0), /déjà eu son essai/);
  });
  await cas("un montant à centimes s'écrit avec ses centimes", () => {
    const e = resumeDeLEssai({ formule: "entreprise", periodicite: "mensuelle", modules: [] }, 15, MAINTENANT)!;
    assert.equal(lignesDeLEssai(e).at(-1)?.sous, "59 € HT par mois, soit 70,80 € TTC, puis chaque mois");
  });
  await cas("une formule inconnue ne s'affiche pas : rien n'est inventé", () => {
    assert.equal(resumeDeLEssai({ formule: "inconnue" as never, periodicite: "mensuelle", modules: [] }, 15, MAINTENANT), null);
  });

  console.log("\n=== Après la carte, et sur Réglages, Abonnement ===\n");

  await cas("« C'est fait » porte l'essai en tête, tant qu'il court", () => {
    const fin = new Date("2026-12-09T10:00:00Z");
    assert.deepEqual(ligneDeLEssaiPose({ formule: "artisan", periodicite: "mensuelle", modules: ["paysage"], essaiJusquAu: fin }, MAINTENANT), {
      intitule: "Votre essai",
      valeur: "Jusqu’au 9 décembre",
      sous: "Carte enregistrée. Puis 45 € HT par mois.",
    });
    assert.equal(ligneDeLEssaiPose({ formule: "artisan", periodicite: "mensuelle", modules: [], essaiJusquAu: null }, MAINTENANT), null);
    assert.equal(ligneDeLEssaiPose({ formule: "artisan", periodicite: "mensuelle", modules: [], essaiJusquAu: MAINTENANT }, MAINTENANT), null);
  });
  await cas("l'état ne dit plus « aucune carte n'a été demandée » quand elle reste à poser", () => {
    const base = { formule: "artisan" as const, periodicite: "mensuelle" as const, statut: "essai" as const, periodeFin: new Date("2026-12-09T10:00:00Z"), annulationDemandee: false };
    const avecCarte = etatAffiche({ ...base, carteRequise: true }, MAINTENANT);
    assert.equal(avecCarte.titre, "Il manque votre carte");
    assert.equal(avecCarte.detail, "Votre essai démarre dès qu’elle est enregistrée.");
    assert.equal(etatAffiche({ ...base, carteRequise: true, essaiDejaPris: true }, MAINTENANT).detail, "L’abonnement commence dès qu’elle est enregistrée.");
    // L'essai d'avant, sans carte, garde sa phrase : elle y est vraie.
    assert.match(etatAffiche(base, MAINTENANT).detail ?? "", /Aucune carte n’a été demandée/);
  });

  console.log("\n=== Les portes ===\n");

  await cas("la porte ne demande la carte que si le paiement et son retour sont branchés", () => {
    assert.match(lire("src/app/creer-un-compte/actions.ts"), /carteRequise: paiementConfigure\(\) && retourConfigure\(\)/);
  });
  await cas("l'action de la carte est celle de Réglages, Abonnement, avec les jours d'essai", () => {
    const actions = lire("src/app/reglages/abonnement/actions.ts");
    assert.match(actions, /joursDEssai: joursDEssaiAuPaiement\(abonnement\)/);
    assert.match(actions, /retenirLaSessionDeCarte\(ctx, r\.session\)/);
    assert.match(lire("src/app/essai/EssaiClient.tsx"), /sabonnerAction\(formule, periodicite, \[\.\.\.modules\], "essai"\)/);
  });
  await cas("la garde ouvre l'écran de la carte, et les étapes d'avant, sans boucle", () => {
    const garde = lire("src/server/garde-page.ts");
    for (const ouvert of ['CHEMIN_DE_LA_CARTE = "/essai"', '"/verifier-email"', '"/documents-legaux"', "CHEMIN_COMPTE_FERME", '"/reglages/abonnement"']) {
      assert.ok(garde.includes(ouvert), `${ouvert} manque aux écrans ouverts sans carte`);
    }
  });
  await cas("les conditions du compte neuf mènent à « Votre essai » quand la carte reste à poser", () => {
    assert.match(lire("src/app/documents-legaux/actions.ts"), /return "\/essai\?debut=1"/);
  });
  await cas("les conditions publiées ne disent plus « sans saisie de moyen de paiement »", () => {
    const cgu = lire("appli/conditions-utilisation.html");
    assert.equal(cgu.includes("sans saisie de moyen de paiement"), false);
    assert.match(cgu, /Vous pouvez résilier à tout moment pendant l’essai, sans frais/);
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)`);
  if (echecs > 0) process.exit(1);
}

main();

// Les conditions du devis : réglées, bornées, et FIGÉES dans le document.
//
// *Dessiné le 13 août 2026 (`maquettes/atlas-reglages-documents.html`), codé le
// 14. `ARCHITECTURE.md` §101.*
//
// CE QUE CETTE SUITE TIENT, ET QUI SE CASSERAIT SANS ELLE :
//
//   · LA VALIDITÉ EST RECOPIÉE DANS LE DEVIS. La lire au moment de composer le
//     PDF ferait changer la durée d'engagement d'un devis DÉJÀ ENVOYÉ, pendant
//     que le client a une autre feuille sous les yeux ;
//   · « JAMAIS RÉGLÉ » ET « ÉTEINT » NE SE CONFONDENT PAS. Le premier vaut 30
//     jours — ce que la constante écrivait —, le second n'imprime rien. Les
//     mêler remettrait « 30 jours » sur le devis d'un artisan qui l'a retiré ;
//   · LES BORNES TIENNENT. Un acompte de 4 000 % s'imprimerait sur un document
//     que le client garde ;
//   · UNE SEULE RÉDACTION des phrases imprimées : l'aperçu des réglages et le
//     PDF lisent la même fonction.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { nettoyerBase } from "./_test-db";
import { creerEntreprise, mettreAJourEntreprise, getEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier } from "../src/server/repositories/chantiers";
import { getOuCreerDevisBrouillon } from "../src/server/repositories/devis";
import {
  lireConditions,
  normaliserConditions,
  libelleValidite,
  lignesConditionsDevis,
  VALIDITE_PAR_DEFAUT_JOURS,
} from "../src/lib/conditions-documents";

let echecs = 0;
async function essai(nom: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

async function monter() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: "Essai conditions" },
    { email: `cd-${Math.random().toString(36).slice(2)}@essai.local`, nom: "Patron" }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

async function main() {
  console.log("=== Les conditions du devis ===\n");

  // ── La règle, sans base ────────────────────────────────────────────────
  await essai("jamais réglé : la validité vaut ce que la constante écrivait", () => {
    assert.equal(lireConditions({}).validiteJours, VALIDITE_PAR_DEFAUT_JOURS);
    assert.equal(lireConditions(null).validiteJours, VALIDITE_PAR_DEFAUT_JOURS);
  });

  // LE PIÈGE : « jamais réglé » et « éteint » ne sont pas la même chose.
  await essai("éteint : plus aucune durée ne s'imprime", () => {
    assert.equal(lireConditions({ validiteJours: null }).validiteJours, null);
    assert.equal(libelleValidite(lireConditions({ validiteJours: null })), null);
  });

  await essai("le libellé s'accorde", () => {
    assert.equal(libelleValidite(lireConditions({ validiteJours: 1 })), "1 jour");
    assert.equal(libelleValidite(lireConditions({ validiteJours: 15 })), "15 jours");
  });

  // ON BORNE AU LIEU DE REFUSER : un doigt qui glisse ne doit pas éteindre le
  // réglage, ce qui serait l'inverse de ce qu'il voulait.
  await essai("une saisie aberrante est ramenée dans ses bornes", () => {
    assert.equal(normaliserConditions({ validiteJours: 4000 }).validiteJours, 365);
    assert.equal(normaliserConditions({ acomptePourcent: 4000 }).acomptePourcent, "100");
    assert.equal(normaliserConditions({ delaiPaiementJours: -5 }).delaiPaiementJours, 0);
  });

  // ─── LE DÉFAUT DU 25 AOÛT 2026 : « ça saute automatiquement » ─────────────
  //
  // Cette suite exigeait qu'« un champ vide ÉTEIGNE le réglage » — et c'est ce
  // qui empêchait le patron d'allumer « Texte en bas de vos documents » :
  // l'interrupteur s'allume en envoyant une chaîne vide, elle repartait en
  // `null`, et `null` veut dire éteint. Le geste s'annulait lui-même.
  //
  // **Ce qu'elle défendait vraiment reste vrai** — un champ vide n'imprime
  // rien —, mais cela se vérifie à l'IMPRESSION, pas sur l'interrupteur
  // (`CLAUDE.md` §5 bis : fixer la règle, pas la façon dont un écran la montre).
  await essai("un champ vide reste ALLUMÉ — il n'est pas encore rempli", () => {
    const c = normaliserConditions({ moyensPaiement: "   ", textePied: "" });
    assert.equal(c.moyensPaiement, "", "un champ vidé a éteint l'interrupteur");
    assert.equal(c.textePied, "", "allumer sans rien écrire a éteint l'interrupteur");
  });

  await essai("mais un champ vide n'imprime RIEN sur le devis", () => {
    const lignes = lignesConditionsDevis(lireConditions({ moyensPaiement: "", textePied: "" }));
    assert.ok(
      !lignes.some((l) => /Moyens de paiement/.test(l)),
      `une ligne de moyens vide s'imprime : ${lignes.join(" | ")}`
    );
    assert.ok(
      !lignes.some((l) => l.trim() === ""),
      `une ligne vide s'imprime sur le devis : ${JSON.stringify(lignes)}`
    );
  });

  await essai("l'interrupteur ÉTEINT, lui, rend bien null", () => {
    const c = normaliserConditions({ moyensPaiement: null, textePied: null });
    assert.equal(c.moyensPaiement, null);
    assert.equal(c.textePied, null);
  });

  await essai("un pourcentage vide éteint bien l'acompte", () => {
    // Celui-ci n'a pas d'interrupteur : un acompte sans chiffre n'existe pas.
    assert.equal(normaliserConditions({ acomptePourcent: "" }).acomptePourcent, null);
  });

  await essai("zéro jour de délai veut dire comptant, pas éteint", () => {
    const lignes = lignesConditionsDevis(lireConditions({ delaiPaiementJours: 0 }));
    assert.ok(lignes.some((l) => /comptant/i.test(l)), lignes.join(" | "));
  });

  await essai("les phrases imprimées suivent les réglages", () => {
    const lignes = lignesConditionsDevis(
      lireConditions({
        acomptePourcent: 30,
        delaiPaiementJours: 45,
        moyensPaiement: "virement, chèque",
        rappelerPenalites: true,
        textePied: "Évacuation des déchets comprise.",
      }),
      3480
    );
    assert.ok(lignes.some((l) => l.includes("30 %") && l.includes("1044,00 €")), lignes.join(" | "));
    assert.ok(lignes.some((l) => l.includes("45 jours")));
    assert.ok(lignes.some((l) => l.includes("virement, chèque")));
    assert.ok(lignes.some((l) => /40 €/.test(l)));
    assert.ok(lignes.some((l) => l.includes("Évacuation")));
  });

  // **AUCUN MONTANT INVENTÉ.** Sur l'aperçu des réglages, le total est inconnu :
  // un chiffre glissé là finirait imprimé (`docs/AGENT.md` §3).
  await essai("sans total connu, aucun montant d'acompte n'est écrit", () => {
    const lignes = lignesConditionsDevis(lireConditions({ acomptePourcent: 30 }));
    assert.ok(lignes.some((l) => l.includes("30 %")), lignes.join(" | "));
    assert.ok(!lignes.some((l) => /€/.test(l)), `un montant a été inventé : ${lignes.join(" | ")}`);
  });

  await essai("rien de réglé : rien ne s'ajoute au devis", () => {
    assert.deepEqual(lignesConditionsDevis(lireConditions({})), []);
  });

  // ── Branchée sur la base ───────────────────────────────────────────────
  await essai("les conditions s'enregistrent et se relisent", async () => {
    const ctx = await monter();
    await mettreAJourEntreprise(ctx, {
      conditions: { validiteJours: 15, acomptePourcent: 40, rappelerPenalites: true },
    });
    const e = await getEntreprise(ctx);
    assert.equal(e?.validiteDevisJours, 15);
    assert.equal(Number(e?.acomptePourcent), 40);
    assert.equal(e?.rappelerPenalitesDevis, true);
  });

  // LE CONTRÔLE QUI COMPTE : le devis garde ce qu'il portait.
  await essai("la validité est FIGÉE dans le devis, pas relue plus tard", async () => {
    const ctx = await monter();
    await mettreAJourEntreprise(ctx, { conditions: { validiteJours: 15 } });
    const chantier = await creerChantier(ctx, { nom: "Abattage" });
    const devis = await getOuCreerDevisBrouillon(ctx, chantier.id);
    assert.equal(devis.validiteJours, 15, "la validité n'a pas été recopiée");

    // Le réglage change APRÈS : le devis déjà fait ne bouge pas.
    await mettreAJourEntreprise(ctx, { conditions: { validiteJours: 60 } });
    const e = await getEntreprise(ctx);
    assert.equal(e?.validiteDevisJours, 60, "le réglage n'a pas changé");
    assert.equal(devis.validiteJours, 15, "le devis a suivi le réglage");
  });

  await essai("une entreprise neuve porte les 30 jours d'avant", async () => {
    const ctx = await monter();
    const e = await getEntreprise(ctx);
    assert.equal(e?.validiteDevisJours, VALIDITE_PAR_DEFAUT_JOURS);
  });

  // La base porte les mêmes bornes que la règle : une valeur passée de côté ne
  // doit pas pouvoir s'imprimer.
  await essai("la base refuse un acompte hors bornes", async () => {
    const ctx = await monter();
    await assert.rejects(() =>
      pool.query("UPDATE entreprises SET acompte_pourcent = 4000 WHERE id = $1", [ctx.entrepriseId])
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Conditions des documents — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

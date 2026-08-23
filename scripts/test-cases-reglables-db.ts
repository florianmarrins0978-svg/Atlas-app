import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  ajouterNature,
  ajouterTechnique,
  ajouterTranche,
  lireGrilles,
  prixParTranche,
  rendreTranche,
  rendreNature,
  retirerNature,
  retirerTranche,
} from "../src/server/repositories/grilles-reglables";
import { lireGrillePrix, poserPrixGrille, prixConnusDe } from "../src/server/repositories/grille-prix";
import { AXES_PAR_DEFAUT, NATURES_PAR_DEFAUT, celluleAbattage } from "../src/lib/grille-prix";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **« Je dois pouvoir ajouter ou retirer des cases. »** — le patron, le 14 août
// 2026.
//
// Les règles sont éprouvées sans base (`test-cases-reglables.ts`). Ce que CETTE
// suite tient, et qu'aucune règle pure ne peut tenir :
//
//   1. **RETIRER N'EFFACE AUCUN PRIX.** C'est la promesse du lot, et la seule
//      qui coûterait vraiment cher : ces prix sont ses décisions, et certains
//      viennent de devis réels que rien ne reconstituerait. La tranche part de
//      l'écran, les cases restent en base, et « Annuler » les rend telles
//      quelles ;
//   2. **le premier geste ne fait pas disparaître le reste.** Un axe sans ligne
//      signifie « les tranches de départ » ; y insérer la sienne sans recopier
//      les autres les effacerait toutes les huit d'un coup ;
//   3. **rien ne déborde d'une entreprise sur une autre.** Ce sont ses prix de
//      vente : un artisan qui redessine sa grille ne doit pas toucher celle de
//      son voisin.

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage A" },
    { email: "cases-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage B" },
    { email: "cases-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await test("sans rien avoir touché, ce sont les tranches de départ", async () => {
    const g = await lireGrilles(A);
    assert.equal(g.axes.diametres.length, AXES_PAR_DEFAUT.diametres.length);
    assert.equal(g.natures.length, NATURES_PAR_DEFAUT.length);
    assert.equal(g.axes.diametres[0].cle, "d0");
  });

  await test("une tranche plus haute que la dernière, OUVERTE, est refusée — et le refus dit quoi faire", async () => {
    // Le cas de tous les jours : « plus de 90 cm » n'a pas de borne haute, donc
    // tout ce qui dépasse 90 y tombe déjà. Un refus qui dirait seulement « ça
    // recouvre » laisserait sans issue.
    const r = await ajouterTranche(A, "diametre", { de: 90, a: 120 });
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.raison, /borne haute/, "le refus n'explique pas ce qui bloque");
    assert.match(r.ok ? "" : r.raison, /Retirez-la d'abord/, "le refus ne dit pas comment s'en sortir");
  });

  await test("LE PREMIER GESTE NE FAIT PAS DISPARAÎTRE LES HUIT AUTRES", async () => {
    // Le piège de la matérialisation : un axe sans ligne veut dire « les
    // tranches de départ ». Insérer la sienne sans recopier les autres ferait
    // basculer l'axe sur « une seule tranche » — et huit rangées de prix
    // deviendraient introuvables d'un coup.
    await retirerTranche(A, "diametre", "d90");
    const r = await ajouterTranche(A, "diametre", { de: 90, a: 120 });
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);

    const g = await lireGrilles(A);
    // Les huit d'origine moins « plus de 90 cm » qu'on vient de retirer, plus
    // la sienne : le compte n'a pas bougé, mais ce ne sont plus les mêmes.
    assert.equal(g.axes.diametres.length, AXES_PAR_DEFAUT.diametres.length, "les tranches d'origine n'ont pas été recopiées");
    for (const t of AXES_PAR_DEFAUT.diametres.slice(0, 7)) {
      assert.ok(g.axes.diametres.some((x) => x.cle === t.cle), `« ${t.libelle} » a disparu`);
    }
  });

  await test("la tranche neuve se range à sa place, et porte un libellé lisible", async () => {
    const g = await lireGrilles(A);
    const neuve = g.axes.diametres.find((t) => t.de === 90 && t.a === 120);
    assert.ok(neuve, "la tranche 90-120 est introuvable");
    assert.equal(neuve.libelle, "90 à 120 cm");
    // Rangée entre « 70 à 90 » et « plus de 90 » : c'est l'ordre où il lit sa
    // grille, et l'ordre où `trancheDe` cherche.
    const ordre = g.axes.diametres.map((t) => t.de);
    assert.deepEqual([...ordre].sort((x, y) => x - y), ordre, "les tranches ne sont plus dans l'ordre");
  });

  await test("une tranche qui chevauche est refusée, et rien n'est écrit", async () => {
    const avant = (await lireGrilles(A)).axes.diametres.length;
    const r = await ajouterTranche(A, "diametre", { de: 45, a: 55 });
    assert.equal(r.ok, false);
    assert.equal((await lireGrilles(A)).axes.diametres.length, avant, "une tranche refusée a quand même été écrite");
  });

  // --- LE contrôle du lot --------------------------------------------------

  await test("RETIRER UNE TRANCHE N'EFFACE AUCUN PRIX, et « Annuler » les rend", async () => {
    const axes = (await lireGrilles(A)).axes;
    const cellule = celluleAbattage("au_pied", 45, axes)!;
    await poserPrixGrille(A, "abattage", cellule.cle, "620");

    const avant = await prixConnusDe(A, "abattage");
    assert.equal(avant.get(cellule.cle), "620.00", "le prix n'a pas été posé");

    const r = await retirerTranche(A, "diametre", "d40");
    assert.ok(r.prixEmportes >= 1, `le retrait annonce ${r.prixEmportes} prix : il devrait en annoncer au moins un`);

    // La tranche a disparu de l'écran, et son prix ne se présente plus.
    const apres = await lireGrilles(A);
    assert.ok(!apres.axes.diametres.some((t) => t.cle === "d40"), "la tranche est toujours là");
    assert.equal((await prixConnusDe(A, "abattage")).get(cellule.cle), undefined);

    // **La preuve qu'il n'a pas été effacé, c'est son RETOUR.** Un prix
    // supprimé ne pourrait pas revenir : « Annuler » serait un mensonge.
    // (On ne l'interroge pas en base directement : le rôle applicatif ne
    // traverse pas la RLS, et c'est exactement ce qu'on veut de lui.)
    await rendreTranche(A, "diametre", "d40");
    const rendue = await lireGrilles(A);
    assert.ok(rendue.axes.diametres.some((t) => t.cle === "d40"), "la tranche n'est pas revenue");
    assert.equal(
      (await prixConnusDe(A, "abattage")).get(cellule.cle),
      "620.00",
      "le prix n'est pas revenu avec sa tranche : il avait donc été effacé"
    );
  });

  await test("une clé retirée n'est JAMAIS rendue à une autre tranche", async () => {
    // « plus de 90 cm » s'appelait `d90` et vient d'être retirée. La tranche
    // « 90 à 120 » posée à sa place ne doit pas hériter de ses prix — ils
    // portaient sur des troncs qui ne sont pas les siens.
    const g = await lireGrilles(A);
    const neuve = g.axes.diametres.find((t) => t.de === 90 && t.a === 120)!;
    assert.notEqual(neuve.cle, "d90", "la clé d'une tranche retirée a été réemployée");
  });

  await test("le décompte des prix par tranche dit ce qu'un retrait rangerait", async () => {
    const compte = await prixParTranche(A, "diametre");
    assert.ok((compte.get("d40") ?? 0) >= 1, "la tranche qui porte un prix est annoncée vide");
    assert.equal(compte.get("d0"), 0);
  });

  // --- Les façons d'abattre et les travaux ---------------------------------

  await test("une façon d'abattre ajoutée s'emploie comme les autres", async () => {
    const r = await ajouterTechnique(A, "Abattage par câble");
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);
    const g = await lireGrilles(A);
    assert.equal(g.axes.techniques.length, AXES_PAR_DEFAUT.techniques.length + 1);
    const cellule = celluleAbattage(r.ok ? r.cle : "", 45, g.axes)!;
    await poserPrixGrille(A, "abattage", cellule.cle, "1500");
    assert.equal((await prixConnusDe(A, "abattage")).get(cellule.cle), "1500.00");
  });

  await test("deux fois la même façon d'abattre est refusée", async () => {
    const r = await ajouterTechnique(A, "abattage par câble");
    assert.equal(r.ok, false);
  });

  await test("un travail à lui reçoit ses prix, et se dit NON reconnu par le chiffrage", async () => {
    const r = await ajouterNature(A, { titre: "Broyer les branches", forme: "un-axe" });
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);
    const cle = r.ok ? r.cle : "";
    assert.ok(cle.startsWith("perso_"), `« ${cle} » n'est pas préfixé`);

    const g = await lireGrilles(A);
    const nature = g.natures.find((n) => n.cle === cle);
    assert.ok(nature, "le travail n'apparaît pas dans ses grilles");
    assert.equal(nature.integree, false, "un travail à lui se prétend reconnu par le chiffrage");

    await poserPrixGrille(A, cle, g.axes.diametres[0].cle, "80");
    const cases = await lireGrillePrix(A, g);
    assert.ok(cases.some((c) => c.nature === cle && c.prix === "80.00"), "le prix du travail neuf n'est pas relu");
  });

  await test("une case qu'aucune de ses grilles ne connaît n'écrit RIEN", async () => {
    // La garde n'est pas dans l'écran : une clé fabriquée depuis un navigateur
    // doit ne rien créer du tout.
    const avant = (await lireGrillePrix(A)).length;
    await poserPrixGrille(A, "abattage", "au_pied|d999", "999");
    await poserPrixGrille(A, "travail_qui_n_existe_pas", "d0", "999");
    assert.equal((await lireGrillePrix(A)).length, avant, "une case inventée a été écrite");
  });

  await test("retirer un travail range ses prix sans les effacer", async () => {
    const g = await lireGrilles(A);
    const perso = g.natures.find((n) => !n.integree)!;
    const r = await retirerNature(A, perso.cle);
    assert.ok(r.prixEmportes >= 1, "le retrait n'annonce aucun prix alors qu'il y en avait");
    assert.ok(!(await lireGrilles(A)).natures.some((n) => n.cle === perso.cle), "le travail est toujours affiché");

    // Là encore, la preuve est le retour : ses prix reviennent avec lui.
    await rendreNature(A, perso.cle);
    const revenu = await lireGrilles(A);
    assert.ok(revenu.natures.some((n) => n.cle === perso.cle), "le travail n'est pas revenu");
    assert.ok(
      (await lireGrillePrix(A, revenu)).some((c) => c.nature === perso.cle),
      "ses prix n'ont pas suivi : ils avaient donc été effacés"
    );
  });

  // --- L'isolation ---------------------------------------------------------

  await test("RIEN DE TOUT CELA N'A DÉBORDÉ SUR L'AUTRE ENTREPRISE", async () => {
    const gB = await lireGrilles(B);
    assert.equal(gB.axes.diametres.length, AXES_PAR_DEFAUT.diametres.length, "B a hérité des tranches de A");
    assert.equal(gB.axes.techniques.length, AXES_PAR_DEFAUT.techniques.length, "B a hérité des façons de A");
    assert.equal(gB.natures.length, NATURES_PAR_DEFAUT.length, "B a hérité des travaux de A");
    assert.equal((await lireGrillePrix(B)).length, 0, "B voit les prix de A");
  });

  await test("B règle les siennes sans toucher à celles de A", async () => {
    const avantA = (await lireGrilles(A)).axes.hauteurs.length;
    // Une hauteur qui se glisse là où B a de la place : ses tranches d'origine
    // s'arrêtent à « plus de 25 m », qu'on retire d'abord.
    await retirerTranche(B, "hauteur", "h25");
    const r = await ajouterTranche(B, "hauteur", { de: 25, a: 40 });
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);
    assert.equal((await lireGrilles(A)).axes.hauteurs.length, avantA, "les hauteurs de A ont bougé");
    // Six d'origine, moins « plus de 25 m » retirée, plus la sienne.
    assert.equal((await lireGrilles(B)).axes.hauteurs.length, AXES_PAR_DEFAUT.hauteurs.length);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

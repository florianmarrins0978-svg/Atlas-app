// UN TARIF SANS INTITULÉ NE RÉPOND À AUCUN MOT — l'outil de l'assistant, en base.
//
// **Trouvé le 29 septembre 2026**, en relevant tous les « + Ajouter » de
// l'application après sa case vide : *« va vérifier tous les endroits où on peut
// rajouter des lignes ou des choses »*. « + Ajouter un tarif » (Réglages) écrit
// le tarif dès l'appui, intitulé vide et 0 €. L'outil de l'assistant testait
// `motCle.includes(intitule)` : une chaîne vide est contenue dans toutes, et ce
// tarif à 0 € était proposé pour n'importe quel travail.
//
// Le calcul du prix tenait déjà la bonne règle, et son commentaire disait
// « même règle que l'outil » : c'étaient deux copies, et l'une était fausse.

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { creerTarif } from "../src/server/repositories/tarifs";
import { rechercherTarifsCompatibles } from "../src/server/ai/tools/rechercher-tarifs-compatibles";
import { nettoyerBase } from "./_test-db";

async function main() {
  await nettoyerBase();
  const A = await entreprisesRepo.creerEntreprise(
    { nom: "Paysages A" },
    { email: `tarif-vide-${Date.now()}@test.local`, nom: "Anne" }
  );
  const ctx = { utilisateurId: A.utilisateurId, entrepriseId: A.entreprise.id };
  await creerTarif(ctx, { intitule: "", prix: "0" });
  await creerTarif(ctx, { intitule: "Élagage", prix: "300" });

  let echec = false;
  const r = (await rechercherTarifsCompatibles.executer({ ctx, chantierId: null }, { motCle: "élagage du sapin" })) as {
    correspondances: { intitule: string }[];
  };
  try {
    assert.deepEqual(r.correspondances.map((c) => c.intitule), ["Élagage"]);
    console.log("  ✓ le tarif sans intitulé n'est proposé pour rien");
  } catch (e) {
    echec = true;
    console.log(`  ✗ le tarif sans intitulé n'est proposé pour rien\n    ${(e as Error).message}`);
  }
  await pool.end();
  process.exit(echec ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});

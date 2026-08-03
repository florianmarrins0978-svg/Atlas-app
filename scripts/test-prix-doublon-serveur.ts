import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import { appliquerPropositionPrixAction } from "../src/app/chantiers/[id]/prix/actions";
import { nettoyerBase } from "./_test-db";

// Le refus côté serveur du doublon de proposition.
//
// L'écran grise désormais le bouton, mais **un écran ne protège rien** : une
// page laissée ouverte, deux appuis pendant que le premier voyage, ou une
// requête forgée arrivent quand même ici. C'est ce chemin-là qui a coûté au
// patron un devis à 4 017,60 € au lieu de 2 008,80 €.
//
// La règle appliquée ici est la MÊME fonction que celle de l'écran
// (`src/lib/proposition-au-detail.ts`, `CLAUDE.md` §3) : deux implémentations
// finissent toujours par diverger, et c'est l'écran qui aurait raison pendant
// que le serveur laisse passer.

let reussis = 0;
let echoues = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise doublon prix" },
    { email: "doublon-prix@test.local", nom: "Test" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;

  await tarifsRepo.creerTarif(ctx, { intitule: "Élagage", prix: "1674.00", unite: "forfait" });

  async function chantierPret(nom: string) {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom });
    await prestationsRepo.ajouterPrestation(ctx, chantier.id, "Élagage");
    return chantier;
  }

  await test("deux appels d'affilée n'ajoutent qu'une seule ligne", async () => {
    const chantier = await chantierPret("Doublon — deux appels");

    const premier = await appliquerPropositionPrixAction(chantier.id);
    assert.equal(premier.succes, true, "Le premier ajout aurait dû réussir.");

    const second = await appliquerPropositionPrixAction(chantier.id);
    assert.equal(second.succes, false, "Le second ajout a été accepté : le devis double.");

    const lignes = await lignesPrixRepo.listerLignesPrix(ctx, chantier.id);
    assert.equal(lignes.length, 1, `Le détail porte ${lignes.length} lignes au lieu d'une.`);
    const total = await lignesPrixRepo.totalLignesPrix(ctx, chantier.id);
    assert.equal(total, "1674.00", `Total ${total} € — le doublement s'est produit quand même.`);
  });

  await test("le refus dit quoi faire, il ne se contente pas de refuser", async () => {
    const chantier = await chantierPret("Doublon — message");
    await appliquerPropositionPrixAction(chantier.id);
    const second = await appliquerPropositionPrixAction(chantier.id);
    assert.equal(second.succes, false);
    if (!second.succes) {
      assert.match(second.erreur, /d[ée]j[àa]/i, "Le message ne dit pas que la ligne est déjà là.");
      assert.match(second.erreur, /Modifiez/i, "Le message n'indique pas la sortie : modifier la ligne existante.");
    }
  });

  await test("le premier ajout d'un chantier neuf n'est jamais bloqué", async () => {
    const chantier = await chantierPret("Doublon — premier ajout");
    const r = await appliquerPropositionPrixAction(chantier.id);
    assert.equal(r.succes, true, "Le tout premier ajout a été pris pour un doublon.");
  });

  await test("une ligne saisie à la main sous un autre nom ne bloque pas la proposition", async () => {
    const chantier = await chantierPret("Doublon — ligne manuelle");
    await lignesPrixRepo.ajouterLignePrix(ctx, chantier.id, "Déplacement", "60.00");
    const r = await appliquerPropositionPrixAction(chantier.id);
    assert.equal(r.succes, true, "Une ligne sans rapport a bloqué la proposition.");
  });

  await test("une ligne saisie à la main sous LE MÊME nom bloque bien la proposition", async () => {
    // Le patron a très bien pu écrire « élagage » lui-même : lui ajouter la
    // même prestation une seconde fois produirait le même devis doublé.
    const chantier = await chantierPret("Doublon — même nom à la main");
    await lignesPrixRepo.ajouterLignePrix(ctx, chantier.id, "  élagage ", "1500.00");
    const r = await appliquerPropositionPrixAction(chantier.id);
    assert.equal(r.succes, false, "Un doublon écrit à la main est passé au travers.");
  });

  console.log(`\n${reussis} test(s) réussi(s), ${echoues} échoué(s).`);
  await pool.end();
  if (echoues > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import {
  creerEnvoi,
  enregistrerReponse,
  notificationsPatron,
  dernierEnvoi,
} from "../src/server/repositories/envois-devis";
import { etatEnvoi, etatEnvoiLabel, demandeUneAction } from "../src/lib/etat-envoi";
import { versJourIso, ajouterJours } from "../src/server/disponibilites";
import { nettoyerBase } from "./_test-db";

// La troisième issue : « corrigez, et je signe ».
//
// **Ce qui n'allait pas.** Le client n'avait que deux boutons : accepter, ou ne
// pas donner suite. Celui qui repère une faute ne veut ni l'un ni l'autre. Il
// touchait donc « Je ne donne pas suite », et le patron lisait « Le client n'a
// pas donné suite » — un chantier perdu pour une coquille.
//
// **Et le plus coûteux, parce qu'invisible.** Le champ « Une précision ? »
// existait, le client y écrivait (« Le devis comprend une fautes »), c'était
// enregistré dans `precision_client`… et **aucun écran ne l'affichait**. Le
// message partait dans le vide. C'est ce que le dernier contrôle de ce fichier
// interdit désormais.

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

const MARDI = new Date("2026-03-03T09:00:00Z");
const dans = (n: number) => versJourIso(ajouterJours(MARDI, n));
const MESSAGE = "Mon nom est mal écrit : Martins, avec un s.";

async function contexteAvecEnvoi(email: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Élagage Éden" }, { email });
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Martins", email: "m@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Élagage", clientId: client.id });
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  const envoi = await creerEnvoi(
    ctx,
    {
      chantierId: chantier.id,
      devisId: devis.id,
      canal: "email",
      datesProposees: [dans(7)],
      contenuDevis: "devis",
    },
    MARDI
  );
  return { ctx, chantierId: chantier.id, envoi };
}

async function main() {
  await nettoyerBase();

  await test("une correction demandée n'est ni un oui ni un non", async () => {
    const { ctx, chantierId, envoi } = await contexteAvecEnvoi(`corr-${Date.now()}@t.test`);

    const r = await enregistrerReponse(
      envoi.jeton,
      { decision: "correction", precision: MESSAGE },
      MARDI
    );
    assert.equal(r.succes, true, "La demande de correction a été refusée.");

    const dernier = await dernierEnvoi(ctx, chantierId);
    assert.equal(dernier?.reponse, "correction");
    assert.equal(etatEnvoi(dernier ? { envoyeAt: dernier.envoyeAt, expireAt: dernier.expireAt, reponse: dernier.reponse } : null, MARDI), "a_corriger");
    assert.equal(etatEnvoiLabel.a_corriger, "Correction demandée");
  });

  await test("le chantier n'est pas planifié, et n'est pas non plus refusé", async () => {
    const { ctx, chantierId, envoi } = await contexteAvecEnvoi(`etat-${Date.now()}@t.test`);
    await enregistrerReponse(envoi.jeton, { decision: "correction", precision: MESSAGE }, MARDI);

    const chantier = await chantiersRepo.getChantier(ctx, chantierId);
    assert.equal(chantier?.datePlanifiee, null, "Une correction ne planifie rien.");

    const dernier = await dernierEnvoi(ctx, chantierId);
    assert.notEqual(dernier?.reponse, "refusee", "Une correction a été enregistrée comme un refus.");
  });

  await test("une correction appelle un geste du patron", async () => {
    assert.equal(demandeUneAction("a_corriger"), true, "Une correction demandée ne remonte pas à l'accueil.");
  });

  await test("INVARIANT — le message du client parvient au patron, mot pour mot", async () => {
    // Le défaut d'origine : il était enregistré et n'apparaissait nulle part.
    const { ctx, envoi } = await contexteAvecEnvoi(`message-${Date.now()}@t.test`);
    await enregistrerReponse(envoi.jeton, { decision: "correction", precision: MESSAGE }, MARDI);

    const notifications = await notificationsPatron(ctx);
    assert.equal(notifications.length, 1, "La demande de correction n'a pas été portée au patron.");
    assert.equal(
      notifications[0].precisionClient,
      MESSAGE,
      "Le message du client n'accompagne pas la notification : le patron ne saura pas quoi corriger."
    );
  });

  await test("le message accompagne aussi un refus, s'il y en a un", async () => {
    // Un client qui renonce en expliquant pourquoi (« trop cher », « j'ai
    // trouvé moins loin ») apprend au patron plus qu'un « non » muet.
    const { ctx, envoi } = await contexteAvecEnvoi(`refus-${Date.now()}@t.test`);
    await enregistrerReponse(envoi.jeton, { decision: "refuse", precision: "Trop cher pour moi." }, MARDI);

    const notifications = await notificationsPatron(ctx);
    assert.equal(notifications[0]?.precisionClient, "Trop cher pour moi.");
  });

  await test("le message accompagne aussi une acceptation", async () => {
    // « Plutôt le matin » : une acceptation sur une date proposée ne remontait
    // pas, faute de surprise. Avec un message, elle remonte — il change ce que
    // le patron doit prévoir.
    const { ctx, envoi } = await contexteAvecEnvoi(`accept-${Date.now()}@t.test`);
    await enregistrerReponse(
      envoi.jeton,
      { decision: "accepte", dateRetenue: dans(7), precision: "Plutôt le matin si possible." },
      MARDI
    );

    const notifications = await notificationsPatron(ctx);
    assert.equal(notifications.length, 1, "Une acceptation accompagnée d'un message n'a pas été portée au patron.");
    assert.equal(notifications[0].precisionClient, "Plutôt le matin si possible.");
  });

  await test("une acceptation muette sur une date proposée ne dérange toujours personne", async () => {
    // Le contrôle précédent ne prouverait rien si TOUTES les acceptations
    // remontaient : ce serait noyer les deux nouvelles qui appellent un geste.
    const { ctx, envoi } = await contexteAvecEnvoi(`muet-${Date.now()}@t.test`);
    await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: dans(7) }, MARDI);

    const notifications = await notificationsPatron(ctx);
    assert.equal(notifications.length, 0, "Une acceptation sans surprise ni message ne doit rien réclamer.");
  });

  await test("une correction sans message est refusée, avec un motif utilisable", async () => {
    // Sans message, le patron saurait qu'il y a un problème sans savoir lequel,
    // et devrait rappeler son client — l'aller-retour que ce parcours supprime.
    const { envoi } = await contexteAvecEnvoi(`vide-${Date.now()}@t.test`);
    const r = await enregistrerReponse(envoi.jeton, { decision: "correction", precision: "   " }, MARDI);
    assert.equal(r.succes, false);
    if (!r.succes) assert.equal(r.motif, "message_manquant");
  });

  await test("on ne répond pas deux fois, correction comprise", async () => {
    const { envoi } = await contexteAvecEnvoi(`double-${Date.now()}@t.test`);
    await enregistrerReponse(envoi.jeton, { decision: "correction", precision: MESSAGE }, MARDI);
    const second = await enregistrerReponse(envoi.jeton, { decision: "accepte", dateRetenue: dans(7) }, MARDI);
    assert.equal(second.succes, false);
    if (!second.succes) assert.equal(second.motif, "deja_repondu");
  });

  await test("la base refuse une correction sans message, même si le code changeait", async () => {
    // La contrainte de la migration 0020, éprouvée directement : si un jour le
    // garde applicatif disparaissait, la base tiendrait encore.
    //
    // **Le contexte d'entreprise est indispensable ici.** Une première version
    // écrivait sans le poser : la RLS ne renvoyait aucune ligne, l'UPDATE
    // passait sans rien toucher, et le contrôle concluait « pas d'erreur, donc
    // pas de contrainte ». Il aurait accusé la base à tort — piège n°1 du dépôt
    // (`HANDOVER.md`). D'où la vérification préalable : la sonde doit d'abord
    // prouver qu'elle atteint bien la ligne.
    const { ctx, envoi } = await contexteAvecEnvoi(`ck-${Date.now()}@t.test`);
    const connexion = await pool.connect();
    try {
      await connexion.query("BEGIN");
      await connexion.query("SELECT set_config('app.entreprise_id', $1, true)", [ctx.entrepriseId]);

      const atteinte = await connexion.query(
        "UPDATE envois_devis SET reponse = 'correction', repondu_at = now(), precision_client = 'x' WHERE id = $1",
        [envoi.id]
      );
      assert.equal(atteinte.rowCount, 1, "La sonde n'atteint pas la ligne : le contrôle n'éprouverait rien.");

      await assert.rejects(
        connexion.query("UPDATE envois_devis SET precision_client = NULL WHERE id = $1", [envoi.id]),
        /envois_devis_correction_motivee_ck/,
        "La contrainte de base ne protège plus contre une correction muette."
      );
    } finally {
      await connexion.query("ROLLBACK").catch(() => {});
      connexion.release();
    }
  });

  console.log(`\n${reussis} test(s) réussi(s), ${echoues} échoué(s).`);
  await pool.end();
  if (echoues > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

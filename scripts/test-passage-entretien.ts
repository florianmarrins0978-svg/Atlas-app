import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { creerClient, mettreAJourClient } from "../src/server/repositories/clients";
import {
  ajouterPrestation,
  listerPrestations,
  poserModeleFourni,
  retirerPrestation,
  renommerPrestation,
} from "../src/server/repositories/prestations-entretien";
import {
  brouillonVierge,
  cocherLigne,
  figerPassage,
  lirePassage,
  lireRapportParJeton,
  majPassage,
  nommerClient,
  ouvrirPassage,
  supprimerPassage,
} from "../src/server/repositories/passages-entretien";
import {
  MINUTES_MAX,
  empechementEnvoi,
  libelleMinutes,
  minutesValides,
  cocherCommeLaDerniereFois,
  constatDesCoches,
} from "../src/lib/passage-entretien";

// Le PASSAGE d'entretien — la fiche qu'il coche sur un chantier.
//
// **Ce qui est éprouvé ici, et pourquoi ces cas-là plutôt que d'autres :**
//
//   1. **L'INVARIANT DU 16 AOÛT** — un rapport parti chez un client ne change
//      plus jamais, quoi qu'il advienne du modèle. C'est le seul défaut de
//      cette liste qui ne se rattrape pas : il se découvre le jour où un client
//      conteste un passage, et le rapport ne dit plus ce qu'il disait.
//   2. **Nommer le client** — sa règle du 22 septembre 2026 : la fiche recoche
//      ce que son dernier rapport portait, sans retirer une ligne ni perdre une
//      coche du jour.
//   3. **L'isolation** — c'est ce dont un défaut ne se voit jamais à l'écran.
//   4. Les refus se RENDENT, ils ne lèvent pas : l'exception d'une action
//      serveur n'arrive jamais jusqu'au patron (`HANDOVER.md`, piège 0 ter).

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void> | void) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

async function contexte(suffixe: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Atelier ${suffixe}` },
    { email: `passage-${suffixe}-${Date.now()}-${Math.random().toString(36).slice(2)}@atlas.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Une fiche minuscule, pour que les cas se lisent : quatre lignes nommées. */
async function petitModele(ctx: { utilisateurId: string; entrepriseId: string }) {
  for (const libelle of ["Tonte", "Haies", "Massifs", "Feuilles"]) {
    const r = await ajouterPrestation(ctx, { famille: "Entretien", libelle });
    assert.equal(r.ok, true, `le petit modèle n'a pas pu poser « ${libelle} »`);
  }
}

/**
 * Compte les lignes d'une fiche **en base**, hors du dépôt.
 *
 * **Le contexte d'entreprise se pose ici, et c'est tout l'intérêt du geste.**
 * Une requête nue sur `lignes_passage` rend zéro quoi qu'il arrive — la RLS est
 * FORCÉE, y compris pour le propriétaire. Un contrôle écrit ainsi mesurerait
 * zéro avant comme après une suppression, et rendrait un vert qui ne prouve
 * rien : c'est exactement la faute payée le 15 août 2026.
 */
async function compterLignes(entrepriseId: string, passageId: string): Promise<number> {
  const client = new Client({
    connectionString: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    await client.query("SELECT set_config('app.entreprise_id', $1, false)", [entrepriseId]);
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM lignes_passage WHERE passage_id = $1",
      [passageId]
    );
    return rows[0].n;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("=== Le passage d'entretien ===");

  await cas("la RLS est armée sur les DEUX tables, pas seulement le filtre du code", async () => {
    // **Sans ce cas, l'isolation plus bas ne prouverait pas ce qu'elle promet.**
    // Les fonctions filtrent déjà sur `entreprise_id` : elles resteraient vertes
    // même si la migration avait oublié la politique. Or c'est la RLS qui
    // protège d'une requête écrite de travers demain.
    for (const table of ["passages_entretien", "lignes_passage"]) {
      const { rows } = await pool.query(
        `select c.relrowsecurity, c.relforcerowsecurity,
                (select count(*) from pg_policies p where p.tablename = $1) as politiques
           from pg_class c where c.relname = $1`,
        [table]
      );
      assert.equal(rows[0]?.relrowsecurity, true, `${table} : ROW LEVEL SECURITY absente`);
      assert.equal(rows[0]?.relforcerowsecurity, true, `${table} : FORCE absente`);
      assert.ok(Number(rows[0]?.politiques) >= 1, `${table} : aucune politique d'isolation`);
    }
  });

  await cas("le temps passé s'écrit comme il se lit, et l'aberrant se refuse", () => {
    assert.equal(libelleMinutes(null), "—");
    assert.equal(libelleMinutes(45), "45 min");
    assert.equal(libelleMinutes(120), "2 h");
    assert.equal(libelleMinutes(100), "1 h 40");
    // Le zéro à gauche : « 1 h 05 », jamais « 1 h 5 ».
    assert.equal(libelleMinutes(65), "1 h 05");

    assert.equal(minutesValides(90), 90);
    // Le cran de la molette : cinq minutes.
    assert.equal(minutesValides(92), 90);
    assert.equal(minutesValides(93), 95);
    assert.equal(minutesValides(MINUTES_MAX), MINUTES_MAX);
    // Au-delà d'une journée, c'est une faute de frappe, pas du travail.
    assert.equal(minutesValides(MINUTES_MAX + 1), null);
    assert.equal(minutesValides(-5), null);
    assert.equal(minutesValides(undefined), null);
  });

  await cas("nommer le client recoche son dernier passage, et ne retire AUCUNE ligne", () => {
    // **Sa règle du 22 septembre 2026**, qui remplace le repli du 17 août :
    // *« ce qui a déjà été coché par le passé se recoche automatiquement, mais
    // les 20 points qui composent ma fiche doivent être présents ! Car si j'ai
    // fait quelque chose en plus ce jour, je le coche »*.
    const actuelles = [
      { famille: "E", libelle: "Tonte", ordre: 10, faite: false },
      { famille: "E", libelle: "Haies", ordre: 20, faite: false },
      { famille: "E", libelle: "Massifs", ordre: 30, faite: true },
      { famille: "E", libelle: "Feuilles", ordre: 40, faite: false },
    ];
    const lignes = cocherCommeLaDerniereFois(actuelles, [{ libelle: "Tonte" }, { libelle: "Haies" }]);

    // Toutes les lignes restent, dans l'ordre de l'écran.
    assert.deepEqual(lignes.map((l) => l.libelle), ["Tonte", "Haies", "Massifs", "Feuilles"]);
    // Ce qu'il a coché la dernière fois se recoche ; ce qu'il vient de cocher reste.
    assert.deepEqual(lignes.map((l) => l.faite), [true, true, true, false]);
  });

  await cas("la phrase compte les cases COCHÉES, pas celles reprises une fois", () => {
    // **Sa capture du 24 septembre 2026** : *« y'a marqué 5 prestations cochées,
    // celles du dernier chantier, alors qu'il y en a 8 de cochées »*. Le
    // chiffre était compté UNE fois, au moment de nommer le client, puis ne
    // bougeait plus : ni ce qui était coché avant, ni ce qui l'était après.
    const l = (id: string, faite: boolean) => ({ id, faite });
    const reprises = new Set(["a", "b"]);
    // Juste après la reprise : les cases cochées sont exactement celles reprises.
    assert.equal(
      constatDesCoches([l("a", true), l("b", true), l("c", false)], reprises),
      "2 prestations cochées, celles du dernier chantier."
    );
    // Il coche une case de plus : le chiffre suit, et la reprise ne se prétend plus.
    assert.equal(
      constatDesCoches([l("a", true), l("b", true), l("c", true)], reprises),
      "3 prestations cochées."
    );
    // Une case cochée AVANT de nommer le client compte aussi.
    assert.equal(constatDesCoches([l("a", true), l("c", true)], new Set(["a"])), "2 prestations cochées.");
    assert.equal(constatDesCoches([l("a", true)], new Set(["a"])), "1 prestation cochée, celle du dernier chantier.");
    // Rien de coché, ou aucun client nommé sur cet écran : rien à dire.
    assert.equal(constatDesCoches([l("a", false)], reprises), null);
    assert.equal(constatDesCoches([l("a", true)], null), null);
    // Premier passage chez lui : rien n'a été repris, la phrase ne se pose pas.
    assert.equal(constatDesCoches([l("a", true)], new Set()), null);
  });

  await cas("CHANGER de client décoche tout ce qui venait du premier", () => {
    // **Sa règle du 24 septembre 2026** : *« les cases doivent se décocher,
    // car seules les cases du nouveau client doivent apparaître »*.
    const actuelles = [
      { famille: "E", libelle: "Tonte", ordre: 10, faite: true },
      { famille: "E", libelle: "Haies", ordre: 20, faite: true },
      { famille: "E", libelle: "Massifs", ordre: 30, faite: false },
    ];
    const lignes = cocherCommeLaDerniereFois(actuelles, [{ libelle: "Massifs" }], { changeDeClient: true });
    assert.deepEqual(lignes.map((l) => l.faite), [false, false, true]);
    // Au PREMIER client nommé, ce qu'il a coché à la main reste.
    const premier = cocherCommeLaDerniereFois(actuelles, [{ libelle: "Massifs" }]);
    assert.deepEqual(premier.map((l) => l.faite), [true, true, true]);
  });

  await cas("premier passage chez un client : rien ne se coche tout seul", () => {
    const actuelles = [
      { famille: "E", libelle: "Tonte", ordre: 10, faite: false },
      { famille: "E", libelle: "Haies", ordre: 20, faite: false },
    ];
    assert.deepEqual(cocherCommeLaDerniereFois(actuelles, []), actuelles);
  });

  await cas("la comparaison des libellés reste indulgente entre deux passages", () => {
    // Le libellé a été renommé « tonte » en minuscules dans les Réglages entre
    // deux passages : c'est le même geste, il se recoche.
    const lignes = cocherCommeLaDerniereFois(
      [{ famille: "E", libelle: "tonte", ordre: 10, faite: false }],
      [{ libelle: "Tonte" }]
    );
    assert.equal(lignes[0].faite, true);
  });

  await cas("le bouton d'envoi éteint DIT pourquoi", () => {
    const lignes = [{ famille: "E", libelle: "Tonte", ordre: 10, faite: false }];
    assert.match(
      empechementEnvoi({ clientId: null, lignes, envoyeLe: null }) ?? "",
      /client/i,
      "sans client, l'écran ne dit pas qu'il manque le client"
    );
    assert.match(
      empechementEnvoi({ clientId: "c", lignes, envoyeLe: null }) ?? "",
      /coche/i,
      "sans une seule coche, l'écran ne dit pas ce qui manque"
    );
    assert.equal(
      empechementEnvoi({
        clientId: "c",
        lignes: [{ ...lignes[0], faite: true }],
        envoyeLe: null,
      }),
      null
    );
    assert.match(
      empechementEnvoi({
        clientId: "c",
        lignes: [{ ...lignes[0], faite: true }],
        envoyeLe: new Date(),
      }) ?? "",
      /déjà parti/i
    );

    // **Un canal sans coordonnée ouvrirait un message SANS destinataire**, et il
    // ne le découvrirait que dans Messages — trop tard. Le bouton s'éteint et
    // nomme l'autre canal, plutôt que de laisser partir un envoi borgne.
    const prete = { clientId: "c", lignes: [{ ...lignes[0], faite: true }], envoyeLe: null };
    assert.match(
      empechementEnvoi({ ...prete, canal: "sms", telephone: null, email: "a@b.c" }) ?? "",
      /téléphone/i
    );
    assert.match(
      empechementEnvoi({ ...prete, canal: "email", telephone: "0612345678", email: "  " }) ?? "",
      /e-mail/i
    );
    // Et le canal qui a sa coordonnée passe.
    assert.equal(
      empechementEnvoi({ ...prete, canal: "sms", telephone: "0612345678", email: null }),
      null
    );
  });

  await cas("une fiche s'ouvre COPIÉE du modèle, et refuse si le modèle est vide", async () => {
    const ctx = await contexte("ouverture");
    // Le modèle est vide : ouvrir donnerait un écran blanc dont il ne saurait
    // rien faire. Le refus le dit, plutôt que de laisser passer.
    assert.deepEqual(await ouvrirPassage(ctx, "2026-08-18"), {
      ok: false,
      refus: "modele_vide",
    });

    assert.equal((await poserModeleFourni(ctx)).ok, true);
    const modele = await listerPrestations(ctx);
    const ouverte = await ouvrirPassage(ctx, "2026-08-18");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    const passage = await lirePassage(ctx, ouverte.id);
    assert.ok(passage, "la fiche ouverte est introuvable");
    assert.equal(passage!.lignes.length, modele.length, "la copie n'a pas tout repris");
    assert.equal(passage!.clientId, null, "la fiche s'ouvre SANS client (décision du 17 août)");
    assert.deepEqual(
      passage!.lignes.map((l) => l.libelle),
      modele.map((p) => p.libelle),
      "l'ordre du modèle n'est pas celui de la fiche"
    );
    assert.equal(passage!.lignes.every((l) => !l.faite), true, "une ligne arrive déjà cochée");
  });

  await cas("UN RAPPORT PARTI NE CHANGE PLUS, quoi qu'il advienne du modèle", async () => {
    // **L'invariant du 16 août, et le seul de cette liste qui ne se rattrape
    // pas.** Il se découvrirait le jour où un client conteste un passage — et
    // le rapport ne dirait plus ce qu'il disait quand il est parti.
    const ctx = await contexte("fige");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Bernard" });

    const ouverte = await ouvrirPassage(ctx, "2026-07-02");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;
    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);

    const avant = await lirePassage(ctx, ouverte.id);
    const tonte = avant!.lignes.find((l) => l.libelle === "Tonte")!;
    assert.equal((await cocherLigne(ctx, ouverte.id, tonte.id, true)).ok, true);
    const fige = await figerPassage(ctx, ouverte.id);
    assert.equal(fige.ok, true, "l'envoi a été refusé alors que tout était en place");

    const partiLe = await lirePassage(ctx, ouverte.id);
    const libellesPartis = partiLe!.lignes.map((l) => l.libelle);

    // On saccage le modèle APRÈS l'envoi : on retire une prestation, on en
    // renomme une autre. Le rapport de juillet ne doit pas bouger d'un mot.
    const modele = await listerPrestations(ctx);
    assert.equal((await retirerPrestation(ctx, modele[0].id)).ok, true);
    assert.equal((await renommerPrestation(ctx, modele[1].id, "Haies TOTALEMENT AUTRE")).ok, true);

    const apres = await lirePassage(ctx, ouverte.id);
    assert.deepEqual(
      apres!.lignes.map((l) => l.libelle),
      libellesPartis,
      "toucher au modèle a réécrit un rapport déjà parti chez un client"
    );
    assert.equal(
      apres!.lignes.find((l) => l.libelle === "Tonte")?.faite,
      true,
      "la coche d'un rapport parti a disparu"
    );
  });

  await cas("un rapport parti ne se modifie plus, et le refus le dit", async () => {
    const ctx = await contexte("verrou");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Martin" });
    const ouverte = await ouvrirPassage(ctx, "2026-07-03");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;
    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
    const lue = await lirePassage(ctx, ouverte.id);
    const uneLigne = lue!.lignes[0];
    assert.equal((await cocherLigne(ctx, ouverte.id, uneLigne.id, true)).ok, true);
    assert.equal((await figerPassage(ctx, ouverte.id)).ok, true);

    assert.deepEqual(await cocherLigne(ctx, ouverte.id, uneLigne.id, false), {
      ok: false,
      refus: "deja_envoye",
    });
    assert.deepEqual(await majPassage(ctx, ouverte.id, { minutes: 60 }), {
      ok: false,
      refus: "deja_envoye",
    });
    assert.deepEqual(await nommerClient(ctx, ouverte.id, client.id), {
      ok: false,
      refus: "deja_envoye",
    });
    // Et il ne part pas deux fois : le second envoi rend une PHRASE, pas un code.
    const second = await figerPassage(ctx, ouverte.id);
    assert.equal(second.ok, false);
    if (!second.ok) assert.match(second.phrase, /déjà parti/i);
  });

  await cas("l'empreinte porte le CONTENU : la même fiche, la même empreinte", async () => {
    const ctx = await contexte("empreinte");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Durand" });

    const empreintes: string[] = [];
    for (const jour of ["2026-07-10", "2026-07-10"]) {
      const ouverte = await ouvrirPassage(ctx, jour);
      assert.equal(ouverte.ok, true);
      if (!ouverte.ok) return;
      // Le client n'est nommé qu'à la fin : sinon le second passage se
      // replierait sur le premier et n'aurait plus les mêmes lignes.
      const lue = await lirePassage(ctx, ouverte.id);
      const tonte = lue!.lignes.find((l) => l.libelle === "Tonte")!;
      assert.equal((await cocherLigne(ctx, ouverte.id, tonte.id, true)).ok, true);
      assert.equal((await majPassage(ctx, ouverte.id, { minutes: 90 })).ok, true);
      assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
      const fige = await figerPassage(ctx, ouverte.id);
      assert.equal(fige.ok, true);
      if (fige.ok) empreintes.push(fige.empreinte);
    }
    assert.equal(empreintes[0], empreintes[1], "un contenu identique donne deux empreintes");
    assert.equal(empreintes[0].length, 64, "l'empreinte n'est pas un SHA-256");
  });

  await cas("le passage suivant chez le même client recoche son DERNIER passage", async () => {
    // Sa règle du 22 septembre 2026 : ce qui a été coché la dernière fois se
    // recoche, et toute la fiche reste là pour ce qu'il fait en plus.
    const ctx = await contexte("pont");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Lefèvre" });

    async function envoyer(jour: string, cochees: string[]) {
      const p = await ouvrirPassage(ctx, jour);
      assert.equal(p.ok, true);
      if (!p.ok) throw new Error("ouverture refusée");
      assert.equal((await nommerClient(ctx, p.id, client.id)).ok, true);
      const lu = await lirePassage(ctx, p.id);
      for (const l of lu!.lignes) {
        assert.equal((await cocherLigne(ctx, p.id, l.id, cochees.includes(l.libelle))).ok, true);
      }
      assert.equal((await figerPassage(ctx, p.id)).ok, true);
    }
    await envoyer("2026-06-01", ["Tonte", "Haies"]);
    await envoyer("2026-06-15", ["Tonte"]);

    const suivant = await ouvrirPassage(ctx, "2026-07-01");
    assert.equal(suivant.ok, true);
    if (!suivant.ok) return;
    const nu = await lirePassage(ctx, suivant.id);
    // Il coche « Feuilles » AVANT de nommer le client : nommer ne doit pas l'effacer.
    const feuilles = nu!.lignes.find((l) => l.libelle === "Feuilles")!;
    assert.equal((await cocherLigne(ctx, suivant.id, feuilles.id, true)).ok, true);

    const r = await nommerClient(ctx, suivant.id, client.id);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.reprises.length, 1, "le compte des lignes recochées est faux");
      // Feuilles, cochée avant, compte dans la phrase : 2, et pas « celles du
      // dernier chantier », puisque Feuilles n'en vient pas.
      assert.equal(constatDesCoches(r.lignes, new Set(r.reprises)), "2 prestations cochées.");
    }
    const lu = await lirePassage(ctx, suivant.id);
    assert.equal(lu!.lignes.length, 4, "une ligne de la fiche a disparu en nommant le client");
    assert.deepEqual(
      lu!.lignes.filter((l) => l.faite).map((l) => l.libelle).sort(),
      ["Feuilles", "Tonte"],
      "ce n'est pas le DERNIER passage qui a été recoché, ou le geste du jour s'est perdu"
    );
  });

  await cas("un brouillon abandonné ne dicte rien au passage suivant", async () => {
    // Seul un passage ENVOYÉ fait foi : une fiche ouverte par erreur puis
    // laissée en plan ne doit rien cocher à sa place.
    const ctx = await contexte("brouillon");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Petit" });

    const abandonne = await ouvrirPassage(ctx, "2026-06-20");
    assert.equal(abandonne.ok, true);
    if (!abandonne.ok) return;
    assert.equal((await nommerClient(ctx, abandonne.id, client.id)).ok, true);
    const luA = await lirePassage(ctx, abandonne.id);
    assert.equal((await cocherLigne(ctx, abandonne.id, luA!.lignes[0].id, true)).ok, true);

    const suivant = await ouvrirPassage(ctx, "2026-06-21");
    assert.equal(suivant.ok, true);
    if (!suivant.ok) return;
    assert.equal((await nommerClient(ctx, suivant.id, client.id)).ok, true);
    const lu = await lirePassage(ctx, suivant.id);
    assert.equal(lu!.lignes.length, 4);
    assert.equal(lu!.lignes.some((l) => l.faite), false, "un brouillon a coché le passage suivant");
  });

  await cas("une durée aberrante se REFUSE, elle ne se corrige pas en silence", async () => {
    const ctx = await contexte("duree");
    await petitModele(ctx);
    const ouverte = await ouvrirPassage(ctx, "2026-08-01");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    assert.deepEqual(await majPassage(ctx, ouverte.id, { minutes: 5000 }), {
      ok: false,
      refus: "duree_invalide",
    });
    assert.equal((await majPassage(ctx, ouverte.id, { minutes: 92 })).ok, true);
    assert.equal((await lirePassage(ctx, ouverte.id))!.minutes, 90, "le cran de 5 min a sauté");
    // Effacer la durée reste permis : il peut se raviser.
    assert.equal((await majPassage(ctx, ouverte.id, { minutes: null })).ok, true);
    assert.equal((await lirePassage(ctx, ouverte.id))!.minutes, null);
  });

  await cas("le jour se change DANS la fiche, tant qu'elle n'est pas partie", async () => {
    // **Sa demande du 24 septembre 2026** : *« le jeudi 24 septembre doit
    // apparaître lorsque je clique sur Créer une fiche, dans la création, pas
    // en dehors »*. La fiche s'ouvre sur le jour même ; il le change dedans.
    const ctx = await contexte("jour");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Faucher" });
    const ouverte = await ouvrirPassage(ctx, "2026-09-24");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    assert.equal((await majPassage(ctx, ouverte.id, { jour: "2026-09-23" })).ok, true);
    assert.equal((await lirePassage(ctx, ouverte.id))!.jour, "2026-09-23", "le jour n'a pas changé");
    // Le 31 février s'écrit sur dix caractères : il se refuse quand même.
    assert.deepEqual(await majPassage(ctx, ouverte.id, { jour: "2026-02-31" }), {
      ok: false,
      refus: "jour_invalide",
    });
    assert.equal((await lirePassage(ctx, ouverte.id))!.jour, "2026-09-23");

    // Parti chez le client, le jour ne bouge plus : c'est la date qu'il a lue.
    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
    const lue = await lirePassage(ctx, ouverte.id);
    assert.equal((await cocherLigne(ctx, ouverte.id, lue!.lignes[0].id, true)).ok, true);
    assert.equal((await figerPassage(ctx, ouverte.id)).ok, true);
    assert.deepEqual(await majPassage(ctx, ouverte.id, { jour: "2026-09-22" }), {
      ok: false,
      refus: "deja_envoye",
    });
  });

  await cas("une entreprise ne voit ni ne touche le passage d'une autre", async () => {
    const ctxA = await contexte("isole-a");
    const ctxB = await contexte("isole-b");
    await petitModele(ctxA);
    await petitModele(ctxB);
    const clientB = await creerClient(ctxB, { nom: "Client de B" });

    const chezA = await ouvrirPassage(ctxA, "2026-08-05");
    assert.equal(chezA.ok, true);
    if (!chezA.ok) return;
    const lueA = await lirePassage(ctxA, chezA.id);
    const ligneA = lueA!.lignes[0];

    // Viser la fiche de A depuis B, par son identifiant, ne doit RIEN donner.
    assert.equal(await lirePassage(ctxB, chezA.id), null, "B lit la fiche de A");
    assert.deepEqual(await cocherLigne(ctxB, chezA.id, ligneA.id, true), {
      ok: false,
      refus: "introuvable",
    });
    assert.deepEqual(await majPassage(ctxB, chezA.id, { observations: "volé" }), {
      ok: false,
      refus: "introuvable",
    });
    assert.deepEqual(await nommerClient(ctxB, chezA.id, clientB.id), {
      ok: false,
      refus: "introuvable",
    });

    // Et la fiche de A est intacte.
    const relueA = await lirePassage(ctxA, chezA.id);
    assert.equal(relueA!.lignes.find((l) => l.id === ligneA.id)?.faite, false);
    assert.equal(relueA!.observations, null);
    assert.equal(relueA!.clientId, null);
  });

  await cas("un client d'une AUTRE entreprise ne peut pas être nommé", async () => {
    const ctxA = await contexte("client-a");
    const ctxB = await contexte("client-b");
    await petitModele(ctxA);
    const clientB = await creerClient(ctxB, { nom: "Client de B" });
    const chezA = await ouvrirPassage(ctxA, "2026-08-06");
    assert.equal(chezA.ok, true);
    if (!chezA.ok) return;
    assert.deepEqual(await nommerClient(ctxA, chezA.id, clientB.id), {
      ok: false,
      refus: "client_inconnu",
    });
  });

  await cas("deux jardins dans la même journée font DEUX fiches", async () => {
    // **Le défaut que la première version aurait produit chez lui.** Elle
    // rendait « le brouillon du jour », quel qu'il soit — or il fait quatre ou
    // cinq jardins dans une journée. Au deuxième, l'écran lui aurait rendu la
    // fiche du premier, client nommé et cases cochées : il aurait envoyé chez
    // Martin ce qu'il a fait chez Durand.
    const ctx = await contexte("deux-jardins");
    await petitModele(ctx);
    const durand = await creerClient(ctx, { nom: "Durand" });

    const premier = await ouvrirPassage(ctx, "2026-08-20");
    assert.equal(premier.ok, true);
    if (!premier.ok) return;

    // Une fiche NEUVE du même jour se reprend : deux appuis sur « Ouvrir » ne
    // doivent pas empiler deux fiches vides.
    assert.equal(
      await brouillonVierge(ctx, "2026-08-20"),
      premier.id,
      "une fiche vierge du jour ne se reprend pas"
    );

    // Dès qu'on la touche, elle appartient à son chantier.
    assert.equal((await nommerClient(ctx, premier.id, durand.id)).ok, true);
    assert.equal(
      await brouillonVierge(ctx, "2026-08-20"),
      null,
      "la fiche du premier jardin serait rendue au second"
    );

    // Et cocher suffit aussi, même sans client nommé.
    const second = await ouvrirPassage(ctx, "2026-08-20");
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const lue = await lirePassage(ctx, second.id);
    assert.equal((await cocherLigne(ctx, second.id, lue!.lignes[0].id, true)).ok, true);
    assert.equal(
      await brouillonVierge(ctx, "2026-08-20"),
      null,
      "une fiche déjà cochée serait rendue au jardin suivant"
    );
  });

  await cas("le rapport se lit par son jeton, et ne montre QUE ce qui a été fait", async () => {
    // **Sa décision du 16 août, « B »** : le client lit ce qui a été fait chez
    // lui, pas la liste de ce qui ne l'a pas été. Le tri se fait en base, donc
    // ce qui n'est pas fait n'atteint même pas le HTML de sa page.
    const ctx = await contexte("public");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Rousseau" });
    const ouverte = await ouvrirPassage(ctx, "2026-08-12");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    const lue = await lirePassage(ctx, ouverte.id);
    // Un brouillon n'a pas d'adresse publique : lui en donner une ferait fuir
    // une fiche en cours de saisie.
    assert.equal(lue!.jeton, null, "un brouillon porte déjà un jeton");

    const tonte = lue!.lignes.find((l) => l.libelle === "Tonte")!;
    assert.equal((await cocherLigne(ctx, ouverte.id, tonte.id, true)).ok, true);
    assert.equal((await majPassage(ctx, ouverte.id, { minutes: 105 })).ok, true);
    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
    const fige = await figerPassage(ctx, ouverte.id);
    assert.equal(fige.ok, true);
    if (!fige.ok) return;

    const rapport = await lireRapportParJeton(fige.jeton);
    assert.ok(rapport, "le rapport n'est pas lisible par son propre jeton");
    assert.deepEqual(rapport!.faites.map((l) => l.libelle), ["Tonte"]);
    assert.equal(rapport!.minutes, 105);
    assert.equal(rapport!.clientNom, "Rousseau");
    assert.equal(rapport!.entrepriseNom.startsWith("Atelier"), true);

    // **Renommer le client APRÈS l'envoi ne réécrit pas son rapport.** Le nom
    // est parti avec lui : le relire à chaque ouverture le ferait changer sous
    // les yeux de celui qui l'a reçu.
    assert.ok(await mettreAJourClient(ctx, client.id, { nom: "Rousseau et Fils" }));
    const relu = await lireRapportParJeton(fige.jeton);
    assert.equal(relu!.clientNom, "Rousseau", "le rapport a suivi le renommage du client");
  });

  await cas("le temps MASQUÉ ne quitte pas le serveur, et reste enregistré", async () => {
    // Sa demande du 22 août 2026, planche 92 : *« un petit bouton on/off pour
    // si l'utilisateur ne veut pas que le temps apparaisse sur la fiche ».*
    //
    // **Ce que ce cas défend, et qu'aucun autre ne voit :** masquer n'est pas
    // effacer. Le patron garde son chiffre — il lui dit ce qu'a coûté un
    // chantier —, et c'est la LECTURE PUBLIQUE qui le tait. Si un jour
    // quelqu'un « simplifiait » en remettant `minutes` à NULL pour masquer, ce
    // cas rougirait, et c'est tout son intérêt.
    const ctx = await contexte("temps-masque");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Bertin", telephone: "0600000000" });
    const ouverte = await ouvrirPassage(ctx, "2026-08-23");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    const lue = await lirePassage(ctx, ouverte.id);
    assert.equal(lue!.tempsVisible, true, "une fiche neuve part masquée");
    assert.equal((await cocherLigne(ctx, ouverte.id, lue!.lignes[0].id, true)).ok, true);
    assert.equal((await majPassage(ctx, ouverte.id, { minutes: 100 })).ok, true);
    assert.equal((await majPassage(ctx, ouverte.id, { tempsVisible: false })).ok, true);

    // La durée est TOUJOURS là, côté patron.
    const relue = await lirePassage(ctx, ouverte.id);
    assert.equal(relue!.minutes, 100, "masquer a effacé la durée du patron");
    assert.equal(relue!.tempsVisible, false);

    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
    const fige = await figerPassage(ctx, ouverte.id);
    assert.equal(fige.ok, true);
    if (!fige.ok) return;

    const rapport = await lireRapportParJeton(fige.jeton);
    assert.equal(rapport!.minutes, null, "le temps masqué arrive quand même au client");
    assert.deepEqual(rapport!.faites.map((l) => l.libelle), ["Tonte"]);
  });

  await cas("l'empreinte scelle ce que le client A LU, pas la durée cachée", async () => {
    // **Deux passages identiques, l'un montrant son temps et l'autre le
    // masquant, ne peuvent pas porter la même empreinte** : elle prouve ce que
    // le client a reçu. Y sceller un chiffre absent de sa page la rendrait
    // indéfendable le jour où il conteste le passage.
    async function empreinteDe(nom: string, visible: boolean) {
      const ctx = await contexte(nom);
      await petitModele(ctx);
      const client = await creerClient(ctx, { nom: "Bertin", telephone: "0600000000" });
      const ouverte = await ouvrirPassage(ctx, "2026-08-23");
      if (!ouverte.ok) throw new Error("fiche non ouverte");
      const lue = await lirePassage(ctx, ouverte.id);
      await cocherLigne(ctx, ouverte.id, lue!.lignes[0].id, true);
      await majPassage(ctx, ouverte.id, { minutes: 100, tempsVisible: visible });
      await nommerClient(ctx, ouverte.id, client.id);
      const fige = await figerPassage(ctx, ouverte.id);
      if (!fige.ok) throw new Error("fiche non figée");
      return fige.empreinte;
    }

    const montre = await empreinteDe("empreinte-montre", true);
    const masque = await empreinteDe("empreinte-masque", false);
    assert.notEqual(masque, montre, "le temps masqué est scellé comme s'il avait été lu");
  });

  await cas("une fiche EN COURS se supprime, ses lignes avec elle", async () => {
    // **Sa demande du 24 août 2026** : *« Je ne peux pas supprimer les fiches en
    // cours. Il faut pouvoir les supprimer. »*
    const ctx = await contexte("supprimer");
    await petitModele(ctx);
    const ouverte = await ouvrirPassage(ctx, "2026-08-24");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    assert.equal(
      await compterLignes(ctx.entrepriseId, ouverte.id),
      4,
      "la fiche neuve n'a pas ses quatre lignes — ce cas ne mesurerait plus rien"
    );

    assert.equal((await supprimerPassage(ctx, ouverte.id)).ok, true);
    assert.equal(await lirePassage(ctx, ouverte.id), null, "la fiche est encore lisible");

    // **Les lignes ne survivent pas à leur fiche.** Le compte se fait sous
    // contexte, sinon il vaudrait zéro même avec vingt lignes en place (voir
    // `compterLignes`) — et le quatre vérifié juste au-dessus est ce qui prouve
    // que ce contrôle sait, lui, mesurer autre chose que zéro.
    assert.equal(
      await compterLignes(ctx.entrepriseId, ouverte.id),
      0,
      "des lignes survivent à leur fiche"
    );

    // Supprimer deux fois n'efface pas autre chose : le second appel refuse.
    const encore = await supprimerPassage(ctx, ouverte.id);
    assert.equal(encore.ok, false);
    if (!encore.ok) assert.equal(encore.refus, "introuvable");
  });

  await cas("UN RAPPORT PARTI NE SE SUPPRIME PAS, et le refus le dit", async () => {
    // **Le cœur du lot du 24 août.** Son lien vit chez le client, dans un SMS
    // qu'il a peut-être gardé : effacer la fiche changerait cette adresse en
    // page morte, sans que personne ne l'ait voulu ni ne puisse le savoir.
    const ctx = await contexte("supprimer-parti");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Lemoine" });
    const ouverte = await ouvrirPassage(ctx, "2026-08-24");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;
    const lue = await lirePassage(ctx, ouverte.id);
    assert.equal((await cocherLigne(ctx, ouverte.id, lue!.lignes[0].id, true)).ok, true);
    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
    const fige = await figerPassage(ctx, ouverte.id);
    assert.equal(fige.ok, true);
    if (!fige.ok) return;

    const refuse = await supprimerPassage(ctx, ouverte.id);
    assert.equal(refuse.ok, false, "un rapport envoyé a été supprimé");
    if (!refuse.ok) assert.equal(refuse.refus, "deja_envoye");

    // Et la page du client répond toujours : c'est ce que le refus protège.
    assert.notEqual(await lireRapportParJeton(fige.jeton), null, "le lien du client est mort");
  });

  await cas("ISOLATION : B ne supprime pas la fiche de A", async () => {
    const a = await contexte("supprimer-a");
    const b = await contexte("supprimer-b");
    await petitModele(a);
    const ouverte = await ouvrirPassage(a, "2026-08-24");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;

    const vole = await supprimerPassage(b, ouverte.id);
    assert.equal(vole.ok, false, "B a supprimé la fiche de A");
    if (!vole.ok) assert.equal(vole.refus, "introuvable");
    assert.notEqual(await lirePassage(a, ouverte.id), null, "la fiche de A a disparu");
  });

  await cas("sans le jeton exact, la page publique ne rend RIEN", async () => {
    // C'est la politique de la base qui filtre, pas ce code (migration 0055).
    // Le cas doit donc savoir échouer si la politique disparaissait.
    const ctx = await contexte("jeton-faux");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Girard" });
    const ouverte = await ouvrirPassage(ctx, "2026-08-13");
    assert.equal(ouverte.ok, true);
    if (!ouverte.ok) return;
    const lue = await lirePassage(ctx, ouverte.id);
    assert.equal((await cocherLigne(ctx, ouverte.id, lue!.lignes[0].id, true)).ok, true);
    assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
    const fige = await figerPassage(ctx, ouverte.id);
    assert.equal(fige.ok, true);
    if (!fige.ok) return;

    assert.equal(await lireRapportParJeton(""), null, "un jeton vide ouvre un rapport");
    assert.equal(
      await lireRapportParJeton(`${fige.jeton}x`),
      null,
      "un jeton approchant ouvre un rapport"
    );
    assert.equal(
      await lireRapportParJeton(randomBytes(32).toString("base64url")),
      null,
      "un jeton inventé ouvre un rapport"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Passage d'entretien — ${echecs} échec(s).`);
  await pool.end();
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});

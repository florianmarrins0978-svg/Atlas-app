import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
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
} from "../src/server/repositories/passages-entretien";
import {
  MINUTES_MAX,
  empechementEnvoi,
  libelleMinutes,
  minutesValides,
  recomposerPourClient,
} from "../src/lib/passage-entretien";

// Le PASSAGE d'entretien — la fiche qu'il coche sur un chantier.
//
// **Ce qui est éprouvé ici, et pourquoi ces cas-là plutôt que d'autres :**
//
//   1. **L'INVARIANT DU 16 AOÛT** — un rapport parti chez un client ne change
//      plus jamais, quoi qu'il advienne du modèle. C'est le seul défaut de
//      cette liste qui ne se rattrape pas : il se découvre le jour où un client
//      conteste un passage, et le rapport ne dit plus ce qu'il disait.
//   2. **L'arrangement C** (17 août) — nommer le client replie la fiche sur ses
//      prestations *sans perdre une seule coche*. Perdre trois coches parce
//      qu'on a nommé le client au milieu serait pire que ne rien pré-remplir.
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

  await cas("nommer le client replie la fiche SANS perdre une coche", () => {
    const actuelles = [
      { famille: "E", libelle: "Tonte", ordre: 10, faite: true },
      { famille: "E", libelle: "Haies", ordre: 20, faite: false },
      { famille: "E", libelle: "Massifs", ordre: 30, faite: true },
      { famille: "E", libelle: "Feuilles", ordre: 40, faite: false },
    ];
    // Ce client n'a jamais pris que la tonte et les haies.
    const gardees = recomposerPourClient(actuelles, [{ libelle: "Tonte" }, { libelle: "Haies" }]);

    // « Massifs » n'est PAS chez ce client — mais il vient de le faire. Une
    // fiche qui efface un geste déjà fait est pire qu'une fiche trop longue.
    assert.deepEqual(
      gardees.map((l) => l.libelle),
      ["Tonte", "Haies", "Massifs"]
    );
    // « Feuilles » tombe : ni coché, ni chez ce client.
    assert.equal(gardees.some((l) => l.libelle === "Feuilles"), false);
    // L'ordre vient de l'écran : la fiche ne se réorganise pas sous ses doigts.
    assert.deepEqual(gardees.map((l) => l.ordre), [10, 20, 30]);
  });

  await cas("un geste saisonnier survit aux passages où il n'a pas lieu", () => {
    // **Le défaut qu'un repli sur le seul dernier passage aurait fabriqué.** La
    // taille de haie d'automne ne se fait qu'une fois l'an : en mars, elle
    // n'était pas sur le passage de février. Elle doit rester proposée, sinon
    // il ne pourra plus la cocher en octobre — et il n'a pas les Réglages sous
    // la main sur un chantier.
    const gardees = recomposerPourClient(
      [
        { famille: "E", libelle: "Tonte", ordre: 10, faite: false },
        { famille: "E", libelle: "Taille de haie automne", ordre: 20, faite: false },
        { famille: "E", libelle: "Massifs", ordre: 30, faite: false },
      ],
      [{ libelle: "Tonte" }, { libelle: "Taille de haie automne" }]
    );
    assert.deepEqual(gardees.map((l) => l.libelle), ["Tonte", "Taille de haie automne"]);
  });

  await cas("premier passage chez un client : rien ne se replie", () => {
    const actuelles = [
      { famille: "E", libelle: "Tonte", ordre: 10, faite: false },
      { famille: "E", libelle: "Haies", ordre: 20, faite: false },
    ];
    assert.deepEqual(recomposerPourClient(actuelles, []), actuelles);
  });

  await cas("la comparaison des libellés reste indulgente entre deux passages", () => {
    // Le libellé a été renommé « tonte » en minuscules dans les Réglages entre
    // deux passages : c'est le même geste, la ligne doit revenir.
    const gardees = recomposerPourClient(
      [{ famille: "E", libelle: "tonte", ordre: 10, faite: false }],
      [{ libelle: "Tonte" }]
    );
    assert.equal(gardees.length, 1);
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

  await cas("le passage suivant chez le même client reprend SES prestations", async () => {
    // C'est le pont demandé le 17 août : « à partir de cette fiche chantier,
    // faire un pont vers la case client ». Sans ce cas, la fiche repartirait du
    // modèle complet à chaque fois et il retrierait vingt lignes douze fois par an.
    const ctx = await contexte("pont");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Lefèvre" });

    const premier = await ouvrirPassage(ctx, "2026-06-01");
    assert.equal(premier.ok, true);
    if (!premier.ok) return;
    assert.equal((await nommerClient(ctx, premier.id, client.id)).ok, true);
    // Chez lui, on ne fait que la tonte et les haies : c'est ce qu'on coche,
    // et c'est ce que le rapport parti dira qu'il prend.
    const lu1 = await lirePassage(ctx, premier.id);
    for (const l of lu1!.lignes.filter((l) => ["Tonte", "Haies"].includes(l.libelle))) {
      assert.equal((await cocherLigne(ctx, premier.id, l.id, true)).ok, true);
    }
    assert.equal((await figerPassage(ctx, premier.id)).ok, true);

    // Passage suivant : la fiche s'ouvre nue, sur le modèle COMPLET.
    const second = await ouvrirPassage(ctx, "2026-06-15");
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const nu = await lirePassage(ctx, second.id);
    assert.equal(nu!.lignes.length, 4, "la fiche ne s'ouvre pas sur le modèle complet");

    // Il coche « Feuilles » AVANT de nommer le client — un geste qu'il ne fait
    // pas d'habitude chez lui. Nommer le client ne doit pas l'effacer.
    const feuilles = nu!.lignes.find((l) => l.libelle === "Feuilles")!;
    assert.equal((await cocherLigne(ctx, second.id, feuilles.id, true)).ok, true);

    const replie = await nommerClient(ctx, second.id, client.id);
    assert.equal(replie.ok, true);
    const lu2 = await lirePassage(ctx, second.id);
    assert.deepEqual(
      lu2!.lignes.map((l) => l.libelle).sort(),
      ["Feuilles", "Haies", "Tonte"],
      "le repli n'a pas gardé le geste déjà coché, ou n'a pas repris le dernier passage"
    );
    assert.equal(lu2!.clientNom, "Lefèvre");
    assert.equal(
      lu2!.lignes.find((l) => l.libelle === "Feuilles")?.faite,
      true,
      "nommer le client a décoché un geste déjà fait"
    );

    // **Ce qu'on lui a fait une fois entre dans son répertoire.** On envoie ce
    // second rapport, puis on ouvre un troisième passage : « Feuilles » doit
    // revenir tout seul, même décochée cette fois-là.
    assert.equal((await figerPassage(ctx, second.id)).ok, true);
    const troisieme = await ouvrirPassage(ctx, "2026-07-01");
    assert.equal(troisieme.ok, true);
    if (!troisieme.ok) return;
    assert.equal((await nommerClient(ctx, troisieme.id, client.id)).ok, true);
    const lu3 = await lirePassage(ctx, troisieme.id);
    assert.deepEqual(
      lu3!.lignes.map((l) => l.libelle).sort(),
      ["Feuilles", "Haies", "Tonte"],
      "le répertoire du client ne s'est pas enrichi du geste du passage précédent"
    );
    assert.equal(lu3!.lignes.every((l) => !l.faite), true, "une ligne arrive déjà cochée");
  });

  await cas("un brouillon abandonné ne dicte rien au passage suivant", async () => {
    // Seul le dernier passage ENVOYÉ fait foi : une fiche ouverte par erreur
    // puis laissée en plan ne doit pas décider de ce que ce client prend.
    const ctx = await contexte("brouillon");
    await petitModele(ctx);
    const client = await creerClient(ctx, { nom: "Petit" });

    const abandonne = await ouvrirPassage(ctx, "2026-06-20");
    assert.equal(abandonne.ok, true);
    if (!abandonne.ok) return;
    assert.equal((await nommerClient(ctx, abandonne.id, client.id)).ok, true);

    const suivant = await ouvrirPassage(ctx, "2026-06-21");
    assert.equal(suivant.ok, true);
    if (!suivant.ok) return;
    assert.equal((await nommerClient(ctx, suivant.id, client.id)).ok, true);
    const lu = await lirePassage(ctx, suivant.id);
    assert.equal(lu!.lignes.length, 4, "un brouillon a replié la fiche du passage suivant");
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

  await cas("sans le jeton exact, la page publique ne rend RIEN", async () => {
    // C'est la politique de la base qui filtre, pas ce code (migration 0054).
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

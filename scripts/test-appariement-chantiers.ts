import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { sql } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { propositionsPourDemiJournee, situerQuelquesChantiers } from "../src/server/planning/appariement";
import { nettoyerBase } from "./_test-db";

// **L'appariement de deux demi-journées, éprouvé sur la vraie base.**
//
// Pourquoi une suite BASE et pas seulement une suite navigateur : celles-ci
// démarrent leur serveur sous un rôle qui TRAVERSE la RLS (`CLAUDE.md` §5).
// Elles ne verraient donc jamais un défaut d'isolation — or c'est exactement ce
// qui est en jeu ici. Le 8 août 2026, un chemin éprouvé au seul navigateur
// était mort en production ; on ne recommence pas.
//
// Ce que cette suite tient, et que rien d'autre ne tient :
//
//   · **une entreprise ne se voit jamais proposer le chantier d'une autre.**
//     Le planning croiserait alors des adresses de clients entre deux
//     artisans — le pire défaut que ce produit puisse avoir ;
//   · **les coordonnées se rattrapent toutes seules**, y compris après une
//     correction d'adresse, sans que le patron lance quoi que ce soit ;
//   · **une panne d'un service extérieur ne s'écrit pas en base** : sans cela,
//     une coupure réseau condamnerait l'adresse à ne plus jamais être retentée.
//
// Les deux services extérieurs sont remplacés ici par des services montés sur
// place : le mandataire réseau de l'environnement de développement les refuse,
// et la vérification contre les VRAIS est déplacée vers des machines qui ont le
// réseau (`.github/workflows/adresses.yml` et `itineraire.yml`).

let echecs = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

/** Un service qui répond ce qu'on lui dit, sur un port libre. */
function servir(
  repondre: (url: URL, finir: (code: number, corps: string) => void) => void
): Promise<{ base: string; fermer: () => Promise<void>; vues: URL[]; serveur: Server }> {
  const vues: URL[] = [];
  return new Promise((resoudre) => {
    const serveur = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      vues.push(url);
      repondre(url, (code, corps) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(corps);
      });
    });
    serveur.listen(0, "127.0.0.1", () => {
      const port = (serveur.address() as { port: number }).port;
      resoudre({
        base: `http://127.0.0.1:${port}`,
        vues,
        serveur,
        fermer: () => new Promise<void>((r) => serveur.close(() => r())),
      });
    });
  });
}

/** Des places de mairie, jamais une adresse de client. */
const CARTE: Record<string, { lon: number; lat: number }> = {
  "Place de la Mairie, 69630 Chaponost": { lon: 4.7167, lat: 45.7 },
  "Place de la Mairie, 69510 Soucieu-en-Jarrest": { lon: 4.7, lat: 45.6667 },
  "Place de la Mairie, 69690 Brussieu": { lon: 4.5, lat: 45.75 },
  "Place de la Mairie, 29200 Brest": { lon: -4.4861, lat: 48.3904 },
};

/** Le trajet routier : un vol d'oiseau majoré, comme le fait le relief. */
function faussesRoutes(url: URL): string {
  const [lonD, latD] = (url.searchParams.get("start") ?? "0,0").split(",").map(Number);
  const [lonA, latA] = (url.searchParams.get("end") ?? "0,0").split(",").map(Number);
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(latA - latD) / 2) ** 2 +
    Math.cos(rad(latD)) * Math.cos(rad(latA)) * Math.sin(rad(lonA - lonD) / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(h)) * 1.4;
  return JSON.stringify({ distance: km, duration: km * 1.6 });
}

/** Rend le chantier « posable » : un devis parti, une durée d'une demi-journée. */
async function preparer(
  ctx: { utilisateurId: string; entrepriseId: string },
  chantierId: string,
  opts: { dureePrevue?: string; planifie?: string } = {}
) {
  await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    await tx.execute(sql`
      UPDATE chantiers
         SET devis_envoye_at = now(),
             duree_prevue = ${opts.dureePrevue ?? "½ journée"},
             date_planifiee = ${opts.planifie ?? null},
             creneau_debut = ${opts.planifie ? "matin" : null},
             duree_demi_journees = ${opts.planifie ? 1 : null}
       WHERE id = ${chantierId}
    `);
  });
}

async function main() {
  await nettoyerBase();

  const adresses = await servir((url, finir) => {
    const q = url.searchParams.get("q") ?? "";
    const trouve = CARTE[q];
    finir(
      200,
      JSON.stringify({
        type: "FeatureCollection",
        features: trouve
          ? [{ properties: { label: q, context: "69" }, geometry: { coordinates: [trouve.lon, trouve.lat] } }]
          : [],
      })
    );
  });
  const routes = await servir((url, finir) => finir(200, faussesRoutes(url)));
  process.env.ADRESSE_BASE_URL = adresses.base;
  process.env.ITINERAIRE_BASE_URL = routes.base;

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Appariement A" },
    { email: "appariement-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Appariement B" },
    { email: "appariement-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // Chez A : un chantier posé le matin, trois qui attendent une date.
  const enPlace = await chantiersRepo.creerChantier(A, {
    nom: "Abattage",
    adresseChantier: "Place de la Mairie, 69630 Chaponost",
  });
  await preparer(A, enPlace.id, { planifie: "2026-09-10" });

  const proche = await chantiersRepo.creerChantier(A, {
    nom: "Taille de haie",
    adresseChantier: "Place de la Mairie, 69510 Soucieu-en-Jarrest",
  });
  await preparer(A, proche.id);

  const moinsProche = await chantiersRepo.creerChantier(A, {
    nom: "Élagage",
    adresseChantier: "Place de la Mairie, 69690 Brussieu",
  });
  await preparer(A, moinsProche.id);

  const loin = await chantiersRepo.creerChantier(A, {
    nom: "Dessouchage",
    adresseChantier: "Place de la Mairie, 29200 Brest",
  });
  await preparer(A, loin.id);

  const introuvable = await chantiersRepo.creerChantier(A, {
    nom: "Broyage",
    adresseChantier: "derrière l'église",
  });
  await preparer(A, introuvable.id);

  const journeeEntiere = await chantiersRepo.creerChantier(A, {
    nom: "Abattage long",
    adresseChantier: "Place de la Mairie, 69510 Soucieu-en-Jarrest",
  });
  await preparer(A, journeeEntiere.id, { dureePrevue: "2 jours" });

  // Chez B : un chantier tout proche de celui de A — et qui ne doit JAMAIS
  // apparaître dans les propositions de A.
  const chezB = await chantiersRepo.creerChantier(B, {
    nom: "Chantier de la voisine",
    adresseChantier: "Place de la Mairie, 69510 Soucieu-en-Jarrest",
  });
  await preparer(B, chezB.id);

  await test("les chantiers à situer sont ceux dont l'adresse n'a pas encore été convertie", async () => {
    const aFaire = await chantiersRepo.chantiersASituer(A, 50);
    const ids = aFaire.map((c) => c.id).sort();
    assert.deepEqual(
      ids,
      [enPlace.id, proche.id, moinsProche.id, loin.id, introuvable.id, journeeEntiere.id].sort()
    );
  });

  await test("le rattrapage est BORNÉ — sinon trois cents chantiers font trois cents appels", async () => {
    const aFaire = await chantiersRepo.chantiersASituer(A, 2);
    assert.equal(aFaire.length, 2);
  });

  await test("situer pose les coordonnées, et n'y revient pas", async () => {
    // Deux passes de huit couvrent les six chantiers de A.
    await situerQuelquesChantiers(A);
    await situerQuelquesChantiers(A);
    const reste = await chantiersRepo.chantiersASituer(A, 50);
    assert.deepEqual(reste, [], `Encore ${reste.length} chantier(s) à situer après deux passes.`);

    const c = await chantiersRepo.lireChantierSitue(A, proche.id);
    assert.ok(c && c.latitude !== null && c.longitude !== null);
    assert.ok(Math.abs((c.latitude as number) - 45.6667) < 0.001, `latitude lue : ${c.latitude}`);
    assert.ok(Math.abs((c.longitude as number) - 4.7) < 0.001, `longitude lue : ${c.longitude}`);
  });

  await test("une adresse que le service ne reconnaît pas laisse une trace, pas une boucle", async () => {
    // « derrière l'église » ne sera jamais trouvée. Sans trace de l'essai, elle
    // repartirait à chaque ouverture du planning — pour toujours.
    const c = await chantiersRepo.lireChantierSitue(A, introuvable.id);
    assert.ok(c);
    assert.equal(c.latitude, null);
    const aFaire = await chantiersRepo.chantiersASituer(A, 50);
    assert.ok(!aFaire.some((x) => x.id === introuvable.id), "L'adresse introuvable serait resoumise sans fin.");
  });

  await test("seuls les chantiers d'UNE demi-journée sont candidats", async () => {
    const candidats = await chantiersRepo.chantiersDemiJourneeAPlanifier(A);
    const ids = candidats.map((c) => c.id).sort();
    assert.deepEqual(ids, [proche.id, moinsProche.id, loin.id, introuvable.id].sort());
  });

  await test("les propositions sont classées par la route, la plus proche en tête", async () => {
    const r = await propositionsPourDemiJournee(A, enPlace.id);
    assert.deepEqual(
      r.propositions.map((p) => p.nom),
      ["Taille de haie", "Élagage"]
    );
    assert.ok(
      r.propositions.every((p) => p.parLaRoute),
      "Une proposition retombe sur le vol d'oiseau alors que le service répond."
    );
    assert.match(r.propositions[0].phrase, /min de route/);
  });

  await test("ISOLATION : le chantier de l'entreprise voisine n'est jamais proposé", async () => {
    const r = await propositionsPourDemiJournee(A, enPlace.id);
    assert.ok(
      !r.propositions.some((p) => p.chantierId === chezB.id),
      "Le chantier d'une AUTRE entreprise est proposé : les adresses de clients se croisent."
    );
    const candidats = await chantiersRepo.chantiersDemiJourneeAPlanifier(A);
    assert.ok(!candidats.some((c) => c.id === chezB.id));
  });

  await test("ISOLATION : B ne peut pas partir du chantier de A", async () => {
    const r = await propositionsPourDemiJournee(B, enPlace.id);
    assert.equal(r.depart, null, "B lit le chantier de A comme point de départ.");
    assert.deepEqual(r.propositions, []);
  });

  await test("ce qui est trop loin est écarté — et DIT", async () => {
    const r = await propositionsPourDemiJournee(A, enPlace.id);
    assert.equal(r.ecartes.combien, 1, "Brest devrait être le seul écarté.");
    assert.ok((r.ecartes.plusProcheKm ?? 0) > 400, `Brest mesuré à ${r.ecartes.plusProcheKm} km.`);
  });

  await test("« Voir quand même » lève le seuil sans rien changer d'autre", async () => {
    const r = await propositionsPourDemiJournee(A, enPlace.id, true);
    assert.equal(r.ecartes.combien, 0);
    assert.ok(
      r.propositions.some((p) => p.nom === "Dessouchage"),
      "Brest reste caché alors que le seuil est levé."
    );
  });

  await test("un chantier sans adresse reconnue est NOMMÉ, jamais tu", async () => {
    const r = await propositionsPourDemiJournee(A, enPlace.id);
    assert.deepEqual(
      r.sansAdresse.map((c) => c.nom),
      ["Broyage"]
    );
  });

  await test("corriger l'adresse périme les coordonnées et relance le rattrapage", async () => {
    await chantiersRepo.mettreAJourAdresseChantier(A, proche.id, "Place de la Mairie, 69690 Brussieu");
    const aFaire = await chantiersRepo.chantiersASituer(A, 50);
    assert.ok(
      aFaire.some((c) => c.id === proche.id),
      "Les coordonnées de l'ancienne adresse survivent à sa correction — pire que pas de coordonnées."
    );
    await situerQuelquesChantiers(A);
    const c = await chantiersRepo.lireChantierSitue(A, proche.id);
    assert.ok(c && Math.abs((c.latitude as number) - 45.75) < 0.001, `latitude après correction : ${c?.latitude}`);
  });

  await test("le service d'itinéraire en panne : on retombe sur le vol d'oiseau, sans rien perdre", async () => {
    const ancien = process.env.ITINERAIRE_BASE_URL;
    process.env.ITINERAIRE_BASE_URL = "http://127.0.0.1:1";
    try {
      const r = await propositionsPourDemiJournee(A, enPlace.id);
      assert.ok(r.propositions.length >= 2, "Une panne de l'IGN a fait disparaître des propositions.");
      assert.ok(
        r.propositions.every((p) => !p.parLaRoute),
        "Une phrase annonce la route alors que le service est injoignable."
      );
      assert.match(r.propositions[0].phrase, /vol d’oiseau|vol d'oiseau/);
    } finally {
      process.env.ITINERAIRE_BASE_URL = ancien;
    }
  });

  await test("la Base Adresse Nationale en panne : rien ne s'écrit en base", async () => {
    // **Le contrôle qui coûte le plus cher s'il manque.** Marquer
    // `adresse_situee` pendant une coupure condamnerait l'adresse à ne plus
    // jamais être retentée : le chantier resterait « non situé » pour toujours.
    const neuf = await chantiersRepo.creerChantier(A, {
      nom: "Après la coupure",
      adresseChantier: "Place de la Mairie, 69630 Chaponost",
    });
    await preparer(A, neuf.id);

    const ancien = process.env.ADRESSE_BASE_URL;
    process.env.ADRESSE_BASE_URL = "http://127.0.0.1:1";
    try {
      await situerQuelquesChantiers(A);
    } finally {
      process.env.ADRESSE_BASE_URL = ancien;
    }
    const aFaire = await chantiersRepo.chantiersASituer(A, 50);
    assert.ok(
      aFaire.some((c) => c.id === neuf.id),
      "Une coupure réseau a été inscrite comme un échec définitif."
    );

    await situerQuelquesChantiers(A);
    const c = await chantiersRepo.lireChantierSitue(A, neuf.id);
    assert.ok(c && c.latitude !== null, "Le chantier n'a pas été rattrapé une fois le réseau revenu.");
  });

  await test("un chantier de départ sans adresse situable le DIT, avec de quoi corriger", async () => {
    const flou = await chantiersRepo.creerChantier(A, {
      nom: "Chantier flou",
      adresseChantier: "derrière l'église",
    });
    await preparer(A, flou.id, { planifie: "2026-09-11" });
    await situerQuelquesChantiers(A);

    const r = await propositionsPourDemiJournee(A, flou.id);
    assert.ok(r.departNonSitue, "Le point de départ non situé passe pour une absence de candidats.");
    assert.equal(r.departNonSitue?.chantierId, flou.id);
    assert.equal(r.departNonSitue?.adresse, "derrière l'église");
    assert.deepEqual(r.propositions, []);
  });

  await adresses.fermer();
  await routes.fermer();
  await pool.end();

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Appariement sur la base — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});

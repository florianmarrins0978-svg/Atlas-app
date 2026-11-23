import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { lireLeRegistre } from "../src/lib/registre-entreprises";
import { manquesDuDevis, type EmetteurAVerifier } from "../src/lib/mentions-manquantes";
import { demanderAuRegistre } from "../src/server/registre-entreprises";

// ═══════════════════════════════════════════════════════════════════════════
// CE QUE LE REGISTRE DES ENTREPRISES DIT D'UN SIRET (23 novembre 2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa question : *« il n'y a pas moyen de tricher, de taper un numéro au
// pif ? »*, et sa règle : *« il ne faut pas le bloquer ; il ne faut pas non plus
// qu'il puisse créer des comptes gratuits à tire-larigot »*. La forme des
// réponses est celle relevée sur le vrai service le 23 novembre 2026 (La Poste,
// SIREN 356000000, et un SIRET inconnu). Ce que la suite défend :
//   · seul l'établissement au SIRET EXACT compte, siège ou non ;
//   · un établissement fermé n'est pas « trouvé » ;
//   · la diffusion partielle ne publie ni nom ni adresse ;
//   · une forme inattendue est « illisible », jamais « inconnu » ;
//   · un registre qui se tait ou refuse est « injoignable » ;
//   · un SIRET à confirmer arrête le devis, et rien d'autre.

let echecs = 0;
async function cas(nom: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${e instanceof Error ? e.message : e}`);
  }
}

const SIEGE = "35600000000048";
const AUTRE = "35600000012345";
const laPoste = (statutDiffusion = "O", etatAutre = "A") => ({
  results: [
    {
      siren: "356000000",
      nom_complet: "LA POSTE",
      statut_diffusion: statutDiffusion,
      siege: { siret: SIEGE, adresse: "9 RUE DU COLONEL PIERRE AVIA 75015 PARIS", etat_administratif: "A", est_siege: true },
      matching_etablissements: [{ siret: AUTRE, adresse: "1 PLACE DE LA GARE 44000 NANTES", etat_administratif: etatAutre }],
    },
  ],
  total_results: 1,
  page: 1,
  per_page: 1,
  total_pages: 1,
});
const VIDE = { results: [], total_results: 0, page: 1, per_page: 1, total_pages: 0 };

async function main() {
  await cas("le siège, trouvé, avec le nom et l'adresse", () => {
    assert.deepEqual(lireLeRegistre(laPoste(), SIEGE), { etat: "trouve", nom: "LA POSTE", adresse: "9 RUE DU COLONEL PIERRE AVIA 75015 PARIS" });
  });
  await cas("un autre établissement, trouvé à SA propre adresse", () => {
    assert.deepEqual(lireLeRegistre(laPoste(), "356 000 000 12345"), { etat: "trouve", nom: "LA POSTE", adresse: "1 PLACE DE LA GARE 44000 NANTES" });
  });
  await cas("un SIRET du bon SIREN que le registre ne connaît pas : inconnu", () => {
    assert.deepEqual(lireLeRegistre(laPoste(), "35600000099999"), { etat: "inconnu" });
  });
  await cas("une réponse vide : inconnu", () => {
    assert.deepEqual(lireLeRegistre(VIDE, "12345678200010"), { etat: "inconnu" });
  });
  await cas("un résultat d'un AUTRE SIREN (recherche plein texte) : inconnu", () => {
    assert.deepEqual(lireLeRegistre(laPoste(), "12345678200010"), { etat: "inconnu" });
  });
  await cas("un établissement fermé n'est pas trouvé", () => {
    assert.deepEqual(lireLeRegistre(laPoste("O", "F"), AUTRE), { etat: "ferme" });
  });
  await cas("la diffusion partielle ne publie ni nom ni adresse", () => {
    assert.deepEqual(lireLeRegistre(laPoste("P"), SIEGE), { etat: "trouve", nom: null, adresse: null });
    const masque = laPoste();
    masque.results[0].nom_complet = "[NON-DIFFUSIBLE]";
    assert.deepEqual(lireLeRegistre(masque, SIEGE), { etat: "trouve", nom: null, adresse: "9 RUE DU COLONEL PIERRE AVIA 75015 PARIS" });
  });
  await cas("une forme inattendue est illisible, jamais inconnue", () => {
    for (const r of [null, "texte", { resultats: [] }, { results: "non" }]) {
      assert.deepEqual(lireLeRegistre(r, SIEGE), { etat: "illisible" }, JSON.stringify(r));
    }
  });

  const emetteur: EmetteurAVerifier = {
    nom: "Jardins Vidal", adresse: "10 rue des Artisans, Nantes", siret: "123 456 782 00010", formeJuridique: "EI",
    capitalSocial: null, villeRcs: null, mediateurNom: "M", assureurDecennale: null, regimeTva: "franchise",
    numeroTva: null, telephone: "02 40 00 00 00", email: "a@b.fr", adresseAssureurDecennale: null, attestationDecennale: false,
  };
  const client = { nom: "Mme Durand", adresse: "1 rue X", adresseChantier: null };
  await cas("un SIRET à confirmer arrête le devis ; confirmé ou d'avant, rien", () => {
    const cles = (e: EmetteurAVerifier) => manquesDuDevis(e, client, "conditions").map((m) => m.cle);
    assert.deepEqual(cles({ ...emetteur, siretAConfirmer: true }), ["siret-registre"]);
    assert.deepEqual(cles({ ...emetteur, siretAConfirmer: false }), []);
    assert.deepEqual(cles(emetteur), []);
    // Sans SIRET, c'est « Votre SIRET » qui manque, pas sa confirmation.
    assert.deepEqual(cles({ ...emetteur, siret: "", siretAConfirmer: true }), ["siret"]);
  });

  // Le vrai client, contre un faux registre : il répond, refuse, ou se tait.
  let mode: "laPoste" | "panne" | "silence" = "laPoste";
  const serveur = createServer((req, res) => {
    if (mode === "silence") return; // ne répond jamais : le délai doit trancher
    if (mode === "panne") {
      res.writeHead(503).end();
      return;
    }
    const q = new URL(req.url ?? "/", "http://x").searchParams.get("q");
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(q === SIEGE ? laPoste() : VIDE));
  });
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  try {
    await cas("le client lit le registre, espaces compris", async () => {
      assert.equal((await demanderAuRegistre("356 000 000 00048", base)).etat, "trouve");
      assert.equal((await demanderAuRegistre("12345678200010", base)).etat, "inconnu");
    });
    await cas("un registre en panne est injoignable, pas inconnu", async () => {
      mode = "panne";
      assert.equal((await demanderAuRegistre(SIEGE, base)).etat, "injoignable");
    });
    await cas("un registre muet est injoignable dans le délai", async () => {
      mode = "silence";
      const debut = Date.now();
      assert.equal((await demanderAuRegistre(SIEGE, base)).etat, "injoignable");
      assert.ok(Date.now() - debut < 6_000, "le délai de quatre secondes n'a pas tranché");
    });
  } finally {
    serveur.closeAllConnections();
    serveur.close();
  }

  console.log(`\nLe registre des entreprises : ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ATLAS ENVOIE AU PRESTATAIRE, ET CE QU'IL EN RELIT
// ═══════════════════════════════════════════════════════════════════════════
//
// **CE QUE CETTE SUITE PROUVE — et ce qu'elle NE PROUVE PAS.**
//
// Aucun compte Stripe n'existe encore : aucun de ces appels n'a jamais reçu de
// réponse réelle. Ce contrôle monte donc un faux prestataire, ici, en local —
// exactement ce que fait déjà ce dépôt pour l'IA (`anthropicBaseUrl`, dont la
// prose dit pourquoi : sans cela, vérifier qu'on envoie la bonne requête
// supposerait d'appeler le vrai service, avec une vraie clé, et de le payer).
//
// | Éprouvé ICI | À éprouver SUR SON ESPACE, avec une clé d'essai |
// |---|---|
// | les paramètres qu'Atlas envoie, un par un | que Stripe les accepte |
// | la lecture de la réponse | la forme réelle de sa réponse |
// | le prix réemployé au lieu d'être recréé | le premier vrai paiement |
// | les trois refus (pas de clé, injoignable, refusé) | |
//
// Le dire est la règle : *« ne jamais transmettre une commande non vérifiée
// sans le dire »* (`AGENTS.md`).
//
// **LE CONTRÔLE QUI COMPTE LE PLUS** est celui du montant : il vérifie que ce
// qui part chez le prestataire est bien ce que `src/lib/abonnements.ts`
// annonce à l'écran. Un tarif affiché qui ne serait pas le tarif débité est le
// pire défaut que cet écran puisse produire.

let echecs = 0;
async function cas(nom: string, f: () => Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

type Recue = { methode: string; chemin: string; corps: string; autorisation: string | undefined };

/** Le faux prestataire : il note ce qu'on lui envoie, et rend ce qu'on lui dit. */
function fauxPrestataire(repondre: (r: Recue) => { statut: number; corps: unknown }) {
  const recues: Recue[] = [];
  const serveur: Server = createServer((req, res) => {
    let corps = "";
    req.on("data", (c) => (corps += c));
    req.on("end", () => {
      const recue: Recue = {
        methode: req.method ?? "",
        chemin: req.url ?? "",
        corps,
        autorisation: req.headers.authorization,
      };
      recues.push(recue);
      const r = repondre(recue);
      res.writeHead(r.statut, { "content-type": "application/json" });
      res.end(JSON.stringify(r.corps));
    });
  });
  return { serveur, recues };
}

async function surUnPort(serveur: Server): Promise<number> {
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  return (serveur.address() as AddressInfo).port;
}

/** Recharge les modules avec l'environnement du moment (l'env est mémoïsé). */
async function moduleFrais() {
  const { _reinitialiserEnvPourTests } = await import("../src/server/env");
  _reinitialiserEnvPourTests();
  return import("../src/server/paiement/stripe");
}

/** Ce que Stripe rend pour un abonnement, dans la forme qu'il documente. */
function abonnementRendu(surcharge: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    object: "subscription",
    status: "active",
    customer: "cus_456",
    cancel_at_period_end: false,
    current_period_end: 1791633600, // 10 octobre 2026
    metadata: { formule: "entreprise", periodicite: "mensuelle" },
    items: { data: [{ id: "si_789" }] },
    ...surcharge,
  };
}

/** Les paramètres d'un corps de formulaire, sous une forme qu'on peut lire. */
function champs(corps: string): URLSearchParams {
  return new URLSearchParams(corps);
}

async function main() {
  process.env.ATLAS_URL_PUBLIQUE = "https://atlas.example";
  process.env.ATLAS_PAIEMENT_CLE = "sk_test_une_cle_qui_ne_sert_nulle_part";

  console.log("=== S'abonner : ce qui part chez le prestataire ===\n");

  {
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [] } };
      if (r.chemin === "/v1/prices") return { statut: 200, corps: { id: "price_neuf" } };
      return { statut: 200, corps: { id: "cs_1", url: "https://paiement.example/cs_1" } };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.ouvrirLePaiement({
      entrepriseId: "ent-1",
      email: "patron@exemple.fr",
      formule: "entreprise",
      periodicite: "mensuelle",
      retourSucces: "https://atlas.example/reglages/abonnement?paiement={CHECKOUT_SESSION_ID}",
      retourAbandon: "https://atlas.example/reglages/abonnement?paiement=abandon",
    });

    await cas("l'adresse de paiement est rendue telle quelle", async () => {
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.url, "https://paiement.example/cs_1");
    });

    await cas("la clé secrète part en en-tête, jamais dans l'adresse", async () => {
      assert.equal(recues[0].autorisation, "Bearer sk_test_une_cle_qui_ne_sert_nulle_part");
      for (const recue of recues) assert.ok(!recue.chemin.includes("sk_test"), "la clé est passée dans l'adresse");
    });

    await cas("LE MONTANT ENVOYÉ EST CELUI DE LA GRILLE — 59 € en centimes", async () => {
      const creation = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/prices");
      assert.ok(creation, "aucun prix n'a été créé");
      const c = champs(creation.corps);
      assert.equal(c.get("unit_amount"), "5900");
      assert.equal(c.get("currency"), "eur");
      assert.equal(c.get("recurring[interval]"), "month");
    });

    await cas("la clé de recherche porte le montant — un prix changé fait un objet neuf", async () => {
      const creation = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/prices");
      assert.equal(champs(creation!.corps).get("lookup_key"), "atlas_entreprise_mensuelle_5900");
    });

    await cas("la session porte la formule et l'entreprise en étiquettes", async () => {
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.ok(session);
      const c = champs(session.corps);
      assert.equal(c.get("mode"), "subscription");
      assert.equal(c.get("client_reference_id"), "ent-1");
      assert.equal(c.get("subscription_data[metadata][formule]"), "entreprise");
      assert.equal(c.get("subscription_data[metadata][periodicite]"), "mensuelle");
      assert.equal(c.get("line_items[0][price]"), "price_neuf");
      assert.equal(c.get("customer_email"), "patron@exemple.fr");
      assert.equal(c.get("locale"), "fr");
    });

    await cas("l'adresse de retour est celle d'ATLAS_URL_PUBLIQUE, jamais celle du visiteur", async () => {
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.match(champs(session!.corps).get("success_url") ?? "", /^https:\/\/atlas\.example\//);
    });

    serveur.close();
  }

  console.log("\n=== L'année : deux mois offerts, et l'intervalle suit ===\n");

  {
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [] } };
      if (r.chemin === "/v1/prices") return { statut: 200, corps: { id: "price_an" } };
      return { statut: 200, corps: { id: "cs_2", url: "https://paiement.example/cs_2" } };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    await stripe.ouvrirLePaiement({
      entrepriseId: "ent-2",
      email: null,
      formule: "artisan",
      periodicite: "annuelle",
      retourSucces: "https://atlas.example/a",
      retourAbandon: "https://atlas.example/b",
    });

    await cas("290 € pour l'année d'Artisan, en intervalle annuel", async () => {
      const c = champs(recues.find((x) => x.methode === "POST" && x.chemin === "/v1/prices")!.corps);
      assert.equal(c.get("unit_amount"), "29000");
      assert.equal(c.get("recurring[interval]"), "year");
    });

    await cas("sans adresse connue, on n'en invente pas — le prestataire la demandera", async () => {
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.equal(champs(session!.corps).get("customer_email"), null);
    });

    serveur.close();
  }

  console.log("\n=== Le prix existant est RÉEMPLOYÉ, pas recréé ===\n");

  {
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_deja_la" }] } };
      if (r.chemin === "/v1/prices") return { statut: 200, corps: { id: "price_en_trop" } };
      return { statut: 200, corps: { id: "cs_3", url: "https://paiement.example/cs_3" } };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    await stripe.ouvrirLePaiement({
      entrepriseId: "ent-3",
      email: null,
      formule: "artisan",
      periodicite: "mensuelle",
      retourSucces: "https://atlas.example/a",
      retourAbandon: "https://atlas.example/b",
    });

    await cas("aucun prix n'est créé quand la clé de recherche en trouve un", async () => {
      assert.equal(
        recues.filter((x) => x.methode === "POST" && x.chemin === "/v1/prices").length,
        0,
        "un prix a été recréé alors qu'il existait déjà"
      );
    });

    await cas("c'est bien le prix trouvé qui part dans la session", async () => {
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.equal(champs(session!.corps).get("line_items[0][price]"), "price_deja_la");
    });

    serveur.close();
  }

  console.log("\n=== Relire l'abonnement au retour du paiement ===\n");

  {
    const { serveur } = fauxPrestataire(() => ({
      statut: 200,
      corps: { id: "cs_4", client_reference_id: "ent-4", subscription: abonnementRendu() },
    }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.lireLaSessionDePaiement("cs_4");

    await cas("la formule, la périodicité et la date de fin sont relues", async () => {
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.entrepriseId, "ent-4");
      assert.equal(r.etat.formule, "entreprise");
      assert.equal(r.etat.periodicite, "mensuelle");
      assert.equal(r.etat.statut, "actif");
      assert.equal(r.etat.abonnementPrestataire, "sub_123");
      assert.equal(r.etat.clientPrestataire, "cus_456");
      assert.equal(r.etat.periodeFin?.toISOString().slice(0, 10), "2026-10-10");
    });

    serveur.close();
  }

  console.log("\n=== La lecture d'un abonnement, cas par cas ===\n");

  {
    const stripe = await moduleFrais();

    await cas("« trialing » vaut actif — un essai n'est pas un impayé", async () => {
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ status: "trialing" }))?.statut, "actif");
    });

    await cas("« canceled » vaut résilié", async () => {
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ status: "canceled" }))?.statut, "resilie");
    });

    await cas("UN ÉTAT INCONNU vaut IMPAYÉ, jamais actif", async () => {
      // Le seul repli qui ne donne rien gratuitement : se tromper vers l'actif
      // offrirait l'application à un abonnement mort, et personne ne le verrait.
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ status: "past_due" }))?.statut, "impaye");
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ status: "une_nouveauté" }))?.statut, "impaye");
    });

    await cas("SANS FORMULE reconnue, on refuse de conclure", async () => {
      // Mieux vaut « aucun abonnement » qu'une mauvaise formule dont on ferait
      // respecter le plafond.
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ metadata: {} })), null);
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ metadata: { formule: "premium" } })), null);
    });

    await cas("la date de fin se lit AUSSI sur la ligne — les deux formes documentées", async () => {
      const surLaLigne = abonnementRendu({
        current_period_end: undefined,
        items: { data: [{ id: "si_789", current_period_end: 1791633600 }] },
      });
      assert.equal(stripe.lireUnAbonnement(surLaLigne)?.periodeFin?.toISOString().slice(0, 10), "2026-10-10");
    });

    await cas("aucune date nulle part : on ne devine pas un jour de prélèvement", async () => {
      const sansDate = abonnementRendu({ current_period_end: undefined, items: { data: [{ id: "si_789" }] } });
      assert.equal(stripe.lireUnAbonnement(sansDate)?.periodeFin, null);
    });

    await cas("le client développé comme objet se lit comme l'identifiant", async () => {
      assert.equal(stripe.lireUnAbonnement(abonnementRendu({ customer: { id: "cus_dev" } }))?.clientPrestataire, "cus_dev");
    });
  }

  console.log("\n=== Changer de formule : au prorata, sur la ligne existante ===\n");

  {
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.methode === "GET" && r.chemin === "/v1/subscriptions/sub_123") {
        return { statut: 200, corps: abonnementRendu() };
      }
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_illimite" }] } };
      if (r.methode === "POST" && r.chemin === "/v1/subscriptions/sub_123") {
        return {
          statut: 200,
          corps: abonnementRendu({ metadata: { formule: "illimite", periodicite: "mensuelle" } }),
        };
      }
      return { statut: 404, corps: {} };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.changerLaFormule({
      abonnementPrestataire: "sub_123",
      formule: "illimite",
      periodicite: "mensuelle",
    });

    await cas("la nouvelle formule est rendue", async () => {
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.etat.formule, "illimite");
    });

    await cas("LA LIGNE EXISTANTE EST REMPLACÉE — jamais une seconde ajoutée", async () => {
      // Une ligne de plus, c'est deux formules facturées sur le même
      // abonnement, tous les mois.
      const maj = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123");
      assert.ok(maj);
      const c = champs(maj.corps);
      assert.equal(c.get("items[0][id]"), "si_789");
      assert.equal(c.get("items[0][price]"), "price_illimite");
      assert.equal(c.get("items[1][id]"), null, "une seconde ligne a été envoyée");
    });

    await cas("le prorata est demandé — c'est ce que l'article 14.6 promet", async () => {
      const maj = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123");
      assert.equal(champs(maj!.corps).get("proration_behavior"), "create_prorations");
    });

    await cas("une résiliation en cours est annulée : il vient de choisir de rester", async () => {
      const maj = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123");
      assert.equal(champs(maj!.corps).get("cancel_at_period_end"), "false");
    });

    serveur.close();
  }

  await cas("un abonnement à DEUX lignes est refusé plutôt que deviné", async () => {
    const { serveur } = fauxPrestataire(() => ({
      statut: 200,
      corps: abonnementRendu({ items: { data: [{ id: "si_1" }, { id: "si_2" }] } }),
    }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.changerLaFormule({
      abonnementPrestataire: "sub_123",
      formule: "illimite",
      periodicite: "mensuelle",
    });
    assert.equal(r.ok, false, "une ligne a été choisie au hasard parmi deux");
    serveur.close();
  });

  console.log("\n=== Le guichet ===\n");

  {
    const { serveur, recues } = fauxPrestataire(() => ({
      statut: 200,
      corps: { url: "https://guichet.example/p_1" },
    }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.ouvrirLeGuichet({
      clientPrestataire: "cus_456",
      retour: "https://atlas.example/reglages/abonnement",
    });

    await cas("le guichet s'ouvre pour le bon client, et revient chez Atlas", async () => {
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.url, "https://guichet.example/p_1");
      const c = champs(recues[0].corps);
      assert.equal(c.get("customer"), "cus_456");
      assert.equal(c.get("return_url"), "https://atlas.example/reglages/abonnement");
    });

    serveur.close();
  }

  console.log("\n=== Les trois refus, et chacun dit lequel c'est ===\n");

  await cas("SANS CLÉ : « non configuré », et aucun appel n'est tenté", async () => {
    const { serveur, recues } = fauxPrestataire(() => ({ statut: 200, corps: {} }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    delete process.env.ATLAS_PAIEMENT_CLE;
    const stripe = await moduleFrais();

    assert.equal(stripe.paiementConfigure(), false);
    const r = await stripe.ouvrirLeGuichet({ clientPrestataire: "cus_1", retour: "https://atlas.example/x" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erreur, "non_configure");
    assert.equal(recues.length, 0, "un appel est parti sans clé");

    process.env.ATLAS_PAIEMENT_CLE = "sk_test_une_cle_qui_ne_sert_nulle_part";
    serveur.close();
  });

  await cas("LE PRESTATAIRE REFUSE : on ne rend pas d'adresse boiteuse", async () => {
    const { serveur } = fauxPrestataire(() => ({
      statut: 400,
      corps: { error: { message: "No such price" } },
    }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.ouvrirLeGuichet({ clientPrestataire: "cus_1", retour: "https://atlas.example/x" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erreur, "prestataire_refuse");
    serveur.close();
  });

  await cas("UNE RÉPONSE SANS ADRESSE est un refus, pas une redirection vide", async () => {
    const { serveur } = fauxPrestataire(() => ({ statut: 200, corps: { id: "cs_x" } }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.ouvrirLeGuichet({ clientPrestataire: "cus_1", retour: "https://atlas.example/x" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erreur, "prestataire_refuse");
    serveur.close();
  });

  await cas("INJOIGNABLE : le refus le dit, et rien ne lève", async () => {
    // Une exception ici remonterait au patron comme une page cassée : le
    // message d'une action serveur ne lui parvient jamais (`AGENTS.md`).
    const { serveur } = fauxPrestataire(() => ({ statut: 200, corps: {} }));
    const port = await surUnPort(serveur);
    serveur.close();
    await new Promise((ok) => setTimeout(ok, 50));
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.ouvrirLeGuichet({ clientPrestataire: "cus_1", retour: "https://atlas.example/x" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.erreur, "prestataire_injoignable");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

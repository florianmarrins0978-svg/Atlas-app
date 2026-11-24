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
      if (r.chemin.startsWith("/v1/tax_rates?")) return { statut: 200, corps: { data: [] } };
      if (r.chemin === "/v1/tax_rates") return { statut: 200, corps: { id: "txr_neuf" } };
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
      modules: [],
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

    // **Sa réponse du 5 novembre 2026 : Atlas est soumis à la TVA.** Les CGU
    // et l'écran annoncent des prix HT ; sans taux sur l'abonnement, Stripe
    // prélevait le HT seul et la facture ne portait aucune TVA.
    await cas("la TVA à 20 % s'ajoute au prix HT, sur l'abonnement entier", async () => {
      const taux = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/tax_rates");
      assert.ok(taux, "aucun taux de TVA n'a été créé chez le prestataire");
      const t = champs(taux.corps);
      assert.equal(t.get("percentage"), "20");
      assert.equal(t.get("inclusive"), "false", "un taux inclus ferait du prix HT un prix TTC");
      assert.equal(t.get("country"), "FR");
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.equal(champs(session!.corps).get("subscription_data[default_tax_rates][0]"), "txr_neuf");
    });

    await cas("l'adresse de retour est celle d'ATLAS_URL_PUBLIQUE, jamais celle du visiteur", async () => {
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.match(champs(session!.corps).get("success_url") ?? "", /^https:\/\/atlas\.example\//);
    });

    serveur.close();
  }

  // **LES OUTILS DE PAYSAGE PARTENT DANS LE MÊME PRIX** (18 et 19 novembre
  // 2026) : un seul prix « formule et outils », jamais une seconde ligne. Un
  // abonnement Atlas n'a qu'une ligne (`ligneUnique` le vérifie). Les ajouter
  // est une montée, les retirer une descente à l'échéance (24 novembre 2026,
  // `src/lib/changement-de-formule.ts`).
  console.log("\n=== Les outils de paysage : un seul prix, formule et outils ===\n");

  {
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [] } };
      if (r.chemin === "/v1/prices") return { statut: 200, corps: { id: "price_outils" } };
      if (r.chemin.startsWith("/v1/tax_rates?")) return { statut: 200, corps: { data: [] } };
      if (r.chemin === "/v1/tax_rates") return { statut: 200, corps: { id: "txr_neuf" } };
      return { statut: 200, corps: { id: "cs_outils", url: "https://paiement.example/cs_outils" } };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.ouvrirLePaiement({
      entrepriseId: "ent-outils",
      email: null,
      formule: "artisan",
      periodicite: "mensuelle",
      modules: ["paysage"],
      retourSucces: "https://atlas.example/reglages/abonnement?paiement={CHECKOUT_SESSION_ID}",
      retourAbandon: "https://atlas.example/reglages/abonnement?paiement=abandon",
    });

    await cas("ARTISAN ET LES OUTILS : 45 € en centimes, sous une clé qui nomme les outils", async () => {
      assert.equal(r.ok, true);
      const creation = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/prices");
      assert.ok(creation, "aucun prix n'a été créé");
      const c = champs(creation.corps);
      assert.equal(c.get("unit_amount"), "4500");
      assert.equal(c.get("lookup_key"), "atlas_artisan_paysage_mensuelle_4500");
      assert.equal(c.get("product_data[name]"), "Cause Artisan, avec les outils de paysage");
    });

    await cas("la session porte les outils en étiquette, et UNE seule ligne", async () => {
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.ok(session);
      const c = champs(session.corps);
      assert.equal(c.get("subscription_data[metadata][modules]"), "paysage");
      assert.equal(c.get("line_items[0][price]"), "price_outils");
      assert.equal(c.get("line_items[1][price]"), null, "les outils sont partis sur une seconde ligne");
    });

    serveur.close();
  }

  {
    // AJOUTER les outils : une montée, débitée tout de suite, au prix qui les
    // nomme.
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.methode === "GET" && r.chemin === "/v1/subscriptions/sub_123") {
        return { statut: 200, corps: abonnementRendu({ metadata: { formule: "artisan", periodicite: "mensuelle" } }) };
      }
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_avec" }] } };
      if (r.methode === "POST" && r.chemin === "/v1/subscriptions/sub_123") {
        return { statut: 200, corps: abonnementRendu({ metadata: { formule: "artisan", periodicite: "mensuelle", modules: "paysage" } }) };
      }
      return { statut: 404, corps: {} };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();
    const r = await stripe.monterToutDeSuite({
      abonnementPrestataire: "sub_123",
      formule: "artisan",
      periodicite: "mensuelle",
      modules: ["paysage"],
      facon: "monter-au-mois",
    });

    await cas("AJOUTER LES OUTILS : le prix qui les nomme, leur étiquette, débité tout de suite", async () => {
      assert.equal(r.ok, true);
      if (r.ok) assert.deepEqual(r.etat.modules, ["paysage"]);
      const maj = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123");
      assert.ok(maj);
      const c = champs(maj.corps);
      assert.equal(c.get("metadata[modules]"), "paysage");
      assert.equal(c.get("items[0][price]"), "price_avec");
      assert.equal(c.get("billing_cycle_anchor"), "now");
      const recherche = recues.find((x) => x.chemin.startsWith("/v1/prices?"));
      assert.match(decodeURIComponent(recherche!.chemin), /lookup_keys\[\]=atlas_artisan_paysage_mensuelle_4500/);
    });
    serveur.close();
  }

  {
    // RETIRER les outils : une descente, à l'échéance, par le calendrier.
    const avecOutils = abonnementRendu({
      metadata: { entreprise_id: "ent-1", formule: "entreprise", periodicite: "mensuelle", modules: "paysage" },
      items: { data: [{ id: "si_789", price: { id: "price_entreprise_outils" } }] },
    });
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.methode === "GET" && r.chemin === "/v1/subscriptions/sub_123") return { statut: 200, corps: avecOutils };
      if (r.chemin === "/v1/subscription_schedules") {
        return { statut: 200, corps: { id: "sub_sched_7", phases: [{ start_date: 1763899200, end_date: 1766491200 }] } };
      }
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_sans" }] } };
      if (r.chemin.startsWith("/v1/tax_rates?")) {
        return { statut: 200, corps: { data: [{ id: "txr_20", metadata: { atlas_cle: "atlas_tva_fr_20" } }] } };
      }
      if (r.chemin === "/v1/subscription_schedules/sub_sched_7") return { statut: 200, corps: { id: "sub_sched_7" } };
      return { statut: 404, corps: {} };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();
    const r = await stripe.prevoirALEcheance({
      abonnementPrestataire: "sub_123",
      formule: "entreprise",
      periodicite: "mensuelle",
      modules: [],
    });

    await cas("RETIRER LES OUTILS : il les garde jusqu'à l'échéance, puis le prix sans eux, l'étiquette effacée", async () => {
      assert.equal(r.ok, true);
      const maj = recues.find((x) => x.chemin === "/v1/subscription_schedules/sub_sched_7");
      assert.ok(maj);
      const c = champs(maj.corps);
      assert.equal(c.get("phases[0][metadata][modules]"), "paysage");
      assert.equal(c.get("phases[0][items][0][price]"), "price_entreprise_outils");
      // Une étiquette vide, c'est ainsi que le prestataire l'efface.
      assert.equal(c.get("phases[1][metadata][modules]"), "");
      assert.equal(c.get("phases[1][items][0][price]"), "price_sans");
      const recherche = recues.find((x) => x.chemin.startsWith("/v1/prices?"));
      assert.match(decodeURIComponent(recherche!.chemin), /lookup_keys\[\]=atlas_entreprise_mensuelle_5900/);
      assert.equal(recues.filter((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123").length, 0);
    });
    serveur.close();
  }

  await cas("les outils se relisent sur l'abonnement : présents, absents, vides ou inconnus", async () => {
    const stripe = await moduleFrais();
    const avec = stripe.lireUnAbonnement(abonnementRendu({ metadata: { formule: "artisan", periodicite: "mensuelle", modules: "paysage" } }));
    assert.deepEqual(avec?.modules, ["paysage"]);
    assert.deepEqual(stripe.lireUnAbonnement(abonnementRendu())?.modules, []);
    assert.deepEqual(stripe.lireUnAbonnement(abonnementRendu({ metadata: { formule: "artisan", periodicite: "mensuelle", modules: "" } }))?.modules, []);
    // Un module qu'Atlas ne connaît pas : on ne devine pas ce qui est payé.
    assert.equal(stripe.lireUnAbonnement(abonnementRendu({ metadata: { formule: "artisan", periodicite: "mensuelle", modules: "piscine" } })), null);
  });

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
      modules: [],
      retourSucces: "https://atlas.example/a",
      retourAbandon: "https://atlas.example/b",
    });

    await cas("390 € pour l'année d'Artisan, en intervalle annuel", async () => {
      const c = champs(recues.find((x) => x.methode === "POST" && x.chemin === "/v1/prices")!.corps);
      assert.equal(c.get("unit_amount"), "39000");
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
      // Un taux d'un autre usage d'abord : seule l'étiquette d'Atlas compte.
      if (r.chemin.startsWith("/v1/tax_rates?")) {
        return {
          statut: 200,
          corps: {
            data: [
              { id: "txr_autre", metadata: {} },
              { id: "txr_deja_la", metadata: { atlas_cle: "atlas_tva_fr_20" } },
            ],
          },
        };
      }
      if (r.chemin === "/v1/tax_rates") return { statut: 200, corps: { id: "txr_en_trop" } };
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
      modules: [],
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

    await cas("le taux de TVA déjà créé par Atlas est réemployé, jamais recréé", async () => {
      assert.equal(recues.filter((x) => x.methode === "POST" && x.chemin === "/v1/tax_rates").length, 0);
      const session = recues.find((x) => x.chemin === "/v1/checkout/sessions");
      assert.equal(champs(session!.corps).get("subscription_data[default_tax_rates][0]"), "txr_deja_la");
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

  console.log("\n=== Monter : débité tout de suite, sur la ligne existante ===\n");

  // Ses décisions du 23 novembre 2026 (`src/lib/changement-de-formule.ts`) :
  // au mois, le prix entier et l'échéance remise ; à l'année, la différence
  // entière, l'échéance gardée. Le faux prestataire note ce qui part ; que
  // Stripe l'accepte et débite bien ce montant se joue sur son espace.
  async function monter(facon: "monter-au-mois" | "monter-a-l-annee" | "passer-a-l-annee", rendu = abonnementRendu()) {
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.methode === "GET" && r.chemin === "/v1/subscriptions/sub_123") return { statut: 200, corps: rendu };
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_illimite" }] } };
      if (r.chemin.endsWith("/release")) return { statut: 200, corps: { id: "sub_sched_1" } };
      if (r.methode === "POST" && r.chemin === "/v1/subscriptions/sub_123") {
        return { statut: 200, corps: abonnementRendu({ metadata: { formule: "illimite", periodicite: "mensuelle" } }) };
      }
      return { statut: 404, corps: {} };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();
    const r = await stripe.monterToutDeSuite({
      abonnementPrestataire: "sub_123",
      formule: "illimite",
      periodicite: facon === "monter-au-mois" ? "mensuelle" : "annuelle",
      modules: [],
      facon,
    });
    serveur.close();
    const maj = recues.find((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123");
    return { r, recues, maj: maj ? champs(maj.corps) : null };
  }

  {
    const { r, maj } = await monter("monter-au-mois");

    await cas("la nouvelle formule est rendue", async () => {
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.etat.formule, "illimite");
    });

    await cas("LA LIGNE EXISTANTE EST REMPLACÉE, jamais une seconde ajoutée", async () => {
      assert.ok(maj);
      assert.equal(maj.get("items[0][id]"), "si_789");
      assert.equal(maj.get("items[0][price]"), "price_illimite");
      assert.equal(maj.get("items[1][id]"), null, "une seconde ligne a été envoyée");
    });

    await cas("AU MOIS : le prix entier, l'échéance remise à aujourd'hui, aucun prorata", async () => {
      assert.equal(maj?.get("billing_cycle_anchor"), "now");
      assert.equal(maj?.get("proration_behavior"), "none");
      assert.equal(maj?.get("proration_date"), null);
    });

    await cas("UN PAIEMENT QUI NE PASSE PAS LAISSE L'ABONNEMENT INTACT", async () => {
      assert.equal(maj?.get("payment_behavior"), "error_if_incomplete");
    });

    await cas("une résiliation en cours est annulée : il vient de choisir de rester", async () => {
      assert.equal(maj?.get("cancel_at_period_end"), "false");
    });

    await cas("la formule et le rythme partent dans les étiquettes", async () => {
      assert.equal(maj?.get("metadata[formule]"), "illimite");
      assert.equal(maj?.get("metadata[periodicite]"), "mensuelle");
    });
  }

  {
    const { maj } = await monter("monter-a-l-annee", abonnementRendu({ current_period_start: 1760097600 }));
    await cas("À L'ANNÉE : la différence entière, comptée depuis le début de la période, l'échéance gardée", async () => {
      assert.equal(maj?.get("proration_behavior"), "always_invoice");
      assert.equal(maj?.get("proration_date"), "1760097600");
      assert.equal(maj?.get("billing_cycle_anchor"), null, "l'échéance a été remise");
      assert.equal(maj?.get("payment_behavior"), "error_if_incomplete");
    });
  }

  {
    const lignes = { data: [{ id: "si_789", current_period_start: 1760097600 }] };
    const { maj } = await monter("monter-a-l-annee", abonnementRendu({ items: lignes }));
    await cas("le début de période se lit AUSSI sur la ligne, comme la fin", async () => {
      assert.equal(maj?.get("proration_date"), "1760097600");
    });
  }

  {
    const { r, maj } = await monter("monter-a-l-annee");
    await cas("sans début de période, la différence ne se devine pas : rien ne part", async () => {
      assert.equal(r.ok, false);
      assert.equal(maj, null, "un changement est parti sans montant sûr");
    });
  }

  {
    const { maj } = await monter("passer-a-l-annee");
    await cas("DU MOIS À L'ANNÉE : l'année entière, l'échéance remise", async () => {
      assert.equal(maj?.get("billing_cycle_anchor"), "now");
      assert.equal(maj?.get("proration_behavior"), "none");
    });
  }

  {
    const { recues } = await monter("monter-au-mois", abonnementRendu({ schedule: "sub_sched_1" }));
    await cas("un calendrier resté chez le prestataire part AVANT la montée", async () => {
      const ordre = recues.map((x) => `${x.methode} ${x.chemin.split("?")[0]}`);
      const liberation = ordre.indexOf("POST /v1/subscription_schedules/sub_sched_1/release");
      const montee = ordre.indexOf("POST /v1/subscriptions/sub_123");
      assert.ok(liberation >= 0, "le calendrier est resté");
      assert.ok(liberation < montee, "la montée est partie avant que le calendrier soit retiré");
    });
  }

  for (const [nom, erreur, attendu] of [
    ["une carte refusée se dit « carte refusée »", { type: "card_error", code: "card_declined" }, "carte_refusee"],
    ["la banque qui veut une confirmation se dit comme telle", { type: "card_error", code: "authentication_required" }, "confirmation_bancaire"],
  ] as const) {
    await cas(nom, async () => {
      const { serveur } = fauxPrestataire((r) => {
        if (r.methode === "GET") return { statut: 200, corps: abonnementRendu() };
        if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_illimite" }] } };
        return { statut: 402, corps: { error: erreur } };
      });
      const port = await surUnPort(serveur);
      process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
      const stripe = await moduleFrais();
      const r = await stripe.monterToutDeSuite({
        abonnementPrestataire: "sub_123",
        formule: "illimite",
        periodicite: "mensuelle",
        modules: [],
        facon: "monter-au-mois",
      });
      serveur.close();
      assert.deepEqual(r, { ok: false, erreur: attendu });
    });
  }

  await cas("un abonnement à DEUX lignes est refusé plutôt que deviné", async () => {
    const { r, maj } = await monter("monter-au-mois", abonnementRendu({ items: { data: [{ id: "si_1" }, { id: "si_2" }] } }));
    assert.equal(r.ok, false, "une ligne a été choisie au hasard parmi deux");
    assert.equal(maj, null);
  });

  console.log("\n=== Descendre : un calendrier, rien de débité ===\n");

  {
    const avecPrix = abonnementRendu({
      metadata: { entreprise_id: "ent-1", formule: "entreprise", periodicite: "mensuelle" },
      items: { data: [{ id: "si_789", price: { id: "price_entreprise" } }] },
    });
    let relu = 0;
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.methode === "GET" && r.chemin === "/v1/subscriptions/sub_123") {
        relu++;
        return { statut: 200, corps: relu === 1 ? avecPrix : { ...avecPrix, schedule: "sub_sched_9" } };
      }
      if (r.chemin === "/v1/subscription_schedules") {
        return { statut: 200, corps: { id: "sub_sched_9", phases: [{ start_date: 1763899200, end_date: 1766491200 }] } };
      }
      if (r.chemin.startsWith("/v1/prices?")) return { statut: 200, corps: { data: [{ id: "price_artisan" }] } };
      if (r.chemin.startsWith("/v1/tax_rates?")) {
        return { statut: 200, corps: { data: [{ id: "txr_20", metadata: { atlas_cle: "atlas_tva_fr_20" } }] } };
      }
      if (r.chemin === "/v1/subscription_schedules/sub_sched_9") return { statut: 200, corps: { id: "sub_sched_9" } };
      return { statut: 404, corps: {} };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();
    const r = await stripe.prevoirALEcheance({
      abonnementPrestataire: "sub_123",
      formule: "artisan",
      periodicite: "mensuelle",
      modules: [],
    });
    serveur.close();
    const maj = recues.find((x) => x.chemin === "/v1/subscription_schedules/sub_sched_9");
    const c = champs(maj?.corps ?? "");

    await cas("le calendrier naît de l'abonnement, et l'abonnement relu le porte", async () => {
      assert.ok(recues.some((x) => x.chemin === "/v1/subscription_schedules" && champs(x.corps).get("from_subscription") === "sub_123"));
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.etat.changementPrevu, true);
        assert.equal(r.etat.formule, "entreprise", "la formule payée a changé avant l'échéance");
      }
    });

    await cas("AUCUN ABONNEMENT N'EST MODIFIÉ, donc rien n'est débité aujourd'hui", async () => {
      assert.equal(recues.filter((x) => x.methode === "POST" && x.chemin === "/v1/subscriptions/sub_123").length, 0);
    });

    await cas("la période en cours reste telle quelle, jusqu'à l'échéance", async () => {
      assert.equal(c.get("phases[0][items][0][price]"), "price_entreprise");
      assert.equal(c.get("phases[0][start_date]"), "1763899200");
      assert.equal(c.get("phases[0][end_date]"), "1766491200");
      assert.equal(c.get("phases[0][metadata][formule]"), "entreprise");
    });

    await cas("ARTISAN COMMENCE À L'ÉCHÉANCE, sans prorata, ses étiquettes avec lui", async () => {
      assert.equal(c.get("phases[1][items][0][price]"), "price_artisan");
      assert.equal(c.get("phases[1][metadata][formule]"), "artisan");
      assert.equal(c.get("phases[1][metadata][periodicite]"), "mensuelle");
      assert.equal(c.get("phases[1][metadata][entreprise_id]"), "ent-1");
      assert.equal(c.get("phases[1][proration_behavior]"), "none");
      assert.equal(c.get("proration_behavior"), "none");
      assert.equal(c.get("end_behavior"), "release");
    });

    await cas("LA TVA EST REDONNÉE À CHAQUE PHASE : Artisan ne part pas hors taxe", async () => {
      assert.equal(c.get("phases[0][default_tax_rates][0]"), "txr_20");
      assert.equal(c.get("phases[1][default_tax_rates][0]"), "txr_20");
    });

    await cas("la phase d'Artisan court une période, puis le calendrier se retire", async () => {
      // 23 décembre 2025 + un mois = 23 janvier 2026, en secondes.
      assert.equal(c.get("phases[1][end_date]"), String(Date.UTC(2026, 0, 23, 12) / 1000));
    });
  }

  console.log("\n=== Garder, et résilier : le calendrier part ===\n");

  for (const [nom, appel] of [
    ["« Garder Entreprise » retire le calendrier, rien d'autre", "garder"],
    ["résilier retire d'abord une descente prévue", "resilier"],
  ] as const) {
    await cas(nom, async () => {
      const { serveur, recues } = fauxPrestataire((r) => {
        if (r.methode === "GET") return { statut: 200, corps: abonnementRendu({ schedule: "sub_sched_9" }) };
        if (r.chemin.endsWith("/release")) return { statut: 200, corps: { id: "sub_sched_9" } };
        return { statut: 200, corps: abonnementRendu({ cancel_at_period_end: true }) };
      });
      const port = await surUnPort(serveur);
      process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
      const stripe = await moduleFrais();
      const r =
        appel === "garder"
          ? await stripe.garderLaFormule({ abonnementPrestataire: "sub_123" })
          : await stripe.demanderLaResiliation({ abonnementPrestataire: "sub_123", raison: null, texte: null });
      serveur.close();
      assert.equal(r.ok, true);
      const ordre = recues.map((x) => `${x.methode} ${x.chemin.split("?")[0]}`);
      assert.ok(ordre.includes("POST /v1/subscription_schedules/sub_sched_9/release"), "le calendrier est resté");
      if (appel === "garder") {
        assert.equal(ordre.filter((x) => x === "POST /v1/subscriptions/sub_123").length, 0, "garder a modifié l'abonnement");
      } else {
        assert.ok(ordre.indexOf("POST /v1/subscription_schedules/sub_sched_9/release") < ordre.indexOf("POST /v1/subscriptions/sub_123"));
      }
    });
  }

  await cas("un abonnement relu SANS calendrier ne prévoit rien", async () => {
    const stripe = await moduleFrais();
    assert.equal(stripe.lireUnAbonnement(abonnementRendu())?.changementPrevu, false);
    assert.equal(stripe.lireUnAbonnement(abonnementRendu({ schedule: { id: "sub_sched_1" } }))?.changementPrevu, true);
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

  console.log("\n=== Partir : à l'échéance, avec sa raison et son texte (18 octobre 2026) ===\n");

  {
    const { serveur, recues } = fauxPrestataire(() => ({
      statut: 200,
      corps: abonnementRendu({ cancel_at_period_end: true }),
    }));
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.demanderLaResiliation({
      abonnementPrestataire: "sub_123",
      raison: "manque",
      texte: "la facturation en anglais",
    });

    // La résiliation relit d'abord l'abonnement (une descente prévue partirait
    // avant elle) : on lit donc les ENVOIS, dans l'ordre.
    const envois = () => recues.filter((x) => x.methode === "POST");

    await cas("la résiliation part pour l'échéance, jamais tout de suite", async () => {
      assert.equal(envois()[0].chemin, "/v1/subscriptions/sub_123");
      assert.equal(champs(envois()[0].corps).get("cancel_at_period_end"), "true");
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.etat.annulationDemandee, true);
    });

    await cas("sa raison et son texte partent avec, là où le patron les lit", async () => {
      const c = champs(envois()[0].corps);
      assert.equal(c.get("cancellation_details[feedback]"), "missing_features");
      assert.equal(c.get("cancellation_details[comment]"), "la facturation en anglais");
    });

    await cas("sans raison ni texte, rien n'est inventé", async () => {
      await stripe.demanderLaResiliation({ abonnementPrestataire: "sub_123", raison: null, texte: null });
      const c = champs(envois()[1].corps);
      assert.equal(c.has("cancellation_details[feedback]"), false);
      assert.equal(c.has("cancellation_details[comment]"), false);
    });

    await cas("« Ne pas arrêter » retire la résiliation demandée", async () => {
      await stripe.retirerLaResiliation({ abonnementPrestataire: "sub_123" });
      assert.equal(champs(envois()[2].corps).get("cancel_at_period_end"), "false");
    });

    serveur.close();
  }

  console.log("\n=== Refuser de nouvelles conditions : résilier, et rendre les mois non utilisés ===\n");

  {
    // Payé le 18 avril pour un an, refusé le 18 octobre : six mois rendus.
    const finAvril = Math.floor(Date.UTC(2027, 3, 18, 10) / 1000);
    const { serveur, recues } = fauxPrestataire((r) => {
      if (r.methode === "GET") {
        return {
          statut: 200,
          corps: abonnementRendu({
            current_period_end: finAvril,
            metadata: { formule: "entreprise", periodicite: "annuelle" },
            latest_invoice: { amount_paid: 70800, payment_intent: "pi_annee" },
          }),
        };
      }
      if (r.methode === "DELETE") return { statut: 200, corps: abonnementRendu({ status: "canceled" }) };
      return { statut: 200, corps: { id: "re_1" } };
    });
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();

    const r = await stripe.resilierEtRembourser({
      abonnementPrestataire: "sub_123",
      raison: null,
      texte: "je ne suis pas d'accord avec l'article 7",
      maintenant: new Date(Date.UTC(2026, 9, 18, 10)),
    });

    await cas("l'ordre : lire, résilier, rendre", async () => {
      assert.deepEqual(
        recues.map((x) => x.methode),
        ["GET", "DELETE", "POST"]
      );
      assert.equal(recues[2].chemin, "/v1/refunds");
    });

    await cas("354 € TTC rendus sur le paiement de l'année, pour six mois", async () => {
      const c = champs(recues[2].corps);
      assert.equal(c.get("payment_intent"), "pi_annee");
      assert.equal(c.get("amount"), "35400");
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.rembourseCentimes, 35400);
        assert.equal(r.moisNonUtilises, 6);
        assert.equal(r.remboursementEchoue, false);
        assert.equal(r.etat.statut, "resilie");
      }
    });

    await cas("son texte part avec la résiliation, dans l'adresse", async () => {
      assert.ok(recues[1].chemin.startsWith("/v1/subscriptions/sub_123?"));
      const c = new URLSearchParams(recues[1].chemin.split("?")[1]);
      assert.equal(c.get("cancellation_details[comment]"), "je ne suis pas d'accord avec l'article 7");
    });

    serveur.close();
  }

  await cas("paiement illisible : résilié quand même, RIEN n'est rendu au hasard, et c'est dit", async () => {
    const { serveur, recues } = fauxPrestataire((r) =>
      r.methode === "GET"
        ? { statut: 200, corps: abonnementRendu({ latest_invoice: { amount_paid: 70800 } }) }
        : { statut: 200, corps: abonnementRendu({ status: "canceled" }) }
    );
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();
    const r = await stripe.resilierEtRembourser({
      abonnementPrestataire: "sub_123",
      raison: null,
      texte: null,
      maintenant: new Date(),
    });
    assert.equal(recues.some((x) => x.chemin === "/v1/refunds"), false, "un remboursement est parti sans paiement lu");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.remboursementEchoue, true);
    serveur.close();
  });

  await cas("la résiliation refusée : rien n'est rendu", async () => {
    const { serveur, recues } = fauxPrestataire((r) =>
      r.methode === "GET"
        ? {
            statut: 200,
            corps: abonnementRendu({
              metadata: { formule: "entreprise", periodicite: "annuelle" },
              latest_invoice: { amount_paid: 70800, payment_intent: "pi_annee" },
            }),
          }
        : { statut: 400, corps: { error: { message: "already canceled" } } }
    );
    const port = await surUnPort(serveur);
    process.env.ATLAS_PAIEMENT_BASE_URL = `http://127.0.0.1:${port}`;
    const stripe = await moduleFrais();
    const r = await stripe.resilierEtRembourser({
      abonnementPrestataire: "sub_123",
      raison: null,
      texte: null,
      maintenant: new Date(),
    });
    assert.equal(r.ok, false);
    assert.equal(recues.some((x) => x.chemin === "/v1/refunds"), false, "rendu deux fois : la résiliation avait déjà eu lieu");
    serveur.close();
  });

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

  console.log("\n=== Lire une facture payée (la facture d'abonnement d'Atlas) ===\n");

  {
    const stripe = await moduleFrais();
    const payee = {
      object: "invoice",
      id: "in_1",
      status: "paid",
      parent: { subscription_details: { subscription: "sub_123" } },
      total: 4680,
      total_excluding_tax: 3900,
      created: 1793000000,
      status_transitions: { paid_at: 1793000100 },
      lines: { data: [{ period: { start: 1793000000, end: 1795592000 } }] },
    };

    await cas("le HT, la TVA et le total sont ceux PRÉLEVÉS", async () => {
      const f = stripe.lireUneFacturePayee(payee);
      assert.ok(f);
      assert.equal(f.htCentimes, 3900);
      assert.equal(f.tvaCentimes, 780);
      assert.equal(f.ttcCentimes, 4680);
      assert.equal(f.abonnementPrestataire, "sub_123");
      assert.equal(f.facturePrestataire, "in_1");
    });

    await cas("l'abonnement se lit aussi dans l'ancienne forme, à la racine", async () => {
      const { parent: _p, ...sansParent } = payee;
      void _p;
      assert.equal(stripe.lireUneFacturePayee({ ...sansParent, subscription: "sub_ancien" })?.abonnementPrestataire, "sub_ancien");
    });

    await cas("le dernier jour payé est la veille du début de la période suivante", async () => {
      const f = stripe.lireUneFacturePayee(payee);
      assert.equal(f?.periodeFin, new Date((1795592000 - 1) * 1000).toISOString().slice(0, 10));
    });

    await cas("non payée, à zéro, ou sans abonnement : rien ne s'émet", async () => {
      assert.equal(stripe.lireUneFacturePayee({ ...payee, status: "open" }), null);
      assert.equal(stripe.lireUneFacturePayee({ ...payee, total: 0, total_excluding_tax: 0 }), null);
      assert.equal(stripe.lireUneFacturePayee({ ...payee, parent: null }), null);
    });
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

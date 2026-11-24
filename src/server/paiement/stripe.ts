/**
 * LE PRESTATAIRE DE PAIEMENT — Stripe, et tout ce qui le concerne est ICI.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **POURQUOI STRIPE, ET NON UN AUTRE** (9 septembre 2026, sa question : *« tu
 * dois le dire quelle est la plus adaptée à mon besoin »*).
 *
 * | Son besoin | Ce qui tranche |
 * |---|---|
 * | ses clients sont tous français | Paddle prend 5 % pour régler une TVA étrangère qu'il n'a pas |
 * | trois formules, changement en cours de mois | Stripe Billing fait le prorata ; chez Mollie, il faudrait l'écrire |
 * | « gérer mon abonnement » | le Portail Client est hébergé par Stripe — la partie ennuyeuse et juridiquement sensible qu'on ne code donc pas |
 * | des artisans qui préfèrent le prélèvement | SEPA compris |
 *
 * Coût : ~1,5 % + 0,25 € par carte européenne, plus 0,7 % de Billing — soit
 * environ 0,89 € sur 29 €.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **AUCUNE BIBLIOTHÈQUE, ET C'EST UN CHOIX.** Trois appels REST suffisent ; la
 * bibliothèque officielle apporterait une dépendance entière, sa chaîne de
 * mises à jour, et sa propre couche de types à tenir. Ce qu'elle aurait
 * apporté d'irremplaçable — la vérification de signature — est écrit et
 * ÉPROUVÉ dans `src/lib/signature-stripe.ts`, sans compte ni clé.
 *
 * **CE FICHIER EST LE SEUL À SAVOIR QUE C'EST STRIPE.** Rien d'autre dans
 * `src/` ne nomme le fournisseur : le dépôt, l'écran et le crochet parlent de
 * « prestataire ». En changer un jour, c'est réécrire ce fichier — pas
 * l'application.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QUI N'A PAS PU ÊTRE ÉPROUVÉ ICI, ET IL FAUT LE DIRE** (`AGENTS.md`) :
 * aucun compte Stripe n'existe encore, donc aucun de ces trois appels n'a
 * jamais reçu de réponse réelle. Ce qui EST éprouvé : la signature du crochet,
 * la lecture d'un abonnement en réponse (`scripts/test-paiement-stripe.ts`,
 * qui monte un faux Stripe local), et le refus propre quand la clé manque.
 * Le premier essai avec une vraie clé de test se fait sur son espace.
 */
import { getEnv } from "../env";
import { logger } from "../logger";
import {
  FORMULES,
  MODULES,
  estModule,
  formule,
  nomDeLAbonnement,
  centimes,
  TVA_ABONNEMENT_POURCENT,
  type FormuleCode,
  type ModuleCode,
  type Periodicite,
} from "@/lib/abonnements";
import { remboursementAuProrata, type RaisonDepart } from "@/lib/resiliation";
import { plusUnePeriode } from "@/lib/changement-de-formule";
import type { EtatVenuDuPrestataire } from "../repositories/abonnements";

/**
 * L'adresse de l'API, surchargeable **pour les essais uniquement** — la même
 * raison que `anthropicBaseUrl` : sans elle, vérifier qu'on envoie la bonne
 * requête et qu'on lit bien la réponse supposerait d'appeler le vrai service.
 */
function base(): string {
  return process.env.ATLAS_PAIEMENT_BASE_URL?.trim() || "https://api.stripe.com";
}

/** Le paiement est-il branché ? L'écran le DEMANDE avant d'offrir un bouton. */
export function paiementConfigure(): boolean {
  return Boolean(getEnv().paiementCleSecrete);
}

/**
 * **`carte_refusee` et `confirmation_bancaire` viennent d'un débit immédiat
 * refusé** (la montée, `monterToutDeSuite`) : Stripe répond 402, et rien n'a
 * changé chez lui. Les distinguer dit au patron quoi faire : changer de carte,
 * ou répondre à sa banque.
 */
export type Echec = {
  ok: false;
  erreur: "non_configure" | "prestataire_injoignable" | "prestataire_refuse" | "carte_refusee" | "confirmation_bancaire";
};
export type Ouverture = { ok: true; url: string };

/**
 * Encode en `application/x-www-form-urlencoded`, la seule forme que l'API de
 * Stripe accepte. Les clés imbriquées s'y écrivent `a[b][c]`.
 */
function corpsFormulaire(champs: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur !== undefined) p.set(cle, String(valeur));
  }
  return p.toString();
}

async function appeler(
  chemin: string,
  methode: "GET" | "POST" | "DELETE",
  corps?: string
): Promise<{ ok: true; donnees: Record<string, unknown> } | Echec> {
  const cle = getEnv().paiementCleSecrete;
  if (!cle) return { ok: false, erreur: "non_configure" };

  let reponse: Response;
  try {
    reponse = await fetch(`${base()}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cle}`,
        ...(corps ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: corps,
      cache: "no-store",
    });
  } catch (e) {
    // **On journalise, et on ne relaie PAS le message.** Le message d'une
    // exception levée dans une action serveur n'arrive jamais jusqu'au patron
    // (`AGENTS.md`) : sans cette ligne, la panne serait muette des deux côtés.
    logger.error("Prestataire de paiement injoignable", { err: String(e), chemin });
    return { ok: false, erreur: "prestataire_injoignable" };
  }

  const texte = await reponse.text();
  let donnees: Record<string, unknown>;
  try {
    donnees = JSON.parse(texte) as Record<string, unknown>;
  } catch {
    logger.error("Réponse du prestataire illisible", { chemin, statut: reponse.status });
    return { ok: false, erreur: "prestataire_injoignable" };
  }

  if (!reponse.ok) {
    // Le détail va au journal, jamais à l'écran : il porte des identifiants de
    // compte, et il est écrit en anglais pour un développeur.
    logger.error("Le prestataire de paiement a refusé", { chemin, statut: reponse.status, reponse: donnees });
    // **402, c'est un PAIEMENT refusé**, pas une requête fausse : la carte, ou
    // la banque qui veut une confirmation (3D Secure). Avec
    // `payment_behavior=error_if_incomplete`, l'abonnement n'a pas bougé.
    if (reponse.status === 402) {
      const e = estObjet(donnees.error) ? donnees.error : {};
      const confirmation = e.code === "authentication_required" || e.decline_code === "authentication_required";
      return { ok: false, erreur: confirmation ? "confirmation_bancaire" : "carte_refusee" };
    }
    return { ok: false, erreur: "prestataire_refuse" };
  }

  return { ok: true, donnees };
}

/**
 * LE PRIX — fabriqué PAR ATLAS chez le prestataire, jamais choisi chez lui.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **C'EST LE POINT LE PLUS IMPORTANT DE CE FICHIER.** La façon ordinaire de
 * faire est de créer trois « prix » à la main dans le tableau de bord de
 * Stripe et d'en coller les identifiants dans la configuration. Ce serait une
 * **seconde grille tarifaire** : le jour où l'une change sans l'autre, l'écran
 * affiche 29 € et la banque prélève autre chose. C'est exactement ce que
 * `CLAUDE.md` §3 interdit — et sur le seul écran où cela ne se pardonne pas.
 *
 * Ici, `src/lib/abonnements.ts` décide du montant, et le prix est créé à son
 * image. **La clé de recherche porte le montant** (`atlas_artisan_mensuelle_2900`) :
 * tant que le prix ne bouge pas, le même objet est réemployé ; le jour où il
 * bouge, un objet neuf naît tout seul et l'ancien reste attaché aux abonnements
 * qui le portaient — ce qui est précisément ce qu'on veut, personne ne devant
 * être reprélevé d'un montant qu'il n'a pas accepté.
 *
 * **LES OUTILS DE PAYSAGE ENTRENT DANS CE MÊME PRIX** (18 et 19 novembre 2026) :
 * « Artisan, avec les outils de paysage » est un prix à lui
 * (`atlas_artisan_paysage_mensuelle_4500`), jamais une seconde ligne. Un
 * abonnement Atlas n'a qu'une ligne (`ligneUnique` refuse d'en deviner une
 * parmi deux), et ajouter ou retirer les outils se fait en changeant ce prix,
 * exactement comme un changement de formule : ajouter est une montée, retirer
 * une descente à l'échéance (`src/lib/changement-de-formule.ts`).
 */
async function prixDeLaFormule(
  f: (typeof FORMULES)[number],
  periodicite: Periodicite,
  modules: readonly ModuleCode[]
): Promise<{ ok: true; prix: string } | Echec> {
  const montant = centimes(f, periodicite, modules);
  // L'ordre de `MODULES`, jamais celui de l'appelant : deux ordres feraient
  // deux clés, donc deux prix, pour le même abonnement.
  const avec = MODULES.filter((m) => modules.includes(m.code));
  const cle = ["atlas", f.code, ...avec.map((m) => m.code), periodicite, montant].join("_");

  const existant = await appeler(
    `/v1/prices?lookup_keys[]=${encodeURIComponent(cle)}&active=true&limit=1`,
    "GET"
  );
  if (!existant.ok) return existant;
  const liste = existant.donnees.data;
  if (Array.isArray(liste) && liste.length > 0 && estObjet(liste[0]) && typeof liste[0].id === "string") {
    return { ok: true, prix: liste[0].id };
  }

  const cree = await appeler(
    "/v1/prices",
    "POST",
    corpsFormulaire({
      currency: "eur",
      unit_amount: montant,
      "recurring[interval]": periodicite === "annuelle" ? "year" : "month",
      lookup_key: cle,
      // Si un prix portait déjà cette clé mais n'était plus actif, la lui
      // reprendre évite un refus pour clé occupée — la seule cause possible
      // étant un prix qu'on a nous-même désactivé.
      transfer_lookup_key: "true",
      "product_data[name]": `Cause ${nomDeLAbonnement(f.code, modules)}`,
    })
  );
  if (!cree.ok) return cree;
  const id = cree.donnees.id;
  if (typeof id !== "string") {
    logger.error("Le prestataire n'a pas rendu d'identifiant de prix", { reponse: cree.donnees });
    return { ok: false, erreur: "prestataire_refuse" };
  }
  return { ok: true, prix: id };
}

/**
 * LE TAUX DE TVA — fabriqué par Atlas chez le prestataire, comme le prix.
 *
 * Même raison que `prixDeLaFormule` : un taux créé à la main dans le tableau
 * de bord serait une seconde source, et l'écran dirait HT pendant que la
 * banque prélèverait autre chose. Un taux Stripe ne se modifie pas ; il n'a
 * pas non plus de clé de recherche, d'où l'étiquette qui porte le taux : le
 * jour où le taux change, un objet neuf naît et l'ancien reste aux factures
 * déjà faites.
 *
 * **Non inclus** (`inclusive=false`) : le prix de `abonnements.ts` est HT, et
 * un taux inclus en ferait silencieusement un prix TTC, soit 20 % de recette
 * en moins sur chaque abonnement.
 */
async function tauxDeTva(): Promise<{ ok: true; taux: string } | Echec> {
  const cle = `atlas_tva_fr_${TVA_ABONNEMENT_POURCENT}`;

  const existants = await appeler("/v1/tax_rates?active=true&limit=100", "GET");
  if (!existants.ok) return existants;
  const liste = existants.donnees.data;
  if (Array.isArray(liste)) {
    for (const t of liste) {
      if (estObjet(t) && typeof t.id === "string" && estObjet(t.metadata) && t.metadata.atlas_cle === cle) {
        return { ok: true, taux: t.id };
      }
    }
  }

  const cree = await appeler(
    "/v1/tax_rates",
    "POST",
    corpsFormulaire({
      display_name: "TVA",
      percentage: TVA_ABONNEMENT_POURCENT,
      inclusive: "false",
      country: "FR",
      jurisdiction: "FR",
      "metadata[atlas_cle]": cle,
    })
  );
  if (!cree.ok) return cree;
  const id = cree.donnees.id;
  if (typeof id !== "string") {
    logger.error("Le prestataire n'a pas rendu d'identifiant de taux de TVA", { reponse: cree.donnees });
    return { ok: false, erreur: "prestataire_refuse" };
  }
  return { ok: true, taux: id };
}

/**
 * OUVRIR LE PAIEMENT — la page hébergée où il saisit sa carte.
 *
 * **`metadata` porte la formule choisie, et ses modules**, et c'est par là
 * qu'on les relit au retour : déduire la formule du montant obligerait à faire
 * correspondre des centimes à une grille, et une remise suffirait à tout
 * fausser.
 */
export async function ouvrirLePaiement(params: {
  entrepriseId: string;
  email: string | null;
  formule: FormuleCode;
  periodicite: Periodicite;
  modules: readonly ModuleCode[];
  /** Où le patron revient — succès et abandon. Fournies par l'appelant. */
  retourSucces: string;
  retourAbandon: string;
}): Promise<Ouverture | Echec> {
  const f = formule(params.formule);
  if (!f) return { ok: false, erreur: "prestataire_refuse" };

  const prix = await prixDeLaFormule(f, params.periodicite, params.modules);
  if (!prix.ok) return prix;
  const tva = await tauxDeTva();
  if (!tva.ok) return tva;

  const corps = corpsFormulaire({
    mode: "subscription",
    locale: "fr",
    success_url: params.retourSucces,
    cancel_url: params.retourAbandon,
    // De quoi retrouver l'entreprise au retour, sans jamais la demander au
    // navigateur — qui pourrait en écrire une autre.
    client_reference_id: params.entrepriseId,
    ...(params.email ? { customer_email: params.email } : {}),
    "line_items[0][quantity]": 1,
    "line_items[0][price]": prix.prix,
    "subscription_data[metadata][entreprise_id]": params.entrepriseId,
    "subscription_data[metadata][formule]": params.formule,
    "subscription_data[metadata][periodicite]": params.periodicite,
    "subscription_data[metadata][modules]": etiquetteDesModules(params.modules),
    // Sur l'abonnement, pas sur la ligne : un changement de formule remplace
    // la ligne, et la TVA partirait avec elle.
    "subscription_data[default_tax_rates][0]": tva.taux,
  });

  const r = await appeler("/v1/checkout/sessions", "POST", corps);
  if (!r.ok) return r;

  const url = r.donnees.url;
  if (typeof url !== "string") {
    logger.error("Le prestataire n'a pas rendu d'adresse de paiement", { reponse: r.donnees });
    return { ok: false, erreur: "prestataire_refuse" };
  }
  return { ok: true, url };
}

/**
 * OUVRIR LE GUICHET — « gérer mon abonnement », hébergé par le prestataire.
 *
 * C'est là qu'il change de carte, change de formule, résilie et retélécharge
 * ses factures. **Ne pas le réécrire dans Atlas** : cet écran-là porte des
 * obligations d'information qui changent avec la loi, et c'est précisément ce
 * qu'on achète en payant 0,7 % de Billing.
 */
export async function ouvrirLeGuichet(params: {
  clientPrestataire: string;
  retour: string;
}): Promise<Ouverture | Echec> {
  const r = await appeler(
    "/v1/billing_portal/sessions",
    "POST",
    corpsFormulaire({ customer: params.clientPrestataire, return_url: params.retour, locale: "fr" })
  );
  if (!r.ok) return r;

  const url = r.donnees.url;
  if (typeof url !== "string") {
    logger.error("Le prestataire n'a pas rendu d'adresse de guichet", { reponse: r.donnees });
    return { ok: false, erreur: "prestataire_refuse" };
  }
  return { ok: true, url };
}

/**
 * CE QU'ON RELIT APRÈS LE PAIEMENT — la session, et l'abonnement qu'elle a créé.
 *
 * `expand[]=subscription` évite un second appel : sans lui, la session ne rend
 * qu'un identifiant, et il faudrait rappeler Stripe pendant que le patron
 * regarde une page blanche.
 */
export async function lireLaSessionDePaiement(
  sessionId: string
): Promise<{ ok: true; etat: EtatVenuDuPrestataire; entrepriseId: string | null } | Echec> {
  const r = await appeler(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, "GET");
  if (!r.ok) return r;

  const abonnementBrut = r.donnees.subscription;
  if (!estObjet(abonnementBrut)) {
    logger.error("La session de paiement ne porte aucun abonnement", { sessionId });
    return { ok: false, erreur: "prestataire_refuse" };
  }

  const etat = lireUnAbonnement(abonnementBrut);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };

  const reference = r.donnees.client_reference_id;
  return { ok: true, etat, entrepriseId: typeof reference === "string" ? reference : null };
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * L'ÉTIQUETTE DES MODULES : « paysage », ou vide. **Vide l'efface** chez le
 * prestataire : c'est ainsi qu'un abonnement qui retire ses outils perd aussi
 * l'étiquette qui les lui rendait.
 */
function etiquetteDesModules(modules: readonly ModuleCode[]): string {
  return MODULES.filter((m) => modules.includes(m.code))
    .map((m) => m.code)
    .join(",");
}

/** Relit l'étiquette ; `null` quand elle nomme un module qu'Atlas ne connaît pas. */
function modulesLus(brut: unknown): ModuleCode[] | null {
  if (brut === undefined || brut === null || brut === "") return [];
  if (typeof brut !== "string") return null;
  const codes = brut.split(",").map((c) => c.trim());
  return codes.every(estModule) ? (codes as ModuleCode[]) : null;
}

/**
 * LA TRADUCTION D'UN ABONNEMENT STRIPE EN ÉTAT D'ATLAS.
 *
 * **Exportée, parce que le crochet en a besoin autant que le retour de
 * paiement** — et qu'il ne doit exister qu'une seule lecture de cet objet.
 * Deux traductions donneraient deux vérités sur la même ligne, et l'on ne
 * saurait laquelle a écrit ce qui est en base.
 *
 * **Rend `null` plutôt que de deviner.** Un abonnement dont on ne sait pas
 * dire la formule ne s'enregistre pas : mieux vaut un écran qui dit « aucun
 * abonnement » qu'un écran qui affiche la mauvaise formule sur un plafond
 * qu'il ferait respecter.
 */
export function lireUnAbonnement(brut: Record<string, unknown>): EtatVenuDuPrestataire | null {
  const id = brut.id;
  const client = brut.customer;
  if (typeof id !== "string") return null;

  // `customer` arrive tantôt en identifiant, tantôt en objet développé selon
  // ce que l'appel a demandé — les deux formes sont documentées.
  const clientId = typeof client === "string" ? client : estObjet(client) && typeof client.id === "string" ? client.id : null;
  if (!clientId) return null;

  const meta = estObjet(brut.metadata) ? brut.metadata : {};
  const codeFormule = meta.formule;
  const codePeriodicite = meta.periodicite;
  if (!FORMULES.some((f) => f.code === codeFormule)) {
    logger.error("Abonnement sans formule reconnue", { abonnement: id, formule: String(codeFormule) });
    return null;
  }
  if (codePeriodicite !== "mensuelle" && codePeriodicite !== "annuelle") {
    logger.error("Abonnement sans périodicité reconnue", { abonnement: id, periodicite: String(codePeriodicite) });
    return null;
  }
  // Un module inconnu : on ne devine pas ce qui est payé, pour la même raison
  // qu'une formule inconnue. Absent ou vide : aucun module, les abonnements
  // d'avant le 18 novembre 2026 n'en portent pas.
  const modules = modulesLus(meta.modules);
  if (!modules) {
    logger.error("Abonnement aux modules non reconnus", { abonnement: id, modules: String(meta.modules) });
    return null;
  }

  return {
    formule: codeFormule as FormuleCode,
    modules,
    periodicite: codePeriodicite,
    statut: statutLu(brut.status),
    periodeFin: finDePeriode(brut),
    annulationDemandee: brut.cancel_at_period_end === true,
    clientPrestataire: clientId,
    abonnementPrestataire: id,
    changementPrevu: calendrierDe(brut) !== null,
  };
}

/** Le calendrier de l'abonnement (« subscription schedule »), identifiant ou objet développé. */
function calendrierDe(brut: Record<string, unknown>): string | null {
  const c = brut.schedule;
  if (typeof c === "string") return c;
  if (estObjet(c) && typeof c.id === "string") return c.id;
  return null;
}

/** Ce qu'une facture PAYÉE de Stripe dit, et qu'Atlas recopie sur la sienne. */
export type FacturePayeeLue = {
  /** L'identifiant Stripe : il rend l'émission rejouable sans doublon. */
  facturePrestataire: string;
  abonnementPrestataire: string;
  htCentimes: number;
  tvaCentimes: number;
  ttcCentimes: number;
  /** `AAAA-MM-JJ` */
  payeeLe: string;
  periodeDebut: string;
  periodeFin: string;
};

const jourIsoDeSecondes = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);

/**
 * LIRE UNE FACTURE PAYÉE (`invoice.paid`), pour la facture d'abonnement
 * qu'Atlas émet lui-même (5 novembre 2026, `src/lib/facture-atlas.ts`).
 *
 * **Deux formes de l'abonnement, toutes deux documentées** : l'ancienne
 * (`subscription` à la racine) et celle des versions récentes de l'API
 * (`parent.subscription_details.subscription`). Le HT est
 * `total_excluding_tax`, la TVA ce qui sépare ce HT du total : ce sont les
 * montants PRÉLEVÉS, prorata compris, jamais une grille recalculée ici.
 *
 * Une facture non payée, à zéro (un essai), ou à laquelle il manque un
 * morceau : `null`, et rien ne s'émet. Une facture à zéro n'est pas une vente.
 */
export function lireUneFacturePayee(brut: Record<string, unknown>): FacturePayeeLue | null {
  if (brut.object !== "invoice" || typeof brut.id !== "string" || brut.status !== "paid") return null;
  const parent = estObjet(brut.parent) && estObjet(brut.parent.subscription_details) ? brut.parent.subscription_details : null;
  const sub = brut.subscription ?? parent?.subscription;
  const abonnement = typeof sub === "string" ? sub : estObjet(sub) && typeof sub.id === "string" ? sub.id : null;
  const total = brut.total;
  const ht = brut.total_excluding_tax;
  if (!abonnement || typeof total !== "number" || typeof ht !== "number" || total <= 0) return null;

  const transitions = estObjet(brut.status_transitions) ? brut.status_transitions : {};
  const payeeA = typeof transitions.paid_at === "number" ? transitions.paid_at : typeof brut.created === "number" ? brut.created : null;
  const lignes = estObjet(brut.lines) && Array.isArray(brut.lines.data) ? brut.lines.data : [];
  const periode = lignes.length > 0 && estObjet(lignes[0]) && estObjet(lignes[0].period) ? lignes[0].period : null;
  if (payeeA === null || !periode || typeof periode.start !== "number" || typeof periode.end !== "number") {
    logger.error("Facture payée illisible : date ou période absente", { facture: brut.id });
    return null;
  }
  return {
    facturePrestataire: brut.id,
    abonnementPrestataire: abonnement,
    htCentimes: ht,
    tvaCentimes: total - ht,
    ttcCentimes: total,
    payeeLe: jourIsoDeSecondes(payeeA),
    periodeDebut: jourIsoDeSecondes(periode.start),
    // La fin de période Stripe est l'instant où la suivante commence : le
    // dernier jour payé est la veille.
    periodeFin: jourIsoDeSecondes(periode.end - 1),
  };
}

/**
 * **Un état inconnu vaut « impayé », jamais « actif ».** C'est le seul repli
 * qui ne donne rien gratuitement : se tromper vers l'actif offrirait
 * l'application à un abonnement que Stripe considère mort, et personne ne le
 * verrait. Se tromper vers l'impayé fait apparaître un bandeau que le patron
 * signalera dans la journée.
 */
function statutLu(brut: unknown): EtatVenuDuPrestataire["statut"] {
  switch (brut) {
    case "active":
    case "trialing":
      return "actif";
    case "canceled":
      return "resilie";
    default:
      return "impaye";
  }
}

/**
 * LA FIN DE LA PÉRIODE PAYÉE — cherchée à DEUX endroits, et ce n'est pas un
 * pansement.
 *
 * Stripe a déplacé `current_period_end` de l'abonnement vers ses lignes : les
 * deux emplacements sont documentés, et lequel répond dépend de la version
 * d'API du compte — que le patron n'a pas encore créé, donc qu'on ne peut pas
 * connaître d'ici. Ne lire qu'un seul endroit reviendrait à parier sur une
 * version, et à afficher « prochain paiement : jamais » si le pari est perdu.
 *
 * `null` quand aucun des deux ne répond : la date ne se devine pas — un
 * prélèvement annoncé le mauvais jour vaut un mensonge.
 */
function finDePeriode(brut: Record<string, unknown>): Date | null {
  const direct = brut.current_period_end;
  if (typeof direct === "number") return new Date(direct * 1000);

  const lignes = estObjet(brut.items) ? brut.items.data : null;
  if (Array.isArray(lignes) && lignes.length > 0 && estObjet(lignes[0])) {
    const surLaLigne = lignes[0].current_period_end;
    if (typeof surLaLigne === "number") return new Date(surLaLigne * 1000);
  }
  return null;
}

/** Le début de la période payée, aux deux mêmes endroits que `finDePeriode`, et pour la même raison. */
function debutDePeriode(brut: Record<string, unknown>): number | null {
  if (typeof brut.current_period_start === "number") return brut.current_period_start;
  const lignes = estObjet(brut.items) ? brut.items.data : null;
  if (Array.isArray(lignes) && lignes.length > 0 && estObjet(lignes[0]) && typeof lignes[0].current_period_start === "number") {
    return lignes[0].current_period_start;
  }
  return null;
}

/**
 * La ligne unique d'un abonnement d'Atlas, et son prix. Une ligne devinée
 * ferait naître une SECONDE ligne facturée à côté de la première : deux
 * lignes, ou une ligne sans identifiant, se refusent.
 */
function ligneUnique(brut: Record<string, unknown>): { ligne: string; prix: string | null } | null {
  const lignes = estObjet(brut.items) ? brut.items.data : null;
  if (!Array.isArray(lignes) || lignes.length !== 1 || !estObjet(lignes[0]) || typeof lignes[0].id !== "string") return null;
  const p = lignes[0].price;
  return { ligne: lignes[0].id, prix: typeof p === "string" ? p : estObjet(p) && typeof p.id === "string" ? p.id : null };
}

async function lireLAbonnement(id: string): Promise<{ ok: true; brut: Record<string, unknown> } | Echec> {
  const r = await appeler(`/v1/subscriptions/${encodeURIComponent(id)}`, "GET");
  return r.ok ? { ok: true, brut: r.donnees } : r;
}

/**
 * Retire le calendrier d'un abonnement, s'il en a un : l'abonnement continue
 * tel qu'il est, à sa formule payée, et ce qui attendait l'échéance n'arrivera
 * pas. Aucun argent ne bouge.
 */
async function libererLeCalendrier(brut: Record<string, unknown>): Promise<{ ok: true } | Echec> {
  const calendrier = calendrierDe(brut);
  if (!calendrier) return { ok: true };
  const r = await appeler(`/v1/subscription_schedules/${encodeURIComponent(calendrier)}/release`, "POST", "");
  return r.ok ? { ok: true } : r;
}

/**
 * CHANGER DE FORMULE TOUT DE SUITE — et DÉBITER tout de suite, ses décisions
 * du 23 novembre 2026 (`src/lib/changement-de-formule.ts`). Payé pour de vrai
 * avec une clé de test, l'ancien changement (au prorata, sur la facture
 * suivante) offrait la formule du dessus à qui montait puis résiliait.
 *
 * | `facon` | Ce que Stripe reçoit | Ce qui est débité |
 * |---|---|---|
 * | `monter-au-mois` | `billing_cycle_anchor=now`, `proration_behavior=none` | le mois entier de la nouvelle formule, aujourd'hui devient l'échéance |
 * | `passer-a-l-annee` | les mêmes | l'année entière |
 * | `monter-a-l-annee` | `proration_behavior=always_invoice`, `proration_date` = début de la période | l'ancienne année créditée en entier, la nouvelle due en entier : la DIFFÉRENCE ENTIÈRE, jamais au prorata ; l'échéance ne bouge pas |
 *
 * **`payment_behavior=error_if_incomplete`** : si le paiement ne passe pas
 * (carte refusée, ou banque qui veut une confirmation), Stripe répond 402 et
 * l'abonnement NE CHANGE PAS. C'est ce que dit la feuille : « Vous restez sur
 * Artisan, rien n'est débité ».
 *
 * **NON ÉPROUVÉ CONTRE STRIPE** (sa documentation n'est pas joignable d'ici) :
 * que `proration_date` au début de la période soit accepté et donne bien la
 * différence entière, et la forme exacte du refus 3D Secure. À jouer sur son
 * espace avec sa clé de test, avant toute livraison (`TODO.md`).
 *
 * **Pourquoi PAS le guichet du prestataire.** Son portail sait changer de
 * formule, à condition qu'on y ait déclaré les prix à la main : la seconde
 * grille tarifaire que `prixDeLaFormule` refuse. **Et surtout PAS un second
 * abonnement** : il serait prélevé deux fois, tous les mois.
 */
export async function monterToutDeSuite(params: {
  abonnementPrestataire: string;
  formule: FormuleCode;
  periodicite: Periodicite;
  /** Les modules VOULUS, pas ceux d'avant : ajouter les outils est une montée. */
  modules: readonly ModuleCode[];
  facon: "monter-au-mois" | "monter-a-l-annee" | "passer-a-l-annee";
}): Promise<{ ok: true; etat: EtatVenuDuPrestataire } | Echec> {
  const f = formule(params.formule);
  if (!f) return { ok: false, erreur: "prestataire_refuse" };

  const lu = await lireLAbonnement(params.abonnementPrestataire);
  if (!lu.ok) return lu;
  const ligne = ligneUnique(lu.brut);
  if (!ligne) {
    logger.error("Abonnement dont la ligne ne se lit pas", { abonnement: params.abonnementPrestataire });
    return { ok: false, erreur: "prestataire_refuse" };
  }

  // La différence entière se compte depuis le début de la période : sans lui,
  // Stripe ferait un prorata, et le montant débité ne serait plus celui que
  // la feuille a annoncé. On refuse plutôt que de le deviner.
  const debut = debutDePeriode(lu.brut);
  if (params.facon === "monter-a-l-annee" && debut === null) {
    logger.error("Début de période illisible : la différence à l'année ne se calcule pas", { abonnement: params.abonnementPrestataire });
    return { ok: false, erreur: "prestataire_refuse" };
  }

  const prix = await prixDeLaFormule(f, params.periodicite, params.modules);
  if (!prix.ok) return prix;

  // Un calendrier resté chez le prestataire (une descente que l'écran ne
  // savait plus) ramènerait l'ancienne formule à l'échéance : il part avant.
  const libre = await libererLeCalendrier(lu.brut);
  if (!libre.ok) return libre;

  const r = await appeler(
    `/v1/subscriptions/${encodeURIComponent(params.abonnementPrestataire)}`,
    "POST",
    corpsFormulaire({
      "items[0][id]": ligne.ligne,
      "items[0][price]": prix.prix,
      payment_behavior: "error_if_incomplete",
      ...(params.facon === "monter-a-l-annee"
        ? { proration_behavior: "always_invoice", proration_date: debut ?? undefined }
        : { proration_behavior: "none", billing_cycle_anchor: "now" }),
      // La formule se relit dans les étiquettes, ici comme au premier paiement :
      // une seule façon de savoir quelle formule porte un abonnement.
      "metadata[formule]": params.formule,
      "metadata[periodicite]": params.periodicite,
      "metadata[modules]": etiquetteDesModules(params.modules),
      // Un changement de formule annule une résiliation en cours : il vient de
      // choisir de rester. Laisser le drapeau couperait son abonnement neuf à
      // la fin de la période, sans que rien ne l'en avertisse.
      cancel_at_period_end: "false",
    })
  );
  if (!r.ok) return r;

  const etat = lireUnAbonnement(r.donnees);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };
  return { ok: true, etat };
}

/**
 * CHANGER DE FORMULE À L'ÉCHÉANCE — descendre, ou passer de l'année au mois :
 * rien n'est débité aujourd'hui, et il garde jusque-là la formule qu'il a
 * payée (sa décision du 23 novembre 2026, l'article 14.6).
 *
 * **Un calendrier chez le prestataire** (« subscription schedule ») : la
 * période en cours, telle quelle, puis la nouvelle formule. Changer le prix de
 * l'abonnement lui-même ne convient pas : de l'année au mois, Stripe remet
 * l'échéance à aujourd'hui et débite sur-le-champ. Les étiquettes de la phase
 * qui commence passent sur l'abonnement le jour venu ; le crochet relit alors
 * la nouvelle formule, et la ligne d'Atlas avec elle.
 *
 * Un calendrier déjà là (une descente précédente) est retiré d'abord : on
 * repart de l'abonnement tel qu'il est, plutôt que de recomposer ses phases.
 *
 * **La TVA est redonnée à chaque phase** : une phase sans taux ferait partir
 * la nouvelle formule hors taxe, soit 20 % de recette en moins chaque mois.
 *
 * **NON ÉPROUVÉ CONTRE STRIPE**, comme `monterToutDeSuite` : à jouer sur son
 * espace avec sa clé de test.
 */
export async function prevoirALEcheance(params: {
  abonnementPrestataire: string;
  formule: FormuleCode;
  periodicite: Periodicite;
  /** Les modules VOULUS, pas ceux d'avant : les retirer, c'est passer une liste vide. */
  modules: readonly ModuleCode[];
}): Promise<{ ok: true; etat: EtatVenuDuPrestataire } | Echec> {
  const f = formule(params.formule);
  if (!f) return { ok: false, erreur: "prestataire_refuse" };

  const lu = await lireLAbonnement(params.abonnementPrestataire);
  if (!lu.ok) return lu;
  const ligne = ligneUnique(lu.brut);
  const meta = estObjet(lu.brut.metadata) ? lu.brut.metadata : {};
  if (!ligne?.prix || typeof meta.formule !== "string" || typeof meta.periodicite !== "string") {
    logger.error("Abonnement illisible : la descente ne se prévoit pas", { abonnement: params.abonnementPrestataire });
    return { ok: false, erreur: "prestataire_refuse" };
  }

  const libre = await libererLeCalendrier(lu.brut);
  if (!libre.ok) return libre;

  const cree = await appeler(
    "/v1/subscription_schedules",
    "POST",
    corpsFormulaire({ from_subscription: params.abonnementPrestataire })
  );
  if (!cree.ok) return cree;
  const calendrier = cree.donnees.id;
  const phases = cree.donnees.phases;
  const phase = Array.isArray(phases) && phases.length > 0 && estObjet(phases[0]) ? phases[0] : null;
  if (typeof calendrier !== "string" || !phase || typeof phase.start_date !== "number" || typeof phase.end_date !== "number") {
    logger.error("Calendrier du prestataire illisible", { abonnement: params.abonnementPrestataire });
    return { ok: false, erreur: "prestataire_refuse" };
  }

  const prix = await prixDeLaFormule(f, params.periodicite, params.modules);
  if (!prix.ok) return prix;
  const tva = await tauxDeTva();
  if (!tva.ok) return tva;

  // La nouvelle formule court une période, puis le calendrier se retire et
  // l'abonnement continue seul : `end_date` plutôt qu'un nombre de
  // répétitions, dont le nom change d'une version de l'API à l'autre.
  const finDeLaSuivante = Math.round(plusUnePeriode(new Date(phase.end_date * 1000), params.periodicite).getTime() / 1000);
  // Les modules se redisent à chaque phase : une phase sans leur étiquette
  // les ferait perdre à l'échéance, et `lireUnAbonnement` lirait « aucun ».
  const etiquettes = (formuleCode: string, periodicite: string, modules: string) => ({
    entreprise_id: typeof meta.entreprise_id === "string" ? meta.entreprise_id : undefined,
    formule: formuleCode,
    periodicite,
    modules,
  });
  const champs: Record<string, string | number | undefined> = {
    end_behavior: "release",
    proration_behavior: "none",
    "phases[0][items][0][price]": ligne.prix,
    "phases[0][items][0][quantity]": 1,
    "phases[0][start_date]": phase.start_date,
    "phases[0][end_date]": phase.end_date,
    "phases[0][default_tax_rates][0]": tva.taux,
    "phases[0][proration_behavior]": "none",
    "phases[1][items][0][price]": prix.prix,
    "phases[1][items][0][quantity]": 1,
    "phases[1][end_date]": finDeLaSuivante,
    "phases[1][default_tax_rates][0]": tva.taux,
    "phases[1][proration_behavior]": "none",
  };
  const modulesPayes = typeof meta.modules === "string" ? meta.modules : "";
  for (const [cle, valeur] of Object.entries(etiquettes(meta.formule, meta.periodicite, modulesPayes))) {
    champs[`phases[0][metadata][${cle}]`] = valeur;
  }
  for (const [cle, valeur] of Object.entries(etiquettes(params.formule, params.periodicite, etiquetteDesModules(params.modules)))) {
    champs[`phases[1][metadata][${cle}]`] = valeur;
  }

  const maj = await appeler(`/v1/subscription_schedules/${encodeURIComponent(calendrier)}`, "POST", corpsFormulaire(champs));
  if (!maj.ok) return maj;

  // L'abonnement relu : il porte maintenant son calendrier, et toujours la
  // formule payée jusqu'à l'échéance.
  const relu = await lireLAbonnement(params.abonnementPrestataire);
  if (!relu.ok) return relu;
  const etat = lireUnAbonnement(relu.brut);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };
  return { ok: true, etat };
}

/**
 * « GARDER ENTREPRISE » — la descente prévue est retirée, l'abonnement
 * continue à sa formule payée. Aucun argent ne bouge.
 */
export async function garderLaFormule(params: {
  abonnementPrestataire: string;
}): Promise<{ ok: true; etat: EtatVenuDuPrestataire } | Echec> {
  const lu = await lireLAbonnement(params.abonnementPrestataire);
  if (!lu.ok) return lu;
  const libre = await libererLeCalendrier(lu.brut);
  if (!libre.ok) return libre;
  const relu = await lireLAbonnement(params.abonnementPrestataire);
  if (!relu.ok) return relu;
  const etat = lireUnAbonnement(relu.brut);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };
  return { ok: true, etat };
}

/**
 * LES RAISONS DE DÉPART, dans les mots du prestataire. Il les range sur la
 * résiliation, où le patron les lit dans son tableau de bord et son
 * application (sa question du 18 octobre 2026 : « moi, où je le vois ? »).
 */
const RETOUR_DU_PRESTATAIRE: Record<RaisonDepart, string> = {
  trop_cher: "too_expensive",
  peu_servi: "unused",
  manque: "missing_features",
};

function champsDuDepart(raison: RaisonDepart | null, texte: string | null) {
  return {
    "cancellation_details[feedback]": raison ? RETOUR_DU_PRESTATAIRE[raison] : undefined,
    "cancellation_details[comment]": texte ?? undefined,
  };
}

/**
 * RÉSILIER À L'ÉCHÉANCE — il garde tout jusqu'à la date payée.
 *
 * C'est la résiliation ordinaire, celle de l'écran « Avant de partir ». Rien
 * n'est rendu, rien n'est coupé : l'abonnement s'arrête de lui-même à la fin
 * de la période, et la lecture seule prend le relais (`etatDeLAcces`).
 */
export async function demanderLaResiliation(params: {
  abonnementPrestataire: string;
  raison: RaisonDepart | null;
  texte: string | null;
}): Promise<{ ok: true; etat: EtatVenuDuPrestataire } | Echec> {
  // **Une descente prévue n'a plus d'objet** : l'abonnement s'arrête à cette
  // même échéance. Le calendrier part d'abord, sans quoi il porterait encore
  // la phase suivante, et le prestataire refuserait l'arrêt.
  const lu = await lireLAbonnement(params.abonnementPrestataire);
  if (!lu.ok) return lu;
  const libre = await libererLeCalendrier(lu.brut);
  if (!libre.ok) return libre;

  const r = await appeler(
    `/v1/subscriptions/${encodeURIComponent(params.abonnementPrestataire)}`,
    "POST",
    corpsFormulaire({ cancel_at_period_end: "true", ...champsDuDepart(params.raison, params.texte) })
  );
  if (!r.ok) return r;
  const etat = lireUnAbonnement(r.donnees);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };
  return { ok: true, etat };
}

/** « Ne pas arrêter » : la résiliation demandée est retirée, l'abonnement continue. */
export async function retirerLaResiliation(params: {
  abonnementPrestataire: string;
}): Promise<{ ok: true; etat: EtatVenuDuPrestataire } | Echec> {
  const r = await appeler(
    `/v1/subscriptions/${encodeURIComponent(params.abonnementPrestataire)}`,
    "POST",
    corpsFormulaire({ cancel_at_period_end: "false" })
  );
  if (!r.ok) return r;
  const etat = lireUnAbonnement(r.donnees);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };
  return { ok: true, etat };
}

/**
 * LE PAIEMENT DE LA PÉRIODE EN COURS : combien, et sur quoi le rendre.
 *
 * Lu sur la dernière facture de l'abonnement. Deux formes documentées selon la
 * version d'API du compte (comme `finDePeriode`) : `payment_intent` sur la
 * facture, ou la liste `payments`. Aucune ne répond : `null`, et rien ne part.
 */
function paiementDeLaPeriode(abonnement: Record<string, unknown>): { payeCentimes: number; paiement: string } | null {
  const facture = abonnement.latest_invoice;
  if (!estObjet(facture) || typeof facture.amount_paid !== "number") return null;
  const direct = facture.payment_intent;
  if (typeof direct === "string") return { payeCentimes: facture.amount_paid, paiement: direct };
  if (estObjet(direct) && typeof direct.id === "string") return { payeCentimes: facture.amount_paid, paiement: direct.id };
  const liste = estObjet(facture.payments) ? facture.payments.data : null;
  if (Array.isArray(liste) && liste.length > 0 && estObjet(liste[0]) && estObjet(liste[0].payment)) {
    const pi = liste[0].payment.payment_intent;
    if (typeof pi === "string") return { payeCentimes: facture.amount_paid, paiement: pi };
  }
  return null;
}

/**
 * REFUSER DE NOUVELLES CONDITIONS — résilier tout de suite, et rendre les mois
 * payés et non utilisés. Son choix du 18 octobre 2026 (la B,
 * `docs/A-FAIRE.md` §17) : c'est nous qui changeons les règles, il ne perd pas
 * ce qu'il a payé.
 *
 * **L'ordre compte.** Le montant se calcule AVANT la résiliation (après, la
 * période n'existe plus) ; la résiliation part ensuite ; le remboursement en
 * dernier. Si le remboursement échoue, la résiliation reste faite et l'échec
 * est journalisé avec le montant dû : on le rend à la main, jamais deux fois.
 */
export async function resilierEtRembourser(params: {
  abonnementPrestataire: string;
  raison: RaisonDepart | null;
  texte: string | null;
  maintenant: Date;
}): Promise<
  | { ok: true; etat: EtatVenuDuPrestataire; rembourseCentimes: number; moisNonUtilises: number; remboursementEchoue: boolean }
  | Echec
> {
  const id = encodeURIComponent(params.abonnementPrestataire);
  const lu = await appeler(
    `/v1/subscriptions/${id}?expand[]=latest_invoice&expand[]=latest_invoice.payments`,
    "GET"
  );
  if (!lu.ok) return lu;
  const avant = lireUnAbonnement(lu.donnees);
  if (!avant) return { ok: false, erreur: "prestataire_refuse" };

  const paye = paiementDeLaPeriode(lu.donnees);
  const du = paye
    ? remboursementAuProrata({
        payeCentimes: paye.payeCentimes,
        periodicite: avant.periodicite,
        finDePeriode: avant.periodeFin,
        maintenant: params.maintenant,
      })
    : null;

  // Les paramètres d'une suppression passent dans l'adresse, pas dans un corps.
  // Un second appui tombe ici sur un abonnement déjà résilié, que le
  // prestataire refuse : le remboursement plus bas ne part donc qu'une fois.
  const parametres = corpsFormulaire(champsDuDepart(params.raison, params.texte));
  const fin = await appeler(`/v1/subscriptions/${id}${parametres ? `?${parametres}` : ""}`, "DELETE");
  if (!fin.ok) return fin;
  const etat = lireUnAbonnement(fin.donnees);
  if (!etat) return { ok: false, erreur: "prestataire_refuse" };

  if (!du || !paye) {
    // On ne sait pas combien rendre : on ne devine pas. Le journal le dit, et
    // le patron le rend à la main.
    logger.error("Refus des conditions : remboursement à faire à la main, paiement illisible", {
      abonnement: params.abonnementPrestataire,
    });
    return { ok: true, etat, rembourseCentimes: 0, moisNonUtilises: du?.moisNonUtilises ?? 0, remboursementEchoue: true };
  }
  if (du.centimes === 0) {
    return { ok: true, etat, rembourseCentimes: 0, moisNonUtilises: du.moisNonUtilises, remboursementEchoue: false };
  }

  const rendu = await appeler(
    "/v1/refunds",
    "POST",
    corpsFormulaire({
      payment_intent: paye.paiement,
      amount: du.centimes,
      reason: "requested_by_customer",
      "metadata[motif]": "refus_nouvelles_conditions",
      "metadata[mois_non_utilises]": du.moisNonUtilises,
    })
  );
  if (!rendu.ok) {
    logger.error("Refus des conditions : le remboursement a échoué, à rendre à la main", {
      abonnement: params.abonnementPrestataire,
      centimes: du.centimes,
    });
    return { ok: true, etat, rembourseCentimes: 0, moisNonUtilises: du.moisNonUtilises, remboursementEchoue: true };
  }
  return { ok: true, etat, rembourseCentimes: du.centimes, moisNonUtilises: du.moisNonUtilises, remboursementEchoue: false };
}


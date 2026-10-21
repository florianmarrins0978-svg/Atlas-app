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
import { FORMULES, formule, centimes, type FormuleCode, type Periodicite } from "@/lib/abonnements";
import { remboursementAuProrata, type RaisonDepart } from "@/lib/resiliation";
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

export type Echec = { ok: false; erreur: "non_configure" | "prestataire_injoignable" | "prestataire_refuse" };
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
 */
async function prixDeLaFormule(f: (typeof FORMULES)[number], periodicite: Periodicite): Promise<{ ok: true; prix: string } | Echec> {
  const montant = centimes(f, periodicite);
  const cle = `atlas_${f.code}_${periodicite}_${montant}`;

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
      "product_data[name]": `Atlas ${f.nom}`,
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
 * OUVRIR LE PAIEMENT — la page hébergée où il saisit sa carte.
 *
 * **`metadata` porte la formule choisie**, et c'est par là qu'on la relit au
 * retour : déduire la formule du montant obligerait à faire correspondre des
 * centimes à une grille, et une remise suffirait à tout fausser.
 */
export async function ouvrirLePaiement(params: {
  entrepriseId: string;
  email: string | null;
  formule: FormuleCode;
  periodicite: Periodicite;
  /** Où le patron revient — succès et abandon. Fournies par l'appelant. */
  retourSucces: string;
  retourAbandon: string;
}): Promise<Ouverture | Echec> {
  const f = formule(params.formule);
  if (!f) return { ok: false, erreur: "prestataire_refuse" };

  const prix = await prixDeLaFormule(f, params.periodicite);
  if (!prix.ok) return prix;

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

  return {
    formule: codeFormule as FormuleCode,
    periodicite: codePeriodicite,
    statut: statutLu(brut.status),
    periodeFin: finDePeriode(brut),
    annulationDemandee: brut.cancel_at_period_end === true,
    clientPrestataire: clientId,
    abonnementPrestataire: id,
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

/**
 * CHANGER DE FORMULE — au prorata, sans repasser par la carte bancaire.
 *
 * C'est ce que l'article 14.6 des conditions annonce : *« le changement prend
 * effet immédiatement, et la différence est calculée au prorata »*. Sans cette
 * fonction, cet article serait une promesse que le code ne tient pas.
 *
 * **Pourquoi PAS le guichet du prestataire.** Son portail sait changer de
 * formule — à condition qu'on y ait déclaré les prix à la main. C'est
 * exactement la seconde grille tarifaire que `prixDeLaFormule` refuse. Le
 * changement se fait donc ici, avec le montant qu'Atlas connaît.
 *
 * **Et surtout PAS un second abonnement.** Ouvrir une nouvelle page de
 * paiement pour qui est déjà abonné le ferait prélever deux fois, sur deux
 * abonnements vivants — le défaut le plus cher que cet écran puisse produire.
 */
export async function changerLaFormule(params: {
  abonnementPrestataire: string;
  formule: FormuleCode;
  periodicite: Periodicite;
}): Promise<{ ok: true; etat: EtatVenuDuPrestataire } | Echec> {
  const f = formule(params.formule);
  if (!f) return { ok: false, erreur: "prestataire_refuse" };

  // La ligne à remplacer : un abonnement Atlas n'en a qu'une, et la lire vaut
  // mieux que de la supposer — une ligne devinée ferait naître une SECONDE
  // ligne facturée à côté de la première.
  const actuel = await appeler(`/v1/subscriptions/${encodeURIComponent(params.abonnementPrestataire)}`, "GET");
  if (!actuel.ok) return actuel;

  const lignes = estObjet(actuel.donnees.items) ? actuel.donnees.items.data : null;
  if (!Array.isArray(lignes) || lignes.length !== 1 || !estObjet(lignes[0]) || typeof lignes[0].id !== "string") {
    logger.error("Abonnement dont la ligne ne se lit pas", { abonnement: params.abonnementPrestataire });
    return { ok: false, erreur: "prestataire_refuse" };
  }
  const ligneId = lignes[0].id;

  const prix = await prixDeLaFormule(f, params.periodicite);
  if (!prix.ok) return prix;

  const r = await appeler(
    `/v1/subscriptions/${encodeURIComponent(params.abonnementPrestataire)}`,
    "POST",
    corpsFormulaire({
      "items[0][id]": ligneId,
      "items[0][price]": prix.prix,
      // Le prorata, c'est ce que l'article 14.6 promet. Sans ce paramètre, le
      // changement serait gratuit jusqu'à la prochaine échéance dans un sens,
      // et payé deux fois dans l'autre.
      proration_behavior: "create_prorations",
      // La formule se relit dans les étiquettes, ici comme au premier paiement :
      // une seule façon de savoir quelle formule porte un abonnement.
      "metadata[formule]": params.formule,
      "metadata[periodicite]": params.periodicite,
      // Un changement de formule annule une résiliation en cours : il vient de
      // choisir de rester. Laisser le drapeau couperait son abonnement neuf à
      // la fin du mois, sans que rien ne l'en avertisse.
      cancel_at_period_end: "false",
    })
  );
  if (!r.ok) return r;

  const etat = lireUnAbonnement(r.donnees);
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


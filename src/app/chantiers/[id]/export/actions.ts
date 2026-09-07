"use server";

import { exigerGestionDevis, exigerMontants } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { contextePlanning } from "@/server/contexte-planning";
import { getOuCreerDevisBrouillon, envoyerDevis } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import { ingererDevis } from "@/server/documents/ingestion";
import { preparerEnvoi, verifierJourPropose } from "@/server/repositories/preparation-envoi";
import { creerEnvoi, DatesProposeesInvalidesError } from "@/server/repositories/envois-devis";
import { mettreAJourClient } from "@/server/repositories/clients";
import { MOTIF_DEVIS_VIDE } from "@/lib/devis-envoyable";
import { datesHorsFenetre, motifDatesRefusees } from "@/lib/dates-envoi";
import { fenetrePatron } from "@/server/disponibilites";

export async function chargerDevisAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  // **Une LECTURE, donc la garde des montants et non celle du devis.** Ouvrir
  // un devis ne l'écrit pas : c'est la question « avez-vous le droit de voir un
  // prix ? », pas « avez-vous le droit d'en poser un ? ». Les deux rendent le
  // même verdict aujourd'hui, et c'est précisément pourquoi elles restent
  // séparées (`peutGererDevis`).
  await exigerMontants(ctx, "ouvrir le devis");
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  const prestations = await listerPrestations(ctx, chantierId);
  return { devis, prestations: prestations.map((p) => p.libelle) };
}

export async function envoyerDevisAction(devisId: string) {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "envoyer le devis");
  const resultat = await envoyerDevis(ctx, devisId);
  try {
    // Base documentaire (lot IA-07) : rend le devis envoyé recherchable par
    // l'assistant. Un échec d'ingestion ne doit jamais faire échouer l'envoi.
    if (resultat.chantierId) await ingererDevis(ctx, resultat.chantierId);
  } catch {
    // Volontairement silencieux : voir commentaire ci-dessus.
  }
  return resultat;
}

/**
 * Rouvre un devis pour le corriger et le renvoyer.
 *
 * Un refus n'est pas une fin : c'est souvent une négociation qui commence
 * (docs/AGENT.md §2.2). Sans ce chemin, un devis retourné restait retourné pour
 * toujours, et le chantier avec lui.
 *
 * La nouvelle version reprend le numéro commercial et les lignes de prix
 * courantes — corriger un prix se fait donc à l'écran Prix, comme d'habitude,
 * et non ici.
 */
export async function reprendreDevisAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "reprendre le devis");
  const devis = await getOuCreerDevisBrouillon(ctx, chantierId);
  return { devisId: devis.id, numeroVersion: devis.numeroVersion };
}

// --- Envoi au client : la seule question posée au patron (docs/AGENT.md §2.2) ---

/**
 * `dureeDemiJournees` : la durée que le patron a éventuellement corrigée à
 * l'écran. Elle commande les jours proposables — une demi-journée tient là où
 * une journée entière ne tient plus — donc l'écran rappelle cette action à
 * chaque changement.
 */
export async function preparerEnvoiAction(chantierId: string, dureeDemiJournees?: number) {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "préparer l'envoi du devis");

  // **Le document se recompose DÈS L'OUVERTURE de la feuille d'envoi.**
  //
  // Le devis ne se recomposait qu'au chargement de l'écran, et tout prix tapé
  // ensuite restait dehors (voir `envoyerAuClientAction`). Deux conséquences,
  // et la seconde a failli être pire que la première :
  //
  //   1. le patron envoyait un document vide sans le savoir ;
  //   2. le garde-fou posé contre ça — « ce devis ne porte aucune ligne » —
  //      comptait les lignes du document PÉRIMÉ, et refusait donc un envoi
  //      parfaitement légitime. Mesuré : écran à 660 €, refus affiché. Un
  //      contrôle qui accuse à tort coûte plus cher que pas de contrôle du tout
  //      (`AGENTS.md`).
  //
  // Recomposer ici règle les deux d'un coup : ce que l'écran compte, ce qu'il
  // montre et ce qui partira sont enfin la même chose.
  await getOuCreerDevisBrouillon(ctx, chantierId);

  const maintenant = new Date();
  // **Le planning descend avec la préparation** — sa demande du 22 août 2026,
  // validée sur planche 91 : *« la possibilité de cliquer sur les jours pour
  // voir quels chantiers y sont déjà affectés, comme ça on peut savoir si oui
  // ou non on peut rajouter des clients sur les jours »*.
  //
  // **Le MÊME chargement que l'écran Planning** (`contextePlanning`), pas un
  // second : deux lectures séparées finiraient par ne pas compter les mêmes
  // absences, et deux écrans qui se suivent peindraient la même journée
  // différemment (`CLAUDE.md` §3).
  //
  // **Rien de tout cela ne part chez le client.** La page du client reçoit sa
  // propre liste, recalculée sur SA fenêtre au moment où il ouvre le lien
  // (`lireParJeton`) — les deux ne se rejoignent nulle part
  // (`docs/AGENT.md` §2.2 bis).
  const [preparation, planning] = await Promise.all([
    preparerEnvoi(ctx, chantierId, maintenant, dureeDemiJournees),
    contextePlanning(ctx, maintenant),
  ]);
  return { ...preparation, planning };
}

/**
 * Ce jour-là peut-il accueillir ce chantier ?
 *
 * Sert la case « Une autre date… » : le patron choisit un jour au calendrier,
 * et l'écran lui répond aussitôt — oui, ou pourquoi non, avec le jour libre le
 * plus proche. Sans cette réponse immédiate, il découvrirait le refus après
 * avoir composé son message, ce qui coûte un aller-retour avec son client.
 *
 * La règle est celle du dépôt, pas une seconde version : proposer une date que
 * l'envoi refuserait ensuite serait pire que ne rien proposer.
 */
export async function verifierJourProposeAction(
  chantierId: string,
  jour: string,
  dureeDemiJournees?: number
) {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "vérifier un jour proposé");
  return verifierJourPropose(ctx, chantierId, jour, dureeDemiJournees);
}

export type ResultatEnvoiClient =
  | { succes: true; lien: string; canal: "sms" | "email"; destinataire: string | null }
  | { succes: false; erreur: string };

/**
 * Marque le devis comme envoyé, crée le lien destiné au client et place le
 * chantier en attente de réponse.
 *
 * Le lien est RENVOYÉ à l'appelant plutôt qu'expédié : aucun fournisseur de SMS
 * ni d'e-mail n'est encore branché (voir docs/AGENT.md §5). En attendant, le
 * patron peut le transmettre lui-même — ce qui est préférable à un envoi qui
 * échouerait en silence.
 */
export async function envoyerAuClientAction(
  chantierId: string,
  /**
   * **Reçu, et délibérément IGNORÉ depuis le 23 août 2026.**
   *
   * Il datait du chargement de l'écran, et c'est ce décalage qui a envoyé un
   * devis vide chez sa cliente. Le serveur reprend la version courante du
   * chantier, qu'il recompose lui-même juste avant de la figer.
   *
   * Le paramètre reste dans la signature pour que les écrans qui l'envoient
   * encore n'aient rien à changer — le supprimer ferait glisser les suivants et
   * transformerait une correction en panne.
   */
  _devisId: string,
  datesProposees: string[],
  dureeDemiJournees?: number,
  /**
   * Le client peut-il proposer une AUTRE date ? Sa demande du 17 août 2026.
   *
   * Absent : `true` — ce que l'application faisait depuis toujours. Le
   * paramètre est en dernier et facultatif pour que rien d'existant ne change
   * de comportement en silence.
   */
  autreDateAutorisee?: boolean
): Promise<ResultatEnvoiClient> {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "envoyer le devis au client");

  /**
   * **LE DOCUMENT SE RECOMPOSE AVANT DE PARTIR, jamais avant.**
   *
   * *Le patron, le 23 août 2026 :* « le devis part à zéro euro chez la cliente,
   * alors qu'il y a un arbre à tailler et un à démonter », puis, quand on lui a
   * dit que rien n'était chiffré : *« j'avais mis des prix, cinq cent cinquante
   * et je ne sais plus combien, un devis à mille trois cents euros »*.
   *
   * Il avait raison, et la première explication était fausse. Ses prix étaient
   * bien en base — dans `lignes_prix`. Ce sont les lignes du DOCUMENT qui
   * manquaient : le devis ne se recompose qu'au CHARGEMENT de l'écran
   * (`page.tsx` → `getOuCreerDevisBrouillon`), et tout prix tapé ensuite restait
   * dehors. Mesuré : écran à 660 €, document à 0,00 € et zéro ligne.
   *
   * Le geste d'envoi figeait donc le devis tel qu'il était à l'ouverture de la
   * page — c'est-à-dire vide. **Rien ne se perdait ; rien n'arrivait.**
   *
   * **Et l'identifiant vient désormais d'ICI, plus du navigateur.** Celui que
   * l'écran transmettait datait de son chargement : sur une page ouverte depuis
   * un moment, il pouvait désigner une version dépassée. Le serveur reprend la
   * version courante du chantier, qu'il vient lui-même de recomposer.
   */
  const brouillon = await getOuCreerDevisBrouillon(ctx, chantierId);
  const devisAEnvoyer = brouillon.id;

  const preparation = await preparerEnvoi(ctx, chantierId, new Date(), dureeDemiJournees);
  // **Le refus vit AUSSI ici, et pas seulement à l'écran.** Cacher un bouton ne
  // ferme rien : cette action est appelable, et un devis vide parti chez une
  // cliente est sans retour — elle a « J'accepte ce devis » sous un document
  // qui n'énonce rien. Une seule règle (`src/lib/devis-envoyable.ts`) sert à
  // l'écran et à cette vérification : deux implémentations finiraient par
  // diverger (`CLAUDE.md` §3).
  if (preparation.blocage === "devis_vide") {
    return { succes: false, erreur: MOTIF_DEVIS_VIDE };
  }

  if (preparation.blocage === "canal_absent") {
    return {
      succes: false,
      erreur: "Indiquez d'abord comment joindre ce client — par SMS ou par e-mail.",
    };
  }
  if (preparation.blocage === "coordonnee_absente") {
    return {
      succes: false,
      erreur:
        preparation.canal === "sms"
          ? "Ce client n'a pas de numéro de téléphone enregistré."
          : "Ce client n'a pas d'adresse e-mail enregistrée.",
    };
  }
  if (!preparation.canal) {
    return { succes: false, erreur: "Impossible de préparer l'envoi pour ce chantier." };
  }

  if (datesProposees.length < 1 || datesProposees.length > 2) {
    return { succes: false, erreur: "Proposez une date, ou deux au choix du client." };
  }

  /**
   * ═════════════════════════════════════════════════════════════════════════
   * **LES DATES SE VALIDENT AVANT QUE LE DEVIS SOIT FIGÉ — 3 septembre 2026.**
   *
   * Juste en dessous, `envoyerDevisAction` fige le devis pour de bon : statut
   * « envoyé », PDF archivé, numéro consommé, document immuable. La création
   * du lien, elle, venait APRÈS — et quand elle refusait une date, la moitié
   * irréversible avait déjà eu lieu.
   *
   * Le résultat n'était pas un simple échec : le devis était parti pour
   * l'application et n'existait nulle part pour le client. En rouvrant, il
   * lisait « Ce devis est parti chez votre client : il ne se modifie plus » —
   * faux, et sur une pièce qui ne se réécrit pas.
   *
   * **La MÊME règle que le dépôt** (`src/lib/dates-envoi.ts`), consultée ici
   * en premier : le seul refus que `creerEnvoi` sache encore opposer ne peut
   * donc plus surprendre un devis déjà figé.
   * ═════════════════════════════════════════════════════════════════════════
   */
  const refusees = datesHorsFenetre(datesProposees, fenetrePatron(new Date()));
  if (refusees.length > 0) {
    return { succes: false, erreur: motifDatesRefusees(refusees) };
  }

  // L'envoi du devis (PDF figé) précède la création du lien : c'est ce PDF dont
  // on prend l'empreinte, et c'est lui que le client acceptera.
  //
  // **Sa raison d'échouer ne doit pas se perdre.** Le 7 août 2026, le patron :
  // « je ne peux pas envoyer au client ». Son écran affichait « L'envoi n'a pas
  // pu être préparé. » — la phrase de secours du navigateur, celle qui s'affiche
  // quand l'action a LANCÉ une erreur au lieu d'en rendre une. Le serveur savait
  // pourquoi (« ce devis a déjà été envoyé », « devis introuvable », un PDF
  // impossible à composer) ; rien ne le lui a dit, et rien ne me l'a dit non
  // plus. Une erreur qui n'accuse personne coûte deux échanges à chaque fois.
  let devisEnvoye: Awaited<ReturnType<typeof envoyerDevisAction>>;
  try {
    devisEnvoye = await envoyerDevisAction(devisAEnvoyer);
  } catch (err) {
    return { succes: false, erreur: raisonLisible(err) };
  }

  try {
    const envoi = await creerEnvoi(ctx, {
      chantierId,
      // **C'est CE devis que sa cliente ouvrira**, et c'est ici que le lien se
      // nouait de travers : l'envoi retenait l'identifiant venu du navigateur,
      // et la page publique lit les lignes de ce devis-là. Le document recomposé
      // pouvait donc être juste pendant que le lien pointait sur le vide.
      devisId: devisAEnvoyer,
      canal: preparation.canal,
      datesProposees,
      autreDateAutorisee: autreDateAutorisee ?? true,
      contenuDevis: `${devisEnvoye.numeroCommercial}|${devisEnvoye.numeroVersion}|${devisEnvoye.totalTtc}`,
      // La durée réellement retenue, telle que l'écran l'a affichée : c'est sur
      // elle que les dates proposables ont été calculées, et c'est elle qui sera
      // réservée quand le client aura choisi.
      dureeDemiJournees: preparation.dureeDemiJournees,
    });
    return {
      succes: true,
      lien: `/devis/${envoi.jeton}`,
      canal: preparation.canal,
      destinataire: preparation.destinataire,
    };
  } catch (err) {
    if (err instanceof DatesProposeesInvalidesError) {
      // **La phrase vient de la règle, elle n'est plus écrite ici.** Celle qui
      // s'y trouvait disait « n'est plus libre » — or l'occupation d'un jour
      // ne refuse plus rien depuis sa règle du 23 août 2026, et le seul motif
      // restant est la fenêtre. Le patron cherchait une autre date libre pour
      // un jour qui n'avait jamais été pris.
      return { succes: false, erreur: motifDatesRefusees(err.motifs) };
    }
    // Plus rien ne sort d'ici sans sa raison : voir le commentaire ci-dessus.
    return { succes: false, erreur: raisonLisible(err) };
  }
}

/**
 * La phrase que le patron lira, tirée de ce qui s'est réellement passé.
 *
 * Les erreurs du dépôt sont déjà écrites pour lui — « Ce devis a déjà été
 * envoyé. », « Devis introuvable » — et valent mille fois mieux qu'un « l'envoi
 * n'a pas pu être préparé » qui n'apprend rien. Celles qui ne le sont pas
 * (panne de stockage, base injoignable) reçoivent une phrase de secours qui dit
 * au moins où regarder.
 */
function raisonLisible(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : "";
  if (!message) return "L'envoi n'a pas abouti. Réessayez, et dites-le si cela recommence.";
  // Tronqué : une pile d'appels dans un bandeau n'aide personne, et une erreur
  // technique complète peut porter des détails d'infrastructure.
  return message.length > 200 ? `${message.slice(0, 199)}…` : message;
}

/**
 * Enregistre la coordonnée manquante d'un client, depuis l'écran Devis —
 * **et depuis l'écran Facture** (`facture/TransmettreLaFacture.tsx`), qui offre
 * le même choix de canal depuis le 12 août 2026 et importe cette action plutôt
 * que d'en écrire une seconde : deux copies finiraient par diverger, et l'une
 * des deux oublierait de mettre à jour le canal convenu.
 *
 * **Pourquoi ici.** Il n'existe aucun écran de fiche client : le téléphone et
 * l'e-mail ne se saisissent qu'à la création du chantier. Un patron qui veut
 * envoyer par e-mail un devis dont le client n'a qu'un numéro était donc
 * bloqué, sans issue nulle part. La coordonnée est conservée sur la fiche —
 * pas seulement pour cet envoi — pour ne pas la redemander au chantier suivant.
 *
 * Le canal convenu est mis à jour du même geste : c'est bien par là que le
 * patron a choisi de le joindre.
 */
export async function enregistrerCoordonneeClientAction(
  clientId: string,
  canal: "sms" | "email",
  valeur: string
) {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "enregistrer les coordonnées du client");
  const propre = valeur.trim().slice(0, 200);
  if (!propre) return { succes: false as const };
  await mettreAJourClient(ctx, clientId, {
    canalCommunication: canal,
    ...(canal === "sms" ? { telephone: propre } : { email: propre }),
  });
  return { succes: true as const };
}

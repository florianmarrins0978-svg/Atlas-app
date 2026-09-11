"use server";

import { exigerEcran, exigerFacturation } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { logger } from "@/server/logger";
import { creerChantier, getChantier } from "@/server/repositories/chantiers";
import {
  creerFactureSansDevis,
  FactureDirecteImpossibleError,
} from "@/server/repositories/factures";
import { recopierPhotos } from "@/server/repositories/photos";
import {
  trouverOuCreerClient,
  getClient,
  mettreAJourClient,
  reconnaitreLeClient,
  type CanalClient,
  type ClientReconnu,
} from "@/server/repositories/clients";
import { complementsPourFiche } from "@/lib/rapprochement-client";
import { nomDuChantier } from "@/lib/nom-chantier";
import type { Civilite } from "@/lib/civilite";
import { jourIso } from "@/lib/jour";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerAudioEntrant } from "@/server/audio-entrant";
import { lireCoordonneesDictees } from "@/server/ai/services/coordonnees-service";

export type CreerChantierInput = {
  /**
   * Le client est DÉJÀ connu — on vient de sa fiche (« Autre chantier »).
   *
   * **Aucun rapprochement n'est alors joué, et c'est le point.** `rapprocherClient`
   * sert à retrouver un client d'après ce qu'on tape ; ici, il n'y a rien à
   * retrouver. Le faire quand même ferait passer le chantier par une règle de
   * ressemblance alors qu'on tient l'identifiant : sur quatre Martins, un nom
   * corrigé à la volée suffirait à ranger le chantier chez le mauvais.
   *
   * Ce que le patron tape à l'écran complète malgré tout les cases VIDES de la
   * fiche, comme ailleurs — il n'écrase jamais ce qu'elle porte déjà.
   */
  clientId?: string;
  nomClient?: string;
  /** « Mr » ou « Mme », s'il l'a choisi. Absent : il n'a rien dit, et ce
   *  silence se garde tel quel (migration 0038). */
  civilite?: Civilite;
  telephone?: string;
  email?: string;
  /** Canal convenu avec le client pour recevoir son devis (docs/AGENT.md §2.1). */
  canal?: CanalClient;
  adresseChantier?: string;
  adresseClient?: string;
  /**
   * Il a appuyé sur « Ce n'est pas lui » sous la fiche reconnue.
   *
   * Ce n'est pas la même chose qu'un `clientId` absent : là, on ne sait pas ;
   * ici, on sait que **ce n'est pas** celui qu'Atlas a trouvé.
   */
  refuseLeRapprochement?: boolean;
};

// Ne redirige pas elle-même (garde le comportement de navigation côté client,
// comme avant) — retourne l'id du chantier créé, ou lève une erreur explicite.
export async function creerChantierAction(data: CreerChantierInput): Promise<{ id: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "créer un chantier");

  let clientId: string | undefined;
  const nomClient = data.nomClient?.trim();

  // **On vient de SA fiche : il n'y a rien à retrouver.** Le client est relu ici
  // plutôt que cru sur parole — un identifiant qui voyage est un identifiant
  // qu'on peut changer en chemin, et la RLS rend indiscernables « effacé » et
  // « d'une autre entreprise », ce qui est exactement ce qu'on veut.
  const clientConnu = data.clientId ? await getClient(ctx, data.clientId) : null;
  if (clientConnu) {
    clientId = clientConnu.id;
    // Ce qu'il tape à la volée complète les cases VIDES, il n'écrase rien
    // (`complementsPourFiche`, même règle que le rapprochement).
    const complements = complementsPourFiche(
      {
        id: clientConnu.id,
        nom: clientConnu.nom,
        telephone: clientConnu.telephone,
        email: clientConnu.email,
        adresse: clientConnu.adresse,
        creeLe: clientConnu.createdAt,
      },
      {
        nom: nomClient ?? clientConnu.nom,
        telephone: data.telephone,
        email: data.email,
        adresse: data.adresseClient ?? data.adresseChantier,
      }
    );
    if (Object.keys(complements).length > 0) {
      await mettreAJourClient(ctx, clientConnu.id, complements);
    }
  } else if (nomClient) {
    const telephone = data.telephone?.trim() || undefined;
    const email = data.email?.trim() || undefined;

    // Un canal sans la coordonnée correspondante est un cul-de-sac : l'envoi
    // s'annoncerait possible puis échouerait au dernier moment. On préfère ne
    // rien enregistrer et laisser l'écran d'envoi le dire clairement.
    const canal =
      data.canal === "sms" && telephone
        ? "sms"
        : data.canal === "email" && email
          ? "email"
          : undefined;

    // **Retrouvé plutôt que recréé.** Le patron, le 17 août 2026 : *« si c'est
    // monsieur Martins et qu'on a déjà une fiche client monsieur Martins, le
    // devis, la facture s'ajoute à la fiche de monsieur Martins »*. La règle de
    // reconnaissance — et les cas où elle REFUSE de rapprocher — vit dans
    // `src/lib/rapprochement-client.ts`.
    const { client } = await trouverOuCreerClient(ctx, {
      nom: nomClient,
      civilite: data.civilite,
      telephone,
      email,
      canalCommunication: canal,
      // **« Si différente de l'adresse du chantier » — alors identique par
      // défaut.** C'est ce que l'écran promet en toutes lettres sous ce champ,
      // et le patron l'a lu ainsi : il a rempli l'adresse du chantier, laissé
      // celle du client vide, et retrouvé sur son devis un client sans adresse
      // et une adresse orpheline en bas de page.
      //
      // Ce n'est pas une donnée inventée (`CLAUDE.md` §4) : elle est reprise
      // mot pour mot de ce qu'il a saisi, sous une règle qu'il a lue avant de
      // laisser le champ vide. Il la corrige d'un geste sur le devis si les
      // deux diffèrent.
      adresse: data.adresseClient?.trim() || data.adresseChantier?.trim() || undefined,
      // **« Ce n'est pas lui » traverse jusqu'ici, et il le faut.** Le refus est
      // pris à l'écran, mais c'est l'enregistrement qui range le chantier :
      // sans ce passage, le nom seul aurait retrouvé l'homme qu'il venait
      // d'écarter, et Atlas lui aurait répondu « si, c'est lui ».
      refuseLeRapprochement: data.refuseLeRapprochement,
    });
    clientId = client.id;
  }

  // Le nom se DÉDUIT de ce que le patron a donné : il n'a plus à en trouver un.
  // La règle vit dans `src/lib/nom-chantier.ts` et s'applique ici, côté serveur —
  // un écran ne décide de rien, et un appel direct à l'action doit produire le
  // même nom que le formulaire.
  const chantier = await creerChantier(ctx, {
    nom: nomDuChantier({
      nomClient,
      civilite: data.civilite,
      adresseChantier: data.adresseChantier,
      jour: jourIso(new Date()),
    }),
    adresseChantier: data.adresseChantier?.trim() || undefined,
    clientId,
  });

  return { id: chantier.id };
}

/**
 * Remplir la fiche du client à la voix.
 *
 * Le patron, le 7 août 2026 : « une petite touche discrète, juste le signe de
 * la note vocale, pour appuyer dessus et parler pour remplir les infos du
 * client si j'ai pas envie de les écrire ».
 *
 * **Ne crée rien.** L'action rend des champs ; l'écran les pose dans le
 * formulaire, le patron les relit et corrige avant de créer le chantier. Un
 * chantier créé à la voix, sans relecture, mettrait un nom mal entendu sur un
 * devis (`CLAUDE.md` §4).
 *
 * **L'audio n'est pas conservé** : il n'y a pas encore de chantier auquel le
 * rattacher, et garder une voix sans dossier serait la garder sans raison.
 */
export async function dicterCoordonneesAction(formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) throw new Error("Aucun enregistrement reçu.");


  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "dicter des coordonnées");
  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) throw new Error(limite.message);

  // **LA PORTE COMMUNE** — le format se lit dans les octets, jamais dans ce que
  // le téléphone annonce (`src/server/audio-entrant.ts`). Ce chemin ne stocke
  // rien : il transcrit. Ce qui se joue ici est donc l'appel — et sa facture —
  // chez le fournisseur d'IA, qui ne part plus sur un fichier non reconnu.
  const audio = await preparerAudioEntrant(fichier);
  if (!audio.ok) throw new Error(audio.message);
  return lireCoordonneesDictees(audio.octets, audio.mime);
}

/**
 * REPRENDRE LES PHOTOS DE LA DERNIÈRE FOIS — sa règle du 8 septembre 2026.
 *
 * *« Les anciennes photos peuvent apparaître à l'écran mais sans s'inscrire de
 * nouveau, juste pour voir ce qu'on avait fait la dernière fois. […] Si il
 * valide sans les avoir resélectionnées elles ne doivent pas apparaître dans la
 * fiche d'intervention pour le salarié. Seulement si l'utilisateur les
 * coche. »*
 *
 * **Le fichier est RECOPIÉ, jamais partagé** (`recopierPhotos`) : sans quoi
 * effacer l'ancienne photo viderait la fiche du salarié, un mois plus tard,
 * sans que personne fasse le lien.
 *
 * **Un refus se rend, il ne se lève pas** (`AGENTS.md`, piège 0 ter) : le
 * message d'une exception d'action serveur n'arrive jamais jusqu'au patron.
 */
export async function reprendreLesPhotosAction(
  chantierId: string,
  photoIds: readonly string[]
): Promise<{ ok: true; reprises: number } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "reprendre des photos");

  // Un plafond, comme partout où le patron peut envoyer plusieurs fichiers
  // d'un coup : la reprise copie de vrais octets, et une liste forgée à la main
  // ferait recopier tout le rangement de l'entreprise en une requête.
  if (photoIds.length > 24) {
    return { ok: false, raison: "Trop de photos d'un coup. Reprenez-en moins de vingt-quatre." };
  }

  const chantier = await getChantier(ctx, chantierId);
  if (!chantier) return { ok: false, raison: "Ce chantier n'existe plus." };

  const creees = await recopierPhotos(ctx, photoIds, chantierId);
  return { ok: true, reprises: creees.length };
}

/**
 * RECONNAÎTRE LE CLIENT PENDANT QU'IL TAPE — proposition C, tranchée par le
 * patron le 9 septembre 2026.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa question, et la réponse qui l'a décidé :** *« lorsque je clique sur
 * créer un devis j'écris Martins, il reconnaît et entre les infos de lui-même,
 * mais il ne va donc pas me créer un deuxième client appelé Martins ? »* —
 * non. `trouverOuCreerClient` réunit déjà les homonymes depuis le 17 août ;
 * cet écran ne fait que **montrer** ce qu'Atlas faisait en silence.
 *
 * **Ce n'est PAS la liste de correspondances qu'il a écartée** le 17 août
 * (*« non justement, il ne faut pas »*). On ne lui propose rien, on ne lui
 * demande rien : la fiche se remplit, et un seul bouton permet de dire non.
 *
 * **Rien de ce qui sort d'ici n'est un montant, ni une décision.** C'est une
 * lecture, sous `withEntreprise` comme le reste, et elle rend `null` bien plus
 * souvent qu'elle ne rend quelqu'un — quatre Martins sans numéro, c'est `null`.
 */
export async function reconnaitreLeClientAction(saisie: {
  nom: string;
  telephone?: string;
  email?: string;
}): Promise<ClientReconnu | null> {
  const ctx = await getCurrentCtx();
  // La même porte que la création : reconnaître un client, c'est déjà lire sa
  // fiche, et un rôle qui n'a pas le droit de créer un chantier n'a pas à
  // savoir qui est déjà chez lui.
  await exigerEcran(ctx, "/chantiers", "reconnaître un client");
  return reconnaitreLeClient(ctx, saisie);
}

/**
 * FACTURER SANS PASSER PAR LA CASE DEVIS — sa demande du 10 septembre 2026.
 *
 * *« Il faut que l'on puisse facturer sans avoir besoin de passer par la case
 * devis. »* Le chantier vient d'être créé par la fiche client ; cette action
 * pose la facture, vide, et l'écran d'après sert à la remplir.
 *
 * ─── LES DEUX PORTES SE FRANCHISSENT TOUTES LES DEUX ───────────────────────
 *
 * `exigerEcran(/chantiers)` **et** `exigerFacturation`, et ce n'est pas de la
 * ceinture-bretelles : le geste fait deux choses que des rôles différents
 * peuvent avoir le droit de faire. Un salarié autorisé à ouvrir des chantiers
 * mais pas à facturer passerait la première porte ; sans la seconde, il
 * créerait des factures et consommerait des numéros de la suite commerciale.
 *
 * **Le refus se rend en VALEUR, jamais en exception** (`AGENTS.md`, piège
 * 0 ter) : le message d'une exception d'action serveur n'arrive jamais jusqu'au
 * patron — Next.js le remplace en production par un identifiant opaque, et son
 * banc sert une version bâtie.
 */
export type ResultatFactureDirecte =
  | { succes: true; factureId: string }
  | { succes: false; erreur: string };

const REFUS_FACTURE_DIRECTE: Record<FactureDirecteImpossibleError["motif"], string> = {
  chantier_absent: "Ce chantier n'existe plus.",
  deja_facture: "Ce chantier porte déjà une facture.",
  // Le geste que ce refus désigne : passer par la fin de chantier, qui reprend
  // le prix que le client a accepté. Le taire enverrait chercher un défaut.
  chantier_avec_devis:
    "Ce chantier a un devis : sa facture se prépare depuis la fin de chantier, pour reprendre le prix accepté.",
};

export async function creerFactureSansDevisAction(
  chantierId: string
): Promise<ResultatFactureDirecte> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "créer une facture sans devis");
  await exigerFacturation(ctx, "créer une facture sans devis");
  try {
    const facture = await creerFactureSansDevis(ctx, chantierId);
    return { succes: true, factureId: facture.id };
  } catch (err) {
    if (err instanceof FactureDirecteImpossibleError) {
      return { succes: false, erreur: REFUS_FACTURE_DIRECTE[err.motif] };
    }
    // Une panne imprévue se JOURNALISE avant d'être rendue muette à l'écran :
    // sans cette ligne, personne ne peut savoir pourquoi (`AGENTS.md`).
    logger.error("Facture sans devis non créée", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { succes: false, erreur: "La facture n'a pas pu être préparée. Réessayez dans un instant." };
  }
}

import { eq } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  absencesEquipe,
  audiosAPurger,
  brouillonsInformations,
  chantiers,
  clients,
  devis,
  documents,
  entrepriseCompteurs,
  entreprises,
  envoisDevis,
  envoisFactures,
  correctionsDictee,
  grillePrix,
  agendasExternes,
  equipes,
  prestationsEntretien,
  passagesEntretien,
  lignesPassage,
  naturesGrille,
  paiementsFacture,
  tranchesGrille,
  factures,
  fragmentsDocuments,
  historiquePrix,
  leconsPrix,
  lignesDevis,
  lignesFacture,
  lignesPrix,
  materiel,
  membresEntreprise,
  achatsTva,
  notesVocales,
  parametresChiffrage,
  photos,
  precisionsChantier,
  prestations,
  propositionsIa,
  tarifs,
  motsCatalogue,
} from "../db/schema";
import type { Ctx } from "./context";

// Emporter ses données, sans demander la permission à personne.
//
// **Ce n'est pas l'export RGPD.** `donnees-client.ts` sort les données D'UN
// CLIENT pour répondre à une demande d'accès. Ici c'est l'inverse : TOUT ce que
// l'entreprise possède, pour que le patron puisse le remettre ailleurs — chez
// un hébergeur, sur une autre machine, ou simplement le garder.
//
// **Pourquoi ce n'est pas un `pg_dump`.** Un `pg_dump` exige le rôle
// propriétaire de la base, un terminal, et la connaissance de la commande. Le
// patron n'a ni l'un ni les autres, et n'a pas à les avoir : il a un téléphone.
// Cette fonction passe par `withEntreprise`, donc par l'isolation ordinaire —
// aucun privilège en plus, aucune brèche ouverte pour faire une sauvegarde.
//
// **Conséquence à assumer :** l'export ne contient que ce que l'isolation
// laisse voir. C'est exactement ce qu'on veut ici — mais cela veut dire qu'il
// ne remplace pas une sauvegarde d'administration pour restaurer la base
// entière, plusieurs entreprises comprises (voir PRODUCTION_BACKUP_RESTORE.md).

/** Version du format écrite dans le fichier — un relecteur futur saura quoi attendre. */
export const VERSION_FORMAT_EXPORT = 1;

export type ExportEntreprise = {
  versionFormat: number;
  exporteLe: string;
  entrepriseId: string;
  /** Une clé par table, dans l'ordre des dépendances (parents avant enfants). */
  tables: Record<string, Record<string, unknown>[]>;
  /** Nombre de lignes par table — se lit d'un coup d'œil sans dérouler le fichier. */
  compte: Record<string, number>;
  /** Fichiers rattachés, à joindre à l'archive. */
  fichiers: FichierAJoindre[];
};

export type FichierAJoindre = {
  storageKey: string;
  /** D'où vient ce fichier, pour le retrouver dans les données. */
  origine: "photo" | "note-vocale" | "devis-pdf" | "facture-pdf";
};

/**
 * Toutes les données de l'entreprise, plus la liste des fichiers à joindre.
 *
 * Les octets des photos et des PDF ne sont PAS lus ici : les tenir tous en
 * mémoire ferait tomber le serveur sur un compte un peu fourni. La route qui
 * appelle cette fonction les lit un par un, au fil de l'écriture de l'archive.
 */
export async function exporterEntreprise(
  ctx: Ctx,
  maintenant: Date = new Date()
): Promise<ExportEntreprise> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    // L'isolation filtre déjà par entreprise. Le filtre explicite est répété
    // parce qu'une table dont la politique serait un jour oubliée renverrait
    // alors les données des autres — et un export est précisément l'endroit où
    // cela ne se verrait pas.
    const e = ctx.entrepriseId;

    const [
      entreprise,
      compteurs,
      membres,
      lesClients,
      lesChantiers,
      lesPrestations,
      leMateriel,
      lesNotes,
      lesPhotos,
      lesAchatsTva,
      lesTarifs,
      lesLignesPrix,
      lesDevis,
      lesLignesDevis,
      lHistorique,
      lesLecons,
      lesParametres,
      lesDocuments,
      lesFragments,
      lesBrouillons,
      lesPropositions,
      lesPrecisions,
      lesEnvois,
      lesAudiosAPurger,
      lesFactures,
      lesLignesFacture,
      lesEnvoisFactures,
      lesCorrections,
      laGrillePrix,
      lesAgendas,
      lesEquipes,
      sesAbsences,
      sesTranches,
      sesNatures,
      lesReglements,
      sonModeleEntretien,
      sesPassages,
      sesLignesPassage,
      sesMotsCatalogue,
    ] = await Promise.all([
      tx.select().from(entreprises).where(eq(entreprises.id, e)),
      tx.select().from(entrepriseCompteurs).where(eq(entrepriseCompteurs.entrepriseId, e)),
      tx.select().from(membresEntreprise).where(eq(membresEntreprise.entrepriseId, e)),
      tx.select().from(clients).where(eq(clients.entrepriseId, e)),
      tx.select().from(chantiers).where(eq(chantiers.entrepriseId, e)),
      tx.select().from(prestations).where(eq(prestations.entrepriseId, e)),
      tx.select().from(materiel).where(eq(materiel.entrepriseId, e)),
      tx.select().from(notesVocales).where(eq(notesVocales.entrepriseId, e)),
      tx.select().from(photos).where(eq(photos.entrepriseId, e)),
      // Les achats et leur TVA déductible. **Ils partent avec le reste** : le
      // patron a le droit d'emporter TOUTES ses données, et ses tickets sont
      // parmi les plus personnelles — ils disent où il fait le plein et quand
      // il travaille. Le contrôle d'exhaustivité les a réclamés avant qu'on y
      // pense (`test-export-entreprise.ts`).
      tx.select().from(achatsTva).where(eq(achatsTva.entrepriseId, e)),
      tx.select().from(tarifs).where(eq(tarifs.entrepriseId, e)),
      tx.select().from(lignesPrix).where(eq(lignesPrix.entrepriseId, e)),
      tx.select().from(devis).where(eq(devis.entrepriseId, e)),
      tx.select().from(lignesDevis).where(eq(lignesDevis.entrepriseId, e)),
      tx.select().from(historiquePrix).where(eq(historiquePrix.entrepriseId, e)),
      tx.select().from(leconsPrix).where(eq(leconsPrix.entrepriseId, e)),
      tx.select().from(parametresChiffrage).where(eq(parametresChiffrage.entrepriseId, e)),
      tx.select().from(documents).where(eq(documents.entrepriseId, e)),
      tx.select().from(fragmentsDocuments).where(eq(fragmentsDocuments.entrepriseId, e)),
      tx.select().from(brouillonsInformations).where(eq(brouillonsInformations.entrepriseId, e)),
      tx.select().from(propositionsIa).where(eq(propositionsIa.entrepriseId, e)),
      tx.select().from(precisionsChantier).where(eq(precisionsChantier.entrepriseId, e)),
      tx.select().from(envoisDevis).where(eq(envoisDevis.entrepriseId, e)),
      tx.select().from(audiosAPurger).where(eq(audiosAPurger.entrepriseId, e)),
      tx.select().from(factures).where(eq(factures.entrepriseId, e)),
      tx.select().from(lignesFacture).where(eq(lignesFacture.entrepriseId, e)),
      tx.select().from(envoisFactures).where(eq(envoisFactures.entrepriseId, e)),
      tx.select().from(correctionsDictee).where(eq(correctionsDictee.entrepriseId, e)),
      tx.select().from(grillePrix).where(eq(grillePrix.entrepriseId, e)),
      // **Les jetons sont exclus de la requête, pas filtrés après coup.**
      //
      // Ce fichier se télécharge et s'envoie par courriel. Y joindre les jetons
      // d'un compte Google — même chiffrés, la clé se dérivant d'une
      // configuration serveur — reviendrait à faire circuler l'accès à l'agenda
      // de l'artisan dans une pièce jointe. Ce qui n'est pas sélectionné ne peut
      // pas fuir par une distraction plus tard.
      //
      // Ce qui reste est bien SA donnée, et lui appartient : quel compte est
      // relié, depuis quand, et si la lecture fonctionne encore.
      tx
        .select({
          id: agendasExternes.id,
          entrepriseId: agendasExternes.entrepriseId,
          fournisseur: agendasExternes.fournisseur,
          compte: agendasExternes.compte,
          actif: agendasExternes.actif,
          derniereLectureAt: agendasExternes.derniereLectureAt,
          derniereErreur: agendasExternes.derniereErreur,
          createdAt: agendasExternes.createdAt,
          updatedAt: agendasExternes.updatedAt,
        })
        .from(agendasExternes)
        .where(eq(agendasExternes.entrepriseId, e)),
      // Les noms que le patron a donnés à ses équipes. C'est SA saisie, et rien
      // ne la reconstitue : elle part avec le reste de ses données.
      tx.select().from(equipes).where(eq(equipes.entrepriseId, e)),
      // Les jours où une équipe n'est pas là (14 août 2026, `ARCHITECTURE.md`
      // §109). C'est sa saisie, et elle commande les dates qu'Atlas propose à
      // ses clients : une sauvegarde qui l'oublierait rendrait un planning qui
      // ne se comporte plus comme le sien.
      tx.select().from(absencesEquipe).where(eq(absencesEquipe.entrepriseId, e)),
      // Les tranches et les travaux qu'il a réglés lui-même (14 août 2026,
      // `ARCHITECTURE.md` §102). Sans eux, une sauvegarde rendrait ses prix
      // sans rendre les cases qui leur donnent un sens : « 1 400 € » pour
      // « d90_2 » ne veut rien dire une fois la tranche perdue.
      tx.select().from(tranchesGrille).where(eq(tranchesGrille.entrepriseId, e)),
      tx.select().from(naturesGrille).where(eq(naturesGrille.entrepriseId, e)),
      // Les règlements reçus (migration 0045). Sans eux, une sauvegarde rendrait
      // les factures sans dire lesquelles ont été payées — donc sans permettre
      // de reconstituer un seul relevé de TVA.
      tx.select().from(paiementsFacture).where(eq(paiementsFacture.entrepriseId, e)),
      // Le modèle de fiche d'entretien (migration 0051). C'est SA saisie —
      // les prestations, leurs familles, leur ordre —, et rien ne la
      // reconstitue : le modèle fourni au départ n'est qu'un point de départ,
      // que dix retraits et cinq ajouts ont pu éloigner de tout ce qu'Atlas
      // sait engendrer. Une sauvegarde qui l'oublierait rendrait des rapports
      // d'entretien dont plus personne ne saurait de quelle fiche ils viennent.
      tx
        .select()
        .from(prestationsEntretien)
        .where(eq(prestationsEntretien.entrepriseId, e)),
      // Les passages d'entretien et leurs lignes (migration 0055). Ce sont les
      // rapports partis chez ses clients — avec leur horodatage et leur
      // empreinte, qui font la preuve du passage depuis qu'il a écarté les
      // signatures (16 août 2026). Rien ne les reconstitue : les lignes sont
      // une COPIE du modèle au jour dit, et le modèle a bougé depuis. Une
      // sauvegarde qui les oublierait perdrait exactement ce dont il aurait
      // besoin le jour où un client conteste.
      tx.select().from(passagesEntretien).where(eq(passagesEntretien.entrepriseId, e)),
      tx.select().from(lignesPassage).where(eq(lignesPassage.entrepriseId, e)),
      // Les mots qu'il a ajoutés au catalogue (migration 0052). C'est SA
      // saisie, et rien ne la reconstitue : le vocabulaire d'Atlas, lui, se
      // retrouve tout seul — ses mots à lui, non. Une sauvegarde qui les
      // oublierait rendrait une dictée qui ne comprend plus ce qu'elle
      // comprenait la veille, sans que rien ne dise pourquoi.
      tx.select().from(motsCatalogue).where(eq(motsCatalogue.entrepriseId, e)),
    ]);

    // Ordre volontaire : parents avant enfants. Une reprise qui rejouerait ce
    // fichier ligne à ligne n'aurait alors aucune contrainte à désactiver.
    const tables: Record<string, Record<string, unknown>[]> = {
      entreprises: entreprise,
      entreprise_compteurs: compteurs,
      membres_entreprise: membres,
      clients: lesClients,
      chantiers: lesChantiers,
      prestations: lesPrestations,
      materiel: leMateriel,
      notes_vocales: lesNotes,
      photos: lesPhotos,
      achats_tva: lesAchatsTva,
      tarifs: lesTarifs,
      lignes_prix: lesLignesPrix,
      devis: lesDevis,
      lignes_devis: lesLignesDevis,
      historique_prix: lHistorique,
      // La mémoire des corrections du patron. C'est ce qu'Atlas a appris de lui
      // — la perdre lui ferait recommencer son apprentissage à zéro.
      lecons_prix: lesLecons,
      parametres_chiffrage: lesParametres,
      documents: lesDocuments,
      fragments_documents: lesFragments,
      brouillons_informations: lesBrouillons,
      propositions_ia: lesPropositions,
      // Ce qu'il a répondu quand l'agent l'a arrêté avant de chiffrer. Sans
      // elles, une sauvegarde restituerait des devis dont on ne saurait plus
      // sur quelle technique ni quel diamètre ils ont été établis.
      precisions_chantier: lesPrecisions,
      envois_devis: lesEnvois,
      audios_a_purger: lesAudiosAPurger,
      factures: lesFactures,
      lignes_facture: lesLignesFacture,
      // Les liens de facture remis aux clients : sans eux, une sauvegarde ne
      // dirait plus quelle facture est réellement partie, ni quand.
      envois_factures: lesEnvoisFactures,
      // Ce que l'artisan a corrigé après une dictée : c'est SA mémoire, faite de
      // ses libellés et de ses prix. Elle part avec ses données, comme le reste.
      corrections_dictee: lesCorrections,
      // Sa grille de prix pour fendre le bois. Chaque case est une décision
      // qu'il a prise, ou un prix qu'il a réellement pratiqué : la perdre lui
      // ferait rechiffrer à l'aveugle des chantiers déjà arbitrés.
      grille_prix: laGrillePrix,
      // Les tranches et les travaux qui donnent leur sens aux cases ci-dessus.
      tranches_grille: sesTranches,
      natures_grille: sesNatures,
      // Ce qui a été encaissé, et quand : c'est ce qui date sa TVA.
      paiements_facture: lesReglements,
      // Sans les jetons — voir la requête ci-dessus.
      agendas_externes: lesAgendas,
      equipes: lesEquipes,
      absences_equipe: sesAbsences,
      // Le modèle de fiche d'entretien : ses prestations, ses familles, son ordre.
      prestations_entretien: sonModeleEntretien,
      passages_entretien: sesPassages,
      lignes_passage: sesLignesPassage,
      mots_catalogue: sesMotsCatalogue,
    };

    const compte: Record<string, number> = {};
    for (const [nom, lignes] of Object.entries(tables)) compte[nom] = lignes.length;

    // Les fichiers, dédoublonnés : un même PDF peut être référencé deux fois,
    // et l'écrire deux fois dans l'archive produirait un doublon que certains
    // décompresseurs refusent d'extraire.
    const vus = new Set<string>();
    const fichiers: FichierAJoindre[] = [];
    const ajouter = (cle: string | null, origine: FichierAJoindre["origine"]) => {
      if (!cle || vus.has(cle)) return;
      vus.add(cle);
      fichiers.push({ storageKey: cle, origine });
    };
    for (const p of lesPhotos) ajouter(p.storageKey as string | null, "photo");
    for (const n of lesNotes) ajouter(n.storageKey as string | null, "note-vocale");
    for (const d of lesDevis) ajouter(d.pdfStorageKey as string | null, "devis-pdf");
    for (const f of lesFactures) ajouter(f.pdfStorageKey as string | null, "facture-pdf");

    return {
      versionFormat: VERSION_FORMAT_EXPORT,
      exporteLe: maintenant.toISOString(),
      entrepriseId: e,
      tables,
      compte,
      fichiers,
    };
  });
}

// Le jeton d'`envois_devis` est exporté, en connaissance de cause. C'est une clé
// d'accès vivante à une page publique — mais l'écarter reviendrait à produire une
// sauvegarde d'où les envois ne pourraient pas être remis en place, pour protéger
// un secret qui expire de lui-même. Le mode d'emploi joint à l'archive le dit en
// toutes lettres, plutôt que de retirer la donnée en silence.
//
// Ce que l'export NE contient PAS, et pourquoi — écrit ici plutôt que dans un
// document, pour être relu par celui qui modifiera la liste ci-dessus :
//
// - `users`, `accounts`, `verification_tokens` : ce sont des identifiants de
//   connexion, pas des données d'entreprise. Les recopier dans un fichier
//   téléchargeable transformerait une sauvegarde en fuite de comptes.
// - `catalogue_prestations`, `catalogue_materiels`, `documents_legaux` : données
//   de référence, partagées par toutes les sociétés. Elles n'appartiennent pas
//   au patron et se retrouvent identiques sur n'importe quelle installation.
// - `acceptations_documents` : rattachée à l'utilisateur, pas à l'entreprise —
//   et sans valeur hors de l'installation qui l'a recueillie.
// - `fichiers_a_purger` : file de maintenance, sans donnée ni rattachement à
//   une entreprise.

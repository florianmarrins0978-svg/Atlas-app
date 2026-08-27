import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { withEntreprise } from "../db/with-entreprise";
import {
  chantiers,
  clients,
  devis,
  entreprises,
  equipes,
  equipesDuChantier,
  materiel,
  notesVocales,
  photos,
  prestations,
} from "../db/schema";
import type { Ctx } from "./context";
import type { FicheChantierPdfData } from "../pdf/fiche-chantier-pdf";
import { libelleSalarie } from "../../lib/equipes";
import { ditQuiPart } from "../../lib/planning-jour";

/**
 * Tout ce qu'il faut pour imprimer la fiche d'un chantier, en une lecture.
 *
 * **D'où elle vient.** Le patron, le 20 août 2026 : *« fais en sorte que les
 * fiches chantiers soient au format PDF maintenant »*.
 *
 * **Rien n'est calculé ici** : ce fichier lit, et `composerFicheChantierPdf`
 * met en page. La séparation vaut ce qu'elle vaut partout ailleurs — la mise en
 * page s'éprouve sans base (`scripts/test-fiche-chantier-pdf.ts`), et la
 * lecture s'éprouve avec.
 *
 * **Rien ne sort de `withEntreprise`** (`CLAUDE.md` §3). L'enjeu est direct :
 * cette fiche nomme un client, son adresse, et ce qu'on est venu faire chez
 * lui. Une requête hors de ce cadre ne rendrait rien, silencieusement.
 *
 * Rend `null` quand le chantier n'existe pas, est supprimé, ou appartient à une
 * autre entreprise — les trois cas ne se distinguent jamais pour l'appelant.
 */
export async function chargerFicheChantierPourPdf(
  ctx: Ctx,
  chantierId: string
): Promise<FicheChantierPdfData | null> {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [chantier] = await tx
      .select()
      .from(chantiers)
      .where(and(eq(chantiers.id, chantierId), isNull(chantiers.deletedAt)))
      .limit(1);
    if (!chantier) return null;

    const [entreprise] = await tx
      .select()
      .from(entreprises)
      .where(eq(entreprises.id, ctx.entrepriseId))
      .limit(1);

    const client = chantier.clientId
      ? (await tx.select().from(clients).where(eq(clients.id, chantier.clientId)).limit(1))[0]
      : null;

    // **Toutes les équipes du chantier, matin et après-midi confondus.** Depuis
    // la migration 0058, un chantier peut en porter plusieurs, et différentes
    // selon la demi-journée : la fiche, elle, couvre le chantier entier — y
    // écrire la seule équipe du matin ferait croire que l'après-midi n'a
    // personne. `ditQuiPart` compte au-delà de deux noms, comme le planning.
    const sesEquipes = await tx
      .selectDistinct({ rang: equipes.rang, nom: equipes.nom })
      .from(equipesDuChantier)
      .innerJoin(equipes, eq(equipesDuChantier.equipeId, equipes.id))
      .where(eq(equipesDuChantier.chantierId, chantierId))
      .orderBy(asc(equipes.rang));

    const [sesPrestations, sonMateriel, sesPhotos, saNote, sonDevis] = await Promise.all([
      tx
        .select({ libelle: prestations.libelle })
        .from(prestations)
        .where(eq(prestations.chantierId, chantierId))
        .orderBy(asc(prestations.ordre)),
      tx
        .select({ libelle: materiel.libelle })
        .from(materiel)
        .where(eq(materiel.chantierId, chantierId))
        .orderBy(asc(materiel.ordre)),
      // Les photos supprimées ne comptent pas : les annoncer ferait chercher
      // dans le chantier des images que le patron a retirées lui-même.
      tx
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.chantierId, chantierId), isNull(photos.deletedAt))),
      // **Seule une transcription RÉUSSIE est imprimée.** Une transcription en
      // cours vaut `null`, une transcription échouée vaut ce que le moteur a
      // cru comprendre : imprimer l'une ou l'autre mettrait sur un document que
      // le client garde une phrase que le patron n'a jamais dite.
      tx
        .select({
          transcription: notesVocales.transcription,
          statut: notesVocales.transcriptionStatut,
        })
        .from(notesVocales)
        .where(eq(notesVocales.chantierId, chantierId))
        .orderBy(desc(notesVocales.createdAt))
        .limit(1),
      // Le devis d'origine, pour rapprocher les deux pièces : le dernier
      // ENVOYÉ, jamais un brouillon — un numéro de brouillon ne désigne rien
      // que le client puisse retrouver.
      tx
        .select({ numero: devis.numeroCommercial })
        .from(devis)
        .where(and(eq(devis.chantierId, chantierId), eq(devis.statut, "envoye")))
        .orderBy(desc(devis.numeroVersion))
        .limit(1),
    ]);

    const note = saNote[0];

    return {
      chantierNom: chantier.nom,
      // **Le jour de l'intervention, et non la date du document.** La fin du
      // chantier s'il est terminé, sinon le jour posé au planning. Ni l'une ni
      // l'autre : la fiche s'imprime sans date plutôt qu'avec celle du jour,
      // qui serait fausse dès le lendemain (`CLAUDE.md` §4).
      jour: chantier.termineAt
        ? chantier.termineAt.toISOString().slice(0, 10)
        : (chantier.datePlanifiee ?? null),
      creneau: chantier.creneauDebut,
      demiJournees: chantier.dureeDemiJournees,
      // `libelleSalarie` rend `null` quand l'entreprise n'a aucun salarié : il
      // n'y a personne à distinguer, et écrire un nom d'organisation ferait
      // exactement ce que le patron a interdit le 10 août (`src/lib/equipes.ts`).
      equipe: ((): string | null => {
        const nommees = sesEquipes
          .map((e) => libelleSalarie(e, entreprise?.nombreSalaries ?? 0))
          .filter((n): n is string => Boolean(n));
        return nommees.length === 0 ? null : ditQuiPart(nommees);
      })(),
      numeroDevis: sonDevis[0]?.numero ?? null,

      entrepriseNom: entreprise?.nom ?? "",
      entrepriseAdresse: entreprise?.adresse ?? null,
      entrepriseSiret: entreprise?.siret ?? null,
      entrepriseTelephone: entreprise?.telephone ?? null,
      entrepriseEmail: entreprise?.email ?? null,
      // Volontairement absent : sans chiffrage, un IBAN inviterait à payer une
      // somme que personne n'a écrite. Le moteur le refuse déjà ; ne pas le
      // charger évite qu'un changement d'option le fasse réapparaître.
      entrepriseIban: null,

      clientNom: client?.nom ?? null,
      clientCivilite: client?.civilite ?? null,
      clientAdresse: client?.adresse ?? null,
      clientTelephone: client?.telephone ?? null,
      adresseChantier: chantier.adresseChantier,

      prestations: sesPrestations.map((p) => p.libelle).filter((l) => l.trim().length > 0),
      materiel: sonMateriel.map((m) => m.libelle).filter((l) => l.trim().length > 0),
      observations: note?.statut === "reussie" ? (note.transcription ?? null) : null,
      photos: sesPhotos.length,
    };
  });
}

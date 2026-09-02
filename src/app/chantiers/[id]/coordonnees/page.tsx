import { notFound } from "next/navigation";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantierPourCoordonnees } from "@/server/repositories/chantiers";
import FormulaireNouveauChantier from "../../nouveau/FormulaireNouveauChantier";
import { provenanceDesCoordonnees } from "@/lib/retour-du-devis";
import { listerPhotos } from "@/server/repositories/photos";
import { getNoteVocale } from "@/server/repositories/notes-vocales";

// Données réelles, propres à l'entreprise courante : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

/**
 * Les coordonnées d'un chantier — l'écran de la création, rouvert.
 *
 * **Sa demande du 17 août 2026, et sa correction le même jour.** D'abord :
 * *« j'ai oublié de rentrer les infos du client […] que je puisse cliquer sur le
 * client du dix-sept août et que ça me mette directement sur la page client »*.
 * Puis, devant une planche qui inventait une fiche de toutes pièces : ***« que
 * ça m'amène sur la page que je t'ai envoyée sur la deuxième photo. RIEN DE
 * PLUS, RIEN DE MOINS. »*** — sa capture montrait l'écran de création.
 *
 * **Il n'y a donc pas d'écran nouveau ici**, seulement une porte : le même
 * `FormulaireNouveauChantier`, prérempli, qui enregistre au lieu de créer. Deux
 * formulaires auraient divergé au premier champ ajouté.
 *
 * **L'adresse du client n'est montrée que si elle DIFFÈRE de celle du
 * chantier.** À la création, laisser ce champ vide vaut « la même » et l'action
 * recopie l'adresse du chantier ; réafficher cette copie ici ferait paraître une
 * seconde adresse qu'il n'a jamais saisie — le défaut qu'il a signalé le 6 août
 * sur le devis, transposé.
 */
export default async function CoordonneesDuChantierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // **D'où il vient, et donc où le ramener** — sa demande du 31 août 2026.
  // Entré depuis un devis sans client, il doit y retourner une fois la fiche
  // remplie : c'est le document qu'il était en train de lire. Entré depuis
  // l'accueil (« Adresse non renseignée », 17 août), rien ne change.
  const provenance = provenanceDesCoordonnees(id, (await searchParams).de);
  const ctx = await getCurrentCtx();
  const chantier = await getChantierPourCoordonnees(ctx, id);
  if (!chantier) notFound();

  // **Ce que le chantier porte déjà** — sa demande du 31 août 2026 : la fiche
  // client rouverte est la MÊME que celle de la création, photos et anneau
  // compris. Les lire ici, et non les inventer vides : une pellicule vide sur
  // un chantier photographié lui ferait croire ses photos perdues.
  const [photos, note] = await Promise.all([listerPhotos(ctx, id), getNoteVocale(ctx, id)]);

  const adresseChantier = chantier.adresseChantier ?? "";
  const adresseClient = chantier.clientAdresse ?? "";
  const memeAdresse =
    adresseClient.trim().length > 0 &&
    adresseClient.trim().toLowerCase() === adresseChantier.trim().toLowerCase();

  return (
    <FormulaireNouveauChantier
      reprise={{
        id: chantier.id,
        provenance,
        photos,
        note: note ? { storageKey: note.storageKey, dureeSecondes: note.dureeSecondes } : null,
        nomClient: chantier.clientNom ?? "",
        civilite: chantier.clientCivilite ?? null,
        telephone: chantier.clientTelephone ?? "",
        email: chantier.clientEmail ?? "",
        canal: chantier.clientCanal ?? null,
        adresseChantier,
        adresseClient: memeAdresse ? "" : adresseClient,
      }}
    />
  );
}

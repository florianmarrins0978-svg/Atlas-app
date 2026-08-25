import { headers } from "next/headers";
import { originePublique } from "@/server/origine-publique";
import { notFound } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { canalPourJoindre } from "@/lib/message-client";
import { getEntreprise } from "@/server/repositories/entreprises";
import { listerLignesPrix } from "@/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran } from "@/server/repositories/devis";
import { getBrouillon } from "@/server/repositories/brouillons-informations";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import { devisAPreparer } from "@/lib/devis-a-preparer";
import { leconsComparables } from "@/server/repositories/lecons-prix";
import { rappelDePrix } from "@/lib/lecons-prix";
import DevisCompletClient from "./DevisCompletClient";
import PreparationDictee from "./PreparationDictee";

// **Une page où il n'y a que le devis.**
//
// Le patron, le 5 août 2026 : « je veux pouvoir cliquer sur un lien qui ouvre
// une page où, dans cette page, il n'y a QUE le devis — celui que je t'ai
// envoyé, celui d'Arborea. C'est pour les patrons qui auront envie de le
// remplir à la main, qui n'ont pas envie d'utiliser la note vocale. »
//
// D'où deux règles qui gouvernent cet écran, et qu'il ne faut pas défaire :
//
// 1. **Aucun décor d'application.** Pas de barre d'onglets (voir
//    `estEcranSansNavigation` dans `src/app/layout.tsx`), pas de titre d'écran,
//    pas de phrase d'explication. Une feuille de devis entourée d'onglets
//    redevient un écran d'application — exactement ce qu'elle ne doit pas être.
//    Seul subsiste un retour discret : une page sans sortie est un piège sur un
//    téléphone.
// 2. **La mise en page du papier**, reprise de `appli/devis-modele.html` : en-tête
//    avec les références à droite, titre, émetteur et client côte à côte,
//    tableau avec ses colonnes, totaux alignés à droite, conditions, cadre de
//    signature. C'est aussi ce que le PDF imprime (`ARCHITECTURE.md` §16) : ce
//    qui est à l'écran est ce que le client recevra.
export const dynamic = "force-dynamic";

// Reprise telle quelle du PDF : une validité affichée qui différerait de celle
// imprimée serait un engagement faux.
const VALIDITE = "30 jours";

export default async function DevisCompletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // Même règle que l'écran Devis : un devis déjà envoyé se relit tel quel, en
  // lecture seule — le consulter ne doit jamais ouvrir une nouvelle version.
  const devisRow = (await chargerDevisPourEcran(ctx, id)) ?? (await getOuCreerDevisBrouillon(ctx, id));

  const [entreprise, client, lignes, brouillon, note] = await Promise.all([
    getEntreprise(ctx),
    chantier.clientId ? getClient(ctx, chantier.clientId) : Promise.resolve(null),
    listerLignesPrix(ctx, id),
    getBrouillon(ctx, id),
    getNoteVocale(ctx, id),
  ]);

  // **Une dictée sans devis se traite ICI, à l'arrivée** — sa panne du 21 août
  // 2026 : il dicte chez sa cliente, ferme l'application, revient, ouvre le
  // chantier, et tombe sur une feuille vide. La règle vit dans une fonction
  // pure (`src/lib/devis-a-preparer.ts`) ; cet écran n'a qu'à l'appliquer.
  const aPreparer = devisAPreparer({
    aUneNoteVocale: note !== null,
    nombreDeLignes: lignes.length,
    statutDevis: devisRow.statut,
  });

  // **Ce que l'agent a retenu de ses devis passés.**
  //
  // Calculé ici, côté serveur, et non dans l'écran : le rappel se déduit de la
  // mémoire de l'entreprise, qui ne traverse jamais jusqu'au navigateur — seule
  // la phrase à lire le fait.
  //
  // Le chantier en cours est exclu de sa propre mémoire : afficher « la
  // dernière fois : 1 400 € » juste sous une ligne à 1 400 € n'apprend rien et
  // donne l'impression d'un agent qui radote.
  const rappels: Record<string, { prix: string; phrase: string }> = {};
  for (const ligne of lignes) {
    const rappel = rappelDePrix(await leconsComparables(ctx, ligne.libelle, { chantierExclu: id }));
    if (rappel) rappels[ligne.id] = { prix: rappel.prix, phrase: rappel.phrase };
  }

  // Le pourquoi vit dans `originePublique` — c'était « même code que l'écran du
  // devis parti », et c'est désormais LE même code.
  const origine = originePublique(await headers());

  return (
    <div
      style={{ backgroundColor: colors.rustTint, color: colors.ink, fontFamily: font.body, minHeight: "100dvh" }}
      className="px-3 py-4 sm:px-6 sm:py-8"
    >
      {/* Le retour et le micro vivent DANS l'écran client depuis le 15 août
          2026 : le micro doit toucher aux lignes du devis, donc à son état, et
          il se tient sur la même ligne que le retour — le retour à gauche, le
          micro à droite, comme sur la fiche du client. */}
      {aPreparer && <PreparationDictee chantierId={id} />}

      <DevisCompletClient
        chantierId={id}
        devisId={devisRow.id}
        numeroCommercial={devisRow.numeroCommercial}
        dateEmission={devisRow.dateEmission}
        validite={VALIDITE}
        statut={devisRow.statut as "brouillon" | "envoye"}
        // **Son logo, sur l'écran où il regarde son devis** (18 août 2026).
        // Il l'avait posé dans « Devis & factures », vu dans l'aperçu de ce
        // réglage, puis constaté qu'il n'apparaissait pas ici : *« j'ai rajouté
        // un logo en haut à gauche mais il n'est pas visible »*. Le PDF le
        // portait déjà — c'est cet écran-ci qui ne le montrait pas.
        logo={entreprise?.logoStorageKey ?? null}
        emetteur={{
          nom: entreprise?.nom ?? "",
          adresse: entreprise?.adresse ?? "",
          siret: entreprise?.siret ?? "",
          telephone: entreprise?.telephone ?? "",
          email: entreprise?.email ?? "",
          iban: entreprise?.iban ?? "",
        }}
        clientId={chantier.clientId ?? null}
        client={{
          nom: client?.nom ?? "",
          civilite: client?.civilite ?? null,
          adresse: client?.adresse ?? "",
          telephone: client?.telephone ?? "",
          email: client?.email ?? "",
        }}
        // Le canal convenu vit sur la fiche du CLIENT, pas sur le devis : c'est
        // un accord avec la personne. Un devis repris six mois plus tard doit
        // partir par le canal du client d'aujourd'hui.
        canalClient={
          canalPourJoindre({
            canal: client?.canalCommunication ?? null,
            telephone: client?.telephone,
            email: client?.email,
          }) ?? "sms"
        }
        origine={origine}
        adresseChantier={chantier.adresseChantier ?? ""}
        lignesInitiales={lignes.map((l) => ({
          id: l.id,
          libelle: l.libelle,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          montant: l.montant,
        }))}
        tauxTva={devisRow.tauxTva}
        reductionPourcent={devisRow.reductionPourcent}
        conditionsPaiement={devisRow.conditionsPaiement ?? ""}
        /* La dictée a-t-elle été comprise, ou seulement recopiée ? L'avis vivait
           sur le compte rendu, qui a disparu du parcours : il se dit désormais
           sur le devis, c'est-à-dire là où le patron relit les lignes. */
        lectureLitterale={brouillon?.lecture === "litterale"}
        rappels={rappels}
      />
    </div>
  );
}

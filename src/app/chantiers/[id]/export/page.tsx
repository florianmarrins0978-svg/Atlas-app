import { headers } from "next/headers";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran, getLignesDevis } from "@/server/repositories/devis";
import { listerPrestations } from "@/server/repositories/prestations";
import { dernierEnvoi } from "@/server/repositories/envois-devis";
import { etatEnvoi } from "@/lib/etat-envoi";
import ExportClient from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  // Si le dernier devis a déjà été envoyé, il est chargé tel quel, en lecture
  // seule — consulter cet écran ne déclenche jamais de nouvelle révision.
  // Sinon, le brouillon est créé ou régénéré depuis les lignes de prix courantes.
  const devisRow = (await chargerDevisPourEcran(ctx, id)) ?? (await getOuCreerDevisBrouillon(ctx, id));

  // Le canal convenu vit sur la fiche du client, pas sur le devis : c'est un
  // accord avec la personne, pas une caractéristique du document. Un devis
  // repris six mois plus tard doit partir par le canal du client d'aujourd'hui.
  const client = chantier.clientId ? await getClient(ctx, chantier.clientId) : null;
  const canalClient = client?.canalCommunication ?? "sms";
  // **Ce que l'écran doit montrer, c'est le devis — pas le chantier.**
  //
  // Il listait les *prestations* du chantier, qui les décrivent. Un devis écrit
  // entièrement à la main n'en a aucune : le patron voyait alors un total et
  // rien d'autre, sans savoir ce qui partirait chez son client. Ce sont les
  // LIGNES du devis, avec leurs montants, qui font foi — ce sont elles qui sont
  // imprimées sur le PDF, et elles seules.
  //
  // Les prestations restent en complément quand elles existent : elles disent
  // le travail, là où les lignes disent le prix.
  const lignesDuDevis = await getLignesDevis(ctx, devisRow.id);
  const prestations = await listerPrestations(ctx, id);

  // Où en est le devis parti, s'il est parti. C'est ce qui distingue « le
  // client réfléchit » de « le client a dit non » — deux situations que l'écran
  // présentait jusqu'ici de la même façon.
  const envoi = await dernierEnvoi(ctx, id);
  const etat = etatEnvoi(envoi);

  // L'adresse complète du lien est bâtie ICI, côté serveur, et non depuis
  // `window` : composée dans le navigateur, elle diffère de ce que le serveur a
  // rendu, et React régénère alors tout l'arbre. Le patron doit pouvoir copier
  // une adresse entière — un chemin seul ne s'ouvre nulle part.
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "";
  const protocole = entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  const origine = hote ? `${protocole}://${hote}` : "";

  return (
    // **`atlas-ecran`, la convention de l'écran d'accueil — pas une soustraction
    // écrite ici.**
    //
    // L'écran d'un devis parti pose son geste en bas, sous le pouce. Deux
    // tentatives ont échoué avant celle-ci, et la suite les a attrapées toutes
    // les deux : `min-height: calc(100vh - 232px)` (l'en-tête « mesuré » — faux
    // dès qu'un titre gagne un mot), puis `min-h-screen` + `pb-16` — qui
    // comptait DEUX FOIS la barre du bas, `main.atlas-contenu` la réservant
    // déjà (`globals.css`). L'écran débordait alors de 68 px.
    //
    // `atlas-ecran` fait exactement ce qu'il faut et le fait déjà pour l'écran
    // des chantiers : hauteur de la fenêtre moins la barre et la marge haute,
    // colonne, rien qui dépasse. Une seule définition à tenir à jour.
    <div className="atlas-ecran" style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}>
      <EnTeteEcran
        retour={{ href: `/chantiers/${id}`, libelle: "Retour à la fiche du chantier" }}
        surtitre={chantier.nom}
        titre="Devis"
      />

        <ExportClient
          chantierId={id}
          devisId={devisRow.id}
          clientId={chantier.clientId ?? null}
          chantierNom={chantier.nom}
          adresseChantier={chantier.adresseChantier ?? "Adresse non renseignée"}
          clientNom={devisRow.clientNom ?? "Client non renseigné"}
          // Celle du DOCUMENT, pas celle de la fiche : cet écran montre le
          // devis tel qu'il a été établi (migration 0038).
          clientCivilite={devisRow.clientCivilite ?? null}
          // Les coordonnées VIVANTES, pas l'instantané figé dans le devis.
          //
          // Le devis garde volontairement celles du jour où il a été établi :
          // c'est un document, il doit dire ce qui a été proposé. Mais cet
          // écran sert à JOINDRE le client aujourd'hui. Confondre les deux
          // faisait qu'une adresse ajoutée après coup n'apparaissait jamais —
          // le patron la saisissait, elle était bien enregistrée, et l'écran
          // continuait d'afficher le vide. Trouvé par `test-transmission-e2e`.
          clientTelephone={client?.telephone ?? devisRow.clientTelephone ?? ""}
          clientEmail={client?.email ?? devisRow.clientEmail ?? ""}
          entrepriseNom={devisRow.entrepriseNom ?? "Votre entreprise"}
          canalClient={canalClient}
          prestations={prestations.map((p) => p.libelle)}
          lignes={lignesDuDevis.map((l) => ({ libelle: l.libelle, montant: l.montant }))}
          totalTtc={devisRow.totalTtc}
          numeroDevis={devisRow.numeroCommercial}
          initialEnvoye={devisRow.statut === "envoye"}
          etatEnvoi={etat}
          messageClient={envoi?.precisionClient ?? null}
          lienEnvoi={envoi && !envoi.reponse ? `/devis/${envoi.jeton}` : null}
        origine={origine}
      />
    </div>
  );
}

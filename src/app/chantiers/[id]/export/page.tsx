import { headers } from "next/headers";
import { originePublique } from "@/server/origine-publique";
import { notFound, redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getEntreprise } from "@/server/repositories/entreprises";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { canalPourJoindre } from "@/lib/message-client";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran } from "@/server/repositories/devis";
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
  // **Déduit, jamais inventé** (`canalPourJoindre`, 20 août 2026) : un client
  // qui n'a qu'une adresse e-mail ne doit pas se voir proposer un SMS vers un
  // numéro qui n'existe pas. `"sms"` ne reste que lorsqu'on ne sait vraiment
  // rien — et l'envoi est alors déjà bloqué en amont.
  const canalClient =
    canalPourJoindre({
      canal: client?.canalCommunication ?? null,
      telephone: client?.telephone,
      email: client?.email,
    }) ?? "sms";
  // **Les lignes du devis et les prestations ne sont plus lues ici** — elles
  // servaient la synthèse d'avant l'envoi, supprimée le 20 août 2026. L'écran
  // du devis parti montre le montant et le numéro, pas le détail : celui-ci se
  // lit sur le devis lui-même, ou sur son PDF.

  // Où en est le devis parti, s'il est parti. C'est ce qui distingue « le
  // client réfléchit » de « le client a dit non » — deux situations que l'écran
  // présentait jusqu'ici de la même façon.
  const envoi = await dernierEnvoi(ctx, id);
  const etat = etatEnvoi(envoi);

  // **CET ÉCRAN N'EXISTE PLUS AVANT L'ENVOI — sa demande du 20 août 2026.**
  //
  // *« On supprime la page qui est entre les deux. On va raccourcir les
  // étapes. »* Il avait raison, et le doublon était réel : cet écran redisait
  // le client, les lignes et le total que `devis-complet` venait d'afficher en
  // entier, pour proposer le même geste. On ne relit pas un devis qu'on vient
  // de fermer.
  //
  // Le choix des dates se fait désormais sur le devis lui-même, par « Choisir
  // la date » — c'est la MÊME feuille, ouverte plus tôt
  // (`docs/maquettes/82-choisir-la-date.html`, proposition A).
  //
  // **Ce qui reste ici est ce qui vient APRÈS l'envoi**, et lui seul : l'état du
  // devis parti, le lien à transmettre au client, la reprise quand il demande
  // une correction. Cet écran-là, il l'a validé lui-même sur planche
  // (`docs/maquettes/34-le-devis-sur-sa-base.html`, « le signet d'or »).
  //
  // **Renvoyé côté SERVEUR, jamais après coup :** une redirection posée dans le
  // navigateur laisserait apparaître un écran vide le temps d'un battement,
  // et l'adresse resterait dans l'historique — le bouton « retour » y
  // ramènerait aussitôt.
  // **La condition suit ce que l'écran sait rendre, pas ce qu'on croit.** Un
  // premier jet renvoyait sur `!envoi && statut !== "envoye"` : après une
  // REPRISE, l'envoi existe encore et le devis est redevenu brouillon — l'écran
  // se serait alors rendu sur sa face récapitulative, celle qu'on supprime,
  // avec son bouton d'envoi. Deux portes vers la même pièce, dont une que le
  // patron ne devait plus voir.
  //
  // Le devis n'est parti que si SON statut le dit. Tout le reste est un devis
  // en cours d'écriture, et sa place est sur l'écran du devis.
  if (devisRow.statut !== "envoye") {
    redirect(`/chantiers/${id}/devis-complet`);
  }

  // Le pourquoi vit dans `originePublique` : quatre écrans recopiaient ces
  // quatre lignes, et le 24 août 2026 la règle a changé pour tous à la fois.
  const origine = originePublique(await headers());

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
      {/* **Plus de « Modifier » en or en face du titre, et c'est le renvoi
          ci-dessus qui l'a rendu impossible.** Ce lien répondait à un trou du
          13 août 2026 — *« si je veux modifier mon devis avant de l'envoyer, je
          peux pas »* : aucun chemin ne menait de l'écran d'envoi au devis. Il
          ne s'affichait que sur un devis NON parti ; or ce cas ne peut plus
          atteindre cet écran. Le garder aurait laissé un ternaire qui ne rend
          jamais rien — un code mort qui trompe la session suivante.

          Le trou, lui, ne peut plus se rouvrir : avant l'envoi, l'écran EST le
          devis modifiable. */}
      <EnTeteEcran
        retour={{ href: `/chantiers/${id}`, libelle: "Retour à la fiche du chantier" }}
        surtitre={chantier.nom}
        titre="Devis"
      />

        <ExportClient
          chantierId={id}
          devisId={devisRow.id}
          clientId={chantier.clientId ?? null}
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
          modeleMessage={(await getEntreprise(ctx))?.messageClient ?? null}
          canalClient={canalClient}
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

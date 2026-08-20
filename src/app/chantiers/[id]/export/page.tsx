import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getClient } from "@/server/repositories/clients";
import { getOuCreerDevisBrouillon, chargerDevisPourEcran } from "@/server/repositories/devis";
import { dernierEnvoi } from "@/server/repositories/envois-devis";
import { etatEnvoi } from "@/lib/etat-envoi";
import ExportClient from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `?envoye=1` : on arrive d'un envoi qui vient d'aboutir. Voir `ExportClient`. */
  searchParams: Promise<{ envoye?: string }>;
}) {
  const { id } = await params;
  const { envoye: vientDEtreEnvoye } = await searchParams;

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
        action={
          /* **« Modifier », en or, en face du titre.**

             Le patron, le 13 août 2026, capture à l'appui : *« j'ai un devis
             sur le feu […] mais si je veux modifier mon devis avant de
             l'envoyer, je peux pas »*. Il avait raison, et le trou était réel :
             « Modifier mon devis » n'existait que sur l'écran du devis PARTI
             (`EcranDevisParti`). Avant l'envoi — au moment précis où l'on
             corrige — aucun chemin ne menait d'ici à `devis-complet`.

             Cinq propositions lui ont été dessinées avant d'en coder une
             (`docs/maquettes/45-modifier-son-devis.html`, `CLAUDE.md` §3 bis).
             Il a retenu celle-ci : *« le modifier en or à droite du mot devis
             est parfait, code celui-là »*. Sa première idée — rendre le mot
             « Devis » lui-même cliquable — a été écartée par lui après avoir vu
             les deux : un titre qui est secrètement un lien ne s'annonce pas.

             **UNIQUEMENT AVANT L'ENVOI, et ce n'est pas un détail de
             présentation.** Un devis parti ne se modifie plus : le déclencheur
             `empecher_modification_devis_envoye` refuse la première frappe. Il
             se REPREND, ce qui ouvre une nouvelle version — un geste que le
             patron décide, et que l'écran d'après l'envoi porte déjà sous son
             propre libellé (« Reprendre le devis », « Corriger et renvoyer »).
             Offrir « Modifier » ici mènerait à un document mort.

             `self-end` : l'en-tête aligne ses enfants par le haut, où se trouve
             le surtitre. Sans cela, le mot se poserait à côté de « MME FÉLICIE »
             et non sur la ligne d'écriture du titre — c'est-à-dire ailleurs que
             sur la maquette qu'il a retenue. */
          devisRow.statut === "envoye" ? null : (
            <Link
              href={`/chantiers/${id}/devis-complet`}
              className="shrink-0 self-end pb-1 text-[15px] font-semibold"
              style={{ color: colors.or }}
            >
              Modifier
            </Link>
          )
        }
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
          canalClient={canalClient}
          totalTtc={devisRow.totalTtc}
          numeroDevis={devisRow.numeroCommercial}
          initialEnvoye={devisRow.statut === "envoye"}
          vientDEtreEnvoye={vientDEtreEnvoye === "1"}
          etatEnvoi={etat}
          messageClient={envoi?.precisionClient ?? null}
          lienEnvoi={envoi && !envoi.reponse ? `/devis/${envoi.jeton}` : null}
        origine={origine}
      />
    </div>
  );
}

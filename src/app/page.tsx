import {
  chantierEnCours,
  getStatutAffiche,
  lienDeReprise,
  ligneEtatChantier,
} from "@/lib/chantier-etat";
import { ongletDuChantier } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import { lieuDuChantier } from "@/lib/nom-chantier";
import { auth } from "@/auth";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersPourAffichage } from "@/server/repositories/chantiers";
import { notificationsPatron, envoisCaducs } from "@/server/repositories/envois-devis";
import Notifications from "./Notifications";
import AnnonceTransmission from "@/components/atlas/AnnonceTransmission";
import EcranChantiers from "./EcranChantiers";
import type { BrinChantier } from "./ListeChantiers";

// Données réelles, propres à l'entreprise courante : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// L'accueil : il ne fait que LIRE et compter. Toute la présentation vit dans
// `EcranChantiers`, qui a besoin du navigateur — la feuille qui monte, le fil
// qui défile, la perle qui s'accroche.
//
// **Le statut est calculé une seule fois, ici.** Le compteur et la ligne du
// chantier doivent dire la même chose ; deux calculs séparés finiraient par
// diverger, et c'est le genre d'écart qu'on ne voit qu'en production.
// ─────────────────────────────────────────────────────────────────────────────

/** Les états qui ATTENDENT un geste du patron : eux seuls portent l'or. */
/** « 26 » et « juil. » — le quantième et le mois, comme sur le fil. */
function jourEtMois(date: Date): { jour: string; mois: string } {
  return {
    jour: String(date.getDate()).padStart(2, "0"),
    mois: date.toLocaleDateString("fr-FR", { month: "short" }),
  };
}

export default async function ChantiersPage() {
  const ctx = await getCurrentCtx();
  const [session, chantiers, notifications, caducs] = await Promise.all([
    auth(),
    listerChantiersPourAffichage(ctx),
    notificationsPatron(ctx),
    envoisCaducs(ctx),
  ]);

  // Le prénom, jamais le nom complet : « Bonjour Florian Marrins » sonne comme
  // un courrier administratif. Absent, on n'invente rien — le salut disparaît.
  const prenom = session?.user?.name?.trim().split(/\s+/)[0] ?? null;

  // **Cette liste ne montre que ce qui reste à préparer.** Un chantier passé au
  // planning vit au planning ; facturé, terminé, ou dont la date est dépassée,
  // il vit dans « Terminés » (`src/lib/onglet-chantier.ts`).
  const avecStatut = chantiers
    .map((c) => ({ ...c, statut: getStatutAffiche(c) }))
    .filter((c) => ongletDuChantier(c) === "chantiers");

  const brins: BrinChantier[] = avecStatut.map((c) => {
    const { jour, mois } = jourEtMois(c.majAt);
    // **La date d'ENVOI, pas celle de la dernière modification.** Celle de
    // gauche est `majAt` — le chantier a pu bouger depuis pour une photo. Ce
    // qu'il compte, lui, ce sont les jours depuis que le devis est parti.
    const envoiLe = c.envoiEnvoyeAt ?? c.devisEnvoyeAt;
    const ligne = ligneEtatChantier({
      statut: c.statut,
      photosCount: c.photosCount,
      envoyeLe: envoiLe ? jourIso(new Date(envoiLe)) : null,
    });
    return {
      id: c.id,
      nom: c.nom,
      jour,
      mois,
      lieu: lieuDuChantier(c.nom, c.adresseChantier, c.clientNom),
      // L'état, et la ligne en clair sous lui quand il y a une date d'envoi à
      // dire. La règle vit dans `chantier-etat.ts` : l'écran n'a rien à décider.
      etat: ligne.etat,
      precision: ligne.precision,
      attend: ligne.enOr,
      // **Toucher un chantier, c'est REPRENDRE — pas recommencer.** Sa demande
      // du 13 août 2026, après s'être retrouvé à refaire toutes les étapes alors
      // qu'il ne lui restait qu'à envoyer son devis. Ce que la ligne DIT et où
      // elle MÈNE sont deux questions distinctes : la refonte du libellé et la
      // reprise cohabitent sans se marcher dessus.
      reprise: lienDeReprise(c.id, c),
      // Le décompte doit suivre un retrait sans redemander la page : l'écran
      // ne peut le faire que s'il sait, ligne par ligne, laquelle compte.
      enCours: chantierEnCours(c.statut),
      // Un chantier facturé ne devrait pas être ici — il vit sous « Terminés ».
      // Le refus voyage quand même avec la donnée : c'est le serveur qui le
      // prononce (`SuppressionChantierRefusee`), et l'écran doit pouvoir le
      // dire AVANT le geste plutôt que de laisser la ligne partir puis revenir.
      refusRetrait:
        c.statut === "facture"
          ? "Ce chantier est facturé : sa facture figure au relevé de TVA."
          : undefined,
    };
  });

  return (
    <EcranChantiers
      prenom={prenom}
      chantiers={brins}
      bandeaux={
        <>
          {/* Le mot qui accueille le patron au retour de sa messagerie. Placé
              AVANT les notifications : c'est la conséquence du geste qu'il
              vient de faire, pas une information de fond. */}
          <AnnonceTransmission />
          <Notifications initiales={notifications} caducs={caducs} />
        </>
      }
    />
  );
}

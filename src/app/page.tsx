import { chantierEnCours, getStatutAffiche, statutLabel, type ChantierStatut } from "@/lib/chantier-etat";
import { ongletDuChantier } from "@/lib/onglet-chantier";
import { nombreEnLettres } from "@/lib/nombre-en-lettres";
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
const ETATS_EN_ATTENTE: ChantierStatut[] = ["devis_retourne", "devis_a_corriger", "a_relancer", "devis_caduc"];

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
  const enCours = avecStatut.filter((c) => chantierEnCours(c.statut)).length;

  const brins: BrinChantier[] = avecStatut.map((c) => {
    const { jour, mois } = jourEtMois(c.majAt);
    const photos = c.photosCount > 0 ? `${c.photosCount} photo${c.photosCount > 1 ? "s" : ""}` : "sans photo";
    return {
      id: c.id,
      nom: c.nom,
      jour,
      mois,
      lieu: c.adresseChantier ?? c.clientNom ?? "Adresse non renseignée",
      // Une seule ligne pour l'état et les photos, séparés d'un point médian :
      // c'est la forme retenue, et elle tient là où deux lignes débordaient.
      etat: `${statutLabel[c.statut]} · ${photos}`,
      attend: ETATS_EN_ATTENTE.includes(c.statut),
    };
  });

  return (
    <EcranChantiers
      prenom={prenom}
      compte={enCours}
      compteEnLettres={nombreEnLettres(enCours)}
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

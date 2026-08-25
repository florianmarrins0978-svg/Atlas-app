import {
  chantierEnCours,
  getStatutAffiche,
  lienDeReprise,
  ligneEtatChantier,
} from "@/lib/chantier-etat";
import { ongletDuChantier } from "@/lib/onglet-chantier";
import { jourIso } from "@/lib/jour";
import { lieuDuChantier, lieuEstManquant } from "@/lib/nom-chantier";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerChantiersPourAffichage } from "@/server/repositories/chantiers";
import { notificationsPatron, envoisCaducs } from "@/server/repositories/envois-devis";
import { rappelsEnCours } from "@/server/repositories/rappels";
import { depuisCombien, joursEcoules } from "@/lib/rappels";
import { enEuros } from "@/lib/euros";
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
  // **L'instant est pris UNE FOIS, ici, et passé plus bas.** Deux appels à
  // `new Date()` dans la même page donnent deux instants, et un rappel « depuis
  // 7 jours » calculé sur l'un puis comparé à l'autre finit par osciller autour
  // de son seuil d'un rechargement à l'autre.
  const maintenant = new Date();
  // **`auth()` n'est plus appelé ici depuis le 24 août 2026.** Il ne servait
  // qu'au « Bonjour … », retiré à sa demande (planche 95) : garder la requête
  // pour n'en rien faire coûterait un aller-retour à chaque ouverture de son
  // écran d'accueil, et laisserait croire à la prochaine lecture que la session
  // sert encore à quelque chose ici.
  const [chantiers, notifications, caducs, rappels] = await Promise.all([
    listerChantiersPourAffichage(ctx),
    notificationsPatron(ctx),
    envoisCaducs(ctx),
    rappelsEnCours(ctx, maintenant),
  ]);

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
    const lieu = lieuDuChantier(c.nom, c.adresseChantier, c.clientNom);
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
      lieu,
      // **La question se tranche ICI, au serveur, et une seule fois.** L'écran
      // qui comparerait le texte de son côté referait la règle une seconde
      // fois : le jour où le repli change de mots, la ligne cesserait
      // silencieusement d'être cliquable (`CLAUDE.md` §3).
      lieuManquant: lieuEstManquant(lieu),
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
      chantiers={brins}
      bandeaux={
        <>
          {/* Le mot qui accueille le patron au retour de sa messagerie. Placé
              AVANT les notifications : c'est la conséquence du geste qu'il
              vient de faire, pas une information de fond. */}
          <AnnonceTransmission />
          <Notifications
            initiales={notifications}
            caducs={caducs}
            // Le délai est mis en mots ICI, au serveur : l'écran n'a pas à
            // recalculer une durée et à en donner une seconde version.
            rappels={rappels.map((r) => ({
              genre: r.genre,
              chantierId: r.chantierId,
              chantierNom: r.chantierNom,
              depuisTexte: depuisCombien(maintenant, r.depuis),
              depuisJours: joursEcoules(maintenant, r.depuis),
              // **Les montants sont mis en forme ICI, au serveur.** Deux mises
              // en forme du même nombre — une au serveur, une à l'écran —
              // finiraient par afficher deux sommes différentes sur la même
              // carte, et il chercherait laquelle est juste.
              facture: r.facture
                ? {
                    id: r.facture.id,
                    numero: r.facture.numero,
                    resteDu: enEuros(r.facture.resteDuCts / 100),
                    total: enEuros(r.facture.totalCts / 100),
                    // Partielle : un règlement est déjà arrivé, donc le reste
                    // diffère du total. C'est ce qui décide d'écrire « restant
                    // sur … » plutôt qu'un montant seul.
                    partielle: r.facture.resteDuCts !== r.facture.totalCts,
                  }
                : undefined,
            }))}
          />
        </>
      }
    />
  );
}

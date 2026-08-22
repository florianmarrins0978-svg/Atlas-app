import { headers } from "next/headers";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { getCurrentCtx } from "@/server/session-ctx";
import { lirePassage } from "@/server/repositories/passages-entretien";
import { listerClients } from "@/server/repositories/clients";
import { getEntreprise } from "@/server/repositories/entreprises";
import FicheChantierClient from "./FicheChantierClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fiche de chantier — Atlas" };

/**
 * La fiche qu'il coche sur un chantier — **arrangement C**, sa décision du
 * 17 août 2026 (planche `docs/maquettes/77-la-fiche-dans-paysage.html`).
 *
 * La fiche s'ouvre SANS client : un outil qui exige un client ne sert pas en
 * visite. Une ligne discrète — « c'est pour quel client ? » — se touche à tout
 * moment, et la fiche se replie alors sur SES prestations sans perdre une
 * coche. La règle est dans `src/lib/passage-entretien.ts`.
 *
 * **La liste des clients part avec la page**, et c'est délibéré : sur un
 * chantier, la couverture réseau est ce qu'elle est. Une recherche qui appelle
 * le serveur à chaque lettre ne répondrait pas quand il en a besoin.
 */
export default async function FichePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const passage = await lirePassage(ctx, id);
  if (!passage) notFound();

  const [clients, entreprise] = await Promise.all([listerClients(ctx), getEntreprise(ctx)]);
  const entrepriseNom = entreprise?.nom ?? "";

  // **L'adresse complète est bâtie ICI, côté serveur, et jamais depuis
  // `window`.** Composée dans le navigateur, elle diffère de ce que le serveur
  // a rendu, et React régénère alors tout l'arbre en annonçant « Hydration
  // failed » — c'est l'erreur que le patron a signalée le 13 août sur la page
  // de sa facture (`ARCHITECTURE.md` §68, §81). L'écran d'envoi du devis
  // procède déjà exactement ainsi.
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "";
  const protocole =
    entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  const origine = hote ? `${protocole}://${hote}` : "";

  return (
    <main className="min-h-dvh">
      <EnTeteEcran
        surtitre="Outils du métier"
        titre="Fiche de chantier"
        retour={{ href: "/paysage/fiche", libelle: "Retour aux fiches" }}
      />
      <FicheChantierClient
        passage={{
          id: passage.id,
          jour: passage.jour,
          clientId: passage.clientId,
          clientNom: passage.clientNom,
          clientTelephone: passage.clientTelephone,
          clientEmail: passage.clientEmail,
          clientCivilite: passage.clientCivilite,
          clientCanal: passage.clientCanal,
          minutes: passage.minutes,
          observations: passage.observations,
          envoyeLe: passage.envoyeLe ? passage.envoyeLe.toISOString() : null,
          jeton: passage.jeton,
          lignes: passage.lignes,
        }}
        origine={origine}
        entrepriseNom={entrepriseNom}
        // **Les coordonnées partent avec la liste, et ce n'est pas du confort.**
        // La fiche s'ouvre sans client : celles du passage sont donc vides, et
        // le rester après qu'il a nommé quelqu'un ferait ouvrir un message SANS
        // destinataire. C'est le contrôle qui l'a trouvé, avant lui.
        clients={clients.map((c) => ({
          id: c.id,
          nom: c.nom,
          adresse: c.adresse ?? null,
          telephone: c.telephone ?? null,
          email: c.email ?? null,
          canal: c.canalCommunication ?? null,
        }))}
      />
    </main>
  );
}

import { colors, font } from "@/lib/design-tokens";
import { jourIso } from "@/lib/jour";
import { getCurrentCtx } from "@/server/session-ctx";
import { listerLesRetours } from "@/server/repositories/retours-intervention";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import { fonctionOuverte } from "@/lib/abonnements";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import FonctionReservee from "@/components/atlas/FonctionReservee";
import ListeDesRetours from "./ListeDesRetours";

/**
 * LES RETOURS D'INTERVENTION — la page que l'onglet de Terminés ouvre.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **SA DEMANDE DU 8 SEPTEMBRE 2026 :** *« on clique dessus et on arrive sur une
 * page où seront listés tous les retours d'intervention par client, avec les
 * infos, et en haut mettre un filtre pour que le patron puisse les retrouver
 * facilement. Et il faut pouvoir les garder longtemps. »*
 *
 * **« Longtemps » se lit dans ce qui N'EST PAS ici** : aucune fenêtre de
 * dix-huit mois, aucun `LIMIT`. La liste part de tout ce que l'entreprise
 * porte, et c'est le filtre qui réduit — jamais le chargement. Le mois affiché
 * (sa demande du 22 septembre 2026, la roue de la fiche de sécurité) se déplace
 * donc sur du déjà-chargé : remonter à 2024 ne demande rien au serveur.
 *
 * **Elle est fermée au salarié** par la liste blanche : elle vit sous
 * `/termines`, qu'il n'atteint pas (`src/lib/acces-roles.ts`). Elle ne porte
 * pourtant aucun montant — c'est une double protection, et la seconde ne
 * dispense pas de la première.
 */
export const dynamic = "force-dynamic";

export default async function PageDesRetours() {
  const ctx = await getCurrentCtx();
  // Un plus d'« Entreprise » (10 septembre 2026) : l'écran reste atteignable,
  // même en-tête, même retour — ce qui change, c'est ce qu'il y a dedans. Et
  // RIEN n'est lu avant d'avoir vérifié la formule.
  const abonnement = await abonnementDeLEntreprise(ctx);
  if (!fonctionOuverte(abonnement?.formule, "retours")) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran titre="Retours d'intervention" retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }} allure="commune" />
        <FonctionReservee fonction="retours" />
      </div>
    );
  }
  const retours = await listerLesRetours(ctx);
  // **Le mois du patron, pas celui de la machine ni celui du navigateur.**
  // Décidé ici, il est le même au rendu et à l'hydratation — sinon la nuit du
  // 30 au 1er, le serveur écrirait « Septembre » et le téléphone « Octobre ».
  const moisCourant = jourIso(new Date()).slice(0, 7);

  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <ListeDesRetours retours={retours} moisCourant={moisCourant} />
    </div>
  );
}

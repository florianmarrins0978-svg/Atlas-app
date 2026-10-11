import { colors, font } from "@/lib/design-tokens";
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
 * **« Longtemps » se lit dans ce qui N'EST PAS ici** : aucun mois, aucune
 * fenêtre de dix-huit mois, aucun `LIMIT` par défaut visible à l'écran. La
 * liste part de tout ce que l'entreprise porte, et c'est le filtre qui réduit —
 * jamais le chargement.
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

  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <ListeDesRetours retours={retours} />
    </div>
  );
}

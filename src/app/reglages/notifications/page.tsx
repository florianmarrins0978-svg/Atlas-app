import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { lireReglagesRappels } from "@/server/repositories/rappels";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";

/**
 * « Notifications » — d'après `maquettes/atlas-reglages-notifications.html`.
 *
 * **DEUX RAPPELS, ET PAS LES HUIT DE LA PLANCHE.** Elle listait huit familles ;
 * une seule existait, et elle le disait — *« rien ne part encore sur votre
 * téléphone »*. Les deux codées ici se calculent avec ce que la base porte
 * déjà ; les six autres attendent une donnée qui n'existe pas, au premier rang
 * de laquelle **« cette facture est payée »** (`src/lib/rappels.ts`).
 *
 * **Ce qui n'a PAS d'interrupteur, et c'est sa règle :** la réponse d'un client
 * et le lien de devis expiré. Les éteindre, ce serait ne plus savoir qu'on a
 * été refusé — *« seulement à celles où la désactivation n'entraîne pas de
 * problème »*, le 13 août 2026. L'écran le dit au lieu de les masquer.
 *
 * **Un non-propriétaire est refusé avant qu'aucune valeur ne soit lue** : ce
 * qu'un rôle n'a pas le droit de voir ne doit pas sortir du serveur
 * (`docs/QUESTIONS.md` §10).
 */
export default async function NotificationsPage() {
  const ctx = await getCurrentCtx();

  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran
          surtitre="Moi"
          titre="Notifications"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />
        <p className="mx-[26px] mt-8 text-[13px] leading-[1.7]" style={{ color: colors.muted }}>
          Ces rappels portent sur les devis et les factures de l&apos;entreprise. Ils appartiennent au patron.
        </p>
      </div>
    );
  }

  const reglages = await lireReglagesRappels(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Moi"
        titre="Notifications"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <NotificationsClient initial={reglages} />
    </div>
  );
}

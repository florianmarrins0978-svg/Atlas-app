import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { lireReglagesRappels } from "@/server/repositories/rappels";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import NotificationsClient from "./NotificationsClient";
import { garderLaPage } from "@/server/garde-page";

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
  await garderLaPage();
  const ctx = await getCurrentCtx();

  if (!(await estProprietaire(ctx))) {
    return (
      <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
        <EnTeteEcran allure="soignee" titre="Notifications" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
        {/* Une information, pas une faute : la plage bleue, et le cadenas qui
            dit d'un coup d'œil que la porte est fermée à ce rôle (sa planche
            soignée du 26 octobre 2026, état « Un salarié »). */}
        <div className="mx-[22px] mt-[18px]">
          <PlageTon ton="bleu">
            <span className="flex items-start gap-3">
              <svg
                aria-hidden="true"
                focusable="false"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-px flex-none"
              >
                <rect x="5" y="10.5" width="14" height="10" rx="2" />
                <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
              </svg>
              <span>Ces rappels portent sur les devis et les factures de l&apos;entreprise. Ils appartiennent au patron.</span>
            </span>
          </PlageTon>
        </div>
      </div>
    );
  }

  const reglages = await lireReglagesRappels(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      {/* Plus de « MOI » doré sous le titre : le titre suffit, comme sur le
          sommaire (sa planche soignée du 26 octobre 2026). */}
      <EnTeteEcran allure="soignee" titre="Notifications" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />
      <NotificationsClient initial={reglages} />
    </div>
  );
}

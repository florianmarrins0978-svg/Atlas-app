import type { ReactNode } from "react";
import { colors, font } from "@/lib/design-tokens";
import { fonctionOuverte, type FonctionReservee as Fonction } from "@/lib/abonnements";
import { getCurrentCtx } from "@/server/session-ctx";
import { abonnementDeLEntreprise } from "@/server/repositories/abonnements";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import FonctionReservee from "@/components/atlas/FonctionReservee";

/**
 * LA PORTE D'UN OUTIL RÉSERVÉ, posée une fois pour tout son dossier.
 *
 * Née le 24 septembre 2026, quand les trois outils de paysage ont quitté
 * « Artisan ». Chacun a plusieurs écrans (le diagnostic et son résultat, la
 * fiche, ses passages et « Composer ma fiche ») : fermer écran par écran
 * finirait par en oublier un. Elle se monte dans le `layout.tsx` de l'outil,
 * et tout ce qui est dessous est fermé d'un coup.
 *
 * **L'écran reste atteignable**, avec son titre et son retour : c'est la règle
 * de `FonctionReservee`, une rubrique qui disparaît se cherche.
 *
 * **Elle ne remplace pas la garde des actions** (`exigerFonction`) : une action
 * serveur s'appelle sans écran.
 */
export default async function OuvertParLaFormule({
  fonction,
  titre,
  children,
}: {
  fonction: Fonction;
  titre: string;
  children: ReactNode;
}) {
  const ctx = await getCurrentCtx();
  const abonnement = await abonnementDeLEntreprise(ctx);
  if (fonctionOuverte(abonnement?.formule, fonction)) return children;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran surtitre="Paysage" titre={titre} retour={{ href: "/paysage", libelle: "Retour à Paysage" }} />
      <FonctionReservee fonction={fonction} />
    </div>
  );
}

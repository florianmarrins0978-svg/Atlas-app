import type { ReactNode } from "react";
import { colors, font } from "@/lib/design-tokens";
import type { FonctionReservee as Fonction } from "@/lib/abonnements";
import { getCurrentCtx } from "@/server/session-ctx";
import { accesDeLaFonction } from "@/server/garde-action";
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
 *
 * **Un outil OFFERT s'ouvre** (le plan d'arrosage et le diagnostic, une fois,
 * 19 novembre 2026) : c'est en s'en servant qu'il le découvre.
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
  if ((await accesDeLaFonction(await getCurrentCtx(), fonction)) !== "fermee") return children;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran surtitre="Paysage" titre={titre} retour={{ href: "/paysage", libelle: "Retour à Paysage" }} />
      <FonctionReservee fonction={fonction} />
    </div>
  );
}

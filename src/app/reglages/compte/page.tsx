import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireCompte } from "@/server/repositories/compte";
import CompteClient from "./CompteClient";

export const dynamic = "force-dynamic";

/**
 * « Mon compte » — d'après `maquettes/atlas-reglages-moi.html`, écran 1.
 *
 * **Deux champs, et c'est tout ce que la base porte.** `users` connaît
 * l'e-mail, le nom, une image jamais remplie et le condensat du mot de passe.
 *
 * **PAS DE TÉLÉPHONE, et c'est SA décision du 14 août 2026 — réponse « A ».**
 * Le sommaire annonçait « Nom, e-mail et téléphone » ; le numéro que ses
 * clients voient est celui de l'entreprise, réglé dans « Mon entreprise » et
 * imprimé sur les documents. En ajouter un second, personnel, n'aurait envoyé
 * de message à personne : Atlas ne passe ni appel ni SMS (tranché le 4 août).
 * Ne pas le rouvrir sans qu'il le demande.
 *
 * **Aucune garde de rôle.** C'est la rubrique de la personne, pas de
 * l'entreprise : un salarié la garde entière.
 */
export default async function ComptePage() {
  const ctx = await getCurrentCtx();
  const compte = await lireCompte(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Moi"
        titre="Mon compte"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <CompteClient initial={{ nom: compte?.nom ?? "", email: compte?.email ?? "" }} />
    </div>
  );
}

import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import ConnexionClient from "./ConnexionClient";

export const dynamic = "force-dynamic";

/**
 * « Connexion » — d'après `maquettes/atlas-reglages-moi.html`, écran 3.
 *
 * **PAS DE LISTE D'APPAREILS, et c'est SA décision du 14 août 2026 — réponse
 * « A ».** Le sommaire annonçait « Mot de passe et appareils » ; Atlas ne garde
 * aucune session en base (`src/auth.ts` : jeton signé), il n'y avait donc rien
 * à afficher et rien à rebrancher — il aurait fallu l'écrire, soit une table et
 * deux à trois jours. Le geste utile un soir de téléphone perdu, c'est de
 * fermer tout d'un coup, pas de lire une liste : c'est ce que fait
 * « Me déconnecter partout » (migration 0042), pour une seule colonne.
 *
 * La liste reste possible plus tard, le jour où quelqu'un d'autre que lui se
 * connectera — avant ça, elle n'aurait qu'une ligne (`TODO.md` §0 octovicies).
 *
 * **Aucune garde de rôle** : c'est la rubrique de la personne.
 *
 * `getCurrentCtx` est appelé pour ce qu'il REFUSE : un visiteur sans session
 * n'atteint pas cet écran. Le contexte lui-même ne sert à rien ici — tout passe
 * par les actions.
 */
export default async function ConnexionPage() {
  await getCurrentCtx();

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Moi"
        titre="Connexion"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <ConnexionClient />
    </div>
  );
}

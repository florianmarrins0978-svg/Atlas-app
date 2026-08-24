import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import ConnexionClient from "./ConnexionClient";
import { listerCles } from "@/server/repositories/cles-appareil";

export const dynamic = "force-dynamic";

/**
 * « Connexion » — d'après `maquettes/atlas-reglages-moi.html`, écran 3.
 *
 * **PAS DE LISTE DES SESSIONS OUVERTES, et c'est SA décision du 14 août 2026 —
 * réponse « A ».** Le sommaire annonçait « Mot de passe et appareils » ; Atlas
 * ne garde aucune session en base (`src/auth.ts` : jeton signé), il n'y avait
 * donc rien à afficher et rien à rebrancher. Le geste utile un soir de
 * téléphone perdu, c'est de fermer tout d'un coup : c'est ce que fait
 * « Me déconnecter partout » (migration 0042), pour une seule colonne.
 *
 * **La liste qui existe depuis le 24 août est AUTRE CHOSE, et il ne faut pas
 * les confondre** : ce sont les appareils qui portent une clé « Ouvrir avec
 * Face ID » (migration 0063). Elle n'est pas là pour montrer qui est connecté —
 * ça, il l'a refusé — mais pour retirer une PORTE. Un téléphone perdu doit
 * cesser d'ouvrir Atlas ; « me déconnecter partout » ferme les sessions et ne
 * retire aucune clé.
 *
 * **Aucune garde de rôle** : c'est la rubrique de la personne.
 *
 * `getCurrentCtx` est appelé d'abord pour ce qu'il REFUSE : un visiteur sans
 * session n'atteint pas cet écran.
 */
export default async function ConnexionPage() {
  const ctx = await getCurrentCtx();
  // Lues au serveur plutôt qu'appelées depuis l'écran : la rubrique doit être
  // juste au premier rendu, sinon un artisan qui vient de perdre son téléphone
  // verrait une liste vide pendant une seconde et croirait n'avoir rien à
  // retirer.
  const cles = await listerCles(ctx.utilisateurId);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        surtitre="Moi"
        titre="Connexion"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <ConnexionClient cles={cles} />
    </div>
  );
}

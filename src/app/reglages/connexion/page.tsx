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
    /**
     * **L'ÉCRAN NE BOUGE PLUS — sa demande du 31 août 2026 :** *« la page
     * connexion n'est pas fixe, elle peut bouger encore ; il ne faut pas
     * qu'elle puisse bouger, aucun scroll possible »*.
     *
     * ─── Ce qu'il voyait, mesuré plutôt que supposé ────────────────────────
     *
     * Sur son banc, à 390 × 664, l'écran demandait **706 px** : il défilait de
     * 42, et « Me déconnecter partout » finissait à moitié sous la barre du
     * bas. Le contrôle du 31 août, lui, était vert — il mesurait 658 ≤ 664,
     * SANS le bandeau du banc, c'est-à-dire un écran que le patron n'a jamais
     * sous les yeux.
     *
     * **`atlas-ecran`, la convention de la maison** — celle de l'écran des
     * chantiers et de l'envoi : la hauteur qui reste, une colonne, rien qui
     * dépasse. Elle retranche désormais le bandeau du banc, et refuse
     * l'élastique du navigateur.
     *
     * **La colonne qui défile dedans n'est PAS un retour du défilement.** Elle
     * ne bouge que si l'écran ne peut pas tout montrer — un iPhone SE avec les
     * deux barres de Safari, ou un appareil Face ID déjà enregistré qui ajoute
     * sa ligne. L'alternative serait de COUPER le dernier geste, et un bouton
     * qu'on ne peut plus atteindre est pire qu'un écran qui glisse de vingt
     * pixels. Sur son téléphone, elle ne bouge pas d'un pixel.
     */
    <div
      className="atlas-ecran"
      style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}
    >
      <EnTeteEcran
        surtitre="Moi"
        titre="Connexion"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />
      <div className="atlas-colonne-defile" style={{ overscrollBehavior: "contain" }}>
        <ConnexionClient cles={cles} />
      </div>
    </div>
  );
}

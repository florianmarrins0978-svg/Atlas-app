/**
 * Le devis, à emporter, en un appui.
 *
 * **Sa demande du 31 août 2026 :** *« ajoute en-dessous une touche pour le
 * télécharger directement, un seul clic ! »* Le client qui revient sur son lien
 * après avoir accepté n'avait plus rien : ni le montant, ni la pièce.
 *
 * **Ce n'est plus un lien depuis le 12 septembre 2026.** Le lien remettait le
 * fichier au navigateur, qui sur un iPhone le peint au lieu de le ranger : le
 * client croyait avoir enregistré son devis, il ne l'avait que regardé. La page
 * va donc chercher le document et le remet à la feuille de partage
 * (`BoutonTelechargerDocument`, et ses raisons).
 *
 * **Le nom vient de la route** : lui seul porte le numéro du devis, et le
 * recopier ici en ferait deux (`CLAUDE.md` §3).
 */
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";
import { colors, surPlein } from "@/lib/design-tokens";

export default function BoutonTelechargerDevis({ jeton }: { jeton: string }) {
  return (
    <BoutonTelechargerDocument
      fichier={`/devis/${jeton}/pdf`}
      nom="devis.pdf"
      dataAtlas="telecharger-devis"
      /* **Les couleurs viennent des jetons, plus du code — 9 septembre 2026.**
         Il portait `bg-[#2F3B2F]` et `text-white` en dur : juste sur cinq
         chartes, illisible sur les deux sombres, et hors de la sienne partout
         (`CLAUDE.md` §3). C’est ce qu’il a vu — *« ce n’est pas aux couleurs
         de l’appli »*. */
      className="mt-4 block w-full rounded-full py-3 text-center text-[15px] font-medium"
      style={{ backgroundColor: colors.plein, color: surPlein }}
    >
      Télécharger mon devis
    </BoutonTelechargerDocument>
  );
}

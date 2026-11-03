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
import IconeTrait from "@/components/atlas/IconeTrait";

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
      className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-center text-[16px] font-semibold"
      style={{ backgroundColor: colors.plein, color: surPlein }}
    >
      <IconeTrait nom="telecharger" taille={19} epaisseur={1.8} />
      Télécharger mon devis
    </BoutonTelechargerDocument>
  );
}

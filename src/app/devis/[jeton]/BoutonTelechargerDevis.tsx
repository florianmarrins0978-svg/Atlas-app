/**
 * Le devis, à emporter, en un appui.
 *
 * **Sa demande du 31 août 2026 :** *« ajoute en-dessous une touche pour le
 * télécharger directement, un seul clic ! »* Le client qui revient sur son lien
 * après avoir accepté n'avait plus rien : ni le montant, ni la pièce.
 *
 * **`?telecharger` plutôt qu'un simple lien**, et la nuance compte sur un
 * téléphone : sans lui, le PDF s'ouvre dans le lecteur du navigateur et le
 * client croit l'avoir enregistré alors qu'il n'a fait que le regarder. Avec
 * lui, le fichier descend dans ses documents (`Content-Disposition:
 * attachment`, voir `pdf/route.ts`).
 *
 * `download` ne suffirait pas : les navigateurs de téléphone l'ignorent
 * largement. C'est le serveur qui décide, pas la page.
 */
import { colors, surPlein } from "@/lib/design-tokens";

export default function BoutonTelechargerDevis({ jeton }: { jeton: string }) {
  return (
    <a
      href={`/devis/${jeton}/pdf?telecharger=1`}
      /* **Les couleurs viennent des jetons, plus du code — 9 septembre 2026.**
         Il portait `bg-[#2F3B2F]` et `text-white` en dur : juste sur cinq
         chartes, illisible sur les deux sombres, et hors de la sienne partout
         (`CLAUDE.md` §3). C’est ce qu’il a vu — *« ce n’est pas aux couleurs
         de l’appli »*. */
      className="mt-4 block rounded-full py-3 text-center text-[15px] font-medium"
      style={{ backgroundColor: colors.plein, color: surPlein }}
    >
      Télécharger mon devis
    </a>
  );
}

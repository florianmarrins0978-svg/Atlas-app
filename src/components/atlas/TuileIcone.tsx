import { colors } from "@/lib/design-tokens";

/**
 * La tuile teintée d'une icône devant une ligne : celle des outils de Paysage,
 * et celle des rapports envoyés depuis sa planche du 9 novembre 2026
 * (*« pour les rapports envoyés, tu mets ce que tu as fait pour la B »*).
 *
 * **Éteinte**, l'icône passe à l'encre douce : un outil que la formule ferme
 * reste lisible sans appeler le doigt.
 */
export default function TuileIcone({ eteinte = false, children }: { eteinte?: boolean; children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]"
      style={{ backgroundColor: colors.rustTint, color: eteinte ? colors.inkSoft : colors.rust }}
    >
      {children}
    </span>
  );
}

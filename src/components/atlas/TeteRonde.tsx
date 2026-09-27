import { colors, font } from "@/lib/design-tokens";

/**
 * La tête d'une personne dans un rond, ou son repli s'il n'a pas de photo.
 *
 * *Sa demande du 27 septembre 2026, planche `appli/photo-des-salaries.html`,
 * proposition B.* Le même rond sert à l'écran Équipe, aux absences et au
 * planning : trois dessins écrits à la main divergeraient à la première
 * retouche (`CLAUDE.md` §3).
 *
 * **Le repli est le rang d'un salarié, en or**, exactement ce que la ligne
 * montrait avant la photo : un salarié sans photo ne change pas d'allure. Pour
 * un compte relié à aucun nom, c'est son initiale.
 */
export default function TeteRonde({
  repli,
  photo,
  taille,
}: {
  repli: string | number;
  /** La clef de stockage, telle que la base la porte. */
  photo: string | null | undefined;
  taille: number;
}) {
  return (
    <span
      data-atlas="tete-ronde"
      className="flex flex-none items-center justify-center overflow-hidden rounded-full"
      style={{
        width: taille,
        height: taille,
        background: colors.card,
        boxShadow: `inset 0 0 0 1px ${colors.line}`,
        color: colors.or,
        fontFamily: font.display,
        fontSize: Math.max(11, Math.round(taille * 0.38)),
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        // En fond plutôt qu'en `<img>` : l'image est décorative (le nom est
        // écrit à côté), et `next/image` n'a rien à optimiser sur une route
        // qui vérifie la session à chaque lecture. `api/tetes`, et pas
        // `api/fichiers` : le salarié doit voir les têtes, pas les chantiers.
        backgroundImage: photo ? `url("/api/tetes/${photo}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {photo ? null : repli}
    </span>
  );
}

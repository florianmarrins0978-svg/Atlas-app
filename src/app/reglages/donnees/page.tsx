import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { nomFichierSauvegarde } from "@/lib/nom-sauvegarde";
import RubriqueReservee from "../RubriqueReservee";
import BoutonTelecharger from "./BoutonTelecharger";

export const dynamic = "force-dynamic";

/**
 * « Sécurité & données » — emporter ses données, en un appui.
 *
 * **Le patron a perdu ses chantiers une fois**, en supprimant l'espace de
 * travail — sur mon conseil, deux fois donné. Il a ensuite posé la question qui
 * compte avant de nourrir l'agent : *« le jour où je mets ça en ligne, est-ce
 * que je perds toute la mémoire ? »* Tant qu'il ne peut pas récupérer ses
 * données lui-même, la réponse honnête reste « peut-être », et il a raison de
 * ne rien vouloir saisir. Ce lien est la réponse : un fichier, sur son
 * téléphone, sans terminal ni compte.
 *
 * **Un lien et non un bouton** : un téléchargement n'a pas à passer par une
 * action serveur (voir la route, et `CLAUDE.md` §5).
 */
export default async function DonneesPage() {
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Sécurité & données"
        quoi="Le fichier contient les clients, les devis et les factures de toute l'entreprise."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran
          surtitre="Réglages"
          titre="Sécurité & données"
          retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
        />

        <section className="mx-[26px] mt-[26px]">
          <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.muted }}>
            En garder une copie
          </p>

          {/* Le nom est redit ICI, et pas seulement dans l'en-tête du serveur.
              Un `download` vide laisse Safari se rabattre sur le nom du
              document : le 7 août 2026, le patron s'est vu proposer un fichier
              nommé « reglages », sans extension — donc impossible à ouvrir sur
              son téléphone. Une sauvegarde qui ne s'ouvre pas ne sauvegarde
              rien (`src/lib/nom-sauvegarde.ts`).

              **Et le nom change avec l'adresse.** Servi depuis
              `/reglages/donnees`, le repli de Safari donnerait « donnees » :
              raison de plus pour ne pas s'en remettre à lui. */}
          <BoutonTelecharger nomFichier={nomFichierSauvegarde(entreprise?.nom ?? "Entreprise", new Date())} />

          <p className="mt-[10px] text-[13px] leading-snug" style={{ color: colors.inkSoft }}>
            Un seul fichier, qui contient vos clients, vos chantiers, vos devis, vos factures, vos photos et vos
            enregistrements. Il s&apos;ouvre sans Atlas.
          </p>
          <p className="mt-2 text-[12px] leading-snug" style={{ color: colors.muted }}>
            Il contient les coordonnées de vos clients : à ranger comme un dossier client. La sauvegarde automatique,
            elle, attend le choix d&apos;un hébergement — sans destination extérieure, elle ne protégerait de rien.
          </p>
        </section>

        {/* **Ce qui n'existe pas encore le dit.** L'effacement d'un compte et le
            registre RGPD sont annoncés par le libellé de la rubrique, sur sa
            planche du 14 août ; laisser l'écran muet ferait chercher un bouton
            qui n'y est pas. */}
        <p className="mx-[26px] mt-[30px] border-t pt-[18px] text-[12px] leading-[1.7]"
           style={{ borderColor: colors.line, color: colors.muted }}>
          L&apos;effacement de votre compte et le registre des traitements ne se font pas
          encore depuis l&apos;application. Les textes qui vous engagent, eux, sont
          consultables et datés.
        </p>
      </div>
    </div>
  );
}

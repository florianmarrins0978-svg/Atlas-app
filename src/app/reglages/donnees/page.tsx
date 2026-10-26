import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import { colors, font, voile } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { nomFichierSauvegarde } from "@/lib/nom-sauvegarde";
import RubriqueReservee from "../RubriqueReservee";
import BoutonTelecharger from "./BoutonTelecharger";
import Picto from "@/components/atlas/reglages/Picto";
import { CONTACT_ATLAS } from "@/lib/contact-atlas";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * « Mes données » — emporter son travail, en un appui.
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
 *
 * **Un seul geste, sous le pouce** (planche des Réglages soignés, 26 octobre
 * 2026) : « Télécharger mes données » descend au-dessus de la barre, la place
 * du seul bouton plein de chaque écran soigné, et le fichier se montre avant
 * de partir.
 */
export default async function DonneesPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Mes données"
        quoi="Le fichier contient les clients, les devis et les factures de toute l'entreprise."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);
  // **Calculé une fois, montré ET posé sur le lien.** Le nom que le téléphone
  // donnera au fichier se lit avant qu'il parte (planche des Réglages soignés,
  // 26 octobre 2026) : c'est le même que celui que porte `download`, et non
  // une seconde écriture qui finirait par diverger.
  const nomFichier = nomFichierSauvegarde(entreprise?.nom ?? "Entreprise", new Date());

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran allure="soignee" titre="Mes données" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />

        {/* **RACCOURCI le 25 août 2026, à sa demande** : *« le texte sous
            télécharger est beaucoup beaucoup trop long, synthétise-le »*.
            Cinq lignes sont devenues deux.

            **Ce qui a été gardé, et pourquoi ces deux-là seulement.** Que le
            fichier s'ouvre SANS Atlas — c'est ce qui en fait une copie de
            secours plutôt qu'un objet captif. Et qu'il porte les coordonnées
            de ses clients — c'est ce qui l'oblige à le ranger, et cela ne
            peut pas se deviner.

            **Ce qui est parti :** l'inventaire de ce que le fichier contient
            (il le verra en l'ouvrant), et l'explication de la sauvegarde
            automatique qui n'existe pas encore — un écran n'a pas à
            expliquer ce qu'il ne fait pas.

            **Le 26 octobre 2026**, la seconde phrase passe sur une plage
            ambre : la ranger est la seule chose à faire une fois le fichier
            reçu, et 12 px gris ne le disaient pas. */}
        <Paquet titre="En garder une copie" sansPlage>
          <div className="flex items-center gap-3.5 rounded-[6px] px-[18px] py-4" style={{ backgroundColor: colors.card }}>
            <PastilleIcone ton="vert">
              <Picto nom="carton" />
            </PastilleIcone>
            <span className="min-w-0 flex-1">
              <span
                data-atlas="nom-de-la-sauvegarde"
                className="block text-[17px] leading-[1.3]"
                style={{ fontFamily: font.display, overflowWrap: "anywhere" }}
              >
                {nomFichier}
              </span>
              <span className="mt-[5px] block text-[15px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                Tout ce qu&apos;Atlas garde pour vous, dans un fichier qui s&apos;ouvre sans lui.
              </span>
            </span>
          </div>
          <div className="mt-3">
            <PlageTon ton="ambre">
              <span className="flex items-start gap-2.5">
                <span className="mt-px">
                  <Picto nom="cadenas" taille={20} />
                </span>
                <span>Il porte les coordonnées de vos clients : rangez-le comme un dossier client.</span>
              </span>
            </PlageTon>
          </div>
        </Paquet>

        {/* **DIRE COMMENT, PLUTÔT QUE DIRE QUE ÇA NE SE FAIT PAS — 9 septembre 2026.**
            La phrase d'avant annonçait deux absences : « l'effacement de votre
            compte et le registre des traitements ne se font pas encore depuis
            l'application ». Le « registre des traitements » est du vocabulaire de
            juriste, et il ne concerne pas l'artisan qui lit cet écran ; quant à
            l'effacement, lui dire qu'il est impossible le laisse sans recours
            alors qu'il en a un — nous écrire. L'écran ne promet donc aucun
            effacement depuis l'appli : il donne l'adresse, et rien d'autre.

            L'adresse vient de `CONTACT_ATLAS` et de nulle part ailleurs : le jour
            où il en crée une pour l'application, une seule ligne change. */}
        <p
          className="mx-6 mt-[30px] pt-[18px] text-[15px] leading-[1.55]"
          style={{ color: colors.inkSoft, boxShadow: `inset 0 1px 0 ${colors.line}` }}
        >
          Pour effacer votre compte, écrivez à{" "}
          <a
            href={`mailto:${CONTACT_ATLAS}`}
            className="font-semibold underline underline-offset-4"
            style={{ color: colors.or, textDecorationColor: voile(colors.or, 0.45) }}
          >
            {CONTACT_ATLAS}
          </a>
          .
        </p>

        {/* Le nom est redit sur le LIEN, et pas seulement dans l'en-tête du
            serveur. Un `download` vide laisse Safari se rabattre sur le nom du
            document : le 7 août 2026, le patron s'est vu proposer un fichier
            nommé « reglages », sans extension — donc impossible à ouvrir sur
            son téléphone. Une sauvegarde qui ne s'ouvre pas ne sauvegarde
            rien (`src/lib/nom-sauvegarde.ts`).

            **Et le nom change avec l'adresse.** Servi depuis
            `/reglages/donnees`, le repli de Safari donnerait « donnees » :
            raison de plus pour ne pas s'en remettre à lui. */}
        <BoutonTelecharger nomFichier={nomFichier} />
      </div>
    </div>
  );
}

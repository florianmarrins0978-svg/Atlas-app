import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import Paquet from "@/components/atlas/reglages/Paquet";
import PlageTon from "@/components/atlas/reglages/PlageTon";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import ActionBas from "@/components/atlas/reglages/ActionBas";
import { colors, font } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { getEntreprise } from "@/server/repositories/entreprises";
import { conditionsDepuisEntreprise } from "@/lib/conditions-documents";
import { conditionsGeneralesRemplies, crochetsRestants } from "@/lib/conditions-generales";
import { allureDepuisColonnes, ALLURE_PAR_DEFAUT } from "@/lib/allure-documents";
import {
  resumeAllure,
  resumeConditions,
  resumeMessages,
  resumeNumero,
  type Resume,
} from "@/lib/resume-devis-et-factures";
import { SOUS_RUBRIQUES_DOCUMENTS, type Rubrique } from "@/lib/rubriques-reglages";
import RubriqueReservee from "../RubriqueReservee";
import VoirUnExemple from "../VoirUnExemple";
import IconeReglage from "../icones";
import { Etat } from "./pieces";
import Picto from "@/components/atlas/reglages/Picto";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * « DEVIS & FACTURES » — un sommaire de quatre lignes, depuis le 7 septembre 2026.
 *
 * **C'était l'écran le plus long de l'application : 4 350 px, six écrans et
 * demi de son téléphone**, et il portait six sujets sans rapport : ce qui
 * s'imprime, ce que le devis dira, ce qui ne se coupe pas, son message, le
 * numéro, l'allure. Pour changer son logo, il traversait tout.
 *
 * **Il a tranché lui-même, planche en main** (`appli/couper-devis-et-factures.html`) :
 * *« on coupe »*. Quatre lignes, quatre écrans courts.
 *
 * **CE QUE LE DÉCOUPAGE NE FAIT PAS, et c'est ce qui a permis de le faire :**
 * rien ne sort de « Devis & factures ». Ses trois réponses des 23 et 25 août,
 * l'allure *« ici et pas dans une rubrique à part »* (B), le message *« ici »*
 * (A), l'aperçu collé (B), tiennent toujours : le sommaire des réglages garde
 * ses lignes, et ces réglages vivent un cran plus bas, pas ailleurs.
 *
 * **Chaque ligne dit ce qu'elle porte depuis le 26 octobre 2026** (sa planche
 * des Réglages soignés, `appli/soignee/reglages-documents.html`) : « Validité
 * 30 jours, acompte 30 % », « Année et 6 chiffres », « Votre logo, le doré ».
 * Il lit l'essentiel sans ouvrir les quatre écrans, et une chose à faire (un
 * crochet des conditions générales) se voit en ambre dès l'entrée. Les phrases
 * se calculent sur ses réglages (`resume-devis-et-factures.ts`).
 *
 * **La ligne n'est plus celle du sommaire des réglages** (`Sommaire`) : elle
 * porte une pastille et une seconde ligne que celui-là n'a pas. Les quatre
 * rubriques, elles, viennent toujours de `SOUS_RUBRIQUES_DOCUMENTS`, leurs
 * titres mot pour mot.
 *
 * **L'écran refuse un non-propriétaire avant de lire quoi que ce soit** : ces
 * conditions engagent l'entreprise sur un document que le client garde
 * (`docs/QUESTIONS.md` §10). Le refus est répété sur les quatre écrans : chacun
 * a son adresse, et une adresse se tape.
 */
export default async function DocumentsPage() {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return (
      <RubriqueReservee
        titre="Devis & factures"
        quoi="Ces conditions engagent l'entreprise sur un document que le client garde."
      />
    );
  }

  const entreprise = await getEntreprise(ctx);
  const conditions = conditionsDepuisEntreprise(entreprise);
  // **Ce qui RESTE une fois Mon entreprise versée dans le texte**, compté comme
  // l'écran « Ce qui s'imprime » le compte : un crochet couvert par l'assureur
  // ou le médiateur déjà saisis n'est plus un travail à faire.
  const crochets = crochetsRestants(
    conditionsGeneralesRemplies(conditions.conditionsGenerales, {
      assureurDecennale: entreprise?.assureurDecennale,
      contratDecennale: entreprise?.contratDecennale,
      couvertureDecennale: entreprise?.couvertureDecennale,
      mediateurNom: entreprise?.mediateurNom,
      mediateurCoordonnees: entreprise?.mediateurCoordonnees,
    })
  );
  // Rien de réglé, c'est le doré de ses documents : la règle de l'écran de
  // l'allure, qui s'ouvre sur ce que ses documents portent aujourd'hui.
  const accent =
    allureDepuisColonnes({
      typographie: entreprise?.docTypographie ?? null,
      fond: entreprise?.docFond ?? null,
      accent: entreprise?.docAccent ?? null,
    })?.accent ?? ALLURE_PAR_DEFAUT.accent;

  const situations: Record<string, Resume> = {
    "/reglages/documents/conditions": resumeConditions(conditions, crochets),
    "/reglages/documents/message": { texte: resumeMessages(), aFaire: false },
    "/reglages/documents/numero": { texte: resumeNumero(entreprise?.formatNumero), aFaire: false },
    "/reglages/documents/allure": { texte: resumeAllure(!!entreprise?.logoStorageKey, accent), aFaire: false },
  };

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <EnTeteEcran
        allure="soignee"
        titre="Devis & factures"
        retour={{ href: "/reglages", libelle: "Retour aux réglages" }}
      />

      <Paquet>
        {/* Une rubrique sans adresse ne mène nulle part : elle ne se dessine
            pas en ligne qu'on touche. Les quatre en ont une. */}
        {SOUS_RUBRIQUES_DOCUMENTS.flatMap((r) =>
          r.href ? [<LigneSommaire key={r.nom} rubrique={r} href={r.href} situation={situations[r.href]} />] : []
        )}
      </Paquet>

      {/* **La phrase qui fermait l'ancien écran reste ici, et nulle part
          ailleurs.** Elle vaut pour les quatre : la répéter sur chacun ferait
          quatre fois la même mise en garde (« Ce qui s'imprime » la redisait
          jusqu'au 26 octobre 2026), et la mettre sur un seul la cacherait aux
          trois autres. Bleue : c'est une information, pas une chose à faire. */}
      <div className="mx-[22px] mt-4">
        <PlageTon ton="bleu">
          Chaque devis garde <b style={{ color: colors.ink, fontWeight: 600 }}>ce que ces réglages disaient le
          jour où il a été créé</b> : les corriger aujourd&apos;hui ne change aucun document déjà fait.
        </PlageTon>
      </div>

      {/* Sous le pouce, au-dessus de la barre (sa planche) : il attendait au
          bout des quatre lignes, sa réponse « A et B » du 26 septembre 2026
          (`VoirUnExemple`). */}
      <ActionBas>
        <VoirUnExemple />
      </ActionBas>
    </div>
  );
}

/**
 * Une rubrique, ce qu'elle porte dessous, toute la ligne touchable.
 *
 * Le filet se pose au-dessus de chaque ligne et le paquet rogne le premier,
 * comme `LigneReglage` : jamais de trait orphelin au bord de la plage.
 */
function LigneSommaire({
  rubrique,
  href,
  situation,
}: {
  rubrique: Rubrique;
  href: string;
  situation: Resume | undefined;
}) {
  return (
    <Link
      href={href}
      className="relative flex min-h-[76px] items-center gap-[14px] py-3 no-underline"
      style={{ color: colors.ink }}
    >
      <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
      <PastilleIcone>
        <IconeReglage nom={rubrique.icone} />
      </PastilleIcone>
      <span className="min-w-0 flex-1">
        <span className="block text-[18.5px] leading-[1.25]" style={{ fontFamily: font.display }}>
          {rubrique.nom}
        </span>
        {situation &&
          (situation.aFaire ? (
            <span className="mt-1 block">
              <Etat ton="ambre">{situation.texte}</Etat>
            </span>
          ) : (
            <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
              {situation.texte}
            </span>
          ))}
      </span>
      <span style={{ color: colors.or }}>
        <Picto nom="suivant" taille={20} epaisseur={2} />
      </span>
    </Link>
  );
}

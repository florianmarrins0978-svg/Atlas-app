import Link from "next/link";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Picto from "@/components/atlas/reglages/Picto";
import PlageTon, { teintesDuTon, type Ton } from "@/components/atlas/reglages/PlageTon";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourEtMois, jourIso, moisAbrege } from "@/lib/jour";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { garderLaPage } from "@/server/garde-page";
import { PLATEFORMES, plateformesOffertes } from "@/server/plateformes/catalogue";
import {
  liaisonPlateforme,
  transmissionsRecentes,
  type LiaisonLue,
  type TransmissionLue,
} from "@/server/repositories/plateforme-facture";
import RubriqueReservee from "../RubriqueReservee";
import { delierPlateformeAction, relierPlateformeAction } from "./actions";

/**
 * FACTURE ÉLECTRONIQUE — sa planche du 5 novembre 2026
 * (`appli/soignee/reglages-facture-electronique.html`), ses choix 1 A, 2 A,
 * 3 B (`ARCHITECTURE.md` §555).
 *
 * **Le dessin est celui de Ma banque** : un compte relié, sa pastille et sa
 * date, la liste de ce qui est passé par lui, ce qu'Atlas y fait, délier tout
 * en bas. Deux comptes de l'entreprise se lisent de la même façon.
 *
 * **Deux cases, pas une** (corrigé sur la planche le même jour) : l'API
 * commune des plateformes demande un identifiant et un secret. Un jeton seul
 * se colle dans « Secret », l'identifiant laissé vide.
 *
 * **Pas de « reçue par son client »** : la planche le montrait, mais ce
 * retour vient d'un second échange (le cycle de vie de la facture) qui n'est
 * pas codé. L'écran dit ce que la plateforme a rendu : en cours, transmise,
 * refusée.
 */

export const dynamic = "force-dynamic";

const ISSUES: Record<string, { ton: "bien" | "mal"; texte: string }> = {
  relie: { ton: "bien", texte: "Votre compte est relié." },
  refus: { ton: "mal", texte: "Le compte n'a pas pu être relié." },
};

const FENETRE_JOURS = 30;

export default async function FactureElectroniquePage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string; raison?: string }>;
}) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  if (!(await estProprietaire(ctx))) {
    return <RubriqueReservee titre="Facture électronique" quoi="Le compte relié appartient au patron." />;
  }
  const params = await searchParams;
  const issue = params.issue ? ISSUES[params.issue] ?? null : null;
  const offertes = plateformesOffertes();
  const liaison = await liaisonPlateforme(ctx);
  const maintenant = new Date();
  const transmissions = liaison ? await transmissionsRecentes(ctx, maintenant, FENETRE_JOURS) : [];
  const refusees = transmissions.filter((t) => t.etat === "refusee");

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran titre="Facture électronique" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} allure="soignee" />

        {issue && (
          <div className="mx-[22px] mt-3" role={issue.ton === "mal" ? "alert" : "status"}>
            <PlageTon ton={issue.ton === "mal" ? "rouge" : "vert"} dataAtlas="issue-plateforme">
              {issue.texte}
              {params.raison && params.issue === "refus" ? ` ${params.raison}` : ""}
            </PlageTon>
          </div>
        )}

        {liaison ? (
          <>
            <CompteRelie liaison={liaison} />
            {liaison.etat === "coupee" && offertes.includes(liaison.plateforme) && (
              <FormulaireRelier offertes={[liaison.plateforme]} libelle="Remplacer mes identifiants" />
            )}
            {refusees.length > 0 && <AReprendre refusees={refusees} nom={liaison.nom} />}
            <FacturesEnvoyees transmissions={transmissions} />
          </>
        ) : offertes.length > 0 ? (
          <Paquet>
            <FormulaireRelier offertes={offertes} libelle="Relier mon compte" />
          </Paquet>
        ) : (
          <Paquet>
            <p className="py-4 text-[17px] leading-[1.4]" style={{ fontFamily: font.display }}>
              Aucune plateforme ne se relie encore à Atlas.
            </p>
          </Paquet>
        )}

        <Paquet titre="Sur ce compte">
          {(
            [
              ["envoyer", "Chaque facture d'entreprise que vous envoyez part aussi chez elle."],
              ["document", "Vos factures de fournisseurs arrivent chez elle, pas dans Atlas."],
              ["cadenas", "Atlas n'y fait rien d'autre."],
            ] as const
          ).map(([picto, phrase], i) => (
            <div key={picto} className="relative flex min-h-[58px] items-center gap-[14px] py-2.5">
              {i > 0 && <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
              <span className="flex-none" style={{ color: colors.or }}>
                <Picto nom={picto} />
              </span>
              <span className="text-[15.5px] leading-[1.4]">{phrase}</span>
            </div>
          ))}
        </Paquet>

        {liaison && (
          <form action={delierPlateformeAction} className="mt-5 flex justify-center">
            <button
              type="submit"
              data-atlas="delier-plateforme"
              className="min-h-[48px] px-4 text-[16px] font-semibold"
              style={{ color: colors.alert }}
            >
              Délier mon compte
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CompteRelie({ liaison }: { liaison: LiaisonLue }) {
  const ton: Ton = liaison.etat === "coupee" ? "rouge" : "vert";
  const quand =
    liaison.etat === "coupee" && liaison.coupeeLe
      ? `depuis le ${jourEtMois(jourIso(liaison.coupeeLe))}`
      : `depuis le ${jourEtMois(jourIso(liaison.depuis))}`;
  return (
    <Paquet dataAtlas="plateforme-reliee">
      <div className="flex items-center gap-[14px] pb-4 pt-[18px]">
        <PastilleIcone ton={ton}>
          <Picto nom="facture" taille={22} />
        </PastilleIcone>
        <div className="min-w-0 flex-1">
          <p className="text-[21px] leading-[1.25]" style={{ fontFamily: font.display }}>
            {liaison.nom}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1" data-atlas={`plateforme-${liaison.etat}`}>
            <EtatEcrit ton={ton}>{liaison.etat === "coupee" ? "Coupée" : "Reliée"}</EtatEcrit>
            <span className="whitespace-nowrap text-[15px] font-semibold" style={{ color: teintesDuTon(ton).texte }}>
              {quand}
            </span>
          </div>
          {liaison.etat === "coupee" && (
            <p className="mt-1.5 text-[14px] leading-[1.4]" style={{ color: teintesDuTon("rouge").texte }}>
              Vos identifiants ne marchent plus. Vos factures d&apos;entreprise ne partent plus tant qu&apos;ils ne sont pas remplacés.
            </p>
          )}
        </div>
      </div>
    </Paquet>
  );
}

const styleCase = {
  backgroundColor: colors.card,
  color: colors.ink,
  fontSize: "18px",
  boxShadow: `inset 0 0 0 1px ${colors.lineSoft}`,
} as const;

function FormulaireRelier({ offertes, libelle }: { offertes: (keyof typeof PLATEFORMES)[]; libelle: string }) {
  return (
    <form action={relierPlateformeAction} className="flex flex-col py-[18px]" data-atlas="relier-plateforme">
      <label htmlFor="plateforme" className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        Votre plateforme agréée
      </label>
      <select
        id="plateforme"
        name="plateforme"
        defaultValue={offertes[0]}
        required
        className="min-h-[52px] rounded-[6px] border-0 px-[15px] py-3"
        style={{ ...styleCase, fontFamily: font.display }}
      >
        {offertes.map((cle) => (
          <option key={cle} value={cle}>
            {PLATEFORMES[cle].nom}
          </option>
        ))}
      </select>
      <label htmlFor="identifiant" className="mb-[7px] mt-[14px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        Identifiant
      </label>
      <input
        id="identifiant"
        name="identifiant"
        autoComplete="off"
        spellCheck={false}
        className="min-h-[52px] rounded-[6px] border-0 px-[15px] py-3"
        style={styleCase}
      />
      <label htmlFor="secret" className="mb-[7px] mt-[14px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        Secret
      </label>
      <input
        id="secret"
        name="secret"
        type="password"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder="Collez le secret ici"
        className="min-h-[52px] rounded-[6px] border-0 px-[15px] py-3"
        style={styleCase}
      />
      <details className="mt-1.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
        <summary className="min-h-[48px] cursor-pointer py-3 underline underline-offset-[3px]">Où les trouver ?</summary>
        <p className="mb-2 leading-[1.5]" style={{ color: colors.ink }}>
          Dans Pennylane : Paramètres de l&apos;entreprise, puis Connectivité, puis Développeurs. Un jeton seul se colle dans Secret.
        </p>
      </details>
      <button
        type="submit"
        className="atlas-plein mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full px-[22px] text-[17px] font-semibold"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        {libelle}
      </button>
    </form>
  );
}

function AReprendre({ refusees, nom }: { refusees: TransmissionLue[]; nom: string }) {
  return (
    <Paquet titre="À reprendre" sansPlage>
      <div className="flex flex-col gap-2.5" data-atlas="factures-refusees">
        {refusees.map((t) => (
          <div key={t.factureId} className="rounded-[6px] px-[18px] py-4" style={{ backgroundColor: colors.carteRougeFond }}>
            <p className="flex items-center gap-2 text-[15px] font-bold" style={{ color: colors.carteRougeTexte }}>
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: "currentColor" }} />
              Refusée par {nom}
            </p>
            <p className="mt-1.5 text-[19px] leading-[1.3]" style={{ fontFamily: font.display }}>
              {t.client ?? t.numero}, {enEuros(Number(t.totalTtc))}
            </p>
            {t.raison && (
              <p className="mt-2 text-[15px] leading-[1.45]" style={{ color: colors.carteRougeTexte }}>
                {t.raison}
              </p>
            )}
            <Link
              href={`/chantiers/${t.chantierId}/facture`}
              className="mt-3 inline-flex min-h-[48px] items-center text-[16px] font-semibold underline underline-offset-[3px]"
              style={{ color: colors.ink }}
            >
              Ouvrir la facture
            </Link>
          </div>
        ))}
      </div>
    </Paquet>
  );
}

const ETATS: Record<TransmissionLue["etat"], { ton?: Ton; mot: string }> = {
  en_cours: { mot: "En cours" },
  transmise: { ton: "vert", mot: "Transmise" },
  refusee: { ton: "rouge", mot: "Refusée" },
};

function FacturesEnvoyees({ transmissions }: { transmissions: TransmissionLue[] }) {
  return (
    <section className="mx-[22px] mt-7">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase" style={{ color: colors.or, letterSpacing: "0.12em", fontFamily: font.body, fontWeight: 600 }}>
          Factures envoyées
        </h2>
        <span className="text-[13px]" style={{ color: colors.inkSoft }}>
          {FENETRE_JOURS} derniers jours
        </span>
      </div>
      <div className="rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
        {transmissions.length === 0 ? (
          <p className="py-4 text-[15px]" style={{ color: colors.inkSoft }}>
            Aucune facture transmise pour l&apos;instant.
          </p>
        ) : (
          <ul data-atlas="factures-transmises" className="flex flex-col">
            {transmissions.map((t, i) => {
              const jour = jourIso(t.deposeeLe);
              const etat = ETATS[t.etat];
              return (
                <li key={t.factureId} className="relative flex items-start gap-[14px] py-4">
                  {i > 0 && <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
                  <span className="mt-0.5 w-12 flex-none text-center leading-none">
                    <span className="block text-[26px]" style={{ fontFamily: font.display }}>
                      {Number(jour.slice(8, 10))}
                    </span>
                    <span className="mt-1 block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.inkSoft }}>
                      {moisAbrege(jour)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-[17.5px] leading-[1.3]" style={{ fontFamily: font.display, overflowWrap: "anywhere" }}>
                        {t.client ?? t.numero}
                      </span>
                      <span className="flex-none text-[18px] leading-[1.3] tabular-nums" style={{ fontFamily: font.display }}>
                        {enEuros(Number(t.totalTtc))}
                      </span>
                    </span>
                    <span className="mt-1 block text-[14px] leading-[1.4] tabular-nums" style={{ color: colors.inkSoft }}>
                      {t.numero}
                    </span>
                    <span className="mt-2.5 block">
                      <EtatEcrit ton={etat.ton}>{etat.mot}</EtatEcrit>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

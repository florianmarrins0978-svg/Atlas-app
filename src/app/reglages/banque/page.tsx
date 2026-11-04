import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import EtatEcrit from "@/components/atlas/reglages/EtatEcrit";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import Picto from "@/components/atlas/reglages/Picto";
import PlageTon, { teintesDuTon, type Ton } from "@/components/atlas/reglages/PlageTon";
import Link from "next/link";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourEtMois, jourIso, moisAbrege } from "@/lib/jour";
import { questionsDesVirements, type QuestionDeVirement } from "@/lib/virement-en-mots";
import { accordEnMots } from "@/lib/accord-bancaire";
import { compteDuReleve, echeanceDeLAccord, etatDeLaLecture, lignesDAvant, nomDuVirement } from "@/lib/ma-banque-en-mots";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { banquesFrancaises, cleDeposee } from "@/server/banque/enable-banking";
import { lireLaBanque, type ResultatLecture } from "@/server/banque/lecture";
import { debutDuReleve, NIVEAUX_D_HISTORIQUE_JOURS } from "@/lib/releve-bancaire";
import { facturesARapprocher } from "@/server/banque/questions";
import {
  liaisonDeLEntreprise,
  virementsDepuis,
  type LiaisonEnregistree,
  type VirementLuEnBase,
} from "@/server/repositories/banque";
import { dossierEnCours } from "@/server/repositories/dossiers-comptables";
import { lignesDuReleve } from "@/server/repositories/pour-mon-comptable";
import { adresseDeRetour, retourConfigure } from "@/server/paiement/retour";
import RubriqueReservee from "../RubriqueReservee";
import ReponseVirement from "../../ReponseVirement";
import { delierBanqueAction, relierBanqueAction } from "./actions";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * MA BANQUE — sa planche du 23 octobre 2026 (`appli/banque-a-essayer.html`),
 * soignée le 1er novembre (`appli/soignee/reglages-banque.html`, « code ça »).
 *
 * Né le 22 octobre comme un essai sur sa propre banque, cet écran porte la
 * liaison (en base, migration 0140) et la liste des virements reçus, chacun
 * avec sa question. **La même question vit sur l'accueil et dans Ma TVA** :
 * une réponse donnée ici vaut pour les deux autres.
 *
 * **Ce que la planche du 1er novembre a changé, et pourquoi** : ce soir-là un
 * scan ne lui a rien trouvé, et rien ici ne disait quand la banque avait été
 * lue. Chaque pastille porte désormais son heure à côté d'elle (« Lue »,
 * « Pas lue », « À renouveler »), le relevé du dossier en cours se compte en
 * entrées et en sorties, et la phrase « Atlas lit les virements reçus », fausse
 * depuis la lecture des sorties (27 octobre), dit les deux.
 *
 * **Dans le sommaire des Réglages, seulement reliée** (`rubriquesReglages`) :
 * sans contrat, Enable Banking ne relie que les comptes du propriétaire de
 * l'application (`docs/A-FAIRE.md` §13), et une rubrique visible de tous
 * ouvrirait chez chacun une porte qui refuse.
 */

const ISSUES: Record<string, { ton: "bien" | "mal"; texte: string }> = {
  relie: { ton: "bien", texte: "Votre banque est reliée." },
  annule: { ton: "mal", texte: "Annulé sur le site de la banque. Rien n'a été relié." },
  etat: { ton: "mal", texte: "Le retour de la banque n'a pas pu être vérifié. Recommencez." },
  banque: { ton: "mal", texte: "Choisissez votre banque." },
  adresse: { ton: "mal", texte: "L'adresse de votre espace est inconnue. Rallumez votre espace, puis recommencez." },
  refus: { ton: "mal", texte: "La banque n'a pas pu être reliée." },
};

/** Trente jours : de quoi voir passer les paiements du mois sans tout relire. */
const FENETRE_JOURS = 30;

export default async function BanquePage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string; raison?: string }>;
}) {
  await garderLaPage();
  const ctx = await getCurrentCtx();
  // Avant toute lecture : un salarié qui tape l'adresse ne déclenche rien.
  if (!(await estProprietaire(ctx))) {
    return <RubriqueReservee titre="Ma banque" quoi="Le compte relié appartient au patron." />;
  }

  const params = await searchParams;
  const issue = params.issue ? ISSUES[params.issue] ?? null : null;
  const cle = cleDeposee();
  const maintenant = new Date();
  // Il est devant l'écran : la banque se relit si la dernière lecture date
  // de plus d'une demi-heure (`lireLaBanque`).
  const lecture = cle.ok ? await lireLaBanque(ctx, { maintenant }) : null;
  const liaison = cle.ok ? await liaisonDeLEntreprise(ctx) : null;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-24">
        <EnTeteEcran titre="Ma banque" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} allure="soignee" />

        {issue && (
          <div className="mx-[22px] mt-3" role={issue.ton === "mal" ? "alert" : "status"}>
            <PlageTon ton={issue.ton === "mal" ? "rouge" : "vert"} dataAtlas="issue-banque">
              {issue.texte}
              {params.raison && params.issue === "refus" ? ` ${params.raison}` : ""}
            </PlageTon>
          </div>
        )}

        {!cle.ok ? (
          <PasEncoreBranche raison={cle.raison} />
        ) : liaison ? (
          <>
            <CompteRelie liaison={liaison} lecture={lecture} maintenant={maintenant} />
            <LeReleve maintenant={maintenant} />
            <VirementsRecus maintenant={maintenant} />
          </>
        ) : (
          <ChoisirSaBanque />
        )}

        {/* Ce qu'Atlas fait sur ce compte, et ce qu'il ne fait pas. La première
            phrase disait « les virements reçus » : fausse depuis le
            27 octobre, la lecture garde aussi les sorties (`lireTransactions`). */}
        <Paquet titre="Sur ce compte">
          {(
            [
              ["oeil", "Atlas lit les entrées et les sorties."],
              ["cadenas", "Il ne peut ni payer, ni déplacer de l'argent."],
              ["document", "Il ne met rien au relevé de TVA sans votre oui."],
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

        {/* Délier tout en bas, en rouge, loin des autres gestes : c'est le
            seul qui défait quelque chose. */}
        {liaison && (
          <form action={delierBanqueAction} className="mt-5 flex justify-center">
            <button type="submit" className="min-h-[48px] px-4 text-[16px] font-semibold" style={{ color: colors.alert }}>
              Délier ma banque
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Une pastille et, sur la même ligne, ce qu'elle date — sa retouche du
 * 1er novembre : *« la temporalité du renouvellement doit se situer à côté de
 * la pastille »*, puis *« fais pareil pour pas lue »*. Ce qui suit la pastille
 * est court pour tenir sur sa ligne dès 360 px ; s'il ne tient pas, il passe
 * dessous plutôt que de déborder.
 */
function PastilleEtQuand({ ton, etat, quand, dataAtlas }: { ton: Ton; etat: string; quand: string | null; dataAtlas: string }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1" data-atlas={dataAtlas}>
      <EtatEcrit ton={ton}>{etat}</EtatEcrit>
      {quand && (
        <span className="whitespace-nowrap text-[15px] font-semibold" style={{ color: teintesDuTon(ton).texte }}>
          {quand}
        </span>
      )}
    </div>
  );
}

function Suite({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[14px] leading-[1.4]" style={{ color: teintesDuTon(ton).texte }}>
      {children}
    </p>
  );
}

function CompteRelie({
  liaison,
  lecture,
  maintenant,
}: {
  liaison: LiaisonEnregistree;
  lecture: ResultatLecture | null;
  maintenant: Date;
}) {
  // La même règle que la carte de l'accueil : sept jours avant, les mêmes mots.
  const accord = accordEnMots(liaison.accordJusquAu, maintenant);
  const etatLecture = etatDeLaLecture(
    {
      luLe: liaison.luLe,
      refusDeCetteLecture: lecture && !lecture.ok ? lecture.raison : null,
      refusGarde: liaison.lectureRefusee,
      accordTermine: accord.joursRestants <= 0,
    },
    maintenant
  );
  const tonIcone: Ton = etatLecture?.ton === "rouge" ? "rouge" : accord.bientot ? "ambre" : "vert";
  // La banque refuse l'historique : seul cas où dire jusqu'où elle a lu sert à
  // quelque chose (sa remarque du 1er novembre, « beaucoup de texte pour pas
  // grand chose »).
  const historiqueLimite =
    liaison.historiqueJours !== null && liaison.historiqueJours < NIVEAUX_D_HISTORIQUE_JOURS[0]
      ? lignesDAvant(debutDuReleve(maintenant, liaison.historiqueJours), maintenant)
      : null;

  return (
    <>
      <Paquet dataAtlas="compte-relie">
        <div className="flex items-center gap-[14px] pb-4 pt-[18px]">
          <PastilleIcone ton={tonIcone}>
            <Picto nom="banque" taille={22} />
          </PastilleIcone>
          <div className="min-w-0 flex-1">
            <p className="text-[21px] leading-[1.25]" style={{ fontFamily: font.display }}>
              {liaison.banque || "Votre banque"}
            </p>
            {etatLecture && (
              <>
                <PastilleEtQuand
                  ton={etatLecture.ton}
                  etat={etatLecture.etat}
                  quand={etatLecture.quand}
                  dataAtlas={etatLecture.ton === "rouge" ? "banque-pas-lue" : "banque-lue"}
                />
                {etatLecture.raison && <Suite ton="rouge">{etatLecture.raison}</Suite>}
              </>
            )}
            {accord.bientot && (
              <>
                <PastilleEtQuand
                  ton="ambre"
                  etat={accord.joursRestants <= 0 ? "Accord terminé" : "À renouveler"}
                  quand={echeanceDeLAccord(accord)}
                  dataAtlas="accord-a-renouveler"
                />
                <Suite ton="ambre">{accord.consequence}</Suite>
              </>
            )}
          </div>
        </div>
        {historiqueLimite && (
          <div className="relative py-3.5" data-atlas="historique-limite" role="status">
            <span aria-hidden className="absolute inset-x-0 -top-px h-px" style={{ backgroundColor: colors.line }} />
            <p className="text-[14px] font-semibold leading-[1.4]" style={{ color: colors.carteAmbreTexte }}>
              {historiqueLimite}
            </p>
          </div>
        )}
        {/* Bientôt finie, l'échéance est déjà à côté de sa pastille : la ligne
            ne la redit pas. */}
        {!accord.bientot && (
          <LigneReglage libelle="Votre accord">
            <p style={styleValeurReglage}>Jusqu&apos;au {jourEtMois(jourIso(liaison.accordJusquAu))}</p>
          </LigneReglage>
        )}
      </Paquet>
      {accord.bientot && (
        <div className="mx-[22px] mt-4">
          <BoutonRelier banque={liaison.banque} libelle="Renouveler l'accord" />
        </div>
      )}
    </>
  );
}

/**
 * Le relevé du dossier en cours, compté : les entrées en vert, les sorties en
 * rouge, et Pour mon comptable d'un appui. Il répond à sa question du
 * 1er novembre, *« je ne sais pas si cette modification avait été poussée »* :
 * les sorties se voient ici, comptées.
 */
async function LeReleve({ maintenant }: { maintenant: Date }) {
  const ctx = await getCurrentCtx();
  const dossier = await dossierEnCours(ctx, maintenant);
  const compte = compteDuReleve(await lignesDuReleve(ctx, dossier.du, jourIso(maintenant)));
  const colonne = (mot: string, nombre: number, centimes: number, couleur: string) => (
    <div>
      <span className="block text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
        {mot}
      </span>
      <span className="mt-0.5 block text-[22px] leading-[1.2] tabular-nums" style={{ fontFamily: font.display }}>
        {nombre}
      </span>
      <span className="mt-0.5 block text-[15px] font-semibold tabular-nums" style={{ color: couleur }}>
        {enEuros(centimes / 100)}
      </span>
    </div>
  );
  return (
    <Paquet titre="Le relevé" dataAtlas="releve-banque">
      <div className="grid grid-cols-2 pb-3.5 pt-4">
        <div className="pr-3">{colonne("Entrées", compte.entrees, compte.centimesEntrees, colors.montantEntree)}</div>
        <div className="pl-4" style={{ boxShadow: `inset 1px 0 0 ${colors.line}` }}>
          {colonne("Sorties", compte.sorties, compte.centimesSorties, colors.montantSortie)}
        </div>
      </div>
      <Link href="/termines/comptable" className="relative flex min-h-[60px] items-center gap-3 py-3 no-underline" style={{ color: colors.ink }}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] leading-[1.25]" style={{ fontFamily: font.display }}>
            Pour mon comptable
          </span>
          <span className="mt-[3px] block text-[14.5px] leading-[1.4]" style={{ color: colors.inkSoft }}>
            Dossier en cours depuis le {jourEtMois(dossier.du)}
          </span>
        </span>
        <span aria-hidden className="flex-none" style={{ color: colors.or }}>
          <Picto nom="suivant" taille={20} epaisseur={2} />
        </span>
      </Link>
    </Paquet>
  );
}

/** Le mot de l'état d'un virement déjà répondu, sur sa pastille. */
function etatDuVirement(v: VirementLuEnBase, question: QuestionDeVirement | undefined): { ton?: Ton; mot: string } | null {
  if (question) return { ton: "ambre", mot: "À répondre" };
  if (v.etat === "confirme") return { ton: "vert", mot: "Noté sur une facture" };
  if (v.etat === "ecarte") return { mot: "Noté comme sans facture" };
  return null;
}

async function VirementsRecus({ maintenant }: { maintenant: Date }) {
  const ctx = await getCurrentCtx();
  const depuis = jourIso(new Date(maintenant.getTime() - FENETRE_JOURS * 24 * 3600 * 1000));
  const [virements, factures] = await Promise.all([virementsDepuis(ctx, depuis), facturesARapprocher(ctx)]);
  // **La même mise en mots que l'accueil et Ma TVA** : une question écrite ici
  // autrement finirait par dire autre chose du même virement.
  const listeQuestions = questionsDesVirements(virements, factures);
  const questions = new Map(listeQuestions.map((q) => [q.virementId, q]));

  return (
    <>
      {/* Un client qui paie : la carte verte de l'accueil, avec Oui ou Non
          (sa planche A du 23 octobre). */}
      {listeQuestions.length > 0 && (
        <Paquet titre="À répondre" sansPlage>
          <div className="flex flex-col gap-2.5">
            {listeQuestions.map((q) => (
              <div key={q.virementId} className="rounded-[6px] px-[18px] py-4" style={{ backgroundColor: colors.carteVertFond }}>
                <p className="flex items-center gap-2 text-[15px] font-bold" style={{ color: colors.carteVertTexte }}>
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: "currentColor" }} />
                  Virement reçu
                </p>
                <p className="mt-1.5 text-[19px] leading-[1.3]" style={{ fontFamily: font.display }}>
                  {q.qui}, <span style={{ color: colors.montantEntree }}>{q.montant}</span>
                </p>
                <p className="mt-2 text-[14.5px] leading-[1.45]" style={{ color: colors.carteVertTexte }}>
                  {q.raison}
                </p>
                <ReponseVirement virementId={q.virementId} question={q.question} oui={q.oui} choix={q.choix} relire />
              </div>
            ))}
          </div>
        </Paquet>
      )}

      <section className="mx-[22px] mt-7">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          {/* L'écriture de `Paquet`, au chiffre près : un `h2` nu prend la
              serif des titres, et ce titre-là se lisait seul de sa famille. */}
          <h2 className="text-[13px] font-semibold uppercase" style={{ color: colors.or, letterSpacing: "0.12em", fontFamily: font.body, fontWeight: 600 }}>
            Virements reçus
          </h2>
          <span className="text-[13px]" style={{ color: colors.inkSoft }}>
            {FENETRE_JOURS} derniers jours
          </span>
        </div>
        <div className="rounded-[6px] px-[18px]" style={{ backgroundColor: colors.card }}>
          {virements.length === 0 ? (
            <p className="py-4 text-[15px]" style={{ color: colors.inkSoft }}>
              Aucun virement reçu depuis le {jourEtMois(depuis)}.
            </p>
          ) : (
            <ul data-atlas="virements-recus" className="flex flex-col">
              {virements.map((v, i) => {
                const { nom, libelleDessous } = nomDuVirement(v.payeur, v.libelle);
                const etat = etatDuVirement(v, questions.get(v.id));
                return (
                  <li key={v.id} className="relative flex items-start gap-[14px] py-4">
                    {i > 0 && <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />}
                    <span className="mt-0.5 w-12 flex-none text-center leading-none">
                      <span className="block text-[26px]" style={{ fontFamily: font.display }}>
                        {Number(v.date.slice(8, 10))}
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: colors.inkSoft }}>
                        {moisAbrege(v.date)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        {/* Le payeur en serif ; sans payeur, le libellé de la
                            banque est le nom, dans l'écriture du texte. */}
                        <span
                          className={v.payeur?.trim() ? "min-w-0 text-[17.5px] leading-[1.3]" : "min-w-0 text-[15px] font-medium leading-[1.35]"}
                          style={v.payeur?.trim() ? { fontFamily: font.display, overflowWrap: "anywhere" } : { overflowWrap: "anywhere" }}
                        >
                          {nom}
                        </span>
                        <span className="flex-none text-[18px] leading-[1.3] tabular-nums" style={{ fontFamily: font.display, color: colors.montantEntree }}>
                          {enEuros(Number(v.montant))}
                        </span>
                      </span>
                      {/* Entier, sur deux lignes au plus : coupé à une, il ne
                          disait rien (planche du 1er novembre). */}
                      {libelleDessous && (
                        <span className="mt-1 line-clamp-2 block text-[13.5px] leading-[1.4]" style={{ color: colors.inkSoft, overflowWrap: "anywhere" }}>
                          {libelleDessous}
                        </span>
                      )}
                      {etat ? (
                        <span className="mt-2.5 block">
                          <EtatEcrit ton={etat.ton}>{etat.mot}</EtatEcrit>
                        </span>
                      ) : (
                        <span className="mt-2 block text-[14px] leading-[1.4]" style={{ color: colors.inkSoft }}>
                          Aucune facture en attente ne correspond.
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

/** La clé n'est pas là : ce qu'il manque, et l'adresse à déclarer chez Enable Banking. */
function PasEncoreBranche({ raison }: { raison: string }) {
  return (
    <Paquet>
      <div className="py-4">
        <EtatEcrit>Pas encore branché</EtatEcrit>
        <p className="mt-3 text-[17px] leading-[1.4]" style={{ fontFamily: font.display }}>
          {raison}
        </p>
        <p className="mt-3 text-[14px]" style={{ color: colors.inkSoft }}>
          Adresse de retour à déclarer chez Enable Banking :
        </p>
        {/* À recopier telle quelle : sélectionnable, et jamais coupée en deux. */}
        <p data-atlas="adresse-retour-banque" className="mt-1 select-all break-all text-[14px]" style={{ color: colors.ink }}>
          {retourConfigure() ? adresseDeRetour("/api/banque/retour") : "Inconnue tant que l'espace n'a pas été rallumé."}
        </p>
      </div>
    </Paquet>
  );
}

/** Le bouton qui part chez la banque : le même pour relier et pour renouveler. */
function BoutonRelier({ banque, libelle }: { banque: string; libelle: string }) {
  return (
    <form action={relierBanqueAction}>
      <input type="hidden" name="banque" value={banque} />
      <button
        type="submit"
        data-atlas="relier-banque"
        className="atlas-plein flex min-h-[56px] w-full items-center justify-center rounded-full px-[22px] text-[17px] font-semibold"
        style={{ backgroundColor: colors.plein, color: colors.card }}
      >
        {libelle}
      </button>
    </form>
  );
}

async function ChoisirSaBanque() {
  const r = await banquesFrancaises();
  if (!r.ok) {
    return (
      <div className="mx-[22px] mt-7">
        <PlageTon ton="rouge">{r.raison}</PlageTon>
      </div>
    );
  }
  // Le Crédit Mutuel d'abord, s'il est là : c'est sa banque.
  const parDefaut = r.banques.find((b) => b.nom === "Crédit Mutuel")?.nom ?? "";
  return (
    <Paquet>
      <form action={relierBanqueAction} className="flex flex-col py-[18px]">
        <label htmlFor="banque" className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
          Votre banque
        </label>
        <select
          id="banque"
          name="banque"
          defaultValue={parDefaut}
          required
          className="min-h-[52px] rounded-[6px] border-0 px-[15px] py-3"
          style={{ backgroundColor: colors.card, color: colors.ink, fontFamily: font.display, fontSize: "18px", boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` }}
        >
          <option value="" disabled>
            Choisir
          </option>
          {r.banques.map((b) => (
            <option key={b.nom} value={b.nom}>
              {b.nom}
            </option>
          ))}
        </select>
        <button
          type="submit"
          data-atlas="relier-banque"
          className="atlas-plein mt-4 flex min-h-[56px] w-full items-center justify-center rounded-full px-[22px] text-[17px] font-semibold"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          Relier ma banque
        </button>
        {/* **Discret, et c'est voulu** : la porte entreprise à carte refusait son
            identifiant le 23 octobre. Elle ne sert qu'à qui a reçu une carte ou
            un certificat de sa banque. */}
        <details className="mt-1.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
          <summary className="min-h-[48px] cursor-pointer py-3 underline underline-offset-[3px]">
            Votre banque vous a donné un accès entreprise à carte ?
          </summary>
          <label className="flex min-h-[48px] items-center gap-2.5" style={{ color: colors.ink }}>
            <input type="checkbox" name="entreprise" value="oui" className="h-5 w-5" style={{ accentColor: colors.plein }} />
            Utiliser l&apos;accès entreprise
          </label>
        </details>
      </form>
    </Paquet>
  );
}

import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourEtMois, jourIso } from "@/lib/jour";
import { questionsDesVirements } from "@/lib/virement-en-mots";
import { accordEnMots } from "@/lib/accord-bancaire";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { banquesFrancaises, cleDeposee } from "@/server/banque/enable-banking";
import { lireLaBanque } from "@/server/banque/lecture";
import { facturesARapprocher } from "@/server/banque/questions";
import { liaisonDeLEntreprise, virementsDepuis, type VirementLuEnBase } from "@/server/repositories/banque";
import { adresseDeRetour, retourConfigure } from "@/server/paiement/retour";
import RubriqueReservee from "../RubriqueReservee";
import ReponseVirement from "../../ReponseVirement";
import { delierBanqueAction, relierBanqueAction } from "./actions";
import { garderLaPage } from "@/server/garde-page";

export const dynamic = "force-dynamic";

/**
 * MA BANQUE — sa planche du 23 octobre 2026 (`appli/banque-a-essayer.html`).
 *
 * Né le 22 octobre comme un essai sur sa propre banque, cet écran porte
 * désormais la liaison (en base, migration 0140) et la liste des virements
 * reçus, chacun avec sa question. **La même question vit sur l'accueil et dans
 * Ma TVA** : une réponse donnée ici vaut pour les deux autres.
 *
 * **Ce que l'essai du 23 octobre a changé** : plus de case « compte pro » ou
 * « compte perso » ; la porte « particulier » est la bonne pour un artisan,
 * l'accès entreprise à carte reste derrière un lien discret. Le nom du payeur
 * passe avant le libellé brut de la banque, qui débordait de l'écran.
 *
 * **Hors du sommaire des réglages, délibérément** : sans contrat, Enable
 * Banking ne relie que les comptes du propriétaire de l'application
 * (`docs/A-FAIRE.md` §13). Une rubrique visible de tous ouvrirait chez chacun
 * une porte qui refuse.
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
        <EnTeteEcran surtitre="Réglages" titre="Ma banque" retour={{ href: "/reglages", libelle: "Retour aux réglages" }} />

        <div className="mt-3 flex flex-col gap-5 px-6">
          {issue && (
            <p
              data-atlas="issue-banque"
              role={issue.ton === "mal" ? "alert" : "status"}
              className="rounded-[12px] px-4 py-3 text-[14px] leading-[1.5]"
              style={{ backgroundColor: colors.rustTint, color: issue.ton === "mal" ? colors.alert : colors.ink }}
            >
              {issue.texte}
              {params.raison && params.issue === "refus" ? ` ${params.raison}` : ""}
            </p>
          )}

          {!cle.ok ? (
            <PasEncoreBranche raison={cle.raison} />
          ) : liaison ? (
            <CompteRelie banque={liaison.banque} fin={liaison.accordJusquAu} maintenant={maintenant} />
          ) : (
            <ChoisirSaBanque />
          )}

          {lecture && !lecture.ok && (
            <p role="alert" className="text-[13.5px] leading-[1.5]" style={{ color: colors.alert }}>
              {lecture.raison}
            </p>
          )}

          {liaison && <VirementsRecus maintenant={maintenant} />}

          <ul className="flex flex-col" style={{ color: colors.inkSoft }}>
            {[
              "Atlas lit les virements reçus sur ce compte.",
              "Il ne peut ni payer, ni déplacer de l'argent.",
              "Il ne met rien au relevé de TVA sans votre oui.",
            ].map((phrase) => (
              <li key={phrase} className="py-2.5 text-[13.5px] leading-[1.45]" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
                {phrase}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Bloc({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] px-[18px] py-4" style={{ backgroundColor: colors.card }}>
      {children}
    </section>
  );
}

/** La clé n'est pas là : ce qu'il manque, et l'adresse à déclarer chez Enable Banking. */
function PasEncoreBranche({ raison }: { raison: string }) {
  return (
    <Bloc>
      <p className={smallCaps} style={{ color: colors.muted }}>
        Pas encore branché
      </p>
      <p className="mt-2 text-[16px] leading-[1.4]" style={{ fontFamily: font.display }}>
        {raison}
      </p>
      <p className="mt-3 text-[13px]" style={{ color: colors.muted }}>
        Adresse de retour à déclarer chez Enable Banking :
      </p>
      {/* À recopier telle quelle : sélectionnable, et jamais coupée en deux. */}
      <p data-atlas="adresse-retour-banque" className="mt-1 select-all break-all text-[13px]" style={{ color: colors.ink }}>
        {retourConfigure() ? adresseDeRetour("/api/banque/retour") : "Inconnue tant que l'espace n'a pas été rallumé."}
      </p>
    </Bloc>
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
        className="atlas-plein min-h-[44px] rounded-full px-5 py-2.5 text-[14px] font-medium"
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
      <Bloc>
        <p className="text-[14px] leading-[1.5]" style={{ color: colors.alert }}>
          {r.raison}
        </p>
      </Bloc>
    );
  }
  // Le Crédit Mutuel d'abord, s'il est là : c'est sa banque.
  const parDefaut = r.banques.find((b) => b.nom === "Crédit Mutuel")?.nom ?? "";
  return (
    <Bloc>
      <form action={relierBanqueAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: colors.muted }}>
            Votre banque
          </span>
          <select
            name="banque"
            defaultValue={parDefaut}
            required
            className="rounded-[4px] border-0 px-3 py-2.5"
            style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
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
        </label>
        <button
          type="submit"
          data-atlas="relier-banque"
          className="atlas-plein min-h-[44px] self-start rounded-full px-5 py-2.5 text-[14px] font-medium"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          Relier ma banque
        </button>
        {/* **Discret, et c'est voulu** : la porte entreprise à carte refusait son
            identifiant le 23 octobre. Elle ne sert qu'à qui a reçu une carte ou
            un certificat de sa banque. */}
        <details className="text-[13px]" style={{ color: colors.muted }}>
          <summary className="min-h-[44px] cursor-pointer py-2.5 underline underline-offset-[3px]">
            Votre banque vous a donné un accès entreprise à carte ?
          </summary>
          <label className="flex min-h-[44px] items-center gap-2" style={{ color: colors.inkSoft }}>
            <input type="checkbox" name="entreprise" value="oui" style={{ accentColor: colors.plein }} />
            Utiliser l&apos;accès entreprise
          </label>
        </details>
      </form>
    </Bloc>
  );
}

function CompteRelie({ banque, fin, maintenant }: { banque: string; fin: Date; maintenant: Date }) {
  // La même règle que la carte de l'accueil : sept jours avant, les mêmes mots.
  const accord = accordEnMots(fin, maintenant);
  return (
    <Bloc>
      <p className={smallCaps} style={{ color: colors.muted }}>
        Compte relié
      </p>
      <p className="mt-2 text-[18px]" style={{ fontFamily: font.display }}>
        {banque || "Votre banque"}
      </p>
      <p className="mt-1 text-[13px] leading-[1.5]" style={{ color: accord.bientot ? colors.alert : colors.muted }}>
        {accord.echeance}
      </p>
      <div className="-mx-2 mt-2 flex flex-wrap items-center gap-2">
        {accord.bientot && (
          <span className="px-2">
            <BoutonRelier banque={banque} libelle="Renouveler l'accord" />
          </span>
        )}
        <form action={delierBanqueAction}>
          <button type="submit" className="min-h-[44px] px-2 text-[14px] font-medium" style={{ color: colors.inkSoft }}>
            Délier
          </button>
        </form>
      </div>
    </Bloc>
  );
}

function ligneDEtat(v: VirementLuEnBase): string {
  if (v.etat === "confirme") return "Noté sur une facture.";
  if (v.etat === "ecarte") return "Noté comme sans facture.";
  return "Aucune facture en attente ne correspond.";
}

async function VirementsRecus({ maintenant }: { maintenant: Date }) {
  const ctx = await getCurrentCtx();
  const depuis = jourIso(new Date(maintenant.getTime() - FENETRE_JOURS * 24 * 3600 * 1000));
  const [virements, factures] = await Promise.all([virementsDepuis(ctx, depuis), facturesARapprocher(ctx)]);
  // **La même mise en mots que l'accueil et Ma TVA** : une question écrite ici
  // autrement finirait par dire autre chose du même virement.
  const questions = new Map(questionsDesVirements(virements, factures).map((q) => [q.virementId, q]));

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px]" style={{ fontFamily: font.display }}>
          Virements reçus
        </h2>
        <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>
          {FENETRE_JOURS} derniers jours
        </span>
      </div>

      {virements.length === 0 ? (
        <p className="mt-4 text-[13.5px]" style={{ color: colors.inkSoft }}>
          Aucun virement reçu depuis le {jourEtMois(depuis)}.
        </p>
      ) : (
        <ul data-atlas="virements-recus" className="mt-1 flex flex-col">
          {virements.map((v) => {
            const q = questions.get(v.id);
            return (
              <li key={v.id} className="py-3.5" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
                <div className="flex items-baseline justify-between gap-3">
                  {/* Le nom du payeur d'abord, propre ; le libellé brut de la
                      banque sur une ligne coupée — il débordait de l'écran le
                      23 octobre. */}
                  <p className="min-w-0 truncate text-[14.5px]">{v.payeur ?? (v.libelle || "Sans nom")}</p>
                  <span className="flex-shrink-0 text-[15.5px] tabular-nums" style={{ fontFamily: font.display }}>
                    {enEuros(Number(v.montant))}
                  </span>
                </div>
                <p className="truncate text-[11.5px] leading-[1.45]" style={{ color: colors.muted }}>
                  Le {jourEtMois(v.date)}
                  {v.libelle && v.payeur ? `, ${v.libelle}` : ""}
                </p>
                {q ? (
                  <>
                    <p className="mt-1.5 text-[12px] leading-[1.45]" style={{ color: colors.carteVertTexte }}>
                      {q.raison}
                    </p>
                    <ReponseVirement virementId={q.virementId} question={q.question} oui={q.oui} choix={q.choix} relire />
                  </>
                ) : (
                  <p className="mt-1.5 text-[12px] leading-[1.45]" style={{ color: colors.muted }}>
                    {ligneDEtat(v)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

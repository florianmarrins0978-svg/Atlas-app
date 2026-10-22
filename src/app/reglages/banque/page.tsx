import { cookies } from "next/headers";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourEtMois, jourIso } from "@/lib/jour";
import { proposerFacture, type FactureARapprocher, type Proposition } from "@/lib/rapprochement-bancaire";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { facturesEnAttente } from "@/server/repositories/paiements-facture";
import {
  banquesFrancaises,
  cleDeposee,
  liaisonDuTemoin,
  virementsRecus,
} from "@/server/banque/enable-banking";
import { adresseDeRetour, retourConfigure } from "@/server/paiement/retour";
import RubriqueReservee from "../RubriqueReservee";
import { delierBanqueAction, relierBanqueAction } from "./actions";
import { TEMOIN_LIAISON_BANQUE } from "./temoin";

export const dynamic = "force-dynamic";

/**
 * MA BANQUE — l'essai du 22 octobre 2026, sur sa propre banque.
 *
 * Sa planche du 21 octobre (`appli/banque-qui-previent.html`), écran 3, et sa
 * question du lendemain : *« est-ce qu'on peut faire un test déjà avec ma
 * banque à moi pour que je voie comment ça fonctionne ? »*.
 *
 * **CET ÉCRAN LIT, IL N'ÉCRIT RIEN.** Il montre les virements reçus et la
 * facture qu'Atlas proposerait pour chacun ; rien n'entre au relevé de TVA.
 * La carte de l'accueil et le « Oui » viendront quand le prestataire sera
 * choisi (`docs/A-FAIRE.md` §13) : ce qui se code d'ici là doit pouvoir
 * changer de prestataire sans rien défaire chez lui.
 *
 * **Hors du sommaire des réglages, délibérément** : sans contrat, Enable
 * Banking ne relie que les comptes du propriétaire de l'application. Une
 * rubrique visible de tous ouvrirait chez chacun une porte qui refuse.
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
  const ctx = await getCurrentCtx();
  // Avant toute lecture : un salarié qui tape l'adresse ne déclenche rien.
  if (!(await estProprietaire(ctx))) {
    return <RubriqueReservee titre="Ma banque" quoi="Le compte relié appartient au patron." />;
  }

  const params = await searchParams;
  const issue = params.issue ? ISSUES[params.issue] ?? null : null;
  const cle = cleDeposee();
  const liaison = liaisonDuTemoin((await cookies()).get(TEMOIN_LIAISON_BANQUE)?.value);

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
            <CompteRelie banque={liaison.banque} />
          ) : (
            <ChoisirSaBanque />
          )}

          {cle.ok && liaison && <VirementsRecus liaison={liaison} ctxFactures={await facturesEnAttente(ctx)} />}

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
  // Le Crédit Mutuel d'abord, s'il est là : c'est sa banque, et l'essai est le sien.
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
        <fieldset className="flex gap-5 text-[14px]">
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="radio" name="compte" value="business" defaultChecked style={{ accentColor: colors.plein }} />
            Compte pro
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="radio" name="compte" value="personal" style={{ accentColor: colors.plein }} />
            Compte perso
          </label>
        </fieldset>
        <button
          type="submit"
          data-atlas="relier-banque"
          className="atlas-plein min-h-[44px] self-start rounded-full px-5 py-2.5 text-[14px] font-medium"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          Relier ma banque
        </button>
      </form>
    </Bloc>
  );
}

function CompteRelie({ banque }: { banque: string }) {
  return (
    <Bloc>
      <p className={smallCaps} style={{ color: colors.muted }}>
        Compte relié
      </p>
      <p className="mt-2 text-[18px]" style={{ fontFamily: font.display }}>
        {banque || "Votre banque"}
      </p>
      <form action={delierBanqueAction}>
        <button type="submit" className="-mx-2 mt-2 min-h-[44px] px-2 text-[14px] font-medium" style={{ color: colors.inkSoft }}>
          Délier
        </button>
      </form>
    </Bloc>
  );
}

function enMots(p: Proposition): string {
  const de = (f: FactureARapprocher) => `la facture ${f.numero}${f.clientNom ? ` de ${f.clientNom}` : ""}`;
  switch (p.genre) {
    case "juste":
      return p.nomConcorde
        ? `C'est sans doute ${de(p.facture)}.`
        : `Peut-être ${de(p.facture)}. Le nom ne figure pas sur le virement.`;
    case "plusieurs":
      return `${p.factures.length} factures font ce montant : ${p.factures.map((f) => f.numero).join(", ")}. Vous choisirez.`;
    case "partie":
      return `Peut-être une partie de ${de(p.facture)}, qui attend encore ${enEuros(p.facture.reste)}.`;
    case "aucune":
      return "Aucune facture en attente ne correspond.";
  }
}

async function VirementsRecus({
  liaison,
  ctxFactures,
}: {
  liaison: NonNullable<ReturnType<typeof liaisonDuTemoin>>;
  ctxFactures: Awaited<ReturnType<typeof facturesEnAttente>>;
}) {
  const debut = new Date();
  debut.setDate(debut.getDate() - FENETRE_JOURS);
  const depuis = jourIso(debut);
  const r = await virementsRecus(liaison, depuis);
  const factures: FactureARapprocher[] = ctxFactures.map((f) => ({
    id: f.id,
    numero: f.numeroCommercial,
    clientNom: f.clientNom,
    reste: f.reste,
    dateEmission: f.dateEmission,
  }));

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
      <p className="mt-1 text-[12px]" style={{ color: colors.muted }}>
        Essai : rien n&apos;est noté au relevé de TVA.
      </p>

      {!r.ok ? (
        <p role="alert" className="mt-3 text-[13.5px] leading-[1.5]" style={{ color: colors.alert }}>
          {r.raison}
        </p>
      ) : r.virements.length === 0 ? (
        <p className="mt-4 text-[13.5px]" style={{ color: colors.inkSoft }}>
          Aucun virement reçu depuis le {jourEtMois(depuis)}.
        </p>
      ) : (
        <ul data-atlas="virements-recus" className="mt-1 flex flex-col">
          {r.virements.map((v, i) => (
            <li key={`${v.date}-${v.montant}-${i}`} className="py-3.5" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px]">{v.payeur ?? (v.libelle || "Sans nom")}</p>
                  <p className="text-[11.5px] leading-[1.45]" style={{ color: colors.muted }}>
                    Le {jourEtMois(v.date)}
                    {v.payeur && v.libelle ? `, ${v.libelle}` : ""}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 text-[15.5px]"
                  style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
                >
                  {enEuros(v.montant)}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-[1.45]" style={{ color: colors.or }}>
                {enMots(proposerFacture(v, factures))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

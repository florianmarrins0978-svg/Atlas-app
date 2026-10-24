import { after } from "next/server";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import { jourIso, jourLisible } from "@/lib/jour";
import {
  categorieDeLaLigne,
  checkUp,
  etatDeLaPeriode,
  jourEnMots,
  libellePeriode,
  resumerPeriodes,
  ressembleAUnVirement,
  type Decoupage,
} from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireLaBanque } from "@/server/banque/lecture";
import { liaisonDeLEntreprise } from "@/server/repositories/banque";
import { dossierEnCours } from "@/server/repositories/dossiers-comptables";
import {
  facturesRecuesLibres,
  ligneAJustifier,
  lignesDuReleve,
  ticketsLibres,
} from "@/server/repositories/pour-mon-comptable";
import DossierEnCours, { type ARegarder, type Periode } from "./DossierEnCours";

export const dynamic = "force-dynamic";

/**
 * POUR MON COMPTABLE — le dossier en cours (lot 2).
 *
 * Ses choix des 23 et 24 octobre 2026 sur `appli/pour-mon-comptable.html`,
 * écrans 2 et 4 : l'année mois par mois, par trimestre ou entière, la barre de
 * couleurs de chaque période, le Check up, et ce qui attend sa réponse.
 *
 * **Cet écran ne fait que LIRE.** Le Check up silencieux passe à l'arrivée des
 * données (une lecture de la banque, un ticket enregistré dans Ma TVA) : relié
 * à l'ouverture d'un écran, il faisait dire « 12 sans ticket » à Terminés et
 * « 3 » au dossier, selon celui qu'on ouvrait d'abord. La banque se relit
 * APRÈS l'affichage, une fois par demi-heure au plus (`lireLaBanque`).
 */
export default async function PageDossierEnCours() {
  const ctx = await getCurrentCtx();
  const maintenant = new Date();
  const { du, au, premier } = await dossierEnCours(ctx, maintenant);

  const liaison = await liaisonDeLEntreprise(ctx);
  if (liaison) after(() => lireLaBanque(ctx, { maintenant }).then(() => undefined));

  const debutTickets = new Date(`${du}T12:00:00Z`);
  debutTickets.setUTCDate(debutTickets.getUTCDate() - 5);
  const [lignes, tickets, factures] = await Promise.all([
    lignesDuReleve(ctx, du, au),
    ticketsLibres(ctx, debutTickets.toISOString().slice(0, 10), au),
    facturesRecuesLibres(ctx),
  ]);

  const dossier = lignes.map((l) => ({
    jour: l.jour,
    montant: l.montant,
    sens: l.sens,
    categorie: categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification }),
    aJustifier: ligneAJustifier(l),
    ticketPerdu: l.justification === "ticket_perdu",
  }));

  const periodes = Object.fromEntries(
    (["mois", "trimestre", "annee"] as Decoupage[]).map((d) => [
      d,
      resumerPeriodes(dossier, d).map(
        (r): Periode => ({
          cle: r.cle,
          nom: libellePeriode(r.cle),
          etat: etatDeLaPeriode(r),
          manque: r.aJustifier > 0,
          sorties: enEuros(r.sorties / 100),
          entrees: enEuros(r.entrees / 100),
          parCategorie: r.parCategorie,
          totalSorties: r.sorties,
        })
      ),
    ])
  ) as Record<Decoupage, Periode[]>;

  // Ce qui attend sa réponse : les sorties sans pièce, avec ce que le Check up
  // en dit, et les entrées dont la facture n'est pas encore confirmée.
  const sansPiece = lignes.filter((l) => l.sens === "sortie" && l.justification === null);
  const verdicts = checkUp(
    sansPiece.map((l) => ({ id: l.id, jour: l.jour, montant: l.montant })),
    tickets.map((t) => ({ id: t.id, dateAchat: t.dateAchat, totalTtc: t.totalTtc }))
  );
  const parTicket = new Map(tickets.map((t) => [t.id, t]));
  // Les plus récentes d'abord, comme les périodes.
  const aRegarder: ARegarder[] = [
    ...[...sansPiece].reverse().map((l): ARegarder => {
      const v = verdicts.get(l.id);
      return {
        id: l.id,
        genre: ressembleAUnVirement(l.libelle) ? "virement" : "carte",
        qui: l.contrepartie ?? l.libelle,
        jour: jourEnMots(l.jour),
        montant: enEuros(l.montant),
        categorie: categorieDeLaLigne({ sens: "sortie", libelle: l.libelle, natureDuTicket: null, justification: null }),
        tickets:
          v?.genre === "choix"
            ? v.ticketIds.flatMap((id) => {
                const t = parTicket.get(id);
                return t ? [{ id, fournisseur: t.fournisseur, jour: `Ticket du ${jourEnMots(t.dateAchat)}` }] : [];
              })
            : [],
      };
    }),
    ...lignes
      .filter((l) => l.sens === "entree" && ligneAJustifier(l))
      .reverse()
      .map(
        (l): ARegarder => ({
          id: l.id,
          genre: "entree",
          qui: l.contrepartie ?? l.libelle,
          jour: jourEnMots(l.jour),
          montant: enEuros(l.montant),
          categorie: "recu",
          tickets: [],
        })
      ),
  ];

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          surtitre="Dossier en cours"
          titre="Pour mon comptable"
        />
        <DossierEnCours
          dossier={{ du, premier, aujourdhui: au }}
          banque={liaison ? { nom: liaison.banque || "Banque reliée", lue: liaison.luLe ? jourLisible(jourIso(liaison.luLe)) : null } : null}
          periodes={periodes}
          aRegarder={aRegarder}
          factures={factures.map((f) => ({ id: f.id, nom: f.nom, societe: f.societe, montant: f.totalTtc ? enEuros(f.totalTtc) : null }))}
        />
      </div>
    </div>
  );
}

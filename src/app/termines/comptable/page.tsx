import { after } from "next/server";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import { colors, font } from "@/lib/design-tokens";
import { jourIso, jourLisible } from "@/lib/jour";
import {
  categorieDeLaLigne,
  checkUp,
  debutCouvert,
  etatDeLaPeriode,
  jourEnMots,
  libelleDansLeDossier,
  libellePeriode,
  resumerPeriodes,
  ticketsPerdusEnMots,
  totalSigne,
  totauxDuReleve,
  type Decoupage,
  type ResumePeriode,
} from "@/lib/pour-mon-comptable";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireLaBanque } from "@/server/banque/lecture";
import { liaisonDeLEntreprise } from "@/server/repositories/banque";
import { facturesARapprocher } from "@/server/banque/questions";
import { dossierEnCours } from "@/server/repositories/dossiers-comptables";
import {
  facturesRecuesLibres,
  ligneAJustifier,
  lignesDuReleve,
  premierJourDuReleve,
  ticketsLibres,
} from "@/server/repositories/pour-mon-comptable";
import DossierEnCours, { type Periode } from "./DossierEnCours";
import { carteDeLaLigne, facturesAffichees, type ARegarder } from "./a-regarder";
import { garderLaPage } from "@/server/garde-page";
import { getEntreprise } from "@/server/repositories/entreprises";
import { MAX_SALARIES } from "@/lib/equipes";
import { moisDuJour, nomDuMois } from "@/lib/jours-travailles";

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
  await garderLaPage();
  const ctx = await getCurrentCtx();
  const maintenant = new Date();
  const { du, au, premier } = await dossierEnCours(ctx, maintenant);

  const liaison = await liaisonDeLEntreprise(ctx);
  if (liaison) after(() => lireLaBanque(ctx, { maintenant }).then(() => undefined));

  const debutTickets = new Date(`${du}T12:00:00Z`);
  debutTickets.setUTCDate(debutTickets.getUTCDate() - 5);
  // **L'année, à côté du dossier** — sa demande du 8 novembre 2026, planche
  // `appli/soignee/banque-entrees-sorties.html` : « à côté, une autre case pour
  // voir toutes les dépenses depuis le 1er janvier ». Elle commence au premier
  // jour que la banque a donné quand il est plus tard (`debutCouvert`) : une
  // année comptée sur 90 jours ne se dit pas « l'année ».
  const annee = au.slice(0, 4);
  const debutAnnee = debutCouvert(`${annee}-01-01`, await premierJourDuReleve(ctx));
  const [lignes, lignesAnnee, tickets, factures, enAttente, entreprise] = await Promise.all([
    lignesDuReleve(ctx, du, au),
    lignesDuReleve(ctx, debutAnnee, au),
    ticketsLibres(ctx, debutTickets.toISOString().slice(0, 10), au),
    facturesRecuesLibres(ctx),
    facturesARapprocher(ctx),
    getEntreprise(ctx),
  ]);
  // La ligne des jours travaillés : un artisan seul n'a personne à compter.
  const salaries = Math.min(MAX_SALARIES, entreprise?.nombreSalaries ?? 0);
  const mois = nomDuMois(moisDuJour(jourIso(maintenant))).split(" ")[0];
  const joursTravailles = salaries > 0 ? `${mois.charAt(0).toUpperCase() + mois.slice(1)}, ${salaries} ${salaries > 1 ? "salariés" : "salarié"}` : null;

  // **Une seule façon de lire une ligne et de dire une période**, pour le dossier
  // comme pour l'année : deux écritures finiraient par compter autrement.
  const enLigneDuDossier = (l: (typeof lignes)[number]) => ({
    jour: l.jour,
    montant: l.montant,
    sens: l.sens,
    categorie: categorieDeLaLigne({ sens: l.sens, libelle: l.libelle, natureDuTicket: l.ticket?.nature ?? null, justification: l.justification }),
    aJustifier: ligneAJustifier(l),
    ticketPerdu: l.justification === "ticket_perdu",
  });
  // L'état (« 6 sans ticket ») ne se dit que dans le dossier : c'est lui seul
  // que le comptable reçoit, et une ligne de février déjà partie n'attend rien.
  const enPeriode = (r: ResumePeriode, nom: string, avecEtat: boolean): Periode => ({
    cle: r.cle,
    nom,
    etat: avecEtat ? etatDeLaPeriode(r) : null,
    manque: avecEtat && r.aJustifier > 0,
    perdus: avecEtat ? ticketsPerdusEnMots(r.ticketsPerdus) : null,
    sorties: totalSigne(r.sorties, "sortie"),
    entrees: totalSigne(r.entrees, "entree"),
    parCategorie: r.parCategorie,
    totalSorties: r.sorties,
  });
  const dossier = lignes.map(enLigneDuDossier);

  const periodes = Object.fromEntries(
    (["mois", "trimestre", "annee"] as Decoupage[]).map((d) => [
      d,
      // **« 2026 » ne compte plus dix jours en se disant l'année** (sa remarque du
      // 8 novembre 2026) : une période que le dossier entame dit où elle commence.
      resumerPeriodes(dossier, d).map((r) => enPeriode(r, libelleDansLeDossier(r.cle, du), true)),
    ])
  ) as Record<Decoupage, Periode[]>;

  const ligneAnnee = lignesAnnee.map(enLigneDuDossier);
  const toutLAnnee = debutAnnee === `${annee}-01-01`;
  const totalDossier = totauxDuReleve(lignes);
  const totalAnnee = totauxDuReleve(lignesAnnee);
  const vueAnnee = {
    titre: toutLAnnee ? "Depuis le 1ᵉʳ janvier" : `Depuis le ${jourEnMots(debutAnnee)}`,
    sous: toutLAnnee ? `toute l’année ${annee}` : "la banque n’a rien donné avant",
    sorties: totalSigne(totalAnnee.sorties, "sortie"),
    entrees: totalSigne(totalAnnee.entrees, "entree"),
    periodes: [
      ...resumerPeriodes(ligneAnnee, "annee").map((r) => enPeriode(r, `${annee}, du ${jourEnMots(debutAnnee)} au ${jourEnMots(au)}`, false)),
      // Les mois dans l'ordre du calendrier, janvier d'abord, comme sur sa planche.
      ...resumerPeriodes(ligneAnnee, "mois")
        .reverse()
        .map((r) => enPeriode(r, libellePeriode(r.cle), false)),
    ],
  };

  // Ce qui attend sa réponse : les sorties sans pièce, avec ce que le Check up
  // en dit, et les virements reçus que rien ne justifie encore. Les plus
  // récentes d'abord, comme les périodes.
  const sansPiece = lignes.filter((l) => l.sens === "sortie" && l.justification === null);
  const verdicts = checkUp(
    sansPiece.map((l) => ({ id: l.id, jour: l.jour, montant: l.montant })),
    tickets.map((t) => ({ id: t.id, dateAchat: t.dateAchat, totalTtc: t.totalTtc }))
  );
  const aRegarder: ARegarder[] = [
    ...[...sansPiece].reverse().map((l) => {
      const v = verdicts.get(l.id);
      return carteDeLaLigne(l, v?.genre === "choix" ? tickets.filter((t) => v.ticketIds.includes(t.id)) : [], []);
    }),
    ...lignes
      .filter((l) => l.sens === "entree" && ligneAJustifier(l))
      .reverse()
      .map((l) => carteDeLaLigne(l, [], enAttente)),
  ];
  const perdus = lignes.filter((l) => l.justification === "ticket_perdu").length;

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        <EnTeteEcran
          retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          titre="Pour mon comptable"
        />
        <DossierEnCours
          dossier={{ du, premier, aujourdhui: au }}
          banque={liaison ? { nom: liaison.banque || "Banque reliée", lue: liaison.luLe ? jourLisible(jourIso(liaison.luLe)) : null } : null}
          perdus={ticketsPerdusEnMots(perdus)}
          periodes={periodes}
          totalDossier={{ sorties: totalSigne(totalDossier.sorties, "sortie"), entrees: totalSigne(totalDossier.entrees, "entree") }}
          annee={vueAnnee}
          aRegarder={aRegarder}
          factures={facturesAffichees(factures)}
          joursTravailles={joursTravailles}
        />
      </div>
    </div>
  );
}

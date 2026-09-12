import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { releveTvaCollectee } from "@/server/repositories/factures";
import { getEntreprise } from "@/server/repositories/entreprises";
import {
  libellePeriode,
  lirePeriode,
  periodeCourante,
  PERIODICITE_TVA_PAR_DEFAUT,
} from "@/server/periode-tva";
import { jourLisible, jourEtMois, jourIso } from "@/lib/jour";
import { enEuros } from "@/lib/euros";
import FrisePeriodes from "./FrisePeriodes";
import LigneMontant from "./LigneMontant";
import RythmeTva from "./RythmeTva";
import AchatsTva from "./AchatsTva";
import EnAttenteDePaiement from "./EnAttenteDePaiement";
import { receptionsDesFactures } from "@/server/repositories/envois-factures";
import { receptionEnMots } from "@/lib/reception-facture";
import { facturesEnAttente } from "@/server/repositories/paiements-facture";
import { listerAchatsTva, totalTvaDeductible } from "@/server/repositories/achats-tva";
import { tvaDue } from "@/lib/achat-tva";
import { facturesAvecAncienIban } from "@/server/repositories/factures";

export const dynamic = "force-dynamic";

// Relevé de TVA collectée (docs/AGENT.md §2.3 et §6).
//
// Calculé à partir des factures émises, jamais stocké. Atlas PRÉPARE ce
// relevé ; il ne le déclare pas. La mention en bas d'écran le dit au patron
// plutôt que de le lui laisser supposer.
//
// ─── L'ÉCRAN EST UNE ADDITION — refonte du 3 septembre 2026 ─────────────────
//
// Il ouvrait sur DEUX RÉGLAGES, avant son titre et avant le moindre chiffre :
// le rythme du relevé, puis le régime d'exigibilité avec ses deux lignes, son
// encart d'écart et sa phrase de prudence. Mesuré sur son écran de 390 × 664,
// le « Reste à payer » — la seule raison d'ouvrir cet écran — tombait sous la
// ligne de flottaison. Il fallait faire défiler pour voir le chiffre qu'on
// venait chercher. Il l'a nommé lui-même.
//
// Les trois montants formaient par ailleurs trois objets différents : deux
// tuiles centrées côte à côte, puis un encadré. Rien ne disait que le troisième
// est la soustraction des deux premiers, et deux montants centrés de longueurs
// différentes ne partagent aucun bord — or un chiffre se compare sur sa colonne
// des unités.
//
// D'où la forme retenue sur maquette, et validée par lui : **deux termes, un
// trait, un total**, alignés à droite sur la même colonne, chacun copiable —
// y compris le reste, qui ne l'était pas et qui est pourtant le seul des trois
// qu'il recopie pour payer.
//
// ─── UNE SEULE LOGIQUE — sa planche du 12 septembre 2026 ─────────────────
//
// `appli/ma-tva-une-seule-logique.html`, retenue trait pour trait : *« TVA
// encaissée − TVA récupérable = TVA à payer. Un règlement noté, une TVA
// comptée. Pas d'explications, des montants. »*
//
// Ce qui a quitté l'écran : la ligne de provenance et sa feuille, où vivaient le
// rythme ET le régime d'exigibilité. Le rythme reste ici, en un mot sous les
// mois (`RythmeTva`) — *« il faut pouvoir passer de mensuelle à trimestrielle
// sur cette page »*. Le régime encaissements / débits, lui, rejoint le rythme
// dans « Mon entreprise » (`reglages/ExigibiliteTva.tsx`) : le brief voulait le
// SUPPRIMER, le prenant pour un mode manuel et un mode automatique ; c'est un
// régime fiscal posé le 14 août à sa demande, et le retirer fausserait la TVA
// de qui a opté pour les débits. Sorti de la vue, pas du produit.
//
// Les trois montants portent leur mot entier — « TVA collectée », « TVA
// déductible », « TVA à payer » — et le dernier devient « Crédit de TVA »
// plutôt qu'un moins. Les deux gestes d'achat passent SOUS le total. Puis
// l'écran suit l'ordre : ce qui reste À FAIRE (les factures en attente), et
// les deux PREUVES, où chaque ligne dit son TTC et sa TVA, et finit sur son
// total.

export default async function ReleveTvaPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; t?: string }>;
}) {
  const { annee, t } = await searchParams;

  const ctx = await getCurrentCtx();
  /**
   * **DEUX DÉCLARATIONS FAITES AUX IMPÔTS, ET ELLES SONT AU PATRON.**
   *
   * Le rythme du relevé et le moment où la TVA devient exigible s'écrivent par
   * `exigerProprietaire` (`reglages/actions.ts`, `tva/actions.ts`) — c'était
   * déjà vrai avant ce lot, et cela ne bouge pas.
   *
   * **Mais l'écran, lui, s'est ouvert au rôle « Facturation » le 30 août 2026.**
   * Elle y voyait donc deux réglages qu'un appui aurait laissés muets : le
   * serveur refuse, et un refus sans explication se lit comme une panne.
   *
   * **Depuis le 3 septembre 2026, elle en LIT l'état sans pouvoir y toucher** :
   * le rythme s'écrit sous les mois, sans trait ni geste pour elle (`RythmeTva`,
   * `modifiable`). Le régime, lui, n'est plus sur cet écran depuis le
   * 12 septembre : la mention du bas dit ce que le relevé compte — règlements
   * ou factures émises —, et c'est tout ce qu'elle a besoin de savoir.
   */
  const patron = await estProprietaire(ctx);

  // **La périodicité vient de l'entreprise, jamais de l'adresse.** Elle
  // commande le découpage ET la lecture du numéro : « 12 » est un mois valide
  // et un trimestre absurde. La lire ici, avant tout le reste, évite qu'un
  // réglage changé laisse passer une adresse qui ne veut plus rien dire.
  const entreprise = await getEntreprise(ctx);
  const periodicite = entreprise?.periodiciteTva ?? PERIODICITE_TVA_PAR_DEFAUT;

  // Une adresse illisible ramène à la période courante : un paramètre bricolé
  // à la main ne doit pas produire d'écran vide et inexplicable.
  const periode = lirePeriode(periodicite, annee, t) ?? periodeCourante(periodicite);
  const courante = periodeCourante(periodicite);

  // **L'attente n'est pas bornée à la période affichée**, et c'est délibéré :
  // une facture d'avril qu'on n'a jamais encaissée doit se voir en août, sinon
  // elle se perd — et une TVA jamais déclarée finit par se remarquer ailleurs.
  const [releve, deductible, achats, enAttente, aPrevenir] = await Promise.all([
    releveTvaCollectee(ctx, periode.debut, periode.fin),
    totalTvaDeductible(ctx, periode.debut, periode.fin),
    listerAchatsTva(ctx, periode.debut, periode.fin),
    facturesEnAttente(ctx),
    // Ce qui reste à signaler après un changement d'IBAN. Vide presque
    // toujours — et rien ne s'affiche alors.
    facturesAvecAncienIban(ctx),
  ]);
  const collectee = Number(releve.totalTva);
  const reste = tvaDue(collectee, deductible);

  // **Ce que les clients ont fait des factures qui attendent** — sa demande du
  // 9 septembre 2026. Après le `Promise.all` et non dedans : la liste des
  // factures à interroger sort de `enAttente`. Une seule requête pour toutes,
  // jamais une par ligne.
  //
  // **Mis en mots ICI, sur le serveur** : une heure formatée par le téléphone
  // changerait selon l'appareil qui la lit, et une preuve qui change d'heure
  // selon qui la regarde ne prouve rien (`src/lib/reception-facture.ts`).
  const receptionsBrutes = await receptionsDesFactures(
    ctx,
    enAttente.map((f) => f.id)
  );
  const receptions = Object.fromEntries(
    [...receptionsBrutes].map(([id, r]) => [id, receptionEnMots(r)])
  );

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        {/* La flèche de retour et l'assistant partagent la rangée du haut :
            c'est la grammaire commune (`EnTeteEcran`), et elle libère toute la
            largeur pour « 3e trimestre 2026 », qui se cassait en deux lignes
            quand la bulle lui prenait son coin droit. */}
        <EnTeteEcran
          retour={{ href: "/termines", libelle: "Retour aux chantiers terminés" }}
          action={<BoutonAssistant />}
          actionPlacee="retour"
          assistant={false}
          surtitre="Ma TVA"
          titre={libellePeriode(periode)}
        />

        <FrisePeriodes
          periodicite={periodicite}
          annee={periode.annee}
          numero={periode.numero}
          anneeCourante={courante.annee}
          numeroCourant={courante.numero}
        />

        {/* **Le rythme, sous les mois, en un mot qui s'appuie** — et rien
            d'autre : le régime d'exigibilité est parti dans « Mon entreprise »
            (`reglages/ExigibiliteTva.tsx`). La planche du 12 septembre 2026 ne
            veut qu'une logique ici. */}
        <RythmeTva actuelle={periodicite} modifiable={patron} />

        {/* ─── L'addition ───────────────────────────────────────────────── */}
        <section className="mt-[22px] px-6" aria-label="Le relevé de la période">
          <LigneMontant libelle="TVA collectée" montant={enEuros(collectee)} marque="montant-collectee" />
          <LigneMontant libelle="TVA déductible" montant={enEuros(deductible)} marque="montant-deductible" negatif />

          <div className="mt-3 h-px" style={{ backgroundColor: colors.line }} aria-hidden="true" />

          {/* **Le reste peut être NÉGATIF, et c'est un état normal** : le mois
              où l'on achète une machine sans facturer grand-chose donne un
              crédit de TVA. Le borner à zéro cacherait le mois où le patron a
              le plus besoin de savoir.

              **Et l'on n'écrit jamais un moins devant** — sa planche du
              12 septembre 2026 : *« ne jamais afficher simplement un montant
              négatif »*. C'est le MOT qui change : « TVA à payer » devient
              « Crédit de TVA », et le chiffre reste ce qu'il est, positif. Un
              « − 20 € » sous « à payer » se lisait à l'envers : on ne paie
              rien, c'est l'État qui doit. */}
          <LigneMontant
            libelle={reste < 0 ? "Crédit de TVA" : "TVA à payer"}
            montant={enEuros(Math.abs(reste))}
            marque="montant-reste"
            total
          />

          {/* **Sous le chiffre, les deux gestes qui le changent.** Sa retouche
              du 12 septembre : *« Scanner et À la main, mets-les sous la TVA à
              payer, au-dessus de Factures en attente »*. Entre la déductible
              et le trait, ils coupaient l'addition en deux. */}
          <AchatsTva
            aujourdHui={jourIso(new Date())}
            periodicite={periodicite}
            annee={periode.annee}
            numero={periode.numero}
          />
        </section>

        {/* **« L'endroit en attente »**, sa demande du 14 août 2026 : la facture
            partie chez le client attend ici, et un appui la fait entrer au
            relevé. Placé AVANT les deux preuves : c'est ce qui reste à faire,
            et ça se lit avant ce qui est fait. */}
        <EnAttenteDePaiement
          aPrevenir={aPrevenir}
          receptions={receptions}
          regime={releve.regime}
          aujourdHui={jourIso(new Date())}
          factures={enAttente.map((f) => ({
            id: f.id,
            numeroCommercial: f.numeroCommercial,
            dateEmission: f.dateEmission,
            clientNom: f.clientNom,
            totalTtc: f.totalTtc,
            reste: f.reste,
            etat: f.etat,
            paiements: f.paiements.map((p) => ({
              id: p.id,
              date: p.date,
              montant: p.montant,
              origine: p.origine,
            })),
          }))}
        />

        {/* ─── La preuve du premier terme ───────────────────────────────── */}
        {/* **Chaque ligne dit son TTC ET sa TVA, chacun avec son mot** — sa
            planche du 12 septembre 2026 : *« l'utilisateur ne doit jamais
            devoir deviner si le montant affiché correspond au TTC ou à la
            TVA »*. Une seule colonne de chiffres ne le disait pas.

            **Ce qu'une ligne EST dépend du régime**, et la ligne le sait
            (`motif`) : aux encaissements c'est un règlement — « Règlement
            encaissé », à la date où il l'a été ; aux débits c'est la facture
            entière — « Facture émise », à sa date d'émission. Écrire
            « règlement » sous les débits mentirait sur ce qui est compté. */}
        <section className="mt-[34px] px-6" data-atlas="preuve-collectee">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[19px]" style={{ color: colors.ink, fontFamily: font.display }}>
              TVA collectée
            </h2>
            <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>
              {releve.lignes.length > 0 &&
                (releve.regime === "encaissements"
                  ? `${releve.lignes.length} règlement${releve.lignes.length > 1 ? "s" : ""}`
                  : `${releve.lignes.length} facture${releve.lignes.length > 1 ? "s" : ""}`)}
            </span>
          </div>
          <p className={`mt-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
            Vos factures
          </p>

          {releve.lignes.length === 0 ? (
            <p className="mt-4 text-center text-[13px]" style={{ color: colors.inkSoft }}>
              {releve.regime === "encaissements"
                ? "Aucun règlement reçu sur cette période."
                : "Aucune facture émise sur cette période."}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {/* **La clé porte la date, pas seulement le numéro.** Aux
                  encaissements, une facture réglée en deux acomptes produit
                  deux lignes : deux clés identiques feraient disparaître la
                  seconde de l'écran, sans que le total change — un écart que
                  personne ne saurait expliquer. */}
              {releve.lignes.map((l) => (
                <li
                  key={`${l.numeroCommercial}|${l.dateEmission}|${l.totalTtc}`}
                  className="py-3"
                  style={{ borderTop: `1px solid ${colors.lineSoft}` }}
                >
                  <p className="truncate text-[15px]" style={{ color: colors.ink }}>
                    {l.clientNom ?? "Client non renseigné"}
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: colors.muted }}>
                    Facture n° <NumeroDeDocument valeur={l.numeroCommercial} /> ·{" "}
                    {l.motif === "paiement" ? "règlement du" : "émise le"} {jourLisible(l.dateEmission)}
                  </p>
                  <Paire
                    quoi={l.motif === "paiement" ? "Règlement encaissé" : "Facture émise"}
                    combien={`${enEuros(Number(l.totalTtc))} TTC`}
                  />
                  <Paire quoi="TVA collectée" combien={enEuros(Number(l.totalTva))} tva />
                </li>
              ))}
              <Total quoi="Total collectée" combien={enEuros(collectee)} marque="total-collectee" />
            </ul>
          )}
        </section>

        {/* ─── La preuve du second ──────────────────────────────────────── */}
        <section className="mt-[34px] px-6" data-atlas="preuve-deductible">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[19px]" style={{ color: colors.ink, fontFamily: font.display }}>
              TVA déductible
            </h2>
            <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>
              {achats.length > 0 && `${achats.length} achat${achats.length > 1 ? "s" : ""}`}
            </span>
          </div>
          {/* La liste garde son mot juste : ce qu'il ajoute, ce sont des
              ACHATS. « TVA déductible », c'est ce que l'administration en
              fait. */}
          <p className={`mt-2.5 ${libelleCaps}`} style={{ color: colors.muted }}>
            Vos achats
          </p>

          {achats.length === 0 ? (
            <p className="mt-4 text-center text-[13px]" style={{ color: colors.inkSoft }}>
              Rien encore. Scannez un ticket, ou écrivez-le.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {achats.map((a) => (
                <li
                  key={a.id}
                  data-atlas="ligne-achat"
                  className="py-3"
                  style={{ borderTop: `1px solid ${colors.lineSoft}` }}
                >
                  <p className="truncate text-[15px]" style={{ color: colors.ink }}>
                    {a.fournisseur}
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: colors.muted }}>
                    {jourEtMois(a.dateAchat)}
                  </p>
                  {/* Le TTC n'est pas toujours connu — un achat écrit à la main
                      peut ne porter que sa TVA. Sans lui, la ligne ne dit que
                      ce qu'elle sait ; elle n'invente pas un montant. */}
                  {a.totalTtc && <Paire quoi="Montant" combien={`${enEuros(Number(a.totalTtc))} TTC`} />}
                  <Paire quoi="TVA déductible" combien={enEuros(Number(a.tvaDeductible))} tva />
                </li>
              ))}
              <Total quoi="Total déductible" combien={enEuros(deductible)} marque="total-deductible" />
            </ul>
          )}
        </section>

        {/* **« vos règlements » ou « vos factures émises » : ce que le relevé
            compte VRAIMENT**, selon le régime. La mention ne doit pas dire
            « règlements » à qui déclare aux débits. */}
        <p className="mt-10 px-8 text-center text-[12px] leading-[1.55]" style={{ color: colors.inkSoft }}>
          Ce relevé est préparé par Atlas à partir de vos{" "}
          {releve.regime === "encaissements" ? "règlements" : "factures émises"}. Il ne
          vaut pas déclaration : celle-ci reste à faire par votre outil
          comptable.
        </p>
      </div>
    </div>
  );
}

/**
 * « Intitulé   montant » — une ligne d'une preuve.
 *
 * **En doré quand c'est la TVA** — le mot ET le chiffre —, sa retouche du
 * 12 septembre 2026 : c'est la ligne qui alimente le total, et le total est
 * doré aussi. Le TTC reste en gris : il dit d'où vient le chiffre, il ne
 * compte pas.
 */
function Paire({ quoi, combien, tva = false }: { quoi: string; combien: string; tva?: boolean }) {
  return (
    <p className="mt-[7px] flex items-baseline justify-between gap-2.5 text-[13px]">
      <span style={{ color: tva ? colors.or : colors.muted }}>{quoi}</span>
      <span
        className="whitespace-nowrap text-[16px]"
        style={{ color: tva ? colors.or : colors.ink, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
      >
        {combien}
      </span>
    </p>
  );
}

/**
 * La ligne de total sous une preuve : le mot en noir gras, décalé à gauche du
 * chiffre ; le chiffre en doré gras, **dans la colonne des chiffres** — sa
 * demande du 12 septembre 2026 : *« le montant total aligné au dernier
 * chiffre »*. Un total qui ne tombe pas sous ses lignes ne se recompose pas à
 * la main (`CLAUDE.md` §4 bis).
 */
function Total({ quoi, combien, marque }: { quoi: string; combien: string; marque: string }) {
  return (
    <li
      data-atlas={marque}
      className="flex items-baseline justify-end gap-3.5 pt-3"
      style={{ borderTop: `1px solid ${colors.line}` }}
    >
      <span className={`${libelleCaps} font-bold`} style={{ color: colors.ink }}>
        {quoi}
      </span>
      <span
        className="whitespace-nowrap text-[18px] font-bold"
        style={{ color: colors.or, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
      >
        {combien}
      </span>
    </li>
  );
}

import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import BoutonAssistant from "@/components/atlas/BoutonAssistant";
import NumeroDeDocument from "@/components/atlas/NumeroDeDocument";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { estProprietaire } from "@/server/autorisation";
import { relevesSousLesDeuxRegimes } from "@/server/repositories/factures";
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
import DeclarationsTva from "./DeclarationsTva";
import AchatsTva from "./AchatsTva";
import EnAttenteDePaiement from "./EnAttenteDePaiement";
import { facturesEnAttente } from "@/server/repositories/paiements-facture";
import { listerAchatsTva, totalTvaDeductible } from "@/server/repositories/achats-tva";
import { tvaDue } from "@/lib/achat-tva";

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
// qu'il recopie pour payer. Les deux réglages descendent sous le total, en une
// ligne de provenance qui ouvre une feuille (`DeclarationsTva`).
//
// Et la suite de l'écran suit le même ordre : ce qui reste À FAIRE (les
// factures en attente), puis les deux PREUVES — les factures qui font la
// collectée, les achats qui font la déductible.

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
   * **Depuis le 3 septembre 2026, elle en LIT l'état sans pouvoir y toucher.**
   * Les retirer entièrement l'empêchait de savoir si « Août 2026 » était compté
   * à l'encaissement ou aux débits — alors que c'est elle qui relit le relevé.
   * Le geste part, la phrase reste (`DeclarationsTva`).
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
  // **Les DEUX régimes, en une seule lecture des factures.** Le second total ne
  // s'affiche pas : il sert à dire, dans la feuille des déclarations, ce que le
  // choix change — ou ne change pas (`ARCHITECTURE.md` §194).
  const [releves, deductible, achats, enAttente] = await Promise.all([
    relevesSousLesDeuxRegimes(ctx, periode.debut, periode.fin),
    totalTvaDeductible(ctx, periode.debut, periode.fin),
    listerAchatsTva(ctx, periode.debut, periode.fin),
    facturesEnAttente(ctx),
  ]);
  const releve = releves.retenu;
  const collectee = Number(releve.totalTva);
  const reste = tvaDue(collectee, deductible);

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

        {/* ─── L'addition ───────────────────────────────────────────────── */}
        <section className="mt-[26px] px-6" aria-label="Le relevé de la période">
          <LigneMontant libelle="Collectée" montant={enEuros(collectee)} marque="montant-collectee" />
          <LigneMontant libelle="Déductible" montant={enEuros(deductible)} marque="montant-deductible" negatif />

          <AchatsTva
            aujourdHui={jourIso(new Date())}
            periodicite={periodicite}
            annee={periode.annee}
            numero={periode.numero}
          />

          <div className="mt-3 h-px" style={{ backgroundColor: colors.line }} aria-hidden="true" />

          {/* **Le reste peut être NÉGATIF, et c'est un état normal** : le mois
              où l'on achète une machine sans facturer grand-chose donne un
              crédit de TVA. Le borner à zéro cacherait le mois où le patron a
              le plus besoin de savoir. */}
          <LigneMontant
            libelle="Reste à payer"
            montant={enEuros(Math.abs(reste))}
            marque="montant-reste"
            negatif={reste < 0}
            total
          />
          {/* **Et le signe seul ne suffit pas à dire ce que ça VEUT dire.**
              « Reste à payer − 20 € » se lit mal : on ne paie rien, c'est
              l'inverse. La phrase le dit en clair — et elle n'apparaît que
              dans ce cas, pour ne pas encombrer les onze mois où le montant
              est positif. */}
          {reste < 0 && (
            <p className="mt-2 text-[12.5px] leading-snug" style={{ color: colors.or }}>
              Crédit de TVA — c’est l’État qui vous doit.
            </p>
          )}
        </section>

        <DeclarationsTva
          periodicite={periodicite}
          regime={releve.regime}
          periode={libellePeriode(periode)}
          tvaRetenue={enEuros(Number(releves.retenu.totalTva))}
          tvaAutre={enEuros(Number(releves.autre.totalTva))}
          modifiable={patron}
        />

        {/* **« L'endroit en attente »**, sa demande du 14 août 2026 : la facture
            partie chez le client attend ici, et un appui la fait entrer au
            relevé. Placé AVANT les deux preuves : c'est ce qui reste à faire,
            et ça se lit avant ce qui est fait. */}
        <EnAttenteDePaiement
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
        <section className="mt-[34px] px-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className={libelleCaps} style={{ color: colors.muted }}>
              Vos factures
            </p>
            <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>
              {releve.lignes.length} facture{releve.lignes.length > 1 ? "s" : ""}
            </span>
          </div>

          {releve.lignes.length === 0 ? (
            <p className="mt-4 text-center text-[13px]" style={{ color: colors.inkSoft }}>
              {releve.regime === "encaissements"
                ? "Aucun règlement reçu sur cette période."
                : "Aucune facture émise sur cette période."}
            </p>
          ) : (
            <ul className="mt-1 flex flex-col">
              {/* **La clé porte la date, pas seulement le numéro.** Aux
                  encaissements, une facture réglée en deux acomptes produit
                  deux lignes : deux clés identiques feraient disparaître la
                  seconde de l'écran, sans que le total change — un écart que
                  personne ne saurait expliquer. */}
              {releve.lignes.map((l) => (
                <li
                  key={`${l.numeroCommercial}|${l.dateEmission}|${l.totalTtc}`}
                  className="flex items-center justify-between gap-4 py-3"
                  style={{ borderTop: `1px solid ${colors.lineSoft}` }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px]" style={{ color: colors.ink }}>
                      {l.clientNom ?? "Client non renseigné"}
                    </p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: colors.muted }}>
                      <NumeroDeDocument valeur={l.numeroCommercial} /> · {jourLisible(l.dateEmission)}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-[15.5px]"
                    style={{ color: colors.ink, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
                  >
                    {enEuros(Number(l.totalTva))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── La preuve du second ──────────────────────────────────────── */}
        <section className="mt-[34px] px-6">
          <div className="flex items-baseline justify-between gap-3">
            {/* La liste garde son mot juste : ce qu'il ajoute, ce sont des
                ACHATS. « TVA déductible », c'est ce que l'administration en
                fait. */}
            <p className={libelleCaps} style={{ color: colors.muted }}>
              Vos achats
            </p>
            <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>
              {achats.length > 0 && `${achats.length} achat${achats.length > 1 ? "s" : ""}`}
            </span>
          </div>

          {achats.length === 0 ? (
            <p className="mt-4 text-center text-[13px]" style={{ color: colors.inkSoft }}>
              Rien encore. Scannez un ticket, ou écrivez-le.
            </p>
          ) : (
            <ul className="mt-1 flex flex-col">
              {achats.map((a) => (
                <li
                  key={a.id}
                  data-atlas="ligne-achat"
                  className="flex items-center gap-3 py-3"
                  style={{ borderTop: `1px solid ${colors.lineSoft}` }}
                >
                  {/* **Des icônes dessinées, plus des émoji — 3 septembre 2026.**
                      « 🧾 » et « ✎ » étaient rendus par la police d'émoji du
                      téléphone : un ticket en couleurs au milieu d'un écran qui
                      n'en a aucune, et un crayon qui change de dessin d'un
                      appareil à l'autre. Leur pastille `rustTint` est partie
                      avec : sur Nuit, elle tient 1,14 de contraste contre le
                      fond, c'est-à-dire qu'elle n'existe pas. */}
                  <span className="flex-shrink-0" aria-hidden="true">
                    {a.saisie === "scan" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.or} strokeWidth="1.5">
                        <path d="M6 3.5h12v15.2l-2.4-1.4-2.4 1.4-2.4-1.4-2.4 1.4L6 17.3z" strokeLinejoin="round" />
                        <path d="M9 8h6M9 11.6h4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.or} strokeWidth="1.5">
                        <path d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20z" strokeLinejoin="round" />
                        <path d="M13.6 6.6l3.8 3.8" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px]" style={{ color: colors.ink }}>
                      {a.fournisseur}
                    </p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: colors.muted }}>
                      {jourEtMois(a.dateAchat)}
                      {a.totalTtc ? ` · ${enEuros(Number(a.totalTtc))}` : ""}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-[15.5px]"
                    style={{ color: colors.ink, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
                  >
                    {enEuros(Number(a.tvaDeductible))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-10 px-8 text-center text-[12px] leading-[1.55]" style={{ color: colors.inkSoft }}>
          Ce relevé est préparé par Atlas à partir de vos factures émises. Il ne
          vaut pas déclaration : celle-ci reste à faire par votre outil
          comptable.
        </p>
      </div>
    </div>
  );
}

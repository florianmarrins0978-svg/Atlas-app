"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { colors, font } from "@/lib/design-tokens";
import { jourCourt, jourEtMois, jourNumerique } from "@/lib/jour";
import { enEuros } from "@/lib/euros";
import { noterPaiementAction, retirerPaiementAction, soldeFactureAction } from "./actions";
import { MarqueAncienIban } from "@/components/atlas/AlerteAncienIban";
import { prevenirAction } from "@/app/prevenir-du-nouvel-iban";
import type { FactureAPrevenir } from "@/server/repositories/factures";
import type { ReceptionLisible } from "@/lib/reception-facture";

export type FactureAttendue = {
  id: string;
  numeroCommercial: string;
  dateEmission: string;
  clientNom: string | null;
  totalTtc: string;
  reste: string;
  etat: "en_attente" | "partielle" | "soldee";
  paiements: { id: string; date: string; montant: string; origine: "saisi" | "reprise" | "banque" }[];
};

/**
 * « L'endroit en attente » — sa demande du 14 août 2026, mot pour mot.
 *
 * *« Lorsque la facture part, au lieu qu'elle rentre directement dans le relevé
 * de TVA, elle arrive dans un endroit en attente ; lorsque j'ai reçu le
 * paiement, je retourne sur l'endroit en attente, je clique sur valider, et
 * boum, la facture va directement dans le relevé. »*
 *
 * **Deux portes, et il les a demandées toutes les deux :** « Payée » solde en
 * un doigt — c'est le cas de cinquante factures par an —, et « Noter un
 * règlement » ouvre la date et le montant pour un acompte. La seconde ne
 * remplace pas la première : une saisie en deux champs pour un geste qu'on fait
 * cinquante fois serait un impôt sur le temps.
 *
 * **Ce qui n'y figure pas est aussi important :** aucune facture soldée. Cet
 * écran est une file d'attente, pas un journal — ce qui est réglé a rejoint le
 * relevé, et il est juste au-dessus.
 */
/** Ce que la page montre d'emblée ; le reste se déplie. */
const QUELQUES = 3;

export default function EnAttenteDePaiement({
  factures,
  aPrevenir,
  receptions,
  aujourdHui,
  regime,
}: {
  factures: FactureAttendue[];
  /**
   * **Ce que le client a fait de chaque facture** — sa demande du 9 septembre
   * 2026, et la réponse à sa question sur le litige.
   *
   * Mis en mots par le SERVEUR (`src/lib/reception-facture.ts`) : une heure
   * calculée sur le téléphone changerait selon l'appareil qui la lit, et une
   * preuve qui change d'heure selon qui la regarde ne prouve rien.
   */
  receptions: Record<string, ReceptionLisible | undefined>;
  /**
   * **Les factures parties avec l'ancien IBAN** — le deuxième des trois
   * endroits qu'il a retenus le 8 septembre 2026. C'est ici qu'il regarde déjà
   * qui n'a pas payé : la marque va donc là, plutôt que dans un écran de plus.
   */
  aPrevenir: FactureAPrevenir[];
  /** Le jour, calculé sur le serveur : le téléphone peut être à l'heure d'ailleurs. */
  aujourdHui: string;
  regime: "encaissements" | "debits";
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  // **Quelques factures d'abord, toutes sur demande** — sa planche du
  // 12 septembre 2026 : *« ne pas afficher énormément de factures directement
  // sur la page ; montrer seulement quelques factures récentes, puis un
  // lien »*. Trois, et le lien déplie le reste sur place : une autre page
  // pour la même liste serait un écran de plus à comprendre.
  const [toutes, setToutes] = useState(false);
  const router = useRouter();

  // **Aux débits, cet écran n'a pas lieu d'être** — tout est déjà déclaré à
  // l'émission. Le montrer quand même ferait croire qu'un geste reste à faire.
  if (regime === "debits") return null;

  async function solder(id: string) {
    setEnCours(id);
    setErreur(null);
    try {
      const r = await soldeFactureAction(id, aujourdHui);
      if (!r.ok) setErreur(r.raison);
      else router.refresh();
    } catch {
      setErreur("Ce règlement n'a pas pu être enregistré. Réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="mt-[34px] px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px]" style={{ color: colors.ink, fontFamily: font.display }}>
          Factures en attente
        </h2>
        <span className="text-[12px] tabular-nums" style={{ color: colors.muted }}>
          {factures.length === 0 ? "rien" : `${factures.length} facture${factures.length > 1 ? "s" : ""}`}
        </span>
      </div>
      {/* **Plus de phrase sous le titre — sa planche du 12 septembre 2026.**
          Elle disait « elles entreront au relevé quand vous appuierez sur
          Payée » ; le bouton « Payée » est juste dessous et dit la même chose.
          Un écran n'explique pas son propre fonctionnement (`CLAUDE.md` §3). */}

      {erreur && (
        <p role="alert" className="mt-3 text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {factures.length === 0 ? (
        <p className="mt-4 text-center text-[13px]" style={{ color: colors.inkSoft }}>
          Tout est réglé. Rien n&apos;attend son paiement.
        </p>
      ) : (
        /* **Des lignes, plus des cartes — 3 septembre 2026.** Six plages
           arrondies empilées faisaient de cet écran une grille de tableau de
           bord, ce que le patron refuse. Un cheveu suffit à séparer deux
           factures, et le montant retrouve la colonne de droite que partagent
           tous les montants de l'écran. */
        <ul className="mt-1 flex flex-col">
          {(toutes ? factures : factures.slice(0, QUELQUES)).map((f) => (
            <li key={f.id} className="py-3.5" style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px]" style={{ color: colors.ink }}>
                    {f.clientNom ?? "Client"}
                  </p>
                  {/* **LA LIGNE RESTE À SA PLACE, ON NE FAIT QUE L'ÉCRIRE PLUS
                      COURT — sa correction du 11 septembre 2026 :** *« il
                      fallait laisser les phrases où elles étaient, juste les
                      modifier »*. Elle avait disparu des factures entamées, au
                      motif que la droite portait la même date ; c'est la date
                      de droite qui est partie, pas celle-ci.

                      Le jour court, comme la trace de réception juste en
                      dessous : une seule façon d'écrire un jour sur cet écran. */}
                  <p className="text-[11.5px] leading-[1.45]" style={{ color: colors.muted }}>
                    {f.numeroCommercial} · émise le {jourCourt(f.dateEmission, aujourdHui)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p
                    className="text-[15.5px]"
                    style={{ color: colors.ink, fontFamily: font.display, fontVariantNumeric: "tabular-nums" }}
                  >
                    {/* Le mot devant le chiffre, et seulement quand un acompte
                        est passé : sur une facture intacte, « reste à payer »
                        et le total disent la même chose. */}
                    {f.etat === "partielle" && (
                      <span className="text-[11px]" style={{ color: colors.muted, fontFamily: font.body }}>
                        Reste à payer{" "}
                      </span>
                    )}
                    {euros(f.reste)}
                  </p>
                  {/* **UN ACOMPTE PASSÉ SE DIT ICI, ET EN TOUTES LETTRES — sa
                      correction du 11 septembre 2026 :** *« lorsqu'on note un
                      règlement la phrase était à droite, c'est là que je
                      voulais reste à payer »*.

                      « reste sur 1 776,00 € » demandait de deviner que le gros
                      chiffre au-dessus était le solde. La ligne le nomme : sans
                      elle, « 1 476 € » sur une facture de 1 776 € se lit comme
                      une erreur de montant.

                      **Sans sa date — 11 septembre 2026 :** *« à droite retire
                      la date en doré »*. Le jour de la facture est déjà sur la
                      ligne du numéro, à gauche ; c'est le MONTANT entier qu'on
                      vient chercher ici. */}
                  {f.etat === "partielle" && (
                    <p className="text-[11px] leading-[1.45]" style={{ color: colors.or }}>
                      Sur les {euros(f.totalTtc)}
                    </p>
                  )}
                </div>
              </div>

              {/* La marque, sous la ligne et avant les gestes de paiement :
                  elle dit quelque chose sur la facture, pas sur son règlement. */}
              <MarqueAncienIban
                facture={aPrevenir.find((p) => p.id === f.id)}
                onPrevenir={prevenirAction}
              />

              {/* **CE QUE LE CLIENT EN A FAIT — sa question du 9 septembre 2026 :**
                  *« en cas de litige, où est-ce que l'utilisateur va rechercher
                  cette info ? »*. Ici, et pas ailleurs : c'est l'écran qu'il
                  ouvre quand il court après l'argent. Même place que la marque
                  ci-dessus, et pour la même raison — cela dit quelque chose sur
                  la facture, pas sur son règlement. */}
              <CeQueLeClientEnAFait reception={receptions[f.id]} />

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={enCours === f.id}
                  onClick={() => solder(f.id)}
                  className="atlas-plein min-h-[40px] rounded-full px-5 py-2 text-[14px] font-medium disabled:opacity-40"
                  style={{ backgroundColor: colors.plein, color: colors.card }}
                >
                  {enCours === f.id ? "…" : "Payée"}
                </button>
                <button
                  type="button"
                  onClick={() => setOuverte(ouverte === f.id ? null : f.id)}
                  aria-expanded={ouverte === f.id}
                  className="min-h-[40px] px-2 py-2 text-[14px]"
                  style={{ color: colors.muted }}
                >
                  Noter un règlement
                </button>
              </div>

              {ouverte === f.id && (
                <SaisieDuReglement
                  facture={f}
                  aujourdHui={aujourdHui}
                  onErreur={setErreur}
                  onFini={() => {
                    setOuverte(null);
                    router.refresh();
                  }}
                />
              )}

              {f.paiements.length > 0 && (
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {f.paiements.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-[12px]" style={{ color: colors.muted }}>
                      {/* **LA LIGNE ENREGISTRÉE PREND LA FORME DE LA SAISIE —
                          sa demande du 11 septembre 2026 :** *« donc :
                          11/09/2026, le montant qui vient d'être rentré »*, la
                          photo de la saisie à l'appui. Elle s'écrivait
                          « 300,00 € le 11/09 » : les deux mêmes choses, dans
                          l'autre sens et dans un autre format, juste sous les
                          cases qu'on venait de remplir. On relit ce qu'on a
                          tapé à la place où on l'a tapé.
                          L'étiquette de lecture d'écran, elle, garde la date en
                          toutes lettres — dite à voix haute, « 11/09 » ne
                          s'entend pas. */}
                      {/* **« ACOMPTE PAYÉ LE » — sa demande du 11 septembre 2026 :**
                          *« une fois l'acompte enregistré il faut marquer
                          acompte payé le »*. Un jour et un montant posés seuls
                          ne disent pas de quoi ils parlent : c'est la seule
                          ligne de la carte qui raconte un geste passé, et elle
                          se lisait comme une deuxième date d'émission.

                          **Et c'est toujours un acompte, ici.** Un règlement
                          qui solde fait sortir la facture de cet écran : ce qui
                          reste visible est forcément une part.

                          **Ce que la migration a SUPPOSÉ garde ses mots à
                          elle.** Ces règlements-là n'ont jamais été constatés :
                          ils existent pour que le relevé du trimestre passé ne
                          bouge pas. Les dire « payés » ferait passer une
                          supposition pour une observation. */}
                      <span className="flex-1 tabular-nums">
                        {p.origine === "reprise" ? "Supposé réglé le " : "Acompte payé le "}
                        {jourNumerique(p.date)}
                      </span>
                      <span className="flex-none tabular-nums" style={{ color: colors.inkSoft }}>
                        {euros(p.montant)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Retirer le règlement de ${euros(p.montant)} du ${enClair(p.date)}`}
                        onClick={async () => {
                          await retirerPaiementAction(p.id);
                          router.refresh();
                        }}
                        // 36 px : une cible isolée dans un rang serré, visée du pouce.
                        className="flex h-9 w-9 flex-none items-center justify-center text-[15px]"
                        style={{ color: colors.muted }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {!toutes && factures.length > QUELQUES && (
        <button
          type="button"
          data-atlas="voir-toutes-en-attente"
          onClick={() => setToutes(true)}
          className="mt-2 block min-h-[44px] py-2 text-left text-[14px]"
          style={{ color: colors.or }}
        >
          Voir toutes les factures en attente ({factures.length})
        </button>
      )}
    </div>
  );
}

/**
 * Un acompte : une date, un montant. Rien de plus n'entre au calcul.
 *
 * **LA PLANCHE N° 1, choisie par lui le 11 septembre 2026** — deux cases, et
 * chacune porte son nom au-dessus (`appli/noter-un-reglement.html`). Elles
 * existaient déjà, nues : une date et un nombre posés côte à côte, sans un mot.
 * Le nom vivait dans `aria-label`, donc pour les lecteurs d'écran seulement —
 * invisible à l'œil, et c'est l'œil qui saisit.
 */
function SaisieDuReglement({
  facture,
  aujourdHui,
  onErreur,
  onFini,
}: {
  facture: FactureAttendue;
  aujourdHui: string;
  onErreur: (m: string | null) => void;
  onFini: () => void;
}) {
  const [date, setDate] = useState(aujourdHui < facture.dateEmission ? facture.dateEmission : aujourdHui);
  // **La case part VIDE — sa demande du 11 septembre 2026 :** *« le montant doit
  // être le chiffre qu'on a écrit »*. Elle arrivait remplie du solde entier, si
  // bien qu'il lisait un chiffre qu'il n'avait pas tapé. Solder d'un doigt reste
  // possible : c'est « Payée », juste au-dessus.
  const [montant, setMontant] = useState("");
  const [enCours, setEnCours] = useState(false);
  // La virgule du clavier français compte autant que le point.
  const rien = !(Number(montant.replace(",", ".")) > 0);

  return (
    <div className="mt-2.5 flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: colors.muted }}
          >
            Payé le
          </span>
          {/* **LE JOUR S'ÉCRIT À LA FRANÇAISE, ET C'EST NOUS QUI L'ÉCRIVONS.**
              Payé le 11 septembre 2026 : sa capture montre « 09/11/2026 » pour
              un 11 septembre. Le champ natif se formate selon la LANGUE DU
              TÉLÉPHONE, pas selon la page — sur le sien, il rend l'ordre
              américain, et il lit novembre.
              Le champ reste natif : lui seul ouvre le rouleau de l'iPhone, et
              le remplacer par trois cases à taper serait un recul. Il est donc
              posé transparent PAR-DESSUS notre propre texte, qui, lui, passe
              par `jourNumerique` — la seule façon d'écrire une date dans ce
              dépôt. */}
          <span className="relative block rounded-[4px]" style={{ backgroundColor: colors.cream }}>
            <span
              aria-hidden
              className="flex items-center justify-between gap-2 px-3 py-2.5"
              style={{ color: colors.ink, fontSize: "16px" }}
            >
              <span className="tabular-nums">{jourNumerique(date)}</span>
              {/* Le calendrier que le champ natif dessinait lui-même : il est
                  redevenu invisible avec lui, et c'est la seule chose qui dit
                  que la case s'ouvre. Il montre une fonction, il ne décore pas
                  (`CLAUDE.md` §3). */}
              <svg width="15" height="16" viewBox="0 0 15 16" fill="none" stroke={colors.muted} strokeWidth="1.3">
                <rect x="1" y="2.5" width="13" height="12" rx="2" />
                <path d="M1 6.5h13M4.5 1v3M10.5 1v3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="date"
              value={date}
              min={facture.dateEmission}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date du paiement"
              className="absolute inset-0 h-full w-full opacity-0"
              style={{ fontSize: "16px" }}
            />
          </span>
        </label>
        <label className="flex flex-none flex-col gap-1.5">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: colors.muted }}
          >
            Montant reçu
          </span>
          <input
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Montant reçu, en euros"
            className="w-28 rounded-[4px] border-0 px-3 py-2.5 text-right outline-none"
            style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
          />
        </label>
        <span className="pb-3 text-[13px]" style={{ color: colors.muted }}>
          €
        </span>
      </div>
      <button
        type="button"
        // Rien de tapé, rien à enregistrer : le refus se voit AVANT l'appui,
        // plutôt que de revenir en message une seconde plus tard.
        disabled={enCours || rien}
        onClick={async () => {
          setEnCours(true);
          onErreur(null);
          try {
            const r = await noterPaiementAction(facture.id, date, montant);
            if (!r.ok) onErreur(r.raison);
            else onFini();
          } catch {
            onErreur("Ce règlement n'a pas pu être enregistré. Réessayez.");
          } finally {
            setEnCours(false);
          }
        }}
        className="atlas-plein min-h-[44px] self-start rounded-full px-5 py-2.5 text-[14px] font-medium disabled:opacity-40"
        style={{ backgroundColor: colors.plein, color: colors.card }}
      >
        Enregistrer ce règlement
      </button>
      {/* **SIX MOTS, CONTRE DIX-HUIT — sa demande du 11 septembre 2026 :**
          *« la phrase sous Enregistrer ce règlement est trop longue,
          synthétise-la, on comprend rien là »*. Elle expliquait le mécanisme de
          l'acompte ; il n'a pas besoin qu'on lui explique un acompte. Ce qui
          reste est la seule chose qu'il ne peut pas deviner : c'est la part
          REÇUE qui entre au relevé, pas la facture. */}
      <p className="text-[12px] leading-snug" style={{ color: colors.muted }}>
        Seule la part reçue entre au relevé.
      </p>
    </div>
  );
}

/**
 * La trace de réception, sous la ligne de la facture.
 *
 * **Aucune décision ici :** la phrase entière — « Ouverte 11/09 », « Réception
 * confirmée le 11/09 », « Pas encore ouverte. » — se décide dans
 * `src/lib/reception-facture.ts`, parce que le dossier du client la montre
 * aussi et que deux copies finissent toujours par diverger (`CLAUDE.md` §3).
 *
 * Aucun trait doré ici, contrairement à la planche : le liseré ne servait qu'à
 * montrer ce qui s'ajoutait. Sur l'écran, cette ligne est une ligne parmi les
 * autres.
 */
function CeQueLeClientEnAFait({ reception }: { reception: ReceptionLisible | undefined }) {
  if (!reception) return null;
  return (
    <p className="mt-2 text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
      {reception.avant}
      {reception.date && <strong style={{ color: colors.inkSoft }}>{reception.date}</strong>}
    </p>
  );
}

/**
 * « 2026-08-14 » → « 14 août 2026 ». Le patron ne lit pas de dates à l'envers.
 *
 * La table des mois vient de `jour.ts` : elle en portait une seconde copie, et
 * deux tables finissent toujours par diverger (`CLAUDE.md` §3). L'année reste,
 * elle : une facture impayée de l'an dernier doit se dire comme telle.
 */
function enClair(iso: string): string {
  return `${jourEtMois(iso)} ${iso.slice(0, 4)}`;
}

/** Le format de tout le dépôt, espace des milliers comprise (`euros.ts`). */
function euros(montant: string): string {
  return enEuros(Number(montant || "0"));
}

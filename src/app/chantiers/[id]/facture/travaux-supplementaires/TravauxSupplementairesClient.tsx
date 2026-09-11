"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { avecCivilite } from "@/lib/civilite";
import { ligneAttendSonPrix } from "@/lib/preparation-devis";
import { lignesParBloc, tauxLisible, totauxAvecReduction } from "@/lib/reduction-devis";
import { Cellule, ChiffreSaisi, Colonne, ZoneQuiGrandit } from "../../devis-complet/ChampsDuDevis";
import {
  ajouterLigneDeFactureAction,
  majLigneDeFactureAction,
  retirerLignesDeFactureAction,
} from "../actions";
import { ligneSeCorrige } from "@/lib/lignes-corrigeables";

/**
 * ─── LA FEUILLE OÙ IL SAISIT SES LIGNES ────────────────────────────────────
 *
 * Sa demande du 9 septembre 2026, et sa règle dans la foulée : *« le devis ne
 * se réécrit pas, seulement la case travaux supplémentaires ; le reste,
 * impossible de les modifier »*.
 *
 * ─── LE MÊME ÉCRAN SERT LES FACTURES SANS DEVIS — 10 septembre 2026 ────────
 *
 * *« Il faut que l'on puisse facturer sans avoir besoin de passer par la case
 * devis. »* Sa planche le dit d'un mot : **l'écran « Travaux en plus » EST cet
 * éditeur**, et il sert ici sans le mot. Un second écran de saisie aurait
 * recopié les champs du devis, le calcul des blocs, les totaux et la grammaire
 * de la TVA — et le premier ajustement ne serait allé que sur l'un des deux.
 *
 * **Ce qui change quand il n'y a pas de devis, et rien d'autre :** il n'y a
 * aucune ligne à protéger (donc aucun bloc de texte figé), la catégorie ne
 * s'appelle plus « travaux supplémentaires » (supplémentaires à quoi ?), et le
 * titre dit « Facture ». Les gestes, eux, sont exactement les mêmes.
 *
 * **Les lignes du devis sont donc du TEXTE, pas des champs.** Ce n'est pas un
 * champ « en lecture seule » qu'on pourrait rouvrir d'un attribut : ce sont des
 * `<span>`. Le refus vit aussi dans l'écriture — `majLigneDeFacture` ne touche
 * que les lignes que `ligneSeCorrige` désigne —, et les deux gardes valent mieux
 * qu'une : la première évite le geste, la seconde le rend impossible.
 *
 * **Les champs de la catégorie sont CEUX DU DEVIS**, importés et non recopiés
 * (`ChampsDuDevis`) : deux façons de saisir un prix auraient divergé au premier
 * ajustement, et c'est le même geste pour le patron.
 */

type LigneEcran = {
  id: string;
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  montant: string;
  tauxTva: string | null;
  supplement: boolean;
};

const enEuros = (v: string | number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 })
    .format(typeof v === "number" ? v : Number(v));

/** Ce que la ligne pèse — la même règle qu'au serveur, jamais une seconde. */
const montantDe = (l: { quantite: string; prixUnitaire: string }) =>
  new Decimal(l.quantite || "0").times(l.prixUnitaire || "0").toFixed(2);

export default function TravauxSupplementairesClient({
  chantierId,
  chantierNom,
  adresseChantier,
  factureId,
  numeroFacture,
  clientNom,
  clientCivilite,
  numeroDevis,
  devisId,
  tauxTvaFacture,
  reductionPourcent,
  lignes: lignesInitiales,
}: {
  chantierId: string;
  chantierNom: string;
  adresseChantier: string | null;
  factureId: string;
  numeroFacture: string;
  clientNom: string | null;
  clientCivilite: "mr" | "mme" | null;
  numeroDevis: string | null;
  /** Le devis dont elle vient. `null` : faite SANS devis (migration 0086) —
   *  aucune de ses lignes n'a été acceptée d'avance, donc aucune à protéger. */
  devisId: string | null;
  tauxTvaFacture: string;
  reductionPourcent: string | null;
  lignes: LigneEcran[];
}) {
  const router = useRouter();
  const [lignes, setLignes] = useState<LigneEcran[]>(lignesInitiales);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, enTransition] = useTransition();

  /**
   * QUI EST DU TEXTE, ET QUI EST UN CHAMP.
   *
   * **La règle n'est pas écrite ici** : c'est `ligneSeCorrige`, celle-là même
   * que le dépôt applique dans le WHERE de ses écritures (`CLAUDE.md` §3). Deux
   * rédactions auraient divergé, et c'est celle de l'écriture qu'on aurait
   * oublié de corriger — celle qui, seule, empêche vraiment de réécrire un prix
   * que le client a accepté.
   *
   * Sur une facture SANS devis, `duDevis` est vide : tout est saisissable, et
   * le bloc de texte figé ne se dessine simplement pas.
   */
  const saisies = lignes.filter((l) => ligneSeCorrige({ devisId }, l));
  const duDevis = lignes.filter((l) => !ligneSeCorrige({ devisId }, l));
  /** Faite sans devis : les mots de l'écran changent, les gestes non. */
  const sansDevis = devisId === null;

  /**
   * Le taux de la catégorie — celui de ses lignes, ou aucun.
   *
   * `null` : elles suivent le taux de la facture, et le geste « + Ajouter une
   * TVA » est encore proposé. C'est exactement la grammaire du devis.
   */
  const tauxDesSaisies = saisies.find((l) => l.tauxTva !== null)?.tauxTva ?? null;

  const totaux = useMemo(
    () => totauxAvecReduction(lignes, tauxTvaFacture, reductionPourcent),
    [lignes, tauxTvaFacture, reductionPourcent]
  );
  const blocs = useMemo(() => lignesParBloc(lignes, tauxTvaFacture), [lignes, tauxTvaFacture]);
  const plusieursTaux = new Set(blocs.map((b) => b.taux)).size > 1;

  /** Ce que le serveur a refusé s'affiche ; le reste se tait. */
  function porter(r: { succes: boolean; erreur?: string }) {
    setErreur(r.succes ? null : (r.erreur ?? "Le geste n'a pas abouti."));
    return r.succes;
  }

  function ajouterUneLigne() {
    enTransition(async () => {
      const r = await ajouterLigneDeFactureAction(factureId, tauxDesSaisies);
      if (!porter(r) || !r.succes) return;
      setLignes((l) => [
        ...l,
        {
          id: r.ligneId,
          libelle: "",
          quantite: "1",
          prixUnitaire: "0",
          montant: "0",
          tauxTva: tauxDesSaisies,
          // **CE QUE LE SERVEUR VIENT D'ÉCRIRE, et non ce qu'on en déduit.**
          // Le redéduire ici — « supplément si la facture a un devis » — aurait
          // été une seconde rédaction de la règle du dépôt, et c'est celle-ci
          // qui aurait eu tort le jour où l'autre change : l'écran aurait
          // montré un bloc « Travaux supplémentaires » là où la base a rangé
          // une ligne ordinaire, jusqu'au prochain rechargement.
          supplement: r.supplement,
        },
      ]);
    });
  }

  /** La saisie vit à l'écran, la base se met à jour quand le doigt quitte. */
  function majLocale(id: string, champ: "libelle" | "quantite" | "prixUnitaire", valeur: string) {
    setLignes((liste) =>
      liste.map((l) => {
        if (l.id !== id) return l;
        const fraiche = { ...l, [champ]: valeur };
        return { ...fraiche, montant: montantDe(fraiche) };
      })
    );
  }

  function persister(id: string, champs: Parameters<typeof majLigneDeFactureAction>[2]) {
    enTransition(async () => {
      porter(await majLigneDeFactureAction(factureId, id, champs));
    });
  }

  function ajouterUneTva() {
    // Le second taux se pose sur TOUTES les lignes de la catégorie : c'est une
    // catégorie, pas une ligne — la même règle que sur le devis (1er septembre).
    const taux = "10.00";
    setLignes((l) => l.map((x) => (ligneSeCorrige({ devisId }, x) ? { ...x, tauxTva: taux } : x)));
    enTransition(async () => {
      for (const l of saisies) {
        porter(await majLigneDeFactureAction(factureId, l.id, { tauxTva: taux }));
      }
    });
  }

  function changerLeTaux(valeur: string) {
    const taux = new Decimal(valeur.replace(",", ".") || "0").toFixed(2);
    setLignes((l) => l.map((x) => (ligneSeCorrige({ devisId }, x) ? { ...x, tauxTva: taux } : x)));
    enTransition(async () => {
      for (const l of saisies) {
        porter(await majLigneDeFactureAction(factureId, l.id, { tauxTva: taux }));
      }
    });
  }

  function retirerLaCategorie() {
    setLignes((l) => l.filter((x) => !ligneSeCorrige({ devisId }, x)));
    enTransition(async () => {
      porter(await retirerLignesDeFactureAction(factureId));
    });
  }

  return (
    <main className="min-h-screen pb-24" style={{ backgroundColor: colors.cream }}>
      {/* **« Facture » quand il n'y a pas de devis** — le point 2 des trois
          qu'il a acceptés sur la planche : *« ça ouvre une page de FACTURE, du
          même dessin »*. Un écran qui dit « travaux en plus » sur la seule
          chose qu'on facture se photographie et s'envoie au client. */}
      <EnTeteEcran
        surtitre={numeroFacture}
        titre={sansDevis ? "Facture" : "Travaux en plus"}
        retour={{ href: `/chantiers/${chantierId}/facture`, libelle: "Retour à la facture" }}
      />

      <section
        className="mx-[12px] mt-[18px] rounded-[10px] px-5 py-7"
        style={{ backgroundColor: colors.card }}
      >
        <p className="text-[13px]" style={{ color: colors.muted }}>
          Chantier
        </p>
        <p className="mt-0.5 text-[15px]" style={{ color: colors.ink, fontFamily: font.display }}>
          {chantierNom}
          {adresseChantier ? ` — ${adresseChantier}` : ""}
        </p>
        <p className="mt-1 text-[12.5px]" style={{ color: colors.muted }}>
          {avecCivilite(clientNom, clientCivilite)}
          {numeroDevis ? ` · devis ${numeroDevis}` : ""}
        </p>

        <div
          className="mt-7 hidden pb-2 sm:grid sm:grid-cols-[1fr_70px_130px_130px] sm:gap-3"
          style={{ borderBottom: `1px solid ${colors.line}` }}
        >
          <Colonne>Description</Colonne>
          <Colonne droite>Qté</Colonne>
          <Colonne droite>Prix unitaire HT</Colonne>
          <Colonne droite>Montant HT</Colonne>
        </div>

        {/* ─── CE QUE LE CLIENT A ACCEPTÉ — du texte, jamais des champs ───── */}
        {duDevis.map((l) => (
          <div
            key={l.id}
            data-atlas="ligne-du-devis"
            className="grid w-full gap-2 py-3 sm:grid-cols-[1fr_70px_130px_130px] sm:items-start sm:gap-3"
            style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
          >
            <span className="text-[16px] leading-[1.45]" style={{ color: colors.ink }}>
              {l.libelle}
            </span>
            <Cellule libelle="Qté">
              <span className="text-[16px]">{l.quantite}</span>
            </Cellule>
            <Cellule libelle="Prix unitaire HT">
              <span className="text-[16px]">{enEuros(l.prixUnitaire)}</span>
            </Cellule>
            <Cellule libelle="Montant HT">
              <span className="text-[16px]">{enEuros(l.montant)}</span>
            </Cellule>
          </div>
        ))}

        {/* ─── LA CATÉGORIE, comme celle des TVA du devis ──────────────────
            Sa demande : *« une catégorie comme pour l'ajout d'une TVA se crée
            direct »*. C'est le même dessin — la plage teintée, les petites
            capitales, le « − » cerclé d'or de 26 px —, seul le mot change. */}
        {saisies.length > 0 && (
          <>
            {/* **Sans devis, la plage teintée disparaît — mais pas le réglage
                de TVA qu'elle portait.** « Travaux supplémentaires » au-dessus
                de la seule chose qu'on facture ne veut rien dire (point 1 des
                trois qu'il a acceptés), et une catégorie qui n'en distingue
                aucune autre est une boîte autour de rien. Le taux, lui, reste
                réglable : il commande TOUTES les lignes, exactement comme sur
                le devis. */}
            <div
              data-atlas={sansDevis ? "categorie-lignes" : "categorie-supplement"}
              className="mt-5 flex items-center justify-between gap-3 rounded-md px-3 py-1.5"
              style={{ backgroundColor: sansDevis ? "transparent" : colors.rustTint }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: colors.rust }}
              >
                {sansDevis ? "" : "Travaux supplémentaires"}
              </span>
              <span className="flex items-center gap-2">
                {tauxDesSaisies !== null && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: colors.rust }}
                  >
                    TVA
                    <input
                      defaultValue={tauxLisible(tauxDesSaisies)}
                      inputMode="decimal"
                      aria-label={sansDevis ? "Taux de TVA des lignes" : "Taux de TVA des travaux supplémentaires"}
                      onBlur={(e) => changerLeTaux(e.target.value)}
                      className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[var(--voile-champ-teinte)]"
                      style={{ color: colors.ink, fontSize: "16px" }}
                    />
                    %
                  </span>
                )}
                <button
                  type="button"
                  aria-label={sansDevis ? "Retirer toutes les lignes" : "Retirer les travaux supplémentaires"}
                  data-atlas="retirer-supplement"
                  onClick={retirerLaCategorie}
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
                  style={{ border: `1px solid ${colors.or}`, color: colors.or }}
                >
                  −
                </button>
              </span>
            </div>

            {saisies.map((l, i) => (
              <div
                key={l.id}
                data-atlas="ligne-supplement"
                className="grid w-full gap-2 py-3 sm:grid-cols-[1fr_70px_130px_130px] sm:items-start sm:gap-3"
                style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
              >
                <ZoneQuiGrandit
                  valeur={l.libelle}
                  aria={`${sansDevis ? "Description de la ligne" : "Description du travail supplémentaire"} ${i + 1}`}
                  fige={false}
                  placeholder="Ex : dessouchage de la haie"
                  onChange={(v) => majLocale(l.id, "libelle", v)}
                  onFini={(fraiche) => persister(l.id, { libelle: fraiche })}
                  className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none focus:bg-[var(--voile-champ)]"
                  style={{ color: colors.ink, fontSize: "16px", lineHeight: 1.45 }}
                />
                <Cellule libelle="Qté">
                  <ChiffreSaisi
                    valeur={l.quantite}
                    aria={`${sansDevis ? "Quantité de la ligne" : "Quantité du travail supplémentaire"} ${i + 1}`}
                    fige={false}
                    placeholder="1"
                    onChange={(v) => majLocale(l.id, "quantite", v)}
                    onFini={(fraiche) => persister(l.id, { quantite: fraiche })}
                  />
                </Cellule>
                <Cellule libelle="Prix unitaire HT">
                  <ChiffreSaisi
                    valeur={l.prixUnitaire}
                    aria={`${sansDevis ? "Prix unitaire de la ligne" : "Prix unitaire du travail supplémentaire"} ${i + 1}`}
                    fige={false}
                    placeholder="0,00"
                    onChange={(v) => majLocale(l.id, "prixUnitaire", v)}
                    onFini={(fraiche) => persister(l.id, { prixUnitaire: fraiche })}
                  />
                </Cellule>
                <Cellule libelle="Montant HT">
                  {/* **« à chiffrer » n'est pas « 0,00 € »** — sa correction du
                      26 août 2026 : un zéro se lit « gratuit », et la pièce
                      pouvait partir ainsi. */}
                  {ligneAttendSonPrix({ libelle: l.libelle, montant: l.montant, aChiffrer: false }) ? (
                    <span className="text-[16px]" style={{ color: colors.or }}>
                      à chiffrer
                    </span>
                  ) : (
                    <span className="text-[16px]">{enEuros(l.montant)}</span>
                  )}
                </Cellule>
              </div>
            ))}
          </>
        )}

        {/* **Le geste dit CE QU'IL AJOUTE, pas « une ligne »** — sa correction
            du 9 septembre 2026, l'écran sous les yeux : *« il ne faut pas qu'il
            y ait marqué "ajouter une ligne" mais "ajouter travaux
            supplémentaires", en plus gros, le même doré que l'appli, avec
            le + »*.

            Il a raison au-delà du mot : sur une facture dont la catégorie est
            encore VIDE, ce bouton est la seule porte d'entrée — et « ajouter
            une ligne » ne dit pas à quoi. C'est aussi pour cela qu'il n'y a
            qu'un seul libellé, catégorie vide ou non : deux mots pour un même
            geste, c'est la règle dupliquée que `CLAUDE.md` §3 refuse. */}
        <button
          type="button"
          data-atlas="ajouter-ligne-supplement"
          onClick={ajouterUneLigne}
          className="mt-5 text-[17px] font-semibold"
          style={{ color: colors.or }}
        >
          {sansDevis ? "+ Ajouter une ligne" : "+ Ajouter des travaux supplémentaires"}
        </button>

        {saisies.length > 0 && tauxDesSaisies === null && (
          <button
            type="button"
            data-atlas="ajouter-tva-supplement"
            onClick={ajouterUneTva}
            className="mt-5 block text-[14px] font-medium"
            style={{ color: colors.or }}
          >
            + Ajouter une TVA
          </button>
        )}

        {erreur && (
          <p className="mt-4 text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}

        {/* ─── LES TOTAUX — une ligne par taux, comme sur le devis ────────── */}
        <div className="mt-7 pt-4" style={{ borderTop: `1px solid ${colors.line}` }}>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[15px]">Total HT</span>
            <span className="text-[15px]">{enEuros(totaux.totalHt)}</span>
          </div>
          {totaux.parTaux.map((c) => (
            <div key={c.taux} className="flex items-center justify-between py-1.5">
              <span className="text-[15px]">
                TVA ({tauxLisible(c.taux)} %){plusieursTaux ? "" : ""}
              </span>
              <span className="text-[15px]">{enEuros(c.tva)}</span>
            </div>
          ))}
          <div
            className="mt-1 flex items-center justify-between pt-2.5"
            style={{ borderTop: `2px solid ${colors.ink}` }}
          >
            <span className="text-[17px] font-semibold">Total TTC</span>
            <span
              data-atlas="total-ttc"
              className="text-[20px] font-semibold"
              style={{ fontFamily: font.display }}
            >
              {enEuros(totaux.totalTtc)}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-[26px] mt-6">
        <PrimaryButton onClick={() => router.push(`/chantiers/${chantierId}/facture`)} repere="revenir-a-la-facture">
          Revenir à la facture
        </PrimaryButton>
        {/* **Rien à rassurer quand il n'y a pas de devis.** Cette ligne existe
            pour lever une inquiétude précise — celle de réécrire ce que le
            client a accepté. Sans devis, elle nommerait un document qui
            n'existe pas, et c'est le genre de phrase qui apprend à ne plus lire
            les autres (`CLAUDE.md` §3 : le moins de mots possible). */}
        {!sansDevis && (
          <p className={`mt-3 text-center ${smallCaps}`} style={{ color: colors.muted }}>
            Le devis d’origine ne bouge pas
          </p>
        )}
      </div>
    </main>
  );
}

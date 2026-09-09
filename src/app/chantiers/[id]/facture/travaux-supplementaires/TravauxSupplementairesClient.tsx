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
  ajouterTravauxSupplementairesAction,
  majTravauxSupplementairesAction,
  retirerTravauxSupplementairesAction,
} from "../actions";

/**
 * ─── LA FEUILLE DES TRAVAUX SUPPLÉMENTAIRES ────────────────────────────────
 *
 * Sa demande du 9 septembre 2026, et sa règle dans la foulée : *« le devis ne
 * se réécrit pas, seulement la case travaux supplémentaires ; le reste,
 * impossible de les modifier »*.
 *
 * **Les lignes du devis sont donc du TEXTE, pas des champs.** Ce n'est pas un
 * champ « en lecture seule » qu'on pourrait rouvrir d'un attribut : ce sont des
 * `<span>`. Le refus vit aussi dans l'écriture (`majTravauxSupplementaires` ne
 * touche que `supplement = true`), et les deux gardes valent mieux qu'une : la
 * première évite le geste, la seconde le rend impossible.
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
  tauxTvaFacture: string;
  reductionPourcent: string | null;
  lignes: LigneEcran[];
}) {
  const router = useRouter();
  const [lignes, setLignes] = useState<LigneEcran[]>(lignesInitiales);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, enTransition] = useTransition();

  const duDevis = lignes.filter((l) => !l.supplement);
  const supplements = lignes.filter((l) => l.supplement);

  /**
   * Le taux de la catégorie — celui de ses lignes, ou aucun.
   *
   * `null` : elles suivent le taux de la facture, et le geste « + Ajouter une
   * TVA » est encore proposé. C'est exactement la grammaire du devis.
   */
  const tauxDuSupplement = supplements.find((l) => l.tauxTva !== null)?.tauxTva ?? null;

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
      const r = await ajouterTravauxSupplementairesAction(factureId, tauxDuSupplement);
      if (!porter(r) || !r.succes || !r.ligneId) return;
      setLignes((l) => [
        ...l,
        {
          id: r.ligneId!,
          libelle: "",
          quantite: "1",
          prixUnitaire: "0",
          montant: "0",
          tauxTva: tauxDuSupplement,
          supplement: true,
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

  function persister(id: string, champs: Parameters<typeof majTravauxSupplementairesAction>[2]) {
    enTransition(async () => {
      porter(await majTravauxSupplementairesAction(factureId, id, champs));
    });
  }

  function ajouterUneTva() {
    // Le second taux se pose sur TOUTES les lignes de la catégorie : c'est une
    // catégorie, pas une ligne — la même règle que sur le devis (1er septembre).
    const taux = "10.00";
    setLignes((l) => l.map((x) => (x.supplement ? { ...x, tauxTva: taux } : x)));
    enTransition(async () => {
      for (const l of supplements) {
        porter(await majTravauxSupplementairesAction(factureId, l.id, { tauxTva: taux }));
      }
    });
  }

  function changerLeTaux(valeur: string) {
    const taux = new Decimal(valeur.replace(",", ".") || "0").toFixed(2);
    setLignes((l) => l.map((x) => (x.supplement ? { ...x, tauxTva: taux } : x)));
    enTransition(async () => {
      for (const l of supplements) {
        porter(await majTravauxSupplementairesAction(factureId, l.id, { tauxTva: taux }));
      }
    });
  }

  function retirerLaCategorie() {
    setLignes((l) => l.filter((x) => !x.supplement));
    enTransition(async () => {
      porter(await retirerTravauxSupplementairesAction(factureId));
    });
  }

  return (
    <main className="min-h-screen pb-24" style={{ backgroundColor: colors.cream }}>
      <EnTeteEcran
        surtitre={numeroFacture}
        titre="Travaux en plus"
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
        {supplements.length > 0 && (
          <>
            <div
              data-atlas="categorie-supplement"
              className="mt-5 flex items-center justify-between gap-3 rounded-md px-3 py-1.5"
              style={{ backgroundColor: colors.rustTint }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: colors.rust }}
              >
                Travaux supplémentaires
              </span>
              <span className="flex items-center gap-2">
                {tauxDuSupplement !== null && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: colors.rust }}
                  >
                    TVA
                    <input
                      defaultValue={tauxLisible(tauxDuSupplement)}
                      inputMode="decimal"
                      aria-label="Taux de TVA des travaux supplémentaires"
                      onBlur={(e) => changerLeTaux(e.target.value)}
                      className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[var(--voile-champ-teinte)]"
                      style={{ color: colors.ink, fontSize: "16px" }}
                    />
                    %
                  </span>
                )}
                <button
                  type="button"
                  aria-label="Retirer les travaux supplémentaires"
                  data-atlas="retirer-supplement"
                  onClick={retirerLaCategorie}
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
                  style={{ border: `1px solid ${colors.or}`, color: colors.or }}
                >
                  −
                </button>
              </span>
            </div>

            {supplements.map((l, i) => (
              <div
                key={l.id}
                data-atlas="ligne-supplement"
                className="grid w-full gap-2 py-3 sm:grid-cols-[1fr_70px_130px_130px] sm:items-start sm:gap-3"
                style={{ borderBottom: `1px solid ${colors.lineSoft}` }}
              >
                <ZoneQuiGrandit
                  valeur={l.libelle}
                  aria={`Description du travail supplémentaire ${i + 1}`}
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
                    aria={`Quantité du travail supplémentaire ${i + 1}`}
                    fige={false}
                    placeholder="1"
                    onChange={(v) => majLocale(l.id, "quantite", v)}
                    onFini={(fraiche) => persister(l.id, { quantite: fraiche })}
                  />
                </Cellule>
                <Cellule libelle="Prix unitaire HT">
                  <ChiffreSaisi
                    valeur={l.prixUnitaire}
                    aria={`Prix unitaire du travail supplémentaire ${i + 1}`}
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
          + Ajouter des travaux supplémentaires
        </button>

        {supplements.length > 0 && tauxDuSupplement === null && (
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
        <p className={`mt-3 text-center ${smallCaps}`} style={{ color: colors.muted }}>
          Le devis d’origine ne bouge pas
        </p>
      </div>
    </main>
  );
}

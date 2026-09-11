"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, smallCaps } from "@/lib/design-tokens";
import { avecCivilite } from "@/lib/civilite";
import { ligneAttendSonPrix, prixAEcrire } from "@/lib/preparation-devis";
import {
  lignesParBloc,
  lignesParCategorie,
  tauxDeLaLigne,
  tauxLisible,
  tauxTvaPropose,
  tauxTvaValide,
  totauxAvecReduction,
} from "@/lib/reduction-devis";
import {
  Cellule,
  ChiffreSaisi,
  Colonne,
  sansZerosInutiles,
  ZoneQuiGrandit,
} from "../../devis-complet/ChampsDuDevis";
import {
  ajouterLigneDeFactureAction,
  majLigneDeFactureAction,
  majReductionFactureAction,
  retirerLignesDeFactureAction,
} from "../actions";
import {
  BoutonPrixAccorde,
  LignePrixAccorde,
  REMISE_PAR_DEFAUT,
} from "@/components/atlas/PrixAccordeAuClient";
// Le formateur du dépôt, au lieu de la copie qui vivait ici : deux façons
// d'écrire un euro finissent par s'écrire différemment (`CLAUDE.md` §3).
import { enEuros } from "@/lib/euros";
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
  /**
   * ─── LE CHAMP DU PRIX NE PORTE PAS DE ZÉRO ──────────────────────────────
   *
   * **Sa capture du 11 septembre 2026, la seconde :** *« le problème pour
   * rentrer les montants n'a pas été résolu, regarde le 0 est toujours
   * présent »* — la case affichait **0250**.
   *
   * La règle avait bien été écrite le matin même (`prixAEcrire`), et elle
   * n'avait été branchée que sur le DEVIS. La facture, qui emploie pourtant
   * les mêmes champs, recevait le zéro de la base tel quel : c'est la règle
   * appliquée à un seul des deux écrans que `CLAUDE.md` §3 refuse.
   *
   * **La règle ne connaît plus d'exception** — sa décision du 11 septembre au
   * soir : une case de montant ne porte jamais de zéro, ici comme ailleurs. Le
   * montant calculé, lui, reste affiché à côté.
   *
   * **Et c'est une VALEUR DE DÉPART, pas un affichage recalculé à chaque
   * frappe** : dérivé au rendu, le champ se viderait au premier « 0 » tapé, et
   * « 0,50 » deviendrait impossible à écrire.
   */
  const [lignes, setLignes] = useState<LigneEcran[]>(() =>
    lignesInitiales.map((l) => ({
      ...l,
      quantite: sansZerosInutiles(l.quantite),
      prixUnitaire: prixAEcrire(sansZerosInutiles(l.prixUnitaire)),
    }))
  );
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
   * ─── LES CATÉGORIES DE TVA, ET NON PLUS UN TAUX UNIQUE ───────────────────
   *
   * **Sa capture du 11 septembre 2026 :** *« je ne peux pas ajouter plusieurs
   * TVA ; lorsque j'en mets une, le bouton disparaît »*.
   *
   * Il avait raison deux fois. Le geste posait 10 % **sur toutes les lignes**
   * au lieu d'ouvrir une catégorie, et le bouton se cachait ensuite — un écran
   * où le second taux était non pas difficile, mais impossible.
   *
   * **La grammaire n'est pas neuve : c'est celle du devis**, qu'il a tranchée
   * le 1er septembre 2026 — *« j'appuie sur ajouter une TVA, une catégorie
   * s'ajoute et là je mets toutes mes lignes qui seront en TVA à 10 »*. Elle
   * est reprise telle quelle, avec les MÊMES fonctions
   * (`lignesParCategorie`, `tauxTvaPropose`) : deux grammaires pour un même
   * geste, c'est ce que `CLAUDE.md` §3 refuse, et c'est exactement ce qui
   * l'avait bloqué.
   */
  const categories = useMemo(
    () => lignesParCategorie(saisies, tauxTvaFacture),
    [saisies, tauxTvaFacture]
  );

  /**
   * ─── LE PRIX ACCORDÉ AU CLIENT ──────────────────────────────────────────
   *
   * **Sa demande du 11 septembre 2026 :** *« on n'a pas mis la réduction client
   * cliquable comme sur le devis »*, puis *« reprends exactement celle du devis
   * — couleur, forme, mots »*.
   *
   * La facture savait AFFICHER une remise reprise du devis ; elle n'avait aucun
   * moyen d'en poser une. Le geste est celui du devis, monté depuis la même
   * pièce (`PrixAccordeAuClient`) — recopié, il aurait divergé au premier
   * ajustement.
   */
  const [reduction, setReduction] = useState(reductionPourcent ?? "");
  const [remiseOuverte, setRemiseOuverte] = useState(reductionPourcent !== null);

  const totaux = useMemo(
    () => totauxAvecReduction(lignes, tauxTvaFacture, remiseOuverte ? reduction : null),
    [lignes, tauxTvaFacture, remiseOuverte, reduction]
  );
  const blocs = useMemo(() => lignesParBloc(lignes, tauxTvaFacture), [lignes, tauxTvaFacture]);
  const plusieursTaux = new Set(blocs.map((b) => b.taux)).size > 1;

  /** Ce que le serveur a refusé s'affiche ; le reste se tait. */
  function porter(r: { succes: boolean; erreur?: string }) {
    setErreur(r.succes ? null : (r.erreur ?? "Le geste n'a pas abouti."));
    return r.succes;
  }

  /** Une ligne de plus, dans la catégorie où le doigt a appuyé. */
  function ajouterUneLigne(taux: string | null) {
    enTransition(async () => {
      const r = await ajouterLigneDeFactureAction(factureId, taux);
      if (!porter(r) || !r.succes) return;
      setLignes((l) => [
        ...l,
        {
          id: r.ligneId,
          libelle: "",
          quantite: "1",
          // Vide, et non « 0 » : c'est ce que le doigt trouve en arrivant dans
          // la case. La base, elle, garde son zéro — la colonne l'exige.
          prixUnitaire: "",
          montant: "0",
          tauxTva: taux,
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

  /**
   * Une CATÉGORIE de plus — une ligne vierge sous un taux qui n'est pas encore
   * ouvert. Les lignes déjà écrites ne bougent pas : leur taux est le sien.
   */
  function ajouterUneTva() {
    ajouterUneLigne(tauxTvaPropose(categories.map((c) => c.taux)));
  }

  /**
   * La remise s'enregistre, et l'écran se referme sur ce que le SERVEUR a
   * retenu — jamais sur ce qu'il a tapé. Une case vidée, « 0 », ou une saisie
   * illisible valent toutes « aucune réduction » (`pourcentValide`) : comparer
   * la chaîne brute laisserait une ligne dorée « … 0 % » sans montant pendant
   * que la base n'en porte plus aucune. C'est le défaut que le patron a signalé
   * sur le devis le 17 août 2026.
   */
  function enregistrerLaRemise(valeurBrute: string = reduction) {
    const valeur = valeurBrute.trim() || null;
    enTransition(async () => {
      const r = await majReductionFactureAction(factureId, valeur);
      if (!porter(r) || !r.succes) return;
      if (r.reductionPourcent === null) {
        setReduction("");
        setRemiseOuverte(false);
      }
    });
  }

  /** Les lignes d'une catégorie — celles que ce taux-là commande. */
  function lignesDe(taux: string): LigneEcran[] {
    return saisies.filter((l) => tauxDeLaLigne(l, tauxTvaFacture) === taux);
  }

  /** Le taux d'UNE catégorie change : ses lignes suivent, les autres non. */
  function changerLeTaux(ancien: string, valeur: string) {
    const taux = tauxTvaValide(valeur);
    if (taux === null || taux === ancien) return;
    const concernees = lignesDe(ancien);
    const ids = new Set(concernees.map((l) => l.id));
    setLignes((l) => l.map((x) => (ids.has(x.id) ? { ...x, tauxTva: taux } : x)));
    enTransition(async () => {
      for (const l of concernees) {
        porter(await majLigneDeFactureAction(factureId, l.id, { tauxTva: taux }));
      }
    });
  }

  /**
   * Retirer une catégorie, et ELLE SEULE.
   *
   * Le retrait passe par l'identifiant de chaque ligne : l'appel sans
   * identifiant vide la facture entière, ce qui emporterait les autres taux —
   * invisible tant qu'il n'y en avait qu'un.
   */
  function retirerLaCategorie(taux: string) {
    const concernees = lignesDe(taux);
    const ids = new Set(concernees.map((l) => l.id));
    setLignes((l) => l.filter((x) => !ids.has(x.id)));
    enTransition(async () => {
      for (const l of concernees) {
        porter(await retirerLignesDeFactureAction(factureId, l.id));
      }
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
        {/* ─── UNE CATÉGORIE PAR TAUX ──────────────────────────────────────
            Sa demande : *« une catégorie comme pour l'ajout d'une TVA se crée
            direct »* — et, le 11 septembre, *« je ne peux pas ajouter
            plusieurs TVA »*. Le dessin est celui du devis : la plage teintée,
            le taux réglable d'un doigt, le « − » qui retire.

            **Sans devis, la plage teintée disparaît, mais pas le réglage
            qu'elle porte.** « Travaux supplémentaires » au-dessus de la seule
            chose qu'on facture ne veut rien dire.

            **Le taux ne s'écrit que si la ligne en porte un.** Un titre
            « TVA 20 % » au-dessus d'un tableau qui n'a qu'un taux serait du
            bruit sur toutes ses factures — la règle du devis, mot pour mot. */}
        {categories.map((categorie) => {
          const explicite = categorie.lignes.some((l) => l.tauxTva !== null);
          // **Dès qu'il y a deux taux, CHACUN se nomme — la première catégorie
          // comprise.** Sans cela, les lignes restées au taux de la facture
          // seraient les seules sans étiquette : on lirait « 250 » sous deux
          // bandeaux nommés sans savoir à quel taux cette ligne-là appartient.
          // C'est la règle du devis, mot pour mot (`plusieursTva`).
          const nomme = explicite || categories.length > 1;
          return (
            <div key={categorie.taux}>
              {(nomme || !sansDevis) && (
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
                    {nomme && (
                      <span
                        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: colors.rust }}
                      >
                        TVA
                        <input
                          defaultValue={tauxLisible(categorie.taux)}
                          inputMode="decimal"
                          aria-label={`Taux de TVA à ${tauxLisible(categorie.taux)} %`}
                          onBlur={(e) => changerLeTaux(categorie.taux, e.target.value)}
                          className="w-9 border-0 bg-transparent p-0 text-right outline-none focus:bg-[var(--voile-champ-teinte)]"
                          style={{ color: colors.ink, fontSize: "16px" }}
                        />
                        %
                      </span>
                    )}
                    {categorie.lignes.length > 0 && (
                      <button
                        type="button"
                        aria-label={
                          sansDevis
                            ? `Retirer les lignes à ${tauxLisible(categorie.taux)} %`
                            : "Retirer les travaux supplémentaires"
                        }
                        data-atlas="retirer-supplement"
                        onClick={() => retirerLaCategorie(categorie.taux)}
                        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[15px] leading-none"
                        style={{ border: `1px solid ${colors.or}`, color: colors.or }}
                      >
                        −
                      </button>
                    )}
                  </span>
                </div>
              )}

              {categorie.lignes.map((l, i) => (
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

              {/* **Le geste dit CE QU'IL AJOUTE, pas « une ligne »** — sa
                  correction du 9 septembre 2026 : *« il ne faut pas qu'il y ait
                  marqué "ajouter une ligne" mais "ajouter travaux
                  supplémentaires", en plus gros, le même doré que l'appli »*.

                  **Il vit DANS sa catégorie** depuis le 11 septembre : avec
                  deux taux à l'écran, un bouton posé en dessous ne dirait pas
                  auquel des deux il ajoute — et poser la ligne au mauvais taux
                  ne se verrait qu'au total. */}
              <button
                type="button"
                data-atlas="ajouter-ligne-supplement"
                onClick={() => ajouterUneLigne(explicite ? categorie.taux : null)}
                className="mt-5 text-[17px] font-semibold"
                style={{ color: colors.or }}
              >
                {sansDevis ? "+ Ajouter une ligne" : "+ Ajouter des travaux supplémentaires"}
              </button>
            </div>
          );
        })}

        {/* **« + Ajouter une TVA » ne disparaît plus.** Il se cachait dès qu'un
            taux était posé : le second était alors hors d'atteinte, et c'est ce
            qu'il a signalé le 11 septembre 2026. */}
        <button
          type="button"
          data-atlas="ajouter-tva-supplement"
          onClick={ajouterUneTva}
          className="mt-5 block text-[14px] font-medium"
          style={{ color: colors.or }}
        >
          + Ajouter une TVA
        </button>

        {erreur && (
          <p className="mt-4 text-[13px]" style={{ color: colors.alert }}>
            {erreur}
          </p>
        )}

        {/* ─── LES TOTAUX — une ligne par taux, comme sur le devis ────────── */}
        <div className="mt-7 pt-4" style={{ borderTop: `1px solid ${colors.line}` }}>
          {/* **Le prix plein d'abord, ce qui a été consenti dessous, puis le
              net** — l'arrangement du devis, choisi le 16 août 2026 : c'est ce
              qui permet au client de refaire le calcul. Sans remise, rien de
              tout cela ne s'affiche : une ligne « Prix accordé au client — % »
              sur une facture qui n'en porte pas contredirait le document. */}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[15px]">Total HT</span>
            <span className="text-[15px]">
              {enEuros(remiseOuverte ? totaux.brutHt : totaux.totalHt)}
            </span>
          </div>
          {remiseOuverte && (
            <>
              <LignePrixAccorde
                pourcent={reduction}
                montantRetire={totaux.reductionMontant}
                onChange={setReduction}
                onFini={() => enregistrerLaRemise()}
                onRetirer={() => enregistrerLaRemise("")}
              />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[15px]">
                  {totaux.reductionPourcent === null ? "Total HT" : "Total HT après remise"}
                </span>
                <span className="text-[15px]">{enEuros(totaux.totalHt)}</span>
              </div>
            </>
          )}
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

          {!remiseOuverte && (
            <BoutonPrixAccorde
              onPoser={() => {
                setRemiseOuverte(true);
                setReduction(REMISE_PAR_DEFAUT);
                enregistrerLaRemise(REMISE_PAR_DEFAUT);
              }}
            />
          )}
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

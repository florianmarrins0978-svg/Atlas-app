"use client";

import { useState } from "react";
import BottomSheet from "@/components/atlas/BottomSheet";
import IconeTrait from "@/components/atlas/IconeTrait";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import {
  DUREES_MAIN_OEUVRE,
  ligneDeSonEquipe,
  ligneDeSonPartenaire,
  montantDeLaMainOeuvre,
  quantiteTapee,
  rangDeLaDuree,
  type PrixDePartenaire,
} from "@/lib/feuille-main-oeuvre";
import type { ChoixDeMainOeuvre } from "./actions";

/**
 * ─── LA FEUILLE « MAIN D'ŒUVRE » — sa planche du 1er novembre 2026 ───────────
 *
 * « + Main d'œuvre » posait une ligne vide où taper un montant. La feuille
 * montre le calcul AVANT d'ajouter : son équipe, avec les hommes et la durée
 * repris de sa dictée et son prix du jour par homme ; ou, par la pastille
 * « Mes partenaires » à droite du titre (son idée du même soir), le prix d'un
 * de ses partenaires, multiplié par sa marge. Les règles sont dans
 * `src/lib/feuille-main-oeuvre.ts`, et l'action les rejoue côté serveur.
 */
export type DonneesMainOeuvre = {
  hommes: number | null;
  jours: number | null;
  tarifJour: string | null;
  partenaires: PrixDePartenaire[];
};

type Props = {
  ouverte: boolean;
  donnees: DonneesMainOeuvre;
  onValider: (choix: ChoixDeMainOeuvre) => void;
  onFermer: () => void;
};

export default function FeuilleMainDoeuvre(props: Props) {
  // Le contenu ne vit que feuille ouverte : chaque ouverture repart de la
  // dictée et de ses tarifs, jamais d'un essai abandonné.
  return (
    <BottomSheet open={props.ouverte} onBackdropClick={props.onFermer}>
      <Contenu {...props} />
    </BottomSheet>
  );
}

const virgule = (n: number | string) => String(n).replace(".", ",");
const sansCentimes = (prix: string) => enEuros(prix).replace(/,00(?=\s*€)/, "");

/** « 3 jours », « 6,5 heures », « 40 ml » : l'unité du partenaire, dite comme il la dit. */
function enUnite(unite: string, n: number): string {
  const pluriel = n > 1;
  const mot: Record<string, [string, string]> = {
    journée: ["jour", "jours"],
    jour: ["jour", "jours"],
    heure: ["heure", "heures"],
    h: ["heure", "heures"],
    forfait: ["forfait", "forfaits"],
  };
  const m = mot[unite];
  return `${virgule(n)} ${m ? m[pluriel ? 1 : 0] : unite}`;
}

/** « 380 € la journée », « 32 € le m² » : le prix tel qu'il le lit sur sa fiche. */
function prixEnMots(p: PrixDePartenaire): string {
  const article: Record<string, string> = { journée: "la journée", heure: "l’heure", forfait: "le forfait" };
  return `${sansCentimes(p.prixHt)} ${article[p.unite] ?? `le ${p.unite}`}`;
}

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
}

function Initiales({ nom }: { nom: string }) {
  return (
    <span
      className="grid h-9 w-9 flex-none place-items-center rounded-full text-[14px]"
      style={{ fontFamily: font.display, color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.6)}` }}
      aria-hidden="true"
    >
      {initiales(nom)}
    </span>
  );
}

function Compteur({
  valeur,
  moins,
  plus,
  peutMoins,
  repere,
  nom,
}: {
  valeur: string;
  moins: () => void;
  plus: () => void;
  peutMoins: boolean;
  repere: string;
  nom: string;
}) {
  const rond = "grid h-11 w-11 place-items-center rounded-full disabled:opacity-40";
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={moins}
        disabled={!peutMoins}
        aria-label={`${nom}, moins`}
        data-atlas={`${repere}-moins`}
        className={rond}
        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
      >
        <IconeTrait nom="moins" taille={20} />
      </button>
      <output className="min-w-[68px] text-center text-[19px]" style={{ fontFamily: font.display, color: colors.ink }} data-atlas={repere}>
        {valeur}
      </output>
      <button
        type="button"
        onClick={plus}
        aria-label={`${nom}, plus`}
        data-atlas={`${repere}-plus`}
        className={rond}
        style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
      >
        <IconeTrait nom="plus" taille={20} />
      </button>
    </div>
  );
}

function Rang({ titre, sous, children }: { titre: string; sous: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3" style={{ boxShadow: `inset 0 -1px 0 ${colors.line}` }}>
      <div className="min-w-0">
        <p className="text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
          {titre}
        </p>
        <p className="text-[14px]" style={{ color: colors.inkSoft }}>
          {sous}
        </p>
      </div>
      {children}
    </div>
  );
}

function Contenu({ donnees, onValider, onFermer }: Props) {
  const [vue, setVue] = useState<"calcul" | "liste">("calcul");
  const [qui, setQui] = useState<PrixDePartenaire | null>(null);
  const [hommes, setHommes] = useState(Math.min(20, Math.max(1, donnees.hommes ?? 1)));
  const [rang, setRang] = useState(rangDeLaDuree(donnees.jours));
  const [tarif, setTarif] = useState(donnees.tarifJour ? virgule(Number(donnees.tarifJour)) : "");
  const [quantite, setQuantite] = useState("1");

  const alaJournee = qui !== null && (qui.unite === "journée" || qui.unite === "jour");
  const tarifLu = quantiteTapee(tarif);
  const quantitePartenaire = qui === null ? null : alaJournee ? DUREES_MAIN_OEUVRE[rang].jours : quantiteTapee(quantite);
  const ligne =
    qui === null
      ? ligneDeSonEquipe(hommes, DUREES_MAIN_OEUVRE[rang].jours, tarifLu === null ? null : String(tarifLu))
      : quantitePartenaire === null
        ? null
        : ligneDeSonPartenaire(qui, quantitePartenaire);
  const montant = ligne ? montantDeLaMainOeuvre(ligne) : null;

  const calcul =
    qui === null
      ? tarifLu === null
        ? "Sans prix du jour par homme, la ligne arrivera à chiffrer."
        : `${hommes} ${hommes > 1 ? "hommes" : "homme"} × ${DUREES_MAIN_OEUVRE[rang].libelle} × ${virgule(tarifLu)} €`
      : qui.marge === null
        ? "Sans marge sur la main d’œuvre, la ligne arrivera à chiffrer."
        : quantitePartenaire === null
          ? "Écrivez une quantité au-dessus de zéro."
          : `${enUnite(qui.unite, quantitePartenaire)} × ${sansCentimes(qui.prixHt)} × ${virgule(Number(qui.marge).toFixed(2))}`;

  function choisir(p: PrixDePartenaire) {
    setQui(p);
    setVue("calcul");
    setQuantite("1");
  }
  function revenirASonEquipe() {
    setQui(null);
    setVue("calcul");
  }

  // Les prix rangés sous leur partenaire, dans l'ordre où ils arrivent.
  const parSociete = donnees.partenaires.reduce<Map<string, PrixDePartenaire[]>>((m, p) => {
    m.set(p.societeNom, [...(m.get(p.societeNom) ?? []), p]);
    return m;
  }, new Map());

  return (
    <div data-atlas="feuille-mo">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
          Main d’œuvre
        </p>
        <button
          type="button"
          aria-pressed={qui !== null}
          onClick={() => setVue(vue === "liste" ? "calcul" : "liste")}
          data-atlas="mo-partenaires"
          className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 pr-3.5 text-[14.5px] font-semibold"
          style={
            qui !== null
              ? { color: surPlein, backgroundColor: colors.or }
              : { color: colors.or, boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.6)}` }
          }
        >
          <IconeTrait nom="equipe" taille={18} />
          Mes partenaires
        </button>
      </div>

      {vue === "liste" ? (
        <div data-atlas="mo-liste">
          {parSociete.size === 0 ? (
            <p className="py-3 text-[15px]" style={{ color: colors.inkSoft }}>
              Aucun prix de partenaire. Ils se notent dans Réglages, Fournisseurs et partenaires.
            </p>
          ) : (
            <ul>
              {[...parSociete.entries()].map(([societe, prix], i) => (
                <li key={societe} style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
                  <div className="flex items-center gap-2.5 pb-0.5 pt-3">
                    <Initiales nom={societe} />
                    <p className="flex-1 text-[18px]" style={{ fontFamily: font.display, color: colors.ink }}>
                      {societe}
                    </p>
                    <span className="text-[14px] tabular-nums" style={{ color: colors.inkSoft }}>
                      {prix[0].marge === null ? "sans marge" : `× ${virgule(Number(prix[0].marge).toFixed(2))}`}
                    </span>
                  </div>
                  {prix.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choisir(p)}
                      data-atlas={`mo-prix-${p.id}`}
                      className="flex min-h-[52px] w-full items-center justify-between gap-2.5 rounded-[10px] py-1.5 pl-[46px] pr-1 text-left text-[15.5px]"
                      style={{ color: colors.ink }}
                    >
                      <span>{p.nom}</span>
                      <b className="whitespace-nowrap font-semibold tabular-nums">{prixEnMots(p)}</b>
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={revenirASonEquipe}
            className="mt-4 min-h-[52px] w-full rounded-full text-[16px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Mon équipe
          </button>
        </div>
      ) : (
        <div>
          {qui !== null && (
            <div className="mb-1 flex items-center gap-2.5 rounded-[12px] py-2.5 pl-3 pr-2" style={{ backgroundColor: voile(colors.or, 0.13) }}>
              <Initiales nom={qui.societeNom} />
              <div className="min-w-0 flex-1">
                <p className="text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
                  {qui.societeNom}
                </p>
                <p className="text-[13.5px]" style={{ color: colors.inkSoft }}>
                  {qui.nom}, {prixEnMots(qui)}
                </p>
              </div>
              <button
                type="button"
                onClick={revenirASonEquipe}
                aria-label="Revenir à mon équipe"
                data-atlas="mo-revenir"
                className="grid h-11 w-11 flex-none place-items-center rounded-full"
                style={{ color: colors.inkSoft }}
              >
                <IconeTrait nom="croix" taille={20} />
              </button>
            </div>
          )}

          {qui === null && (
            <Rang titre="Hommes" sous={donnees.hommes ? "Repris de votre dictée" : "Votre équipe"}>
              <Compteur
                nom="Hommes"
                repere="mo-hommes"
                valeur={String(hommes)}
                peutMoins={hommes > 1}
                moins={() => setHommes((h) => Math.max(1, h - 1))}
                plus={() => setHommes((h) => Math.min(20, h + 1))}
              />
            </Rang>
          )}

          {qui === null || alaJournee ? (
            <Rang titre="Durée" sous={qui === null && donnees.jours ? "Repris de votre dictée" : "À poser"}>
              <Compteur
                nom="Durée"
                repere="mo-duree"
                valeur={DUREES_MAIN_OEUVRE[rang].libelle}
                peutMoins={rang > 0}
                moins={() => setRang((r) => Math.max(0, r - 1))}
                plus={() => setRang((r) => Math.min(DUREES_MAIN_OEUVRE.length - 1, r + 1))}
              />
            </Rang>
          ) : (
            <Rang titre={qui.unite === "heure" || qui.unite === "h" ? "Heures" : `Quantité, en ${qui.unite}`} sous="À taper">
              <input
                inputMode="decimal"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                aria-label={`Quantité, en ${qui.unite}`}
                data-atlas="mo-quantite"
                className="h-11 w-[104px] rounded-[10px] border-0 px-3 text-right text-[17px] outline-none"
                style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
              />
            </Rang>
          )}

          {qui === null ? (
            <Rang titre="Le jour par homme" sous={donnees.tarifJour ? "Vos tarifs" : "Aucun tarif au jour par homme"}>
              <input
                inputMode="decimal"
                value={tarif}
                onChange={(e) => setTarif(e.target.value)}
                placeholder="à chiffrer"
                aria-label="Prix du jour par homme, en euros"
                data-atlas="mo-tarif"
                className="h-11 w-[104px] rounded-[10px] border-0 px-3 text-right text-[17px] outline-none"
                style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }}
              />
            </Rang>
          ) : (
            <Rang titre="Votre marge" sous={qui.margePropre ? "La sienne, sur sa fiche" : "Main d’œuvre, sur leur prix"}>
              <span className="text-[19px]" style={{ fontFamily: font.display, color: colors.ink }}>
                {qui.marge === null ? "aucune" : `× ${virgule(Number(qui.marge).toFixed(2))}`}
              </span>
            </Rang>
          )}

          <div className="mt-4 rounded-[10px] px-4 py-3.5" style={{ backgroundColor: voile(colors.or, 0.13) }}>
            <p className="text-[14.5px] tabular-nums" style={{ color: colors.inkSoft }} data-atlas="mo-calcul">
              {calcul}
            </p>
            <p
              className="mt-1 text-[28px] leading-tight"
              style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "tabular-nums lining-nums" }}
              data-atlas="mo-total"
            >
              {montant === null ? "à chiffrer" : enEuros(montant)}
              {montant !== null && (
                <small className="ml-1.5 text-[13px] font-semibold tracking-wide" style={{ fontFamily: font.body, color: colors.inkSoft }}>
                  HT
                </small>
              )}
            </p>
          </div>

          <div className="mt-5">
            <PrimaryButton
              disabled={ligne === null}
              repere="mo-valider"
              pleineLargeur
              onClick={() => {
                if (ligne === null) return;
                onValider(
                  qui === null
                    ? { qui: "equipe", hommes, jours: DUREES_MAIN_OEUVRE[rang].jours, tarif: tarifLu === null ? null : String(tarifLu) }
                    : { qui: "partenaire", prixId: qui.id, quantite: quantitePartenaire ?? 0 }
                );
              }}
            >
              Ajouter la main d’œuvre
            </PrimaryButton>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="mt-2 block min-h-[44px] w-full text-center text-[15px] font-semibold"
            style={{ color: colors.inkSoft }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

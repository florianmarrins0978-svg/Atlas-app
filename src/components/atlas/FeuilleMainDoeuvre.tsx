"use client";

import { useState } from "react";
import BottomSheet from "./BottomSheet";
import IconeTrait from "./IconeTrait";
import PrimaryButton from "./PrimaryButton";
import RepartirLaMainOeuvre from "./RepartirLaMainOeuvre";
import { ListeDesPartenaires, PartenairePris, PastilleMesPartenaires } from "./PartenairesDeLaMainOeuvre";
import { colors, font, voile } from "@/lib/design-tokens";
import { enEuros } from "@/lib/euros";
import {
  DUREES_MAIN_OEUVRE,
  aLaJournee,
  ligneDeSonEquipe,
  mainOeuvreDUnPartenaire,
  montantDeLaMainOeuvre,
  quantiteTapee,
  quantiteDuPartenaire,
  rangDeLaDuree,
  type ChoixDeMainOeuvre,
  type DonneesMainOeuvre,
  type PrixDePartenaire,
} from "@/lib/feuille-main-oeuvre";
import { ecrireChoix, lireChoix, repartirMainOeuvre, type QuestionMainOeuvre } from "@/lib/main-oeuvre-dictee";

/**
 * ─── LA FEUILLE « MAIN D'ŒUVRE » — sa planche du 1er novembre 2026 ───────────
 *
 * « + Main d'œuvre » posait une ligne vide où taper un montant. La feuille
 * montre le calcul AVANT d'ajouter : son équipe, avec les hommes et la durée
 * repris de sa dictée et son prix du jour par homme ; ou, par la pastille
 * « Mes partenaires » à droite du titre (son idée du même soir), le prix d'un
 * de ses partenaires, multiplié par sa marge. Les règles sont dans
 * `src/lib/feuille-main-oeuvre.ts`, et l'action les rejoue côté serveur
 * (`ligneDuChoix`).
 *
 * **Le devis et la facture la montent** depuis le 4 novembre 2026 (planche
 * `appli/soignee/facture.html`, page « ts ») : *« le bouton ma TVA, main
 * d'œuvre, est le même qu'à l'ancienne »*. La facture ne la monte que pour
 * poser une ligne : ses lignes ne gardent pas de part de main d'œuvre
 * (`lignes_facture` n'a ni le drapeau ni la part, §459), il n'y a donc rien
 * à répartir, et « Où la mettre » ne s'y montre pas.
 */
type Props = {
  ouverte: boolean;
  donnees: DonneesMainOeuvre;
  /**
   * La répartition, quand la pièce sait la garder (le devis) : les travaux de
   * la TVA où il a appuyé qui ont leur prix, et ce qui pose les parts.
   * Absente, la feuille ne propose que la ligne.
   */
  repartition?: {
    travaux: readonly { id: string; libelle: string }[];
    onRepartir: (choix: ChoixDeMainOeuvre, parts: Record<string, number>) => void;
  };
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

function Contenu({ donnees, repartition, onValider, onFermer }: Props) {
  const travaux = repartition?.travaux ?? [];
  const [vue, setVue] = useState<"calcul" | "liste">("calcul");
  const [qui, setQui] = useState<PrixDePartenaire | null>(null);
  const [hommes, setHommes] = useState(Math.min(20, Math.max(1, donnees.hommes ?? 1)));
  const [rang, setRang] = useState(rangDeLaDuree(donnees.jours));
  const [tarif, setTarif] = useState(donnees.tarifJour ? virgule(Number(donnees.tarifJour)) : "");
  const [quantite, setQuantite] = useState("1");
  // « Où la mettre » : la barre de l'appli, celle d'« Avant de chiffrer »
  // (`RepartirLaMainOeuvre`), et non une seconde barre. Sur une ligne d'abord,
  // comme la planche : répartir est un choix, pas l'habitude.
  const [ou, setOu] = useState(ecrireChoix({ mode: "ligne", parts: {}, retires: [] }));

  const alaJournee = qui !== null && aLaJournee(qui.unite);
  const tarifLu = quantiteTapee(tarif);
  const quantitePartenaire = qui === null ? null : quantiteDuPartenaire(qui, DUREES_MAIN_OEUVRE[rang].jours, quantiteTapee(quantite));
  const duPartenaire = qui !== null && quantitePartenaire !== null ? mainOeuvreDUnPartenaire(qui, quantitePartenaire) : null;
  const sonEquipe = ligneDeSonEquipe(hommes, DUREES_MAIN_OEUVRE[rang].jours, tarifLu === null ? null : String(tarifLu));
  const ligne = qui === null ? sonEquipe : (duPartenaire?.ligne ?? null);
  const montant = qui === null ? montantDeLaMainOeuvre(sonEquipe) : (duPartenaire?.montant ?? null);
  const choixDeLaFeuille: ChoixDeMainOeuvre | null =
    ligne === null
      ? null
      : qui === null
        ? { qui: "equipe", hommes, jours: DUREES_MAIN_OEUVRE[rang].jours, tarif: tarifLu === null ? null : String(tarifLu) }
        : { qui: "partenaire", prixId: qui.id, quantite: quantitePartenaire ?? 0 };
  // Répartir demande un montant : une main d'œuvre « à chiffrer » n'a rien à partager.
  const peutRepartir = repartition !== undefined && travaux.length > 0 && montant !== null && Number(montant) > 0;
  const lu = lireChoix(ou);
  const dedans = travaux.filter((t) => !(lu?.retires ?? []).includes(t.id));
  const reparti = peutRepartir && lu?.mode === "reparti" && dedans.length > 0;
  const question: QuestionMainOeuvre = {
    total: montant ?? "0",
    detail: "",
    prixJourHomme: tarifLu === null ? "" : String(tarifLu),
    travaux: travaux.map((t) => ({ cle: t.id, libelle: t.libelle, part: 0, grille: null })),
    engins: [],
    hommes,
    jours: DUREES_MAIN_OEUVRE[rang].jours,
    // Ses partenaires sont déjà dans la feuille, au-dessus : la barre n'en montre pas.
    partenaires: [],
  };

  const calcul =
    qui === null
      ? tarifLu === null
        ? "Sans prix du jour par homme, la ligne arrivera à chiffrer."
        : `${hommes} ${hommes > 1 ? "hommes" : "homme"} × ${DUREES_MAIN_OEUVRE[rang].libelle} × ${virgule(tarifLu)} €`
      : qui.marge === null
        ? "Sans marge sur la main d’œuvre, la ligne arrivera à chiffrer."
        : duPartenaire === null
          ? "Écrivez une quantité au-dessus de zéro."
          : duPartenaire.calcul;

  function choisir(p: PrixDePartenaire) {
    setQui(p);
    setVue("calcul");
    setQuantite("1");
  }
  function revenirASonEquipe() {
    setQui(null);
    setVue("calcul");
  }

  return (
    <div data-atlas="feuille-mo">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
          Main d’œuvre
        </p>
        <PastilleMesPartenaires pris={qui !== null} onClick={() => setVue(vue === "liste" ? "calcul" : "liste")} />
      </div>

      {vue === "liste" ? (
        <ListeDesPartenaires partenaires={donnees.partenaires} onChoisir={choisir} onMonEquipe={revenirASonEquipe} />
      ) : (
        <div>
          {qui !== null && (
            <div className="mb-1">
              <PartenairePris prix={qui} onRevenir={revenirASonEquipe} />
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

          {peutRepartir && (
            <div className="mt-4" data-atlas="mo-ou">
              <RepartirLaMainOeuvre question={question} valeur={ou} onChange={setOu} />
            </div>
          )}

          <div className="mt-5">
            <PrimaryButton
              disabled={choixDeLaFeuille === null}
              repere="mo-valider"
              pleineLargeur
              onClick={() => {
                if (choixDeLaFeuille === null) return;
                if (reparti && montant !== null && repartition) {
                  // Les parts telles que la barre les montre : la même règle,
                  // que le serveur rejoue avant d'écrire.
                  const parts = repartirMainOeuvre(
                    montant,
                    dedans.map((t) => t.id),
                    lu?.parts ?? {}
                  );
                  repartition.onRepartir(
                    choixDeLaFeuille,
                    Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Number(v)]))
                  );
                } else {
                  onValider(choixDeLaFeuille);
                }
              }}
            >
              {reparti ? "Répartir la main d’œuvre" : "Ajouter la main d’œuvre"}
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

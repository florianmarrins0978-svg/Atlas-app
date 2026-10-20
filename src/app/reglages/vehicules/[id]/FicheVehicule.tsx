"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, libelleCaps, surPlein, texteSituation, voile } from "@/lib/design-tokens";
import { jourDeLettre } from "@/lib/jour";
import {
  CHAMPS_DATE,
  LIBELLE_CHAMP,
  NOM_DOCUMENT_VEHICULE,
  dApres,
  valeurAffichee,
  valeurDuChamp,
  type ChampVehicule,
  type Echeance,
  type NatureDocumentVehicule,
  type SourcesVehicule,
  type ValeursVehicule,
} from "@/lib/vehicules";
import AjoutDocument, { AJOUTER_LA_CARTE_GRISE, AJOUTER_LE_PROCES_VERBAL, AJOUTER_UN_DOCUMENT } from "../AjoutDocument";
import { modifierChampVehiculeAction, retirerVehiculeAction } from "../actions";

const TEINTE: Record<Echeance["ton"], string> = { calme: colors.ink, proche: colors.or, depasse: colors.alert };

/**
 * La fiche d'un véhicule — sa troisième planche du 14 octobre 2026
 * (`appli/vehicules-plus-simple.html`).
 *
 * **Toute case se corrige à la main** (*« si jamais elle s'est trompée ou si ça
 * a changé »*) : à la sortie du champ, la valeur part au serveur, qui la
 * revalide avec la même règle (`valeurDuChamp`) et retire la mention « d'après
 * … ». La valeur envoyée est celle du CHAMP, jamais l'état React d'un rendu en
 * retard (leçon du 30 août 2026, `ChampsDuDevis`).
 */
export default function FicheVehicule({
  id,
  valeurs,
  sources,
  documents,
  prochain,
  manquants,
  ouvrirAjout,
}: {
  id: string;
  valeurs: ValeursVehicule;
  sources: SourcesVehicule;
  documents: { nature: NatureDocumentVehicule; le: string }[];
  prochain: { phrase: string; ton: Echeance["ton"] } | null;
  manquants: string[];
  /** Venu d'un rappel de l'accueil, ou d'un véhicule tout neuf : la feuille s'ouvre d'elle-même. */
  ouvrirAjout: "proces-verbal" | "carte-grise" | null;
}) {
  const router = useRouter();
  const [ajout, setAjout] = useState(ouvrirAjout !== null);
  const [avis, setAvis] = useState<string | null>(null);
  const [justeLus, setJusteLus] = useState<ChampVehicule[]>([]);
  const [refusDuChamp, setRefusDuChamp] = useState<Partial<Record<ChampVehicule, string>>>({});
  const [retrait, setRetrait] = useState(false);
  const [refusRetrait, setRefusRetrait] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  // La dernière valeur ENVOYÉE de chaque case, tant que la page ne s'est pas
  // rafraîchie. Le sélecteur de date d'iPhone écrit deux fois de suite sans
  // attendre : la date du jour à l'ouverture d'une case vide, puis « » sur
  // « Réinitialiser ». Comparé à `valeurs`, encore vide, ce « » ne partait
  // jamais, et la date du jour restait (20 octobre 2026).
  const envoyees = useRef<Partial<Record<ChampVehicule, string | number | null>>>({});

  const enregistrer = (champ: ChampVehicule, brut: string) => {
    // On compare la valeur NETTOYÉE, pas le texte : sortir de « 3 500 kg » sans
    // y toucher ne doit pas renvoyer 3500, ni effacer « d'après la carte grise ».
    const lu = valeurDuChamp(champ, brut);
    const connue = champ in envoyees.current ? envoyees.current[champ] : valeurs[champ];
    if (lu.ok && lu.valeur === connue) return;
    if (lu.ok) envoyees.current[champ] = lu.valeur;
    demarrer(async () => {
      const r = await modifierChampVehiculeAction(id, champ, brut);
      setRefusDuChamp((p) => ({ ...p, [champ]: r.ok ? undefined : r.raison }));
      if (r.ok) router.refresh();
      // Refusée, la valeur n'est pas en base : c'est de nouveau `valeurs` qui dit vrai.
      else delete envoyees.current[champ];
    });
  };

  const champ = (c: ChampVehicule) => {
    const source = sources[c];
    const estDate = CHAMPS_DATE.includes(c);
    return (
      <label
        key={c}
        data-atlas={`champ-${c}`}
        className="flex items-center justify-between gap-3 border-b py-[11px] transition-colors duration-[1600ms]"
        style={{ borderColor: colors.line, backgroundColor: justeLus.includes(c) ? voile(colors.or, 0.16) : "transparent" }}
      >
        <span className="min-w-0">
          <span className="block text-[15px]" style={{ color: colors.inkSoft }}>
            {LIBELLE_CHAMP[c]}
          </span>
          {source ? (
            <span className="block text-[12.5px]" style={{ color: colors.or }} data-atlas="source-du-champ">
              {dApres(source)}
            </span>
          ) : estDate && c !== "contreVisiteAvant" && !valeurs[c] ? (
            <span className="block text-[12.5px]" style={{ color: colors.muted }}>
              pas encore lue
            </span>
          ) : null}
          {refusDuChamp[c] && (
            <span className="block text-[12.5px]" style={{ color: colors.alert }}>
              {refusDuChamp[c]}
            </span>
          )}
        </span>
        <input
          // La clé suit la valeur : une lecture qui remplit la case doit
          // remplacer ce qui était affiché, sans attendre un rechargement.
          key={`${c}-${valeurs[c] ?? ""}`}
          type={estDate ? "date" : "text"}
          inputMode={c === "assistance" ? "tel" : c === "ptacKg" ? "numeric" : undefined}
          defaultValue={valeurAffichee(c, valeurs[c])}
          placeholder="à remplir"
          aria-label={LIBELLE_CHAMP[c]}
          onBlur={(e) => enregistrer(c, e.currentTarget.value)}
          // Le sélecteur de date d'iPhone se referme sans toujours rendre la
          // main au champ : la date part dès qu'elle est choisie.
          onChange={estDate ? (e) => enregistrer(c, e.currentTarget.value) : undefined}
          className="w-[46%] min-w-0 border-0 bg-transparent p-0 text-right outline-none"
          // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
          style={{ fontSize: 16, color: colors.ink }}
        />
      </label>
    );
  };

  const titreSection = (t: string) => (
    <p className={`mb-1 mt-7 ${libelleCaps}`} style={{ color: colors.inkSoft }}>
      {t}
    </p>
  );

  return (
    <div className="px-6">
      <button
        type="button"
        data-atlas="ajouter-document"
        onClick={() => setAjout(true)}
        className="atlas-plein mt-4 w-full rounded-full py-3.5 text-[15px] font-medium"
        style={{ backgroundColor: colors.plein, color: surPlein }}
      >
        Ajouter un document
      </button>

      {avis && (
        <p
          data-atlas="avis-lecture"
          className="mt-4 rounded-[14px] px-4 py-3 text-[14.5px] leading-snug"
          style={{ backgroundColor: colors.rustTint, color: colors.ink }}
        >
          {avis}
        </p>
      )}

      {prochain && (
        <p
          data-atlas="prochain-controle"
          className="mt-4 text-[16px] leading-snug"
          style={{ color: TEINTE[prochain.ton], fontWeight: prochain.ton === "depasse" ? 600 : 400 }}
        >
          {prochain.phrase}
        </p>
      )}
      {manquants.length > 0 && (
        <p data-atlas="documents-manquants" className={`mt-1.5 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          À ajouter : {manquants.join(", ")}.
        </p>
      )}

      {titreSection("Dates limites")}
      {champ("controleTechniqueAvant")}
      {champ("pollutionAvant")}
      {valeurs.contreVisiteAvant && champ("contreVisiteAvant")}

      {titreSection("Assurance")}
      {champ("assureur")}
      {champ("numeroContrat")}
      {champ("assistance")}

      {titreSection("Documents")}
      {documents.length === 0 ? (
        <p className="py-2 text-[14px]" style={{ color: colors.muted }}>
          Aucun document pour l’instant.
        </p>
      ) : (
        documents.map((d) => (
          <a
            key={d.nature}
            href={`/reglages/vehicules/${id}/document/${d.nature}`}
            target="_blank"
            rel="noopener"
            data-atlas={`document-${d.nature}`}
            className="flex items-center justify-between border-b py-3"
            style={{ borderColor: colors.line }}
          >
            <span>
              <span className="block text-[15px]" style={{ color: colors.ink }}>
                {NOM_DOCUMENT_VEHICULE[d.nature]}
              </span>
              <span className="block text-[12.5px]" style={{ color: colors.muted }}>
                ajouté le {jourDeLettre(d.le)}
              </span>
            </span>
            <span className="text-[14px] font-medium" style={{ color: colors.rust }}>
              Voir
            </span>
          </a>
        ))
      )}

      {titreSection("Le véhicule")}
      {champ("nom")}
      {champ("plaque")}
      {champ("modele")}
      {champ("ptacKg")}
      {champ("genre")}
      <p className={`mt-3 ${texteSituation}`} style={{ color: colors.inkSoft }}>
        La carte grise originale reste dans le véhicule.
      </p>

      <button
        type="button"
        data-atlas="retirer-vehicule"
        onClick={() => setRetrait(true)}
        className="mt-10 min-h-[44px] text-[14px]"
        style={{ color: colors.alert }}
      >
        Retirer ce véhicule
      </button>

      <AjoutDocument
        ouverte={ajout}
        quoi={
          ouvrirAjout === "proces-verbal"
            ? AJOUTER_LE_PROCES_VERBAL
            : ouvrirAjout === "carte-grise"
              ? AJOUTER_LA_CARTE_GRISE
              : AJOUTER_UN_DOCUMENT
        }
        vehiculeId={id}
        onFermer={() => setAjout(false)}
        onRange={(r) => {
          setAjout(false);
          setAvis(r.message);
          setJusteLus(r.remplis);
          router.refresh();
          // Le doré s'efface : il dit « vient d'être lu », pas « lu un jour ».
          setTimeout(() => setJusteLus([]), 2200);
        }}
      />

      <BottomSheet open={retrait} onBackdropClick={() => setRetrait(false)}>
        <p style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.2, color: colors.ink }}>Retirer {valeurs.nom} ?</p>
        <p className={`mb-5 mt-1 ${texteSituation}`} style={{ color: colors.inkSoft }}>
          Il quitte la liste et ses rappels s’arrêtent. Ses papiers restent dans la sauvegarde.
        </p>
        <button
          type="button"
          data-atlas="confirmer-retrait"
          onClick={() =>
            demarrer(async () => {
              const r = await retirerVehiculeAction(id);
              if (r.ok) router.push("/reglages/vehicules");
              else setRefusRetrait(r.raison);
            })
          }
          className="atlas-plein w-full rounded-full py-3.5 text-[15px] font-medium"
          style={{ backgroundColor: colors.alert, color: surPlein }}
        >
          Retirer
        </button>
        <button
          type="button"
          onClick={() => setRetrait(false)}
          className="mt-2 block w-full py-3 text-center text-[15px]"
          style={{ color: colors.inkSoft }}
        >
          Garder
        </button>
        {refusRetrait && (
          <p className={`mt-2 ${texteSituation}`} style={{ color: colors.alert }}>
            {refusRetrait}
          </p>
        )}
      </BottomSheet>
    </div>
  );
}

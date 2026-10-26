"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { jourDeLettre } from "@/lib/jour";
import {
  CHAMPS_DATE,
  LIBELLE_CHAMP,
  NATURES_DOCUMENT_VEHICULE,
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
import ActionBas from "@/components/atlas/reglages/ActionBas";
import LigneReglage, { styleValeurReglage } from "@/components/atlas/reglages/LigneReglage";
import Paquet from "@/components/atlas/reglages/Paquet";
import PastilleIcone from "@/components/atlas/reglages/PastilleIcone";
import { teintesDuTon } from "@/components/atlas/reglages/PlageTon";
import AjoutDocument, { AJOUTER_LA_CARTE_GRISE, AJOUTER_LE_PROCES_VERBAL, AJOUTER_UN_DOCUMENT } from "../AjoutDocument";
import { modifierChampVehiculeAction, retirerVehiculeAction } from "../actions";
import Picto from "@/components/atlas/reglages/Picto";
import { encreDuTon, tonDuVehicule } from "../etat";

/**
 * La fiche d'un véhicule — sa troisième planche du 14 octobre 2026
 * (`appli/vehicules-plus-simple.html`).
 *
 * **Toute case se corrige à la main** (*« si jamais elle s'est trompée ou si ça
 * a changé »*) : à la sortie du champ, la valeur part au serveur, qui la
 * revalide avec la même règle (`valeurDuChamp`) et retire la mention « d'après
 * … ». La valeur envoyée est celle du CHAMP, jamais l'état React d'un rendu en
 * retard (leçon du 30 août 2026, `ChampsDuDevis`).
 *
 * **Sa planche du 26 octobre 2026** (`appli/soignee/reglages-vehicules.html`) :
 * la prochaine date sur un carré qui dit l'état d'un coup d'œil ; les trois
 * papiers toujours nommés, celui qui manque en ambre avec son geste (la ligne
 * « À ajouter : … » s'y range) ; les cases en toutes lettres dans leurs paquets ;
 * « Ajouter un document », le seul bouton plein, au-dessus de la barre.
 */
export default function FicheVehicule({
  id,
  valeurs,
  sources,
  documents,
  prochain,
  ouvrirAjout,
}: {
  id: string;
  valeurs: ValeursVehicule;
  sources: SourcesVehicule;
  documents: { nature: NatureDocumentVehicule; le: string }[];
  /** Le contrôle le plus pressé : son nom, son jour et son mois pour le carré, et ce qui reste. */
  prochain: { quoi: string; jour: number; mois: string; phrase: string; ton: Echeance["ton"] } | null;
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
    const pasEncoreLue = !source && estDate && c !== "contreVisiteAvant" && !valeurs[c];
    return (
      // **Le doré d'une case lue couvre toute la largeur de la plage** (planche
      // du 26 octobre 2026), pas seulement le texte : il dit « vient d'être
      // lu » sur la ligne entière.
      <div
        key={c}
        data-atlas={`champ-${c}`}
        className="-mx-[18px] px-[18px] transition-colors duration-[1600ms]"
        style={{ backgroundColor: justeLus.includes(c) ? voile(colors.or, 0.16) : "transparent" }}
      >
        <LigneReglage
          libelle={LIBELLE_CHAMP[c]}
          htmlFor={`vehicule-${c}`}
          sous={
            source || pasEncoreLue || refusDuChamp[c] ? (
              <>
                {source ? (
                  <span className="block font-semibold" style={{ color: colors.or }} data-atlas="source-du-champ">
                    {dApres(source)}
                  </span>
                ) : pasEncoreLue ? (
                  <span className="block">pas encore lue</span>
                ) : null}
                {refusDuChamp[c] && (
                  <span className="block font-semibold" style={{ color: colors.alert }}>
                    {refusDuChamp[c]}
                  </span>
                )}
              </>
            ) : undefined
          }
        >
          <input
            id={`vehicule-${c}`}
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
            // 18 px : en dessous de 16, iOS agrandit la page à la mise au point.
            style={styleValeurReglage}
          />
        </LigneReglage>
      </div>
    );
  };

  // La couleur du carré : celle de la liste, par la même règle (`tonDuVehicule`).
  const ton = tonDuVehicule(prochain?.ton ?? null, valeurs.plaque);

  return (
    <div>
      {avis && (
        <p
          data-atlas="avis-lecture"
          className="mx-[22px] mt-4 rounded-[14px] px-4 py-[13px] text-[15px] leading-[1.45]"
          style={{ backgroundColor: colors.rustTint, color: colors.ink }}
        >
          {avis}
        </p>
      )}

      {/* **La prochaine date sur un carré** : le jour en grand, le mois dessous,
          à la couleur de l'état ; à côté, le contrôle et ce qui reste (« Plus
          que 10 jours », « Dépassé depuis 4 jours »). Rien de pressé et une
          plaque connue : « À jour », en vert. Le carré répète la phrase, il se
          tait donc à voix haute. */}
      {ton && (
        <div
          data-atlas="prochain-controle"
          className="mx-[22px] mt-4 flex items-center gap-3.5 rounded-[6px] px-4 py-3.5"
          style={{ backgroundColor: teintesDuTon(ton).fond }}
        >
          <span
            aria-hidden="true"
            className="flex h-14 min-w-14 flex-none flex-col items-center justify-center rounded-[12px] px-2 leading-none"
            style={{ backgroundColor: colors.card }}
          >
            {prochain ? (
              <>
                <span className="text-[26px]" style={{ fontFamily: font.display, color: colors.ink, fontVariantNumeric: "lining-nums" }}>
                  {prochain.jour}
                </span>
                <span className="mt-[3px] text-[13px] font-bold" style={{ color: encreDuTon(ton) }}>
                  {prochain.mois}
                </span>
              </>
            ) : (
              <span style={{ color: encreDuTon(ton) }}>
                <Picto nom="coche" />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span
              className="block text-[19px] leading-[1.25]"
              style={{ fontFamily: font.display, color: prochain ? colors.ink : encreDuTon(ton) }}
            >
              {prochain ? prochain.quoi : "À jour"}
            </span>
            {prochain && (
              <span
                className="mt-0.5 block text-balance text-[15px] font-semibold leading-[1.4]"
                style={{ color: ton === "or" ? colors.ink : encreDuTon(ton) }}
              >
                {prochain.phrase}
              </span>
            )}
          </span>
        </div>
      )}

      {/* **Les trois papiers, toujours nommés** : présent avec sa date et
          « Voir », manquant en ambre avec « Ajouter ». C'est ici que la ligne
          « À ajouter : … » s'est rangée. */}
      <Paquet titre="Documents">
        {NATURES_DOCUMENT_VEHICULE.map((n, i) => {
          const present = documents.find((d) => d.nature === n);
          const filet = i > 0 && (
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ backgroundColor: colors.line }} />
          );
          return present ? (
            <a
              key={n}
              href={`/reglages/vehicules/${id}/document/${n}`}
              target="_blank"
              rel="noopener"
              data-atlas={`document-${n}`}
              className="relative flex min-h-[68px] items-center gap-3.5 py-3"
            >
              {filet}
              <PastilleIcone ton="vert">
                <Picto nom="coche" />
              </PastilleIcone>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  {NOM_DOCUMENT_VEHICULE[n]}
                </span>
                <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                  ajouté le {jourDeLettre(present.le)}
                </span>
              </span>
              <span className="flex-none text-[16px] font-semibold" style={{ color: colors.or }}>
                Voir
              </span>
            </a>
          ) : (
            <button
              key={n}
              type="button"
              data-atlas="document-manquant"
              onClick={() => setAjout(true)}
              className="relative flex min-h-[68px] w-full items-center gap-3.5 py-3 text-left"
            >
              {filet}
              <PastilleIcone ton="ambre">
                <Picto nom="plus" />
              </PastilleIcone>
              <span className="min-w-0 flex-1">
                <span className="block text-[18px] leading-[1.25]" style={{ fontFamily: font.display, color: colors.ink }}>
                  {NOM_DOCUMENT_VEHICULE[n]}
                </span>
                <span className="mt-0.5 block text-[14px] font-semibold" style={{ color: colors.carteAmbreTexte }}>
                  À ajouter
                </span>
              </span>
              <span className="flex-none text-[16px] font-semibold" style={{ color: colors.or }}>
                Ajouter
              </span>
            </button>
          );
        })}
      </Paquet>

      <Paquet titre="Dates limites">
        {champ("controleTechniqueAvant")}
        {champ("pollutionAvant")}
        {valeurs.contreVisiteAvant && champ("contreVisiteAvant")}
      </Paquet>

      <Paquet titre="Assurance">
        {champ("assureur")}
        {champ("numeroContrat")}
        {champ("assistance")}
      </Paquet>

      <Paquet titre="Le véhicule">
        {champ("nom")}
        {champ("plaque")}
        {champ("modele")}
        {champ("ptacKg")}
        {champ("genre")}
      </Paquet>
      <p className="mx-6 mt-2.5 text-[14px] leading-[1.5]" style={{ color: colors.inkSoft }}>
        La carte grise originale reste dans le véhicule.
      </p>

      <button
        type="button"
        data-atlas="retirer-vehicule"
        onClick={() => setRetrait(true)}
        className="mx-[22px] mt-7 flex min-h-[52px] w-[calc(100%-44px)] items-center justify-center gap-2 rounded-full text-[16px] font-semibold"
        style={{ color: colors.alert }}
      >
        <Picto nom="croix" taille={20} />
        Retirer ce véhicule
      </button>

      <ActionBas>
        <button
          type="button"
          data-atlas="ajouter-document"
          onClick={() => setAjout(true)}
          className="atlas-plein flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          <Picto nom="plus" />
          Ajouter un document
        </button>
      </ActionBas>

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
        <p className="mt-1.5 text-[26px] leading-[1.15]" style={{ fontFamily: font.display, color: colors.ink }}>
          Retirer {valeurs.nom} ?
        </p>
        <p className="mb-4 mt-2 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
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
          className="atlas-plein flex min-h-[56px] w-full items-center justify-center rounded-full text-[17px] font-semibold"
          style={{ backgroundColor: colors.alert, color: surPlein }}
        >
          Retirer
        </button>
        <button
          type="button"
          onClick={() => setRetrait(false)}
          className="mt-1 flex min-h-[48px] w-full items-center justify-center rounded-full text-[16px] font-semibold"
          style={{ color: colors.inkSoft }}
        >
          Garder
        </button>
        {refusRetrait && (
          <p className="mt-2 text-[14px] leading-[1.5]" style={{ color: colors.alert }}>
            {refusRetrait}
          </p>
        )}
      </BottomSheet>
    </div>
  );
}

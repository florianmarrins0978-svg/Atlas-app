"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/atlas/BottomSheet";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font, surPlein } from "@/lib/design-tokens";
import { NOM_DE_DOSSIER_MAX, NOTE_MAX, type Destination } from "@/lib/dossiers-diagnostic";
import { rangerAction } from "../actions";

/**
 * Ranger le diagnostic dans un dossier, avec sa note (sa planche du 20 novembre
 * 2026, `appli/soignee/diagnostic-dossiers.html`). Il remplace « Rattacher à un
 * chantier », qui vivait en bas des détails : **un chantier est un dossier**.
 *
 * Deux allures, selon que le diagnostic est rangé ou non : le bouton creux sous
 * « Nouvelle photo », ou la carte verte « Rangée dans… » avec la note et
 * « Modifier ». Les deux ouvrent la même feuille. La note s'écrit au clavier
 * seulement (sa réponse du jour).
 *
 * **Ce que ce geste change sans se voir** : la photo cesse de suivre la règle
 * de conservation « libre » ; le recalcul est fait côté serveur
 * (`rangerDansUnDossier`), l'écran ne fait que le demander.
 */
export default function RangerDansUnDossier({
  diagnosticId,
  rangement,
  chantiers,
  dossiers,
}: {
  diagnosticId: string;
  rangement: { phrase: string; note: string | null; chantierId: string | null; dossierId: string | null } | null;
  chantiers: { id: string; nom: string }[];
  dossiers: { id: string; nom: string }[];
}) {
  const [ouverte, setOuverte] = useState(false);
  const [choix, setChoix] = useState<string>(
    rangement?.chantierId ? `chantier:${rangement.chantierId}` : rangement?.dossierId ? `dossier:${rangement.dossierId}` : ""
  );
  const [nomNouveau, setNomNouveau] = useState<string | null>(null);
  const [note, setNote] = useState(rangement?.note ?? "");
  const [phrase, setPhrase] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const router = useRouter();

  function destination(): Destination | null {
    if (choix === "nouveau") return { genre: "nouveau", nom: nomNouveau ?? "" };
    const [genre, id] = choix.split(":");
    if (genre === "chantier" || genre === "dossier") return { genre, id };
    return null;
  }

  function ranger() {
    const d = destination();
    if (!d) {
      setPhrase("Choisissez un dossier.");
      return;
    }
    demarrer(async () => {
      const r = await rangerAction(diagnosticId, d, note);
      if (!r.ok) {
        setPhrase(r.phrase);
        return;
      }
      setOuverte(false);
      setPhrase(null);
      router.refresh();
    });
  }

  const ouvrir = () => {
    setPhrase(null);
    setOuverte(true);
  };

  return (
    <>
      {rangement ? (
        <div className="mt-8 rounded-[6px] p-[18px]" style={{ backgroundColor: colors.carteVertFond }} data-atlas="diagnostic-range">
          <p className="flex items-start gap-2.5 text-[16px] font-semibold leading-[1.4]" style={{ color: colors.carteVertTexte }}>
            <span className="mt-px">
              <IconeTrait nom="coche" taille={20} epaisseur={1.9} />
            </span>
            {rangement.phrase}
          </p>
          {rangement.note && (
            <p className="mt-2.5 whitespace-pre-wrap text-[16px] leading-[1.55]" style={{ color: colors.ink }} data-atlas="diagnostic-note">
              {rangement.note}
            </p>
          )}
          <button
            type="button"
            onClick={ouvrir}
            className="mt-2.5 min-h-[44px] text-[16px] font-semibold"
            style={{ color: colors.rust }}
            data-atlas="diagnostic-modifier-rangement"
          >
            Modifier
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={ouvrir}
          className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[17px] font-semibold"
          style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          data-atlas="diagnostic-ranger"
        >
          <IconeTrait nom="dossier" taille={22} epaisseur={1.7} />
          Ranger dans un dossier
        </button>
      )}

      <BottomSheet open={ouverte} onBackdropClick={() => setOuverte(false)}>
        <div role="dialog" aria-label="Ranger cette photo" data-atlas="feuille-ranger">
          <h2 className="text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
            Ranger cette photo
          </h2>

          {chantiers.length > 0 && (
            <>
              <Rubrique>Chantiers</Rubrique>
              <Liste>
                {chantiers.map((c, i) => (
                  <Choix
                    key={c.id}
                    premier={i === 0}
                    valeur={`chantier:${c.id}`}
                    choix={choix}
                    onChoisir={setChoix}
                    nom={c.nom}
                  />
                ))}
              </Liste>
            </>
          )}

          <Rubrique>Mes dossiers</Rubrique>
          <Liste>
            {dossiers.map((d, i) => (
              <Choix key={d.id} premier={i === 0} valeur={`dossier:${d.id}`} choix={choix} onChoisir={setChoix} nom={d.nom} />
            ))}
            <li style={dossiers.length > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}>
              {nomNouveau === null ? (
                <button
                  type="button"
                  onClick={() => {
                    setNomNouveau("");
                    setChoix("nouveau");
                  }}
                  className="flex min-h-[60px] w-full items-center gap-3.5 text-[17px] font-semibold"
                  style={{ color: colors.rust }}
                  data-atlas="ranger-nouveau-dossier"
                >
                  <IconeTrait nom="plus" taille={22} epaisseur={1.7} />
                  Nouveau dossier
                </button>
              ) : (
                <label className="flex min-h-[60px] items-center gap-3.5 py-2">
                  <input
                    type="radio"
                    name="dossier-choisi"
                    checked={choix === "nouveau"}
                    onChange={() => setChoix("nouveau")}
                    className="h-[22px] w-[22px] flex-none"
                    style={{ accentColor: colors.plein }}
                  />
                  <input
                    type="text"
                    value={nomNouveau}
                    autoFocus
                    maxLength={NOM_DE_DOSSIER_MAX}
                    onChange={(e) => {
                      setNomNouveau(e.target.value);
                      setChoix("nouveau");
                    }}
                    placeholder="Nom du dossier"
                    aria-label="Nom du nouveau dossier"
                    className="min-h-[48px] w-full rounded-[14px] px-4 text-[16px] outline-none"
                    style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
                    data-atlas="ranger-nom-dossier"
                  />
                </label>
              )}
            </li>
          </Liste>

          <Rubrique>Ma note</Rubrique>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            placeholder="Ce que vous avez vu, où, ce que vous avez fait."
            aria-label="Ma note"
            className="block min-h-[120px] w-full resize-y rounded-[14px] px-4 py-3.5 text-[16px] leading-[1.5] outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            data-atlas="ranger-note"
          />

          <button
            type="button"
            onClick={ranger}
            disabled={enCours}
            className="atlas-plein mt-5 flex min-h-[56px] w-full items-center justify-center rounded-[14px] text-[17px] font-semibold disabled:opacity-60"
            style={{ backgroundColor: colors.plein, color: surPlein }}
            data-atlas="ranger-valider"
          >
            {enCours ? "Rangement…" : "Ranger"}
          </button>
          {phrase && (
            <p className="mt-2.5 text-[14.5px] leading-[1.45]" style={{ color: colors.alert }} data-atlas="ranger-refus">
              {phrase}
            </p>
          )}
          <button
            type="button"
            onClick={() => setOuverte(false)}
            className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-[14px] text-[17px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Annuler
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

function Rubrique({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-6 text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.inkSoft }}>
      {children}
    </p>
  );
}

function Liste({ children }: { children: React.ReactNode }) {
  return (
    <ul className="rounded-[6px] px-[18px] py-1" style={{ backgroundColor: colors.card }}>
      {children}
    </ul>
  );
}

function Choix({
  valeur,
  choix,
  onChoisir,
  nom,
  premier,
}: {
  valeur: string;
  choix: string;
  onChoisir: (v: string) => void;
  nom: string;
  premier: boolean;
}) {
  return (
    <li style={premier ? undefined : { boxShadow: `inset 0 1px 0 ${colors.line}` }}>
      <label className="flex min-h-[60px] cursor-pointer items-center gap-3.5 py-2 text-[17px]">
        <input
          type="radio"
          name="dossier-choisi"
          checked={choix === valeur}
          onChange={() => onChoisir(valeur)}
          className="h-[22px] w-[22px] flex-none"
          style={{ accentColor: colors.plein }}
        />
        {nom}
      </label>
    </li>
  );
}

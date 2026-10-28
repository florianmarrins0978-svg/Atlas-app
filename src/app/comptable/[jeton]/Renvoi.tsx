"use client";

import { useId, useState, useTransition } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { jourCourt, montantSigne } from "@/lib/attestation-comptable";
import { lignesAReprendre } from "@/lib/retour-comptable";
import { renvoyerAction } from "./actions";
import Icone from "@/components/atlas/IconeTrait";
import { garderLEmail, signataireGarde } from "./appareil";

/**
 * RENVOYER À CORRIGER — sa planche du 27 octobre 2026
 * (`appli/soignee/comptable-retour.html`), comme le client qui demande une
 * correction de devis.
 *
 * Les lignes renvoyées sont ses rejets, relus tels quels ; il n'y ajoute qu'un
 * mot et son adresse. **Le même lien le ramène ici** : ce que le patron
 * corrige repasse sur sa page, rien ne se renvoie dans l'autre sens.
 */

export type LigneRenvoyee = { id: string; jour: string; libelle: string; montant: string; sens: "entree" | "sortie"; note: string | null };

const plein = "inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[17px] font-semibold disabled:opacity-50";

export default function Renvoi({
  jeton,
  entreprise,
  lignes,
  fermer,
  renvoye,
}: {
  jeton: string;
  entreprise: string;
  lignes: LigneRenvoyee[];
  fermer: () => void;
  renvoye: () => void;
}) {
  const [fait, setFait] = useState(false);
  const [mot, setMot] = useState("");
  // Monté après un appui, jamais au premier rendu du serveur : lire l'appareil ici ne fait pas diverger l'hydratation.
  const [email, setEmail] = useState(() => signataireGarde()?.email ?? "");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const idMot = useId();
  const idEmail = useId();
  const idAide = useId();

  function renvoyer() {
    setRefus(null);
    demarrer(async () => {
      const r = await renvoyerAction(jeton, { message: mot, email });
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      garderLEmail(email.trim());
      setFait(true);
      renvoye();
    });
  }

  const champ = { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }} data-atlas="renvoi-comptable">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[560px] px-5 pb-8 pt-3">
          {fait ? (
            <div className="flex flex-col items-center px-2 pt-9 text-center" data-atlas="renvoi-envoye">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full" style={{ backgroundColor: colors.carteAmbreFond, color: colors.carteAmbreTexte }}>
                <Icone nom="envoyer" taille={32} />
              </span>
              <h2 className="mt-[18px] text-[28px] leading-[1.08]" style={{ fontFamily: font.display }}>
                Renvoyé à {entreprise}
              </h2>
              <p className="mt-2 max-w-[32ch] text-[15.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                {lignesAReprendre(lignes.length)} {entreprise} vous préviendra{email.trim() ? ` à ${email.trim()}` : ""} quand c’est corrigé.
              </p>
            </div>
          ) : (
            <>
              <button type="button" onClick={fermer} aria-label="Retour" data-geste-retour="" className="flex h-12 w-12 items-center justify-center rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                <Icone nom="retour" />
              </button>
              <h2 className="mt-1.5 text-[28px] leading-[1.08]" style={{ fontFamily: font.display }}>
                Renvoyer à corriger
              </h2>
              <p className="mt-2 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                {entreprise} reprend ces lignes. Le même lien vous ramène ici.
              </p>
              <ul className="mt-3 flex flex-col gap-2" data-atlas="lignes-renvoyees">
                {lignes.map((l) => (
                  <li key={l.id} className="rounded-[6px] p-3" style={{ backgroundColor: voile(colors.montantSortie, 0.08) }}>
                    <div className="flex items-baseline gap-2">
                      <span className="w-11 flex-none text-[13.5px] tabular-nums" style={{ color: colors.inkSoft }}>
                        {jourCourt(l.jour)}
                      </span>
                      <span className="min-w-0 flex-1 text-[14.5px] font-semibold [overflow-wrap:anywhere]">{l.libelle}</span>
                      <span className="flex-none whitespace-nowrap text-[16.5px] tabular-nums" style={{ fontFamily: font.display, color: l.sens === "entree" ? colors.montantEntree : colors.montantSortie }}>
                        {montantSigne(l.montant, l.sens)}
                      </span>
                    </div>
                    {l.note && (
                      <span className="ml-[52px] mt-1 block text-[13.5px]" style={{ color: colors.montantSortie }}>
                        Rejetée : {l.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <label htmlFor={idMot} className="mt-[18px] block">
                <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
                  Un mot pour {entreprise}
                </span>
                <textarea id={idMot} value={mot} rows={3} maxLength={1000} placeholder="Facultatif" onChange={(e) => setMot(e.target.value)} className="block min-h-[84px] w-full resize-none rounded-[6px] px-[15px] py-3.5 text-[16px] outline-none" style={champ} data-atlas="mot-du-comptable" />
              </label>
              <label htmlFor={idEmail} className="mt-4 block">
                <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
                  Votre e-mail
                </span>
                <input id={idEmail} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={idAide} className="block min-h-[52px] w-full rounded-[6px] px-[15px] text-[16px] outline-none" style={champ} />
              </label>
              {/* Hors de l'étiquette : dedans, elle s'ajoutait au nom du champ lu à voix haute. */}
              <p id={idAide} className="mt-1.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
                Pour recevoir un mot quand c’est corrigé.
              </p>
            </>
          )}
          {refus && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[13.5px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}
        </div>
      </div>

      <div className="flex-none" style={{ boxShadow: `inset 0 1px 0 ${colors.line}` }}>
        <div className="mx-auto w-full max-w-[560px] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {fait ? (
            <button type="button" onClick={fermer} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-5 text-[16px] font-medium" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }} data-atlas="revenir-au-dossier">
              Revenir au dossier
            </button>
          ) : (
            <button type="button" disabled={enCours} onClick={renvoyer} className={plein} style={{ backgroundColor: colors.plein, color: surPlein }} data-atlas="renvoyer-a-l-artisan">
              {enCours ? "Envoi…" : `Renvoyer à ${entreprise}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

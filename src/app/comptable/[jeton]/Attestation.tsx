"use client";

import { useEffect, useId, useRef, useState, useTransition, type PointerEvent as EvenementPointeur } from "react";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import {
  FONCTIONS,
  MOT_DE_LA_CONCLUSION,
  NOM_DE_LA_FONCTION,
  SUITE_DE_LA_CONCLUSION,
  TON_DE_LA_CONCLUSION,
  conclusionProposee,
  contenuDeLAttestation,
  jourCourt,
  lireLaSaisie,
  lignesDuSignataire,
  montantSigne,
  type Conclusion,
  type Fonction,
  type LigneAttestee,
} from "@/lib/attestation-comptable";
import { jourIso } from "@/lib/jour";
import { signerAttestationAction } from "./actions";
import Icone from "@/components/atlas/IconeTrait";
import Tampon from "./Tampon";

/**
 * TERMINER ET SIGNER — sa planche du 27 octobre 2026
 * (`appli/soignee/comptable-attestation.html`).
 *
 * Trois étapes, puis l'envoi : la conclusion (Atlas propose, le comptable
 * choisit), qui signe (gardé sur son appareil pour la fois suivante), puis
 * l'attestation elle-même, relue et signée du doigt ou à la souris. Ce qu'il
 * signe est ce qu'il relit : l'aperçu sort de `contenuDeLAttestation`, la
 * fonction qui compose aussi le PDF.
 *
 * Le tampon de son cabinet se pose quand il signe. C'est le seul mouvement.
 */

type Etape = "conclusion" | "signataire" | "signer" | "envoyee";
type Saisie = { nom: string; fonction: Fonction; societe: string; ordre: string; siren: string; adresse: string; email: string; telephone: string };

const VIDE: Saisie = { nom: "", fonction: "expert_comptable", societe: "", ordre: "", siren: "", adresse: "", email: "", telephone: "" };
/** Le signataire, gardé sur SON appareil : la seconde fois, rien ne se redemande. */
const CLE_DU_SIGNATAIRE = "atlas-comptable-signataire";

/** Ce que l'appareil a gardé, ou rien : un stockage refusé (navigation privée) n'empêche pas de signer. */
function signataireGarde(): Saisie | null {
  try {
    const brut = window.localStorage.getItem(CLE_DU_SIGNATAIRE);
    if (!brut) return null;
    const s = { ...VIDE, ...(JSON.parse(brut) as Partial<Saisie>) };
    return FONCTIONS.includes(s.fonction) ? s : null;
  } catch {
    return null;
  }
}

function garderLeSignataire(s: Saisie) {
  try {
    window.localStorage.setItem(CLE_DU_SIGNATAIRE, JSON.stringify(s));
  } catch {
    // Le stockage refusé : il retapera ses coordonnées la prochaine fois, rien de plus.
    return;
  }
}

const TEINTE: Record<"vert" | "ambre" | "rouge", string> = {
  vert: colors.carteVertTexte,
  ambre: colors.carteAmbreTexte,
  rouge: colors.carteRougeTexte,
};

const plein = "inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[17px] font-semibold disabled:opacity-50";
const creux = "inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-medium";

export type LigneDeLAttestation = LigneAttestee & { id: string };

export default function Attestation({
  jeton,
  entreprise,
  du,
  au,
  empreinte,
  lignes,
  fermer,
  signee,
}: {
  jeton: string;
  entreprise: string;
  du: string;
  au: string;
  empreinte: string;
  lignes: LigneDeLAttestation[];
  fermer: () => void;
  signee: () => void;
}) {
  const rejetees = lignes.filter((l) => l.verdict === "rejete");
  const [etape, setEtape] = useState<Etape>("conclusion");
  const [conclusion, setConclusion] = useState<Conclusion>(conclusionProposee(rejetees.length));
  const [observations, setObservations] = useState("");
  // Monté après un appui, jamais au premier rendu du serveur : lire l'appareil ici ne fait pas diverger l'hydratation.
  const [garde] = useState<Saisie | null>(signataireGarde);
  const [saisie, setSaisie] = useState<Saisie>(garde ?? VIDE);
  const [modifier, setModifier] = useState(garde === null);
  const [trace, setTrace] = useState(false);
  const [posee, setPosee] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const toile = useRef<HTMLCanvasElement>(null);
  const tampon = useRef<HTMLDivElement>(null);
  const jour = jourIso(new Date());
  const idTampon = useId().replace(/:/g, "");

  const lue = lireLaSaisie({ conclusion, observations, signataire: saisie });
  const contenu = lue.ok
    ? contenuDeLAttestation({ entreprise, du, au, conclusion, observations: lue.valeur.observations, lignes, signataire: lue.valeur.signataire, signeLe: jour, empreinteDuDossier: empreinte })
    : null;
  const teinte = TEINTE[TON_DE_LA_CONCLUSION[conclusion]];

  // La toile prend la taille où elle est posée, à deux pixels par point au
  // plus : le PNG reste léger, et le trait net sur le papier.
  useEffect(() => {
    const c = toile.current;
    if (etape !== "signer" || !c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(c.clientWidth * dpr);
    c.height = Math.round(c.clientHeight * dpr);
    const x = c.getContext("2d");
    if (!x) return;
    x.scale(dpr, dpr);
    x.lineWidth = 2.2;
    x.lineCap = "round";
    x.lineJoin = "round";
    x.strokeStyle = getComputedStyle(c).color;
  }, [etape]);

  // Le tampon se pose : il descend, s'écrase un peu, se fixe. Une fois, et pas
  // pour qui a demandé moins de mouvement à son appareil.
  useEffect(() => {
    if (!posee || !tampon.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tampon.current.animate(
      [
        { opacity: 0, transform: "rotate(-9deg) scale(1.6)" },
        { opacity: 0.96, transform: "rotate(-9deg) scale(0.97)", offset: 0.62 },
        { opacity: 0.92, transform: "rotate(-9deg) scale(1)" },
      ],
      { duration: 460, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "both" }
    );
  }, [posee]);

  function aller(vers: Etape) {
    setRefus(null);
    // La toile se redessine vide en revenant : « Signer » ne doit pas rester allumé sur un trait disparu.
    setTrace(false);
    setEtape(vers);
  }

  function signer() {
    if (!toile.current || !lue.ok) return;
    const image = toile.current.toDataURL("image/png");
    setRefus(null);
    demarrer(async () => {
      const r = await signerAttestationAction(jeton, { conclusion, observations, signataire: saisie }, image);
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      garderLeSignataire(saisie);
      setPosee(true);
      const lent = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 400 : 1300;
      window.setTimeout(() => {
        setEtape("envoyee");
        signee();
      }, lent);
    });
  }

  const rang = etape === "conclusion" ? 1 : etape === "signataire" ? 2 : etape === "signer" ? 3 : null;
  const retour: Record<Etape, () => void> = {
    conclusion: fermer,
    signataire: () => aller("conclusion"),
    signer: () => aller("signataire"),
    envoyee: fermer,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }} data-atlas="attestation-comptable" data-etape={etape}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[560px] px-5 pb-8 pt-3">
          {etape !== "envoyee" && (
            <div className="flex items-center justify-between">
              <button type="button" onClick={retour[etape]} aria-label="Retour" className="flex h-12 w-12 items-center justify-center rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${colors.line}` }}>
                <Icone nom="retour" />
              </button>
              {rang && (
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: colors.inkSoft }}>
                  {rang} sur 3
                </span>
              )}
            </div>
          )}

          {etape === "conclusion" && (
            <>
              <h2 className="mt-1.5 text-[28px] leading-[1.08]" style={{ fontFamily: font.display }}>
                Votre conclusion
              </h2>
              <p className="mt-2 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                <b className="font-semibold" style={{ color: colors.ink }}>
                  {lignes.length} {lignes.length > 1 ? "lignes vérifiées" : "ligne vérifiée"}
                </b>
                , {rejetees.length === 0 ? (lignes.length > 1 ? "toutes validées." : "validée.") : `${lignes.length - rejetees.length} validée${lignes.length - rejetees.length > 1 ? "s" : ""} et ${rejetees.length} rejetée${rejetees.length > 1 ? "s" : ""}.`}
              </p>
              {rejetees.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2" data-atlas="lignes-rejetees">
                  {rejetees.map((l) => (
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
              )}
              <div className="mt-[18px] rounded-[6px] px-4 py-0.5" style={{ backgroundColor: colors.card }} role="radiogroup" aria-label="Le dossier est">
                {(["conforme", "reserves", "non_conforme"] as const).map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={conclusion === c}
                    onClick={() => setConclusion(c)}
                    className="flex min-h-[64px] w-full items-center gap-3 py-3 text-left"
                    style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}
                    data-atlas={`conclusion-${c}`}
                  >
                    <span className="h-[22px] w-[22px] flex-none rounded-full" style={{ boxShadow: `inset 0 0 0 ${conclusion === c ? 7 : 1.5}px ${conclusion === c ? colors.or : colors.chevron}` }} />
                    <span className="min-w-0 flex-1">
                      <b className="block text-[17.5px] font-normal leading-[1.25]" style={{ fontFamily: font.display }}>
                        {MOT_DE_LA_CONCLUSION[c]}
                      </b>
                      <small className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
                        {c === "reserves" && rejetees.length === 1 ? "Sauf la ligne rejetée" : SUITE_DE_LA_CONCLUSION[c]}
                      </small>
                    </span>
                    {conclusionProposee(rejetees.length) === c && (
                      <span className="flex-none rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold" style={{ color: colors.or, boxShadow: `inset 0 0 0 1px ${voile(colors.or, 0.6)}` }}>
                        Proposé
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <Champ etiquette="Observations" valeur={observations} onChange={setObservations} placeholder="Facultatif" lignes={3} />
            </>
          )}

          {etape === "signataire" && (
            <>
              <h2 className="mt-1.5 text-[28px] leading-[1.08]" style={{ fontFamily: font.display }}>
                Qui signe
              </h2>
              {!modifier && lue.ok ? (
                <>
                  <div className="mt-[18px] rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }} data-atlas="carte-du-signataire">
                    {lignesDuSignataire(lue.valeur.signataire).map((l, i) =>
                      i === 0 ? (
                        <p key={i} className="text-[21px] leading-[1.2]" style={{ fontFamily: font.display }}>
                          {l}
                        </p>
                      ) : (
                        <p key={i} className="mt-0.5 text-[14.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
                          {l}
                        </p>
                      )
                    )}
                    <button type="button" onClick={() => setModifier(true)} className="-mb-2.5 -ml-1 mt-1.5 inline-flex min-h-[48px] items-center gap-1.5 px-1 text-[16px] font-semibold" style={{ color: colors.rust }}>
                      <Icone nom="crayon" taille={20} />
                      Modifier
                    </button>
                  </div>
                  <p className="mt-2.5 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                    Gardé sur cet appareil depuis votre dernière attestation.
                  </p>
                </>
              ) : (
                <>
                  <Rubrique>Vous</Rubrique>
                  <Champ etiquette="Nom et prénom" valeur={saisie.nom} onChange={(v) => setSaisie({ ...saisie, nom: v })} autoComplete="name" />
                  <div className="mt-4">
                    <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
                      Fonction
                    </span>
                    <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: voile(colors.ink, 0.06) }} role="radiogroup" aria-label="Fonction">
                      {FONCTIONS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          role="radio"
                          aria-checked={saisie.fonction === f}
                          onClick={() => setSaisie({ ...saisie, fonction: f })}
                          className="min-h-[44px] flex-auto whitespace-nowrap rounded-[9px] px-2 text-[14px] font-semibold"
                          style={saisie.fonction === f ? { backgroundColor: colors.card, color: colors.ink } : { color: colors.inkSoft }}
                        >
                          {NOM_DE_LA_FONCTION[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Rubrique>Le cabinet</Rubrique>
                  <Champ etiquette="Dénomination sociale" valeur={saisie.societe} onChange={(v) => setSaisie({ ...saisie, societe: v })} autoComplete="organization" />
                  <div className="grid grid-cols-2 gap-2.5">
                    {saisie.fonction === "expert_comptable" && <Champ etiquette="N° à l’Ordre" valeur={saisie.ordre} onChange={(v) => setSaisie({ ...saisie, ordre: v })} />}
                    <Champ etiquette="SIREN" valeur={saisie.siren} onChange={(v) => setSaisie({ ...saisie, siren: v })} inputMode="numeric" />
                  </div>
                  <Champ etiquette="Adresse" valeur={saisie.adresse} onChange={(v) => setSaisie({ ...saisie, adresse: v })} autoComplete="street-address" />
                  <Rubrique>Pour vous joindre</Rubrique>
                  <Champ etiquette="E-mail" valeur={saisie.email} onChange={(v) => setSaisie({ ...saisie, email: v })} type="email" inputMode="email" autoComplete="email" />
                  <Champ etiquette="Téléphone" valeur={saisie.telephone} onChange={(v) => setSaisie({ ...saisie, telephone: v })} type="tel" inputMode="tel" autoComplete="tel" />
                  <p className="mt-3.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
                    Gardé sur cet appareil pour la prochaine fois.
                  </p>
                </>
              )}
            </>
          )}

          {etape === "signer" && contenu && (
            <>
              <h2 className="mt-1.5 text-[28px] leading-[1.08]" style={{ fontFamily: font.display }}>
                Relire et signer
              </h2>
              <article className="relative mt-4 rounded-[4px] px-5 pb-4 pt-[22px] text-[13.5px] leading-[1.5]" style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }} data-atlas="apercu-attestation">
                <h3 className="text-[22px] leading-[1.15]" style={{ fontFamily: font.display }}>
                  {contenu.titre}
                </h3>
                <p className="mt-1.5" style={{ color: colors.inkSoft }}>
                  {contenu.dossier}
                  <br />
                  {contenu.periode}
                </p>
                <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[5px] pt-3.5" style={{ borderTop: `1px solid ${colors.line}` }}>
                  <dt style={{ color: colors.inkSoft }}>Conclusion</dt>
                  <dd className="text-right text-[17px] leading-[1.3]" style={{ fontFamily: font.display, color: teinte }}>
                    {contenu.motConclusion}
                  </dd>
                  {(
                    [
                      ["Lignes vérifiées", contenu.comptes.lignes],
                      ["Validées", contenu.comptes.validees],
                      ["Rejetées", contenu.comptes.rejetees],
                    ] as const
                  ).map(([t, n]) => (
                    <div key={t} className="contents">
                      <dt style={{ color: colors.inkSoft }}>{t}</dt>
                      <dd className="text-right tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>
                {contenu.rejets.length > 0 && (
                  <div className="mt-3.5 rounded-[6px] px-3 py-2.5" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
                    <b className="block text-[12.5px]">{contenu.rejets.length > 1 ? "Lignes rejetées" : "Ligne rejetée"}</b>
                    {contenu.rejets.map((r, i) => (
                      <div key={i} className="mt-1">
                        <div className="flex justify-between gap-2.5 font-semibold">
                          <span className="[overflow-wrap:anywhere]">
                            {r.jour} {r.libelle}
                          </span>
                          <span className="whitespace-nowrap tabular-nums">{r.montant}</span>
                        </div>
                        {r.note && <p>{r.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {contenu.observations && (
                  <p className="mt-3.5">
                    <b className="block text-[12.5px] font-semibold" style={{ color: colors.inkSoft }}>
                      Observations
                    </b>
                    {contenu.observations}
                  </p>
                )}
                <p className="mt-[18px] text-[16px] italic leading-[1.45]" style={{ fontFamily: font.display }}>
                  {contenu.phrase}
                </p>
                <p className="mt-2.5 text-[12.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
                  {contenu.signataire.map((l, i) => (
                    <span key={i} className={i === 0 ? "block text-[14px] font-semibold" : "block"} style={i === 0 ? { color: colors.ink } : undefined}>
                      {l}
                    </span>
                  ))}
                </p>
                <div className="relative mt-3.5">
                  <div className="flex min-h-[36px] items-center justify-between text-[12.5px]" style={{ color: colors.inkSoft }}>
                    <span>{contenu.fait}</span>
                    {trace && !posee && (
                      <button type="button" onClick={() => effacer(toile.current, setTrace)} className="min-h-[40px] pl-3 text-[14px] font-semibold" style={{ color: colors.ink }}>
                        Effacer
                      </button>
                    )}
                  </div>
                  <ZoneDeSignature toile={toile} trace={trace} figee={posee} onTrace={() => setTrace(true)} />
                  {posee && (
                    <div ref={tampon} className="pointer-events-none absolute -right-1.5 bottom-2" style={{ opacity: 0.92, transform: "rotate(-9deg)", mixBlendMode: "multiply" }} data-atlas="tampon-pose">
                      <Tampon id={`${idTampon}a`} conclusion={conclusion} societe={lue.ok ? lue.valeur.signataire.societe : ""} jour={jour} couleur={teinte} taille={118} />
                    </div>
                  )}
                </div>
                <p className="mt-4 pt-2.5 text-[11.5px] leading-[1.45]" style={{ color: colors.inkSoft, borderTop: `1px solid ${colors.line}` }}>
                  {contenu.pied}
                  <span className="mt-1 block font-mono text-[11px] [overflow-wrap:anywhere]">{contenu.empreinte}</span>
                </p>
              </article>
            </>
          )}

          {etape === "envoyee" && (
            <div className="flex flex-col items-center pt-6 text-center" data-atlas="attestation-envoyee">
              <Tampon id={`${idTampon}b`} conclusion={conclusion} societe={lue.ok ? lue.valeur.signataire.societe : ""} jour={jour} couleur={teinte} taille={156} className="-rotate-6" />
              <h2 className="mt-[18px] text-[28px] leading-[1.08]" style={{ fontFamily: font.display }}>
                Attestation envoyée
              </h2>
              <p className="mt-2.5 max-w-[34ch] text-[15.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
                {entreprise} la reçoit dans Atlas, rangée avec son dossier.
              </p>
            </div>
          )}

          {refus && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[13.5px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}
        </div>
      </div>

      <div className="flex-none" style={{ boxShadow: `inset 0 1px 0 ${colors.line}` }}>
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-1 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {etape === "conclusion" && (
            <button type="button" onClick={() => aller("signataire")} className={plein} style={{ backgroundColor: colors.plein, color: surPlein }} data-atlas="continuer">
              Continuer
            </button>
          )}
          {etape === "signataire" && (
            <button
              type="button"
              disabled={!lue.ok}
              onClick={() => {
                setModifier(false);
                aller("signer");
              }}
              className={plein}
              style={{ backgroundColor: colors.plein, color: surPlein }}
              data-atlas="continuer"
            >
              Continuer
            </button>
          )}
          {etape === "signataire" && !lue.ok && (saisie.nom || saisie.societe || saisie.email) && (
            <p className="text-center text-[13.5px]" style={{ color: colors.carteAmbreTexte }}>
              {lue.raison}
            </p>
          )}
          {etape === "signer" && (
            <button type="button" disabled={!trace || enCours || posee} onClick={signer} className={plein} style={{ backgroundColor: colors.plein, color: surPlein }} data-atlas="signer-et-envoyer">
              {posee ? "Signée" : enCours ? "Envoi…" : "Signer et envoyer"}
            </button>
          )}
          {etape === "envoyee" && (
            <>
              <a href={`/comptable/${jeton}/attestation/pdf?telecharger=1`} className={creux} style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.ink }} data-atlas="telecharger-attestation">
                <Icone nom="telecharger" taille={21} />
                Télécharger le PDF
              </a>
              <button type="button" onClick={fermer} className="min-h-[46px] text-[16px] font-medium" style={{ color: colors.inkSoft }}>
                Revenir au dossier
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Rubrique({ children }: { children: string }) {
  return (
    <h3 className="mb-0 mt-6 text-[13px] font-semibold uppercase tracking-[0.12em]" style={{ color: colors.inkSoft, fontFamily: font.body }}>
      {children}
    </h3>
  );
}

function Champ({
  etiquette,
  valeur,
  onChange,
  placeholder,
  lignes,
  type = "text",
  inputMode,
  autoComplete = "off",
}: {
  etiquette: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
  lignes?: number;
  type?: string;
  inputMode?: "numeric" | "email" | "tel";
  autoComplete?: string;
}) {
  const id = useId();
  // 16 px au moins : en dessous, iOS agrandit la page à la mise au point.
  const style = { backgroundColor: colors.card, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.lineSoft}` };
  return (
    <label htmlFor={id} className="mt-4 block">
      <span className="mb-[7px] block text-[14.5px] font-semibold" style={{ color: colors.inkSoft }}>
        {etiquette}
      </span>
      {lignes ? (
        <textarea id={id} value={valeur} rows={lignes} maxLength={1000} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="block min-h-[84px] w-full resize-none rounded-[6px] px-[15px] py-3.5 text-[16px] outline-none" style={style} />
      ) : (
        <input id={id} type={type} inputMode={inputMode} autoComplete={autoComplete} value={valeur} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="block min-h-[52px] w-full rounded-[6px] px-[15px] text-[16px] outline-none" style={style} />
      )}
    </label>
  );
}

function effacer(toile: HTMLCanvasElement | null, setTrace: (v: boolean) => void) {
  const c = toile?.getContext("2d");
  if (toile && c) c.clearRect(0, 0, toile.width, toile.height);
  setTrace(false);
}

/**
 * La zone où il signe, au doigt ou à la souris. Le trait suit le pointeur,
 * sans lissage : une signature se reconnaît à ses accidents. `touch-action:
 * none` empêche la page de défiler sous le doigt qui signe.
 */
function ZoneDeSignature({ toile, trace, figee, onTrace }: { toile: React.RefObject<HTMLCanvasElement | null>; trace: boolean; figee: boolean; onTrace: () => void }) {
  const actif = useRef(false);

  function point(e: EvenementPointeur<HTMLCanvasElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top] as const;
  }

  return (
    <div
      className="relative h-[132px] rounded-[6px]"
      style={
        trace || figee
          ? { boxShadow: `inset 0 0 0 1px ${colors.line}` }
          : { backgroundColor: voile(colors.or, 0.06), boxShadow: `inset 0 0 0 1.5px ${voile(colors.or, 0.55)}` }
      }
    >
      <span className="pointer-events-none absolute inset-x-3.5 bottom-[30px] h-px" style={{ backgroundColor: voile(colors.ink, 0.22) }} />
      {!trace && (
        <span className="pointer-events-none absolute inset-x-0 top-[40%] flex items-center justify-center gap-2 text-[14.5px] font-semibold" style={{ color: colors.or }}>
          <Icone nom="crayon" taille={20} />
          Signez ici
        </span>
      )}
      <canvas
        ref={toile}
        aria-label="Zone de signature"
        className="absolute inset-0 h-full w-full touch-none"
        style={{ color: colors.ink, cursor: figee ? "default" : "crosshair" }}
        data-atlas="zone-de-signature"
        onPointerDown={(e) => {
          if (figee) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          actif.current = true;
          const x = e.currentTarget.getContext("2d");
          const [px, py] = point(e);
          x?.beginPath();
          x?.moveTo(px, py);
        }}
        onPointerMove={(e) => {
          if (!actif.current) return;
          const x = e.currentTarget.getContext("2d");
          const [px, py] = point(e);
          x?.lineTo(px, py);
          x?.stroke();
          if (!trace) onTrace();
        }}
        onPointerUp={() => {
          actif.current = false;
        }}
        onPointerCancel={() => {
          actif.current = false;
        }}
      />
    </div>
  );
}

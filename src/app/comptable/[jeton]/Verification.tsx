"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { colors, couleursDocument, font } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE } from "@/lib/couleurs-comptable";
import { avancementDeLaVerification, libellePeriode, type Categorie, type EtatDeVerification, type VerdictDuComptable } from "@/lib/pour-mon-comptable";
import { poserVerdictAction } from "./actions";

export type PieceAffichee =
  | {
      genre: "ticket";
      nom: string;
      date: string;
      total: string | null;
      tva: string;
      original: "photo" | null;
      /** Le ticket recopié ligne par ligne (lot 5), ou rien pour un ticket d'avant. */
      lignes: { g: string; d: string | null; surligne: boolean }[] | null;
      /** Une des lignes porte le total : il ne s'ajoute pas à part. */
      totalSurUneLigne: boolean;
    }
  | { genre: "facture"; nom: string; detail: string; total: string | null; original: "photo" | "pdf" | null }
  | { genre: "emise"; numero: string }
  | { genre: "perdu" }
  | { genre: "motif"; libelle: string }
  | { genre: "aucune" };

export type LigneAVerifier = {
  id: string;
  jour: string;
  jourCourt: string;
  jourLong: string;
  libelle: string;
  montant: string;
  sens: "entree" | "sortie";
  categorie: Categorie;
  piece: PieceAffichee;
  etiquette: string;
  verification: EtatDeVerification;
};

const estVerifiee = (e: EtatDeVerification) => e.etat === "valide" || e.etat === "rejete";

/** L'état que l'écran montre tout de suite, avant même la réponse du serveur. */
function etatApres(avant: EtatDeVerification, verdict: VerdictDuComptable | null, note: string | null): EtatDeVerification {
  if (verdict === null) return { etat: "a_verifier" };
  if (verdict === "valide") return { etat: "valide" };
  const propre = note?.replace(/\s+/g, " ").trim() || null;
  return { etat: "rejete", note: propre, avaitValide: avant.etat === "valide" || (avant.etat === "rejete" && avant.avaitValide) };
}

const bouton = "min-h-[46px] min-w-0 flex-1 basis-0 rounded-full px-2 text-center text-[14.5px] font-medium disabled:opacity-60";

export default function Verification({
  jeton,
  titre,
  periode,
  envoye,
  entreprise,
  lignes: depart,
}: {
  jeton: string;
  titre: string;
  periode: string;
  envoye: string;
  entreprise: string;
  lignes: LigneAVerifier[];
}) {
  const [lignes, setLignes] = useState(depart);
  const mois = useMemo(() => [...new Set(depart.map((l) => l.jour.slice(0, 7)))], [depart]);
  const [moisChoisi, setMoisChoisi] = useState(mois[0] ?? "");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [demandeRouge, setDemandeRouge] = useState(false);
  const [note, setNote] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const duMois = lignes.filter((l) => l.jour.startsWith(moisChoisi));
  const a = avancementDeLaVerification(duMois.map((l) => l.verification));
  const ligne = ouvert ? lignes.find((l) => l.id === ouvert) ?? null : null;
  const index = ligne ? duMois.findIndex((l) => l.id === ligne.id) : -1;
  const suivante = duMois.find((l, k) => k > index && !estVerifiee(l.verification)) ?? null;

  function ouvrir(id: string) {
    setOuvert(id);
    setDemandeRouge(false);
    setRefus(null);
  }

  function poser(id: string, verdict: VerdictDuComptable | null, texte: string | null, ensuite?: () => void) {
    const avant = lignes.find((l) => l.id === id);
    if (!avant) return;
    setRefus(null);
    setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, verification: etatApres(l.verification, verdict, texte) } : l)));
    ensuite?.();
    demarrer(async () => {
      const r = await poserVerdictAction(jeton, id, verdict, texte);
      if (!r.ok) {
        setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, verification: avant.verification } : l)));
        setRefus(r.raison);
      }
    });
  }

  /** Le rond de la liste : un second appui sur le même l'enlève, une erreur se défait. */
  function rond(l: LigneAVerifier, verdict: VerdictDuComptable) {
    if (l.verification.etat === verdict) return poser(l.id, null, null);
    if (verdict === "rejete") {
      ouvrir(l.id);
      setNote(l.verification.etat === "rejete" || l.verification.etat === "corrigee" ? l.verification.note ?? "" : "");
      setDemandeRouge(true);
      return;
    }
    poser(l.id, "valide", null);
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}>
      <div className="mx-auto flex max-w-[1180px] items-start">
        <main className="min-w-0 flex-1 px-4 pb-12 pt-6 md:px-6" data-atlas="verification-comptable">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="m-0 text-[26px] leading-[1.15]" style={{ fontFamily: font.display }}>
              {titre}
            </h1>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: colors.orTexte }}>
              {envoye}
            </span>
          </div>
          <p className="mt-1 text-[13.5px]" style={{ color: colors.inkSoft }}>
            {periode}
          </p>

          <div className="mt-4">
            <div className="flex justify-between text-[13px]" style={{ color: colors.inkSoft }}>
              <span data-atlas="avancement">
                <b className="font-medium" style={{ color: colors.ink }}>
                  {a.verifiees} sur {a.total}
                </b>{" "}
                lignes vérifiées en {libellePeriode(moisChoisi).toLowerCase()}
              </span>
              {a.rejetees > 0 && <span style={{ color: colors.montantSortie }}>{a.rejetees} rejetée{a.rejetees > 1 ? "s" : ""}</span>}
            </div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.lineSoft }}>
              <i style={{ width: `${a.total ? ((a.verifiees - a.rejetees) / a.total) * 100 : 0}%`, backgroundColor: colors.montantEntree }} />
              <i style={{ width: `${a.total ? (a.rejetees / a.total) * 100 : 0}%`, backgroundColor: colors.montantSortie }} />
            </div>
          </div>

          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Mois">
            {mois.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === moisChoisi}
                onClick={() => {
                  setMoisChoisi(m);
                  setOuvert(null);
                }}
                className="min-h-[36px] flex-none rounded-full px-3 text-[13px]"
                style={{ border: `1px solid ${m === moisChoisi ? colors.ink : colors.line}`, backgroundColor: colors.card, color: m === moisChoisi ? colors.ink : colors.muted }}
              >
                {libellePeriode(m)}
              </button>
            ))}
          </div>

          <ul className="mt-3" data-atlas="lignes-du-comptable">
            {duMois.map((l) => (
              <li
                key={l.id}
                className="grid grid-cols-[4px_1fr_auto] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[4px_52px_1fr_120px_110px_auto_auto]"
                style={{ borderBottom: `1px solid ${colors.lineSoft}`, backgroundColor: l.id === ouvert ? colors.rustTint : undefined }}
                data-atlas="ligne-du-comptable"
              >
                <span className="row-span-2 h-full rounded-sm md:row-span-1" style={{ backgroundColor: COULEUR_CATEGORIE[l.categorie] }} />
                <span className="hidden text-[13px] md:block" style={{ color: colors.muted }}>
                  {l.jourCourt}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px]" style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                    {l.libelle}
                  </span>
                  {(l.verification.etat === "rejete" || l.verification.etat === "corrigee") && l.verification.note && (
                    <span className="mt-0.5 block text-[12px]" style={{ color: l.verification.etat === "rejete" ? colors.montantSortie : colors.muted }}>
                      {l.verification.etat === "corrigee" ? `Corrigée depuis votre rejet : ${l.verification.note}` : l.verification.note}
                    </span>
                  )}
                </span>
                <span className="hidden text-[12px] md:block" style={{ color: COULEUR_CATEGORIE[l.categorie] }}>
                  {NOM_CATEGORIE[l.categorie]}
                </span>
                <span className="text-right text-[15px] tabular-nums" style={{ fontFamily: font.display, color: l.sens === "entree" ? colors.montantEntree : colors.ink }}>
                  {l.montant}
                </span>
                <button
                  type="button"
                  onClick={() => ouvrir(l.id)}
                  className="col-start-2 justify-self-start whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] md:col-start-auto"
                  style={{
                    minHeight: 36,
                    border: `1px ${l.piece.genre === "perdu" ? "dashed" : "solid"} ${colors.line}`,
                    backgroundColor: colors.card,
                    color: l.piece.genre === "perdu" ? colors.alert : colors.ink,
                    fontStyle: l.piece.genre === "perdu" ? "italic" : undefined,
                  }}
                  data-atlas="ouvrir-justificatif"
                >
                  {l.etiquette}
                </button>
                <span className={`flex justify-end gap-1.5 ${ouvert ? "md:hidden" : ""}`}>
                  <button
                    type="button"
                    aria-label="Valider"
                    aria-pressed={l.verification.etat === "valide"}
                    onClick={() => rond(l, "valide")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[17px] font-semibold"
                    style={l.verification.etat === "valide" ? { backgroundColor: colors.montantEntree, color: colors.card } : { border: `1.5px solid ${colors.line}`, backgroundColor: colors.card, color: colors.muted }}
                    data-atlas="rond-valider"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    aria-label="Rejeter"
                    aria-pressed={l.verification.etat === "rejete"}
                    onClick={() => rond(l, "rejete")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[17px] font-semibold"
                    style={l.verification.etat === "rejete" ? { backgroundColor: colors.montantSortie, color: colors.card } : { border: `1.5px solid ${colors.line}`, backgroundColor: colors.card, color: colors.muted }}
                    data-atlas="rond-rejeter"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {refus && !ligne && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}
        </main>

        {ligne && (
          <aside
            className="fixed inset-0 z-50 overflow-auto px-5 pb-8 pt-5 md:sticky md:top-0 md:z-auto md:max-h-dvh md:w-[400px] md:flex-none"
            style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.line}` }}
            data-atlas="panneau-justificatif"
          >
            <button type="button" onClick={() => setOuvert(null)} className="min-h-[40px] text-[15px]" style={{ color: colors.inkSoft }}>
              Fermer
            </button>
            <div className="mt-1.5 rounded-xl px-3.5 py-3" style={{ backgroundColor: colors.cream }}>
              <div className="text-[12.5px]" style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                {ligne.libelle}
              </div>
              <div className="mt-1 text-[24px] tabular-nums" style={{ fontFamily: font.display, color: ligne.sens === "entree" ? colors.montantEntree : colors.ink }}>
                {ligne.montant}
              </div>
              <div className="mt-0.5 text-[12px]" style={{ color: colors.muted }}>
                {ligne.jourLong} à la banque, {NOM_CATEGORIE[ligne.categorie].toLowerCase()}
              </div>
            </div>

            <Piece jeton={jeton} ligne={ligne} entreprise={entreprise} />

            <Accord etat={ligne.verification} demandeRouge={demandeRouge} />

            {demandeRouge ? (
              <>
                <label className="mt-3.5 block text-[12.5px]" style={{ color: colors.muted }}>
                  {ligne.verification.etat === "valide" ? "Expliquez ce changement" : "Justifier le rejet"}
                  <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    className="mt-1.5 block min-h-[70px] w-full rounded-[10px] px-3 py-2.5 text-[15px]"
                    style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}
                    data-atlas="raison-du-rejet"
                  />
                </label>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => poser(ligne.id, "rejete", note, () => setDemandeRouge(false))}
                    className={bouton}
                    style={{ backgroundColor: colors.montantSortie, color: colors.card }}
                    data-atlas="confirmer-rejet"
                  >
                    Rejeter
                  </button>
                  <button type="button" onClick={() => setDemandeRouge(false)} className={bouton} style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}>
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => poser(ligne.id, "valide", null, () => suivante && ouvrir(suivante.id))}
                  className={bouton}
                  style={{ backgroundColor: colors.montantEntree, color: colors.card }}
                  data-atlas="valider"
                >
                  Valider
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNote(ligne.verification.etat === "rejete" || ligne.verification.etat === "corrigee" ? ligne.verification.note ?? "" : "");
                    setDemandeRouge(true);
                  }}
                  className={bouton}
                  style={{ backgroundColor: colors.montantSortie, color: colors.card }}
                  data-atlas="rejeter"
                >
                  Rejeter
                </button>
                {suivante && (
                  <button type="button" onClick={() => ouvrir(suivante.id)} className={bouton} style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }} data-atlas="suivant">
                    Suivant
                  </button>
                )}
              </div>
            )}
            {refus && (
              <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
                {refus}
              </p>
            )}
            {a.verifiees === a.total && a.total > 0 && (
              <p className="mt-4 rounded-xl px-4 py-3.5 text-[14px]" style={{ backgroundColor: colors.cream }} data-atlas="mois-verifie">
                <b className="font-medium">{libellePeriode(moisChoisi)} est vérifié.</b>{" "}
                {a.rejetees > 0 ? `${entreprise} reçoit vos rejets dans Atlas.` : "Tout est validé."}
              </p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Accord({ etat, demandeRouge }: { etat: EtatDeVerification; demandeRouge: boolean }) {
  const texte =
    etat.etat === "valide"
      ? demandeRouge
        ? "Vous l’aviez validée."
        : "Validée."
      : etat.etat === "rejete" && !demandeRouge
        ? `Rejetée : ${etat.note ?? "sans raison écrite"}`
        : etat.etat === "corrigee"
          ? `Corrigée depuis votre rejet : ${etat.note ?? "sans raison écrite"}`
          : null;
  if (!texte) return null;
  return (
    <p className="mt-2.5 text-[13px]" style={{ color: etat.etat === "valide" ? colors.montantEntree : etat.etat === "rejete" ? colors.montantSortie : colors.inkSoft }} data-atlas="accord">
      {texte}
    </p>
  );
}

/** La pièce reconstituée d'abord, la pièce d'origine en glissant : deux points dessous. */
function Piece({ jeton, ligne, entreprise }: { jeton: string; ligne: LigneAVerifier; entreprise: string }) {
  const pistes = useRef<HTMLDivElement>(null);
  const [vue, setVue] = useState(0);
  const p = ligne.piece;
  const original = (p.genre === "ticket" || p.genre === "facture") && p.original ? p.original : null;
  const adresse = `/comptable/${jeton}/piece/${ligne.id}`;

  const reconstituee = <Reconstituee piece={p} entreprise={entreprise} montant={ligne.montant} />;
  if (!original) return <div className="mt-4 flex justify-center">{reconstituee}</div>;

  const aller = (k: number) => pistes.current?.scrollTo({ left: (pistes.current?.clientWidth ?? 0) * k, behavior: "smooth" });
  return (
    <div className="mt-3.5" data-atlas="carrousel">
      <div
        ref={pistes}
        onScroll={(e) => setVue(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex flex-[0_0_100%] snap-center flex-col items-center">
          <span className="mb-2.5 mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: colors.muted }}>
            Reconstitué par Atlas
          </span>
          {reconstituee}
        </div>
        <div className="flex flex-[0_0_100%] snap-center flex-col items-center">
          <span className="mb-2.5 mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: colors.muted }}>
            {original === "pdf" ? "Facture d’origine" : "Photo d’origine"}
          </span>
          {original === "pdf" ? (
            <a href={adresse} target="_blank" rel="noopener" className="text-[14px] font-medium" style={{ color: colors.rust }} data-atlas="original">
              Ouvrir la facture
            </a>
          ) : (
            // Une photo servie par la route du jeton : `next/image` la ferait
            // passer par l'optimiseur, qui n'a pas le jeton.
            <img src={adresse} alt="Pièce d’origine" className="max-h-[60dvh] max-w-full rounded" data-atlas="original" />
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2.5">
        {[0, 1].map((k) => (
          <button key={k} type="button" aria-label={k === 0 ? "Reconstitué" : "Origine"} aria-current={vue === k} onClick={() => aller(k)} className="inline-flex h-[22px] w-[22px] items-center justify-center">
            <span className="block h-[9px] w-[9px] rounded-full" style={{ border: `1.5px solid ${colors.inkSoft}`, backgroundColor: vue === k ? colors.inkSoft : "transparent" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * La pièce réécrite, sur du papier : elle garde l'allure d'un document quelle
 * que soit la charte, comme le PDF (`couleursDocument`). Le total est surligné
 * bleu gris, son choix du 24 octobre.
 */
function Reconstituee({ piece: p, entreprise, montant }: { piece: PieceAffichee; entreprise: string; montant: string }) {
  const papier = { backgroundColor: couleursDocument.papier, color: couleursDocument.encre, boxShadow: `0 8px 24px ${colors.line}` };
  const total = (libelle: string, valeur: string | null) => (
    <div className="mt-1 flex justify-between gap-2 rounded-[3px] px-1.5 py-1 font-bold" style={{ backgroundColor: couleursDocument.surligne }}>
      <span>{libelle}</span>
      <span>{valeur ?? "non lu"}</span>
    </div>
  );
  switch (p.genre) {
    case "ticket":
      if (p.lignes) {
        return (
          <div className="w-[280px] max-w-full px-3.5 py-4 text-[11.5px] leading-[1.45]" style={{ ...papier, fontFamily: "ui-monospace, Consolas, monospace" }} data-atlas="reconstituee">
            {p.lignes.map((l, k) => (
              <div key={k} className="flex justify-between gap-2 rounded-[3px] px-1" style={l.surligne ? { backgroundColor: couleursDocument.surligne, fontWeight: 700 } : undefined}>
                <span className="min-w-0 break-words">{l.g}</span>
                {l.d && <span className="flex-none">{l.d}</span>}
              </div>
            ))}
            {!p.totalSurUneLigne && total("TOTAL TTC", p.total)}
          </div>
        );
      }
      return (
        <div className="w-[260px] max-w-full px-4 py-4 text-[12px] leading-[1.5]" style={{ ...papier, fontFamily: "ui-monospace, Consolas, monospace" }} data-atlas="reconstituee">
          <div className="text-center font-bold">{p.nom}</div>
          <div className="text-center">{p.date}</div>
          <hr className="my-2" style={{ borderColor: couleursDocument.etiquette }} />
          {total("TOTAL TTC", p.total)}
          <div className="flex justify-between">
            <span>dont TVA déductible</span>
            <span>{p.tva}</span>
          </div>
        </div>
      );
    case "facture":
      return (
        <div className="w-[300px] max-w-full px-4 py-4 text-[12px] leading-[1.5]" style={papier} data-atlas="reconstituee">
          <div className="text-[14px] font-bold" style={{ fontFamily: font.display }}>
            {p.nom}
          </div>
          <div className="mb-2.5 mt-1" style={{ color: couleursDocument.etiquette }}>
            {p.detail}
          </div>
          {total("Total TTC", p.total)}
          <div className="mt-2" style={{ color: couleursDocument.etiquette }}>
            Client : {entreprise}
          </div>
        </div>
      );
    case "emise":
      return (
        <div className="w-[300px] max-w-full px-4 py-4 text-[12px] leading-[1.5]" style={papier} data-atlas="reconstituee">
          <div className="flex justify-between">
            <span className="text-[14px] font-bold" style={{ fontFamily: font.display }}>
              {entreprise}
            </span>
            <span>{p.numero}</span>
          </div>
          {total("Total TTC", montant.replace(/^\+/, ""))}
          <div className="mt-2" style={{ color: couleursDocument.etiquette }}>
            Facture émise par Atlas
          </div>
        </div>
      );
    case "perdu":
      return (
        <div className="rounded-xl px-4 py-4 text-[14px]" style={{ border: `1.5px dashed ${colors.line}`, color: colors.inkSoft }} data-atlas="reconstituee">
          Ticket perdu. La ligne a été validée avec cette mention, et sa TVA n’a pas été déduite.
        </div>
      );
    case "motif":
      return (
        <div className="rounded-xl px-4 py-4 text-[14px]" style={{ border: `1px solid ${colors.line}`, color: colors.inkSoft }} data-atlas="reconstituee">
          Virement justifié par sa nature : {p.libelle.toLowerCase()}.
        </div>
      );
    case "aucune":
      return (
        <div className="rounded-xl px-4 py-4 text-[14px]" style={{ border: `1.5px dashed ${colors.line}`, color: colors.inkSoft }} data-atlas="reconstituee">
          Aucune pièce jointe à cette ligne.
        </div>
      );
  }
}

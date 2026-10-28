"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import { colors, couleursDocument, font, surPlein, voile } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE } from "@/lib/couleurs-comptable";
import { avancementDeLaVerification, libellePeriode, type Categorie, type EtatDeVerification, type VerdictDuComptable } from "@/lib/pour-mon-comptable";
import { moisSeul } from "@/lib/termines-par-mois";
import { poserVerdictAction } from "./actions";
import Icone, { type NomIcone } from "@/components/atlas/IconeTrait";
import { useRouter } from "next/navigation";
import { MOT_DE_LA_CONCLUSION, type Conclusion } from "@/lib/attestation-comptable";
import Attestation from "./Attestation";
import Renvoi from "./Renvoi";
import BoutonTelechargerDocument from "@/components/atlas/BoutonTelechargerDocument";

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
  /** Un virement reçu qui paie une facture faite hors d'Atlas (migration 0150). */
  | { genre: "hors_atlas"; sortie: boolean; total: string | null; original: "photo" | "pdf" }
  | { genre: "emise"; numero: string; total: string }
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
  /** Le montant tel qu'en base, positif : l'attestation le relit et le signe elle-même. */
  montantBrut: string;
  sens: "entree" | "sortie";
  categorie: Categorie;
  piece: PieceAffichee;
  etiquette: string;
  /** Une pièce jointe malgré un autre montant : la phrase entière, ce qui suit le mot du bouton, et si elle s'alerte. */
  ecart: { phrase: string; suite: string; signale: boolean } | null;
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

const ICONE_DE_LA_PIECE: Record<PieceAffichee["genre"], NomIcone | null> = {
  ticket: "facture",
  facture: "document",
  hors_atlas: "document",
  emise: "document",
  motif: "banque",
  perdu: "alerte",
  aucune: null,
};

/** Valider, Rejeter, Suivant : la même largeur, son choix du 24 octobre. */
const bouton = "min-h-[50px] min-w-0 flex-1 basis-0 rounded-full px-2 text-center text-[15.5px] font-semibold disabled:opacity-60";
const creux = { boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.card, color: colors.ink };

/**
 * Entre 1024 et 1280 points, la pièce ouverte laisse 560 points à la liste :
 * les ronds la feraient défiler de côté. Ils s'effacent, Valider et Rejeter
 * sont dans le panneau. Au-delà, tout tient, comme sur la planche.
 */
const RONDS_SOUS_LE_PANNEAU = "lg:max-xl:hidden";

/**
 * La teinte d'une ligne : verte validée, rouge rejetée, et celle de la pièce
 * ouverte par-dessus, pour qu'il retrouve sa place dans la liste.
 */
function fondDeLaLigne(l: LigneAVerifier, ouverte: boolean): string | undefined {
  if (ouverte) return colors.rustTint;
  if (l.verification.etat === "valide") return voile(colors.montantEntree, 0.07);
  if (l.verification.etat === "rejete") return voile(colors.montantSortie, 0.08);
  return undefined;
}

export default function Verification({
  jeton,
  titre,
  periode,
  envoye,
  entreprise,
  lignes: depart,
  dossier,
  attestation,
  renvoye,
  apercu = false,
}: {
  jeton: string;
  titre: string;
  periode: string;
  envoye: string;
  entreprise: string;
  lignes: LigneAVerifier[];
  dossier: { du: string; au: string; empreinte: string };
  /** La dernière attestation signée sur ce lien, et si le dossier n'a pas bougé depuis. */
  attestation: { conclusion: Conclusion; signee: string; aJour: boolean } | null;
  /** « Renvoyé le 27 octobre. », le dernier renvoi à corriger, ou rien. */
  renvoye: string | null;
  /** Ouverte par le patron pour voir ce que voit son comptable : un bouton Fermer le ramène à ses dossiers. */
  apercu?: boolean;
}) {
  const router = useRouter();
  const [signer, setSigner] = useState(false);
  const [renvoyer, setRenvoyer] = useState(false);
  const [lignes, setLignes] = useState(depart);
  const mois = useMemo(() => [...new Set(depart.map((l) => l.jour.slice(0, 7)))], [depart]);
  // Un exercice décalé court sur deux années : le mois seul ne dirait plus lequel.
  const uneAnnee = new Set(mois.map((m) => m.slice(0, 4))).size <= 1;
  const nomDuMois = (m: string) => (uneAnnee ? moisSeul(m) : libellePeriode(m).toLowerCase());
  const [moisChoisi, setMoisChoisi] = useState(mois[0] ?? "");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [demandeRouge, setDemandeRouge] = useState(false);
  const [note, setNote] = useState("");
  const [refus, setRefus] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const tout = avancementDeLaVerification(lignes.map((l) => l.verification));
  // Les lignes « corrigées » passent en tête de leur mois : c'est ce qu'il
  // revient revoir (sa planche du 27 octobre). Le tri est stable : le reste
  // garde l'ordre des jours.
  const duMois = lignes.filter((l) => l.jour.startsWith(moisChoisi)).sort((x, y) => Number(y.verification.etat === "corrigee") - Number(x.verification.etat === "corrigee"));
  const corrigees = lignes.filter((l) => l.verification.etat === "corrigee");
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

  function demanderLaRaison(l: LigneAVerifier) {
    setNote(l.verification.etat === "rejete" || l.verification.etat === "corrigee" ? l.verification.note ?? "" : "");
    setDemandeRouge(true);
  }

  /** Le rond de la liste : un second appui sur le même l'enlève, une erreur se défait. */
  function rond(l: LigneAVerifier, verdict: VerdictDuComptable) {
    if (l.verification.etat === verdict) return poser(l.id, null, null);
    if (verdict === "rejete") {
      ouvrir(l.id);
      demanderLaRaison(l);
      return;
    }
    poser(l.id, "valide", null);
  }

  return (
    // La pièce se pose contre le bord droit de la fenêtre ; la liste garde sa
    // largeur de lecture, centrée dans ce qui reste.
    <div className="flex min-h-dvh items-start" style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body }}>
      <main className="min-w-0 flex-1 px-4 pb-12 pt-5 md:px-6 lg:px-8 lg:pt-6" data-atlas="verification-comptable">
        <div className="mx-auto max-w-[1116px]">
          {apercu && (
            <Link href="/termines/comptable/dossiers" className="-ml-2 mb-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[15px] font-medium" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.card, color: colors.ink }} data-atlas="fermer-apercu">
              <Icone nom="croix" taille={19} epaisseur={2} />
              Fermer
            </Link>
          )}
          <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-4">
            <h1 className="m-0 text-[26px] leading-[1.12] md:text-[28px]" style={{ fontFamily: font.display }}>
              {titre}
            </h1>
            <span className="text-[14px] md:whitespace-nowrap" style={{ color: colors.inkSoft }}>
              {envoye}
            </span>
          </div>
          <p className="mt-1.5 text-[15px]" style={{ color: colors.inkSoft }}>
            {periode}
          </p>

          <div className="mt-[18px]">
            <div className="flex flex-col gap-0.5 text-[14.5px] md:flex-row md:justify-between md:gap-3" style={{ color: colors.inkSoft }}>
              <span data-atlas="avancement">
                <b className="font-semibold" style={{ color: colors.ink }}>
                  {tout.verifiees} sur {tout.total}
                </b>{" "}
                lignes vérifiées
                {mois.length > 1 && `, dont ${a.verifiees} sur ${a.total} en ${nomDuMois(moisChoisi)}`}
              </span>
              {tout.rejetees > 0 && (
                <span className="font-semibold" style={{ color: colors.montantSortie }}>
                  {tout.rejetees} rejetée{tout.rejetees > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full" style={{ backgroundColor: colors.lineSoft }}>
              <i className="transition-[width] duration-300" style={{ width: `${tout.total ? ((tout.verifiees - tout.rejetees) / tout.total) * 100 : 0}%`, backgroundColor: colors.montantEntree }} />
              <i className="transition-[width] duration-300" style={{ width: `${tout.total ? (tout.rejetees / tout.total) * 100 : 0}%`, backgroundColor: colors.montantSortie }} />
            </div>
          </div>

          {corrigees.length > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-xl py-2 pl-3.5 pr-2" style={{ backgroundColor: colors.carteAmbreFond, color: colors.carteAmbreTexte }} data-atlas="lignes-corrigees">
              <span className="min-w-0 flex-1 text-[14.5px] leading-[1.4]">
                <b className="block text-[15.5px] font-bold">
                  {corrigees.length === 1 ? "1 ligne corrigée, à revoir" : `${corrigees.length} lignes corrigées, à revoir`}
                </b>
                Par {entreprise}. En tête de leur mois.
              </span>
              <button
                type="button"
                onClick={() => {
                  setMoisChoisi(corrigees[0].jour.slice(0, 7));
                  ouvrir(corrigees[0].id);
                }}
                className="min-h-[44px] flex-none rounded-full px-4 text-[15px] font-semibold"
                style={{ boxShadow: `inset 0 0 0 1.5px ${voile(colors.carteAmbreTexte, 0.5)}` }}
                data-atlas="revoir-les-corrigees"
              >
                Revoir
              </button>
            </div>
          )}

          <div className="mt-[18px] flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label="Mois">
            {mois.map((m) => {
              const am = avancementDeLaVerification(lignes.filter((l) => l.jour.startsWith(m)).map((l) => l.verification));
              const choisi = m === moisChoisi;
              const fini = am.total > 0 && am.verifiees === am.total;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => {
                    setMoisChoisi(m);
                    setOuvert(null);
                  }}
                  className="inline-flex min-h-[52px] flex-none flex-col items-center justify-center gap-px rounded-full px-5 text-[14.5px] font-semibold"
                  style={{ boxShadow: `inset 0 0 0 ${choisi ? 2 : 1}px ${choisi ? colors.ink : colors.line}`, color: choisi ? colors.ink : colors.inkSoft }}
                >
                  <span className="capitalize">{nomDuMois(m)}</span>
                  <span className="text-[13px] tabular-nums" style={fini ? { color: colors.montantEntree } : { fontWeight: 400 }}>
                    {am.verifiees} sur {am.total}
                  </span>
                </button>
              );
            })}
          </div>

          {/*
            UN SEUL TABLEAU : chaque ligne était sa propre grille, et un montant
            tombait plus à gauche quand le nom de sa pièce était plus long. Sur
            un téléphone, les mêmes rangées se posent en blocs et gardent leur
            date (`display` change, la structure non : une seule liste, une
            seule fois les repères que les suites lisent).
          */}
          <div className="md:overflow-x-auto">
            <table className="mt-4 block w-full border-collapse md:table" data-atlas="lignes-du-comptable">
              <thead className="hidden md:table-header-group">
                <tr>
                  {(["Date", "Ligne de banque", "Montant", "Justificatif", "Vérification"] as const).map((t) => (
                    <th
                      key={t}
                      scope="col"
                      className={`px-2 pb-2 text-[13px] font-semibold first:pl-1 ${t === "Montant" ? "text-right" : t === "Vérification" ? `text-center ${ligne ? RONDS_SOUS_LE_PANNEAU : ""}` : "text-left"}`}
                      style={{ color: colors.inkSoft, borderBottom: `1px solid ${colors.ink}` }}
                    >
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {duMois.map((l) => (
                  <Rangee key={l.id} ligne={l} ouverte={l.id === ouvert} panneau={ligne !== null} ouvrir={() => ouvrir(l.id)} rond={(v) => rond(l, v)} />
                ))}
              </tbody>
            </table>
          </div>
          {refus && !ligne && (
            <p role="alert" className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
              {refus}
            </p>
          )}

          {/*
            TERMINER ET SIGNER — sa planche du 27 octobre 2026. Le bouton naît
            avec la dernière ligne vérifiée, jamais avant : une attestation porte
            sur le dossier entier. Signée et rien n'a bougé depuis, la barre dit
            la conclusion et donne le PDF ; un verdict changé la rend à signer.
          */}
          {!ligne && tout.total > 0 && (tout.verifiees === tout.total || tout.rejetees > 0) && (
            <div className="sticky bottom-0 -mx-4 mt-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:-mx-6 md:px-6" style={{ background: `linear-gradient(to top, ${colors.cream} 78%, ${voile(colors.cream, 0)})` }} data-atlas="fin-de-verification">
              {tout.verifiees === tout.total && attestation?.aJour ? (
                <div className="flex items-center gap-3 rounded-[14px] py-1 pl-4 pr-2" style={{ backgroundColor: colors.card }} data-atlas="attestation-signee">
                  <span className="min-w-0 flex-1 py-2 text-[14px]" style={{ color: colors.inkSoft }}>
                    <b className="block text-[15px] font-semibold" style={{ color: colors.ink }}>
                      {MOT_DE_LA_CONCLUSION[attestation.conclusion]}
                    </b>
                    {attestation.signee}
                  </span>
                  <BoutonTelechargerDocument fichier={`/comptable/${jeton}/attestation/pdf`} nom="Attestation de vérification.pdf" className="flex min-h-[44px] items-center px-2 text-[15px] font-medium" style={{ color: colors.ink }}>
                    Télécharger
                  </BoutonTelechargerDocument>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
                  {tout.verifiees === tout.total && (
                    <button type="button" onClick={() => setSigner(true)} className="flex min-h-[56px] w-full items-center justify-center rounded-full px-5 text-[17px] font-semibold" style={{ backgroundColor: colors.plein, color: surPlein }} data-atlas="terminer-et-signer">
                      Terminer et signer
                    </button>
                  )}
                  {/* Comme le client qui demande une correction de devis : dès
                      qu'une ligne est rejetée, sans attendre la dernière. */}
                  {tout.rejetees > 0 && (
                    <button type="button" onClick={() => setRenvoyer(true)} className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-medium" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.card, color: colors.ink }} data-atlas="renvoyer-a-corriger">
                      <Icone nom="annuler" taille={21} />
                      Renvoyer à corriger
                    </button>
                  )}
                  {renvoye && tout.rejetees > 0 && (
                    <p className="text-center text-[13.5px]" style={{ color: colors.inkSoft }} data-atlas="deja-renvoye">
                      {renvoye}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {renvoyer && (
        <Renvoi
          jeton={jeton}
          entreprise={entreprise}
          lignes={lignes
            .filter((l) => l.verification.etat === "rejete")
            .map((l) => ({ id: l.id, jour: l.jour, libelle: l.libelle, montant: l.montantBrut, sens: l.sens, note: l.verification.etat === "rejete" ? l.verification.note : null }))}
          fermer={() => setRenvoyer(false)}
          renvoye={() => router.refresh()}
        />
      )}

      {signer && (
        <Attestation
          jeton={jeton}
          entreprise={entreprise}
          du={dossier.du}
          au={dossier.au}
          empreinte={dossier.empreinte}
          lignes={lignes.map((l) => ({
            id: l.id,
            jour: l.jour,
            libelle: l.libelle,
            montant: l.montantBrut,
            sens: l.sens,
            verdict: l.verification.etat === "rejete" ? "rejete" : "valide",
            note: l.verification.etat === "rejete" ? l.verification.note : null,
          }))}
          fermer={() => setSigner(false)}
          signee={() => router.refresh()}
        />
      )}

      {ligne && (
        // Trois étages : le haut, ce qui défile, et le bas où vivent les
        // boutons. Valider, Rejeter et la raison ne quittent jamais l'écran,
        // sur un téléphone comme sur un ordinateur.
        <aside
          className="fixed inset-0 z-50 flex flex-col lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[400px] lg:flex-none"
          style={{ backgroundColor: colors.card, boxShadow: `inset 1px 0 0 ${colors.line}` }}
          aria-label="La pièce"
          data-atlas="panneau-justificatif"
        >
          <div className="mx-auto flex w-full max-w-[560px] flex-none items-center justify-between pl-2.5 pr-4 pt-2 lg:pt-3">
            <button type="button" onClick={() => setOuvert(null)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 text-[15px] font-semibold" style={{ color: colors.inkSoft }}>
              <Icone nom="croix" />
              Fermer
            </button>
            <span className="text-[13.5px] tabular-nums" style={{ color: colors.inkSoft }}>
              Ligne {index + 1} sur {duMois.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[560px] px-5 pb-5 pt-2">
              <div className="rounded-xl px-4 py-3.5" style={{ backgroundColor: colors.cream }}>
                <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{ligne.libelle}</span>
                <span className="mt-1 block text-[26px] leading-[1.1] tabular-nums" style={{ fontFamily: font.display, color: ligne.sens === "entree" ? colors.montantEntree : colors.montantSortie }}>
                  {ligne.montant}
                </span>
                <span className="mt-1 block text-[13.5px]" style={{ color: colors.inkSoft }}>
                  {ligne.jourLong} à la banque, {NOM_CATEGORIE[ligne.categorie].toLowerCase()}
                </span>
              </div>

              <Piece key={ligne.id} jeton={jeton} ligne={ligne} entreprise={entreprise} />

              {ligne.ecart && (
                <p className="mt-3.5 flex items-start gap-2 text-[14px] font-medium" style={{ color: ligne.ecart.signale ? colors.carteAmbreTexte : colors.inkSoft }} data-atlas="ecart-de-la-piece">
                  {ligne.ecart.signale && <Icone nom="alerte" taille={18} className="mt-px" />}
                  {ligne.ecart.phrase}
                </p>
              )}

              {!demandeRouge && <Accord etat={ligne.verification} demandeRouge={false} />}
            </div>
          </div>

          <div className="flex-none" style={{ boxShadow: `inset 0 1px 0 ${colors.line}` }}>
            <div className="mx-auto w-full max-w-[560px] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
              {a.verifiees === a.total && a.total > 0 && (
                <p className="mb-2.5 rounded-lg px-3 py-2.5 text-[14px]" style={{ backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }} data-atlas="mois-verifie">
                  <b className="font-bold">
                    <span className="capitalize">{nomDuMois(moisChoisi)}</span> est vérifié.
                  </b>{" "}
                  {a.rejetees > 0 ? `${entreprise} reçoit vos rejets dans Atlas.` : "Tout est validé."}
                </p>
              )}
              {demandeRouge ? (
                <>
                  <Accord etat={ligne.verification} demandeRouge />
                  <label className="mb-2.5 mt-1 block text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
                    {ligne.verification.etat === "valide" ? "Expliquez ce changement" : "Justifier le rejet"}
                    <textarea
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={1000}
                      className="mt-1.5 block min-h-[76px] w-full resize-none rounded-xl px-3 py-2.5 text-[15px] font-normal leading-[1.4] outline-none"
                      style={{ boxShadow: `inset 0 0 0 1px ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }}
                      data-atlas="raison-du-rejet"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => poser(ligne.id, "rejete", note, () => setDemandeRouge(false))}
                      className={bouton}
                      style={{ backgroundColor: colors.montantSortie, color: surPlein }}
                      data-atlas="confirmer-rejet"
                    >
                      Rejeter
                    </button>
                    <button type="button" onClick={() => setDemandeRouge(false)} className={bouton} style={creux}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => poser(ligne.id, "valide", null, () => suivante && ouvrir(suivante.id))}
                    className={bouton}
                    style={{ backgroundColor: colors.montantEntree, color: surPlein }}
                    data-atlas="valider"
                  >
                    Valider
                  </button>
                  <button type="button" onClick={() => demanderLaRaison(ligne)} className={bouton} style={{ backgroundColor: colors.montantSortie, color: surPlein }} data-atlas="rejeter">
                    Rejeter
                  </button>
                  {suivante && (
                    <button type="button" onClick={() => ouvrir(suivante.id)} className={bouton} style={creux} data-atlas="suivant">
                      Suivant
                    </button>
                  )}
                </div>
              )}
              {refus && (
                <p role="alert" className="mt-2.5 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
                  {refus}
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

/**
 * Une ligne du tableau. Sur un téléphone, la rangée devient une grille : la
 * date, le libellé et le montant en haut, la catégorie et la raison d'un rejet
 * dessous, puis la pièce et les deux ronds. La cellule du libellé s'y efface
 * (`contents`) pour que sa catégorie et sa raison passent aussi sous le
 * montant, comme sur la planche.
 */
function Rangee({
  ligne: l,
  ouverte,
  panneau,
  ouvrir,
  rond,
}: {
  ligne: LigneAVerifier;
  ouverte: boolean;
  /** Une pièce est ouverte à côté : voir `RONDS_SOUS_LE_PANNEAU`. */
  panneau: boolean;
  ouvrir: () => void;
  rond: (v: VerdictDuComptable) => void;
}) {
  const perdu = l.piece.genre === "perdu";
  const icone = ICONE_DE_LA_PIECE[l.piece.genre];
  const v = l.verification;
  const cellule = "md:table-cell md:px-2 md:py-2.5 md:align-middle";
  return (
    <tr
      className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-start gap-x-2 py-3 md:table-row md:py-0"
      style={{ backgroundColor: fondDeLaLigne(l, ouverte), borderBottom: `1px solid ${colors.line}` }}
      data-atlas="ligne-du-comptable"
    >
      <td className={`col-start-1 row-start-1 pt-px text-[13.5px] tabular-nums md:pl-1 md:text-[14px] ${cellule}`} style={{ color: colors.inkSoft }} data-atlas="date-de-la-ligne">
        {l.jourCourt}
      </td>
      <td className={`contents ${cellule}`}>
        <span className="col-start-2 row-start-1 block min-w-0 break-words text-[14.5px] font-semibold">{l.libelle}</span>
        <span className="col-start-2 col-end-4 row-start-2 mt-0.5 flex items-center gap-1.5 text-[13px]" style={{ color: colors.inkSoft }}>
          <i className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[l.categorie] }} />
          {NOM_CATEGORIE[l.categorie]}
        </span>
        {(v.etat === "rejete" || v.etat === "corrigee") && (
          <span className="col-start-2 col-end-4 row-start-3 mt-1 block text-[13.5px]" style={{ color: v.etat === "rejete" ? colors.montantSortie : colors.inkSoft }}>
            {v.etat === "rejete" ? "Rejetée" : "Corrigée depuis votre rejet"} : {v.note ?? "sans raison écrite"}
          </span>
        )}
      </td>
      <td
        className={`col-start-3 row-start-1 whitespace-nowrap text-right text-[16.5px] leading-[1.2] tabular-nums ${cellule}`}
        style={{ fontFamily: font.display, color: l.sens === "entree" ? colors.montantEntree : colors.montantSortie }}
        data-atlas="montant-de-la-ligne"
      >
        {l.montant}
      </td>
      <td className={`col-start-2 row-start-4 mt-2 min-w-0 md:mt-0 ${cellule}`}>
        <button
          type="button"
          onClick={ouvrir}
          className="inline-flex min-h-[44px] max-w-full items-center gap-[7px] rounded-full py-1.5 pl-2.5 pr-3.5 text-left text-[14px] font-medium leading-tight md:whitespace-nowrap"
          style={{
            backgroundColor: colors.card,
            boxShadow: `inset 0 0 0 1px ${perdu ? voile(colors.alert, 0.45) : colors.line}`,
            color: perdu ? colors.alert : l.piece.genre === "aucune" ? colors.inkSoft : colors.ink,
            fontStyle: perdu ? "italic" : undefined,
          }}
          data-atlas="ouvrir-justificatif"
        >
          {icone && (
            <span className="inline-flex" style={{ color: perdu ? colors.alert : colors.or }}>
              <Icone nom={icone} taille={18} />
            </span>
          )}
          {/* Sur un petit téléphone le mot passe à la ligne, jamais au milieu
              d'un numéro : « F-2026- » puis « 012 » ne se lit plus. */}
          <span>
            {l.etiquette.split(" ").map((mot, k) => (
              <Fragment key={k}>
                {k > 0 && " "}
                <span className="whitespace-nowrap">{mot}</span>
              </Fragment>
            ))}
          </span>
        </button>
        {l.ecart && (
          <span className="mt-1 block max-w-[240px] text-[12.5px] leading-[1.35]" style={{ color: l.ecart.signale ? colors.carteAmbreTexte : colors.inkSoft }} data-atlas="ecart-de-la-piece">
            {l.ecart.suite}
          </span>
        )}
      </td>
      <td className={`col-start-3 row-start-4 mt-2 justify-self-end md:mt-0 md:text-center ${cellule} ${panneau ? RONDS_SOUS_LE_PANNEAU : ""}`}>
        <span className="inline-flex gap-1.5">
          <Rond nom="coche" libelle="Valider" presse={v.etat === "valide"} plein={colors.montantEntree} onClick={() => rond("valide")} atlas="rond-valider" />
          <Rond nom="croix" libelle="Rejeter" presse={v.etat === "rejete"} plein={colors.montantSortie} onClick={() => rond("rejete")} atlas="rond-rejeter" />
        </span>
      </td>
    </tr>
  );
}

function Rond({ nom, libelle, presse, plein, onClick, atlas }: { nom: NomIcone; libelle: string; presse: boolean; plein: string; onClick: () => void; atlas: string }) {
  return (
    <button
      type="button"
      aria-label={libelle}
      aria-pressed={presse}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full"
      style={presse ? { backgroundColor: plein, color: surPlein } : { boxShadow: `inset 0 0 0 1.5px ${colors.line}`, backgroundColor: colors.card, color: colors.inkSoft }}
      data-atlas={atlas}
    >
      <Icone nom={nom} epaisseur={2.2} />
    </button>
  );
}

/**
 * Où en est la ligne. Quand il change d'avis, « Vous l'aviez validée » vit en
 * bas, au-dessus de la raison qu'on lui demande : c'est elle qu'il explique.
 */
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
    <p
      className={`text-[14.5px] font-semibold ${demandeRouge ? "mb-1.5" : "mt-3"}`}
      style={{ color: etat.etat === "valide" ? colors.montantEntree : etat.etat === "rejete" ? colors.montantSortie : colors.inkSoft }}
      data-atlas="accord"
    >
      {texte}
    </p>
  );
}

/**
 * La pièce reconstituée d'abord, l'origine derrière un onglet nommé : deux
 * points à glisser ne disaient pas qu'une photo attendait. L'origine reste
 * montée, cachée, pour que l'onglet l'ouvre sans attendre.
 */
function Piece({ jeton, ligne, entreprise }: { jeton: string; ligne: LigneAVerifier; entreprise: string }) {
  const [vue, setVue] = useState<"reconstituee" | "origine">("reconstituee");
  const p = ligne.piece;
  const original = (p.genre === "ticket" || p.genre === "facture" || p.genre === "hors_atlas") && p.original ? p.original : null;
  const adresse = `/comptable/${jeton}/piece/${ligne.id}`;

  const reconstituee = <Reconstituee piece={p} entreprise={entreprise} />;
  if (!original) return <div className="mt-3.5 flex justify-center">{reconstituee}</div>;

  const onglet = (cle: "reconstituee" | "origine", texte: string, atlas: string) => (
    <button
      type="button"
      aria-pressed={vue === cle}
      onClick={() => setVue(cle)}
      className="min-h-[40px] min-w-0 flex-1 rounded-full px-2 text-[14px] font-semibold"
      style={vue === cle ? { backgroundColor: colors.card, color: colors.ink, boxShadow: `0 1px 2px ${voile(colors.ink, 0.14)}` } : { color: colors.inkSoft }}
      data-atlas={atlas}
    >
      {texte}
    </button>
  );
  return (
    <>
      <div role="group" aria-label="La pièce" className="mt-3.5 flex gap-[3px] rounded-full p-[3px]" style={{ backgroundColor: voile(colors.ink, 0.06) }} data-atlas="onglets-de-la-piece">
        {onglet("reconstituee", "Reconstitué par Atlas", "onglet-reconstitue")}
        {onglet("origine", original === "pdf" ? "Facture d’origine" : "Photo d’origine", "onglet-origine")}
      </div>
      <div className="mt-3.5 flex justify-center" hidden={vue !== "reconstituee"}>
        {reconstituee}
      </div>
      <div className="mt-3.5" hidden={vue !== "origine"}>
        {original === "pdf" ? (
          <div className="flex justify-center rounded-xl px-4 py-4" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}>
            <a href={adresse} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-semibold" style={{ color: colors.rust }} data-atlas="original">
              <Icone nom="document" />
              Ouvrir la facture
            </a>
          </div>
        ) : (
          <div className="flex justify-center rounded-lg p-3" style={{ backgroundColor: voile(colors.ink, 0.08) }}>
            {/* Une photo servie par la route du jeton : `next/image` la ferait
                passer par l'optimiseur, qui n'a pas le jeton. */}
            <img src={adresse} alt="Pièce d’origine" className="max-h-[60dvh] max-w-full rounded" data-atlas="original" />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * La pièce réécrite, sur du papier : elle garde l'allure d'un document quelle
 * que soit la charte, comme le PDF (`couleursDocument`). Le total est surligné
 * bleu gris, son choix du 24 octobre.
 */
function Reconstituee({ piece: p, entreprise }: { piece: PieceAffichee; entreprise: string }) {
  const papier = { backgroundColor: couleursDocument.papier, color: couleursDocument.encre, boxShadow: `0 8px 24px ${colors.line}` };
  const total = (libelle: string, valeur: string | null) => (
    <div className="mt-1 flex justify-between gap-2 rounded-[3px] px-1.5 py-1 font-bold" style={{ backgroundColor: couleursDocument.surligne }}>
      <span>{libelle}</span>
      <span>{valeur ?? "non lu"}</span>
    </div>
  );
  const facture = (tete: ReactNode, sous: string | null, valeur: string | null, pied: string | null) => (
    <div className="w-[300px] max-w-full px-4 py-4 text-[12px] leading-[1.5]" style={papier} data-atlas="reconstituee">
      {tete}
      {sous && (
        <div className="mb-2.5 mt-1" style={{ color: couleursDocument.etiquette }}>
          {sous}
        </div>
      )}
      {total("Total TTC", valeur)}
      {pied && (
        <div className="mt-2" style={{ color: couleursDocument.etiquette }}>
          {pied}
        </div>
      )}
    </div>
  );
  const nom = (texte: string) => (
    <div className="text-[14px] font-bold" style={{ fontFamily: font.display }}>
      {texte}
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
      return facture(nom(p.nom), p.detail, p.total, `Client : ${entreprise}`);
    case "hors_atlas":
      // Son total a été lu sur la facture ou tapé par le patron : le papier
      // ne dit que ce qui est sûr, l'original est à l'onglet d'à côté.
      return facture(nom(entreprise), p.sortie ? "Facture du fournisseur" : "Facture faite hors d’Atlas", p.total, null);
    case "emise":
      return facture(
        <div className="flex justify-between gap-2">
          {nom(entreprise)}
          <span>{p.numero}</span>
        </div>,
        null,
        p.total,
        "Facture émise par Atlas"
      );
    case "perdu":
      return (
        <div className="w-full rounded-xl px-4 py-4 text-[14.5px] leading-[1.45]" style={{ border: `1.5px dashed ${colors.line}`, color: colors.inkSoft }} data-atlas="reconstituee">
          Ticket perdu. La ligne a été validée avec cette mention, et sa TVA n’a pas été déduite.
        </div>
      );
    case "motif":
      return (
        <div className="w-full rounded-xl px-4 py-4 text-[14.5px] leading-[1.45]" style={{ boxShadow: `inset 0 0 0 1.5px ${colors.line}`, color: colors.inkSoft }} data-atlas="reconstituee">
          Virement justifié par sa nature : {p.libelle.toLowerCase()}.
        </div>
      );
    case "aucune":
      return (
        <div className="w-full rounded-xl px-4 py-4 text-[14.5px] leading-[1.45]" style={{ border: `1.5px dashed ${colors.line}`, color: colors.inkSoft }} data-atlas="reconstituee">
          Aucune pièce jointe à cette ligne.
        </div>
      );
  }
}

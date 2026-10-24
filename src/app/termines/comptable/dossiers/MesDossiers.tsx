"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { adressePourLeClient } from "@/lib/adresse-du-client";
import { ajouterBilanAction, envoyerAuComptableAction, retirerBilanAction } from "../actions";
import { CarteARegarder, type ARegarder, type Facture } from "../DossierEnCours";

export type DossierAffiche = {
  id: string;
  nom: string;
  annee: number;
  detail: string;
  /** Le jour de son effacement, quand il approche (trois mois). */
  echeance: string | null;
  bilans: { id: string; nom: string; ajoute: string }[];
  /** Où en est son comptable (rien tant qu'aucun lien n'est parti), et ce qu'il a rejeté. */
  verification: { texte: string | null; rejets: ARegarder[] };
};

const classeLien = "inline-flex min-h-[40px] items-center pr-3 text-[13.5px] font-medium";

const CLE_DES_VUES = "atlas-echeances-vues";
const AUCUNE: string[] = [];
const abonnesAuxVues = new Set<() => void>();
let vuesEnMemoire: string[] | undefined;

function sAbonnerAuxVues(prevenir: () => void): () => void {
  abonnesAuxVues.add(prevenir);
  return () => {
    abonnesAuxVues.delete(prevenir);
  };
}

function vuesDuTelephone(): string[] {
  if (vuesEnMemoire === undefined) {
    try {
      const lu: unknown = JSON.parse(window.localStorage.getItem(CLE_DES_VUES) ?? "[]");
      vuesEnMemoire = Array.isArray(lu) ? lu.filter((x): x is string => typeof x === "string") : AUCUNE;
    } catch {
      // Stockage refusé ou illisible : la carte reste, c'est le côté sûr.
      vuesEnMemoire = AUCUNE;
    }
  }
  return vuesEnMemoire;
}

function vu(id: string) {
  vuesEnMemoire = [...vuesDuTelephone(), id];
  try {
    window.localStorage.setItem(CLE_DES_VUES, JSON.stringify(vuesEnMemoire));
  } catch {
    // Sans stockage, la carte reviendra à la prochaine ouverture : c'est le côté sûr.
    vuesEnMemoire = [...vuesEnMemoire];
  }
  for (const prevenir of abonnesAuxVues) prevenir();
}

/**
 * La liste des dossiers rangés, le menu Année, le bilan du comptable, et la
 * carte qui prévient avant l'effacement. « J'ai compris » ne la range que sur
 * ce téléphone : c'est une commodité, l'échéance, elle, reste écrite sur le
 * dossier.
 */
export default function MesDossiers({ dossiers, factures }: { dossiers: DossierAffiche[]; factures: Facture[] }) {
  const annees = [...new Set(dossiers.map((d) => d.annee))];
  const [annee, setAnnee] = useState<number | null>(annees[0] ?? null);
  // Le serveur ne connaît pas ce téléphone : il rend la carte, et
  // `useSyncExternalStore` relit le stockage après l'hydratation (comme le tri
  // de `ListeTermines`).
  const vues = useSyncExternalStore(sAbonnerAuxVues, vuesDuTelephone, () => AUCUNE);

  const aPrevenir = dossiers.filter((d) => d.echeance && !vues.includes(d.id));

  return (
    <>
      {aPrevenir.map((d) => (
        <article key={d.id} className="mx-6 mt-4 rounded-[18px] px-[18px] py-4" style={{ backgroundColor: colors.carteAmbreFond }} data-atlas="echeance-dossier">
          <p className="m-0 text-[16px] leading-[1.3]" style={{ fontFamily: font.display, color: colors.ink }}>
            {d.nom} et son bilan seront effacés le {d.echeance}.
          </p>
          <p className="mt-1 text-[13.5px]" style={{ color: colors.inkSoft }}>
            Dix ans sont passés. Téléchargez-les si vous voulez les garder.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a href={`/termines/comptable/dossiers/${d.id}?telecharger=1`} className="atlas-plein inline-flex min-h-[44px] items-center rounded-full px-5 text-[14px] font-medium" style={{ backgroundColor: colors.plein, color: colors.card }}>
              Télécharger
            </a>
            <button type="button" onClick={() => vu(d.id)} className="min-h-[44px] px-2 text-[14px] font-medium" style={{ color: colors.inkSoft }}>
              J’ai compris
            </button>
          </div>
        </article>
      ))}

      {dossiers.length === 0 ? (
        <p className="mx-6 mt-6 text-[14px]" style={{ color: colors.muted }}>
          Aucun dossier rangé pour l’instant. Il se range quand vous l’arrêtez, depuis le dossier en cours.{" "}
          <Link href="/termines/comptable" className="font-medium" style={{ color: colors.rust }}>
            Y aller
          </Link>
        </p>
      ) : (
        <>
          <div className="mx-6 mt-6 flex items-center justify-between gap-3">
            <p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: colors.muted }}>
              Rangés
            </p>
            <label className="flex items-center gap-2 text-[13px]" style={{ color: colors.inkSoft }}>
              Année
              <select
                value={annee ?? ""}
                onChange={(e) => setAnnee(Number(e.target.value))}
                className="min-h-[40px] rounded-full px-3.5 text-[14px] font-medium"
                style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
                data-atlas="filtre-annee"
              >
                {annees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="mx-6 mt-2" data-atlas="dossiers-ranges">
            {dossiers
              .filter((d) => d.annee === annee)
              .map((d) => (
                <Dossier key={d.id} d={d} factures={factures} />
              ))}
          </ul>
        </>
      )}
    </>
  );
}

function Dossier({ d, factures }: { d: DossierAffiche; factures: Facture[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [ajout, setAjout] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  function envoyer() {
    setRefus(null);
    demarrer(async () => {
      const r = await envoyerAuComptableAction(d.id);
      if (!r.ok) setRefus(r.raison);
      else setLien(adressePourLeClient(window.location.origin) + r.chemin);
    });
  }

  async function copier(texte: string) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
    } catch {
      // Le presse-papiers refusé (page non sécurisée) : le lien reste affiché,
      // il se sélectionne à la main.
      setCopie(false);
    }
  }
  const photo = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);

  function deposer(fichier: File | undefined) {
    if (!fichier) return;
    setRefus(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("dossierId", d.id);
      fd.set("fichier", fichier);
      const r = await ajouterBilanAction(fd);
      if (!r.ok) setRefus(r.raison);
      else {
        setAjout(false);
        router.refresh();
      }
    });
  }

  function retirer(id: string) {
    setRefus(null);
    demarrer(async () => {
      const r = await retirerBilanAction(id);
      if (!r.ok) setRefus(r.raison);
      else router.refresh();
    });
  }

  return (
    <li className="py-3.5" style={{ borderTop: `1px solid ${colors.lineSoft}` }} data-atlas="dossier-range">
      <p className="m-0 text-[15px]">{d.nom}</p>
      <p className="mt-0.5 text-[12.5px]" style={{ color: d.echeance ? colors.alert : colors.muted }}>
        {d.echeance ? `Sera effacé le ${d.echeance}` : d.detail}
      </p>
      <div className="mt-1 flex flex-wrap">
        <a href={`/termines/comptable/dossiers/${d.id}`} target="_blank" rel="noopener" className={classeLien} style={{ color: colors.rust }} data-atlas="ouvrir-dossier">
          Ouvrir
        </a>
        <a href={`/termines/comptable/dossiers/${d.id}?telecharger=1`} className={classeLien} style={{ color: colors.rust }}>
          Télécharger
        </a>
        <button type="button" disabled={enCours} onClick={envoyer} className={classeLien} style={{ color: colors.rust }} data-atlas="envoyer-au-comptable">
          Envoyer au comptable
        </button>
      </div>
      {lien && (
        <div className="mt-2 rounded-[12px] px-3.5 py-3" style={{ backgroundColor: colors.card }} data-atlas="lien-du-comptable">
          <p className="m-0 break-all text-[12.5px]" style={{ color: colors.inkSoft, fontFamily: "ui-monospace, Consolas, monospace" }}>
            {lien}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={`mailto:?subject=${encodeURIComponent(`Dossier justifié, ${d.nom.toLowerCase()}`)}&body=${encodeURIComponent(`Bonjour,\n\nVoici mon dossier justifié, à vérifier ligne par ligne :\n${lien}\n\nBonne journée`)}`}
              className="atlas-plein inline-flex min-h-[44px] items-center rounded-full px-5 text-[14px] font-medium"
              style={{ backgroundColor: colors.plein, color: colors.card }}
            >
              Envoyer par e-mail
            </a>
            <button type="button" onClick={() => copier(lien)} className="min-h-[44px] px-2 text-[14px] font-medium" style={{ color: colors.inkSoft }} data-atlas="copier-lien">
              {copie ? "Lien copié" : "Copier le lien"}
            </button>
          </div>
        </div>
      )}
      {d.verification.texte && (
        <p className="mt-1 text-[12.5px]" style={{ color: colors.muted }} data-atlas="verification-du-comptable">
          {d.verification.texte}
        </p>
      )}
      {d.verification.rejets.length > 0 && (
        <div className="mt-2 flex flex-col gap-2" data-atlas="rejets-du-comptable">
          {d.verification.rejets.map((a) => (
            <CarteARegarder key={a.id} a={a} factures={factures} />
          ))}
        </div>
      )}

      {d.bilans.map((b) => (
        <div key={b.id} className="mt-2 flex items-center gap-3 rounded-[12px] px-3 py-2.5" style={{ backgroundColor: colors.rustTint }} data-atlas="bilan-range">
          <span className="min-w-0 flex-1 text-[13px]" style={{ color: colors.inkSoft }}>
            <b className="block font-medium" style={{ color: colors.ink }}>
              Bilan du comptable
            </b>
            Ajouté le {b.ajoute}
          </span>
          <a href={`/termines/comptable/bilans/${b.id}`} target="_blank" rel="noopener" className="text-[13px] font-medium" style={{ color: colors.rust }}>
            Ouvrir
          </a>
          <button type="button" disabled={enCours} onClick={() => retirer(b.id)} className="min-h-[40px] text-[13px]" style={{ color: colors.inkSoft }}>
            Retirer
          </button>
        </div>
      ))}

      {ajout ? (
        <div className="mt-2 flex flex-col overflow-hidden rounded-[12px]" style={{ gap: 1, backgroundColor: colors.lineSoft }}>
          <button type="button" disabled={enCours} onClick={() => photo.current?.click()} className="min-h-[52px] px-3.5 py-3 text-left disabled:opacity-60" style={{ backgroundColor: colors.cream, color: colors.ink }}>
            <span className="block text-[14.5px]">Photographier les pages</span>
            <span className="block text-[12px]" style={{ color: colors.muted }}>
              Le bilan reçu sur papier
            </span>
          </button>
          <button type="button" disabled={enCours} onClick={() => pdf.current?.click()} className="min-h-[52px] px-3.5 py-3 text-left disabled:opacity-60" style={{ backgroundColor: colors.cream, color: colors.ink }}>
            <span className="block text-[14.5px]">Choisir le fichier</span>
            <span className="block text-[12px]" style={{ color: colors.muted }}>
              Le PDF reçu par e-mail
            </span>
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAjout(true)} className="mt-2 min-h-[44px] rounded-full px-5 text-[14px] font-medium" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }} data-atlas="ajouter-bilan">
          Ajouter le bilan du comptable
        </button>
      )}
      <input ref={photo} type="file" accept={ACCEPT_PHOTOS} className="hidden" onChange={(e) => deposer(e.target.files?.[0])} />
      <input ref={pdf} type="file" accept="application/pdf" className="hidden" onChange={(e) => deposer(e.target.files?.[0])} data-atlas="fichier-bilan" />
      {refus && (
        <p role="alert" className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
    </li>
  );
}

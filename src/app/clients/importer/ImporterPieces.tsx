"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { entreeAIgnorer, formatDuFichier, LIMITES_IMPORT, refusDeLEnvoi } from "@/lib/import-pieces";
import { entreesDuZip, lireEntree, ZipIllisible } from "@/lib/lire-zip";
import { jourCourt } from "@/lib/documents-du-client";
import { piecesAVerifierAction, rangerAction, type PieceAVerifier } from "./actions";

/**
 * IMPORTER DEVIS ET FACTURES — l'écran, d'après la maquette qu'il a essayée
 * (`appli/importer-ancienne-appli.html`, 22 octobre 2026).
 *
 * **Deux moments, et l'écran les dit tous les deux** (sa consigne : « il faut
 * expliquer à l'utilisateur que la lecture est en train de se faire et qu'il
 * peut fermer l'application ») :
 *
 *   1. L'ENVOI demande l'appli ouverte : un navigateur fermé n'envoie plus
 *      rien. Le zip s'ouvre ici, sur le téléphone, et chaque pièce part seule
 *      (`lire-zip.ts`, mesuré à 10 Mo de mémoire pour 4 840 PDF).
 *   2. LA LECTURE se fait sur le serveur : on peut fermer.
 *
 * **Ce qui ne peut PAS être promis, et ne l'est pas** : reprendre l'envoi tout
 * seul après une fermeture. Le navigateur ne garde pas le fichier choisi. Il
 * faut le choisir à nouveau ; ce qui est déjà arrivé n'est pas renvoyé
 * (empreintes, `connues`).
 */

type Source = { nom: string; taille: number; lire: () => Promise<Uint8Array> };
type Refuse = { nom: string; raison: string };
type Etat = {
  id: string;
  attendues: number;
  recues: number;
  lues: number;
  aVerifier: number;
  pretes: number;
  rangees: number;
  rangeLe: string | null;
};

type Phase =
  | { quoi: "choisir"; refus?: string }
  | { quoi: "preparer" }
  | { quoi: "envoi"; nom: string; total: number; faits: number }
  | { quoi: "lecture"; lues: number; recues: number }
  | { quoi: "relecture"; etat: Etat; pieces: PieceAVerifier[] };

/** Quelques pièces à la fois : assez pour remplir le réseau, pas assez pour l'étouffer. */
const PAQUET = 8;
const EN_PARALLELE = 3;

async function empreinteDe(octets: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", octets.slice().buffer);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function nombre(n: number): string {
  return n.toLocaleString("fr-FR");
}

async function envoyerPiece(envoiId: string, nom: string, octets: Uint8Array, empreinte: string): Promise<string | null> {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const corps = new FormData();
      corps.set("envoiId", envoiId);
      corps.set("empreinte", empreinte);
      corps.set("fichier", new File([octets.slice()], nom));
      const r = await fetch("/api/pieces-importees", { method: "POST", body: corps });
      if (r.ok) return null;
      const j = (await r.json().catch(() => null)) as { raison?: string } | null;
      // Le débit : on attend un peu, la pièce repart.
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, 4000));
        continue;
      }
      return j?.raison ?? "Ce fichier n'a pas pu être gardé.";
    } catch {
      // Le réseau d'un chantier se coupe : on réessaie après une pause qui s'allonge.
      await new Promise((res) => setTimeout(res, 1500 * (essai + 1)));
    }
  }
  return "Le réseau ne répond pas.";
}

export default function ImporterPieces({ repriseEnvoiId }: { repriseEnvoiId: string | null }) {
  const router = useRouter();
  const choix = useRef<HTMLInputElement>(null);
  // Un envoi déjà lu, pas encore rangé : l'écran s'ouvre sur la lecture, qui
  // passe d'elle-même à la relecture.
  const [phase, setPhase] = useState<Phase>(repriseEnvoiId ? { quoi: "lecture", lues: 0, recues: 0 } : { quoi: "choisir" });
  const [envoiId, setEnvoiId] = useState<string | null>(repriseEnvoiId);
  const [refuses, setRefuses] = useState<Refuse[]>([]);

  // ── La lecture, suivie toutes les deux secondes ──
  const suivre = useCallback(async () => {
    const r = await fetch("/api/pieces-importees/etat", { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { etat: Etat | null }).etat;
  }, []);

  useEffect(() => {
    if (phase.quoi !== "lecture") return;
    let fini = false;
    const tour = async () => {
      const etat = await suivre();
      if (fini || !etat) return;
      if (etat.recues > 0 && etat.lues >= etat.recues) {
        const r = await piecesAVerifierAction(etat.id);
        if (!fini) setPhase({ quoi: "relecture", etat, pieces: r.ok ? r.pieces : [] });
      } else {
        setPhase({ quoi: "lecture", lues: etat.lues, recues: etat.recues });
      }
    };
    void tour();
    const minuteur = setInterval(tour, 2000);
    return () => {
      fini = true;
      clearInterval(minuteur);
    };
  }, [phase.quoi, suivre]);

  async function choisis(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    setPhase({ quoi: "preparer" });
    const sources: Source[] = [];
    const ecartes: Refuse[] = [];
    try {
      for (const f of Array.from(fichiers)) {
        const format = formatDuFichier(f.name);
        if (format === "zip") {
          for (const e of await entreesDuZip(f)) {
            if (entreeAIgnorer(e.chemin)) continue;
            const nom = e.chemin.split("/").pop() ?? e.chemin;
            if (!formatDuFichier(nom) || formatDuFichier(nom) === "zip") {
              ecartes.push({ nom, raison: "Ce format ne s'importe pas." });
              continue;
            }
            sources.push({ nom, taille: e.taille, lire: () => lireEntree(f, e, LIMITES_IMPORT.octetsParDocument) });
          }
        } else if (format) {
          sources.push({ nom: f.name, taille: f.size, lire: async () => new Uint8Array(await f.arrayBuffer()) });
        } else {
          ecartes.push({ nom: f.name, raison: "Ce format ne s'importe pas." });
        }
      }
    } catch (err) {
      setPhase({ quoi: "choisir", refus: err instanceof ZipIllisible ? err.message : "Ce fichier ne s'ouvre pas." });
      return;
    }

    const octets = sources.reduce((t, s) => t + s.taille, 0);
    const refus = refusDeLEnvoi(sources.length, octets);
    if (refus) {
      setPhase({ quoi: "choisir", refus });
      return;
    }

    const nomEnvoi = fichiers.length === 1 ? fichiers[0].name : `${nombre(sources.length)} fichiers`;
    const ouvert = await fetch("/api/pieces-importees/envois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nomEnvoi, nombre: sources.length, octets }),
    }).then((r) => r.json() as Promise<{ ok: boolean; envoiId?: string; raison?: string }>);
    if (!ouvert.ok || !ouvert.envoiId) {
      setPhase({ quoi: "choisir", refus: ouvert.raison ?? "L'envoi n'a pas pu commencer. Réessayez." });
      return;
    }
    const id = ouvert.envoiId;
    setEnvoiId(id);
    setPhase({ quoi: "envoi", nom: nomEnvoi, total: sources.length, faits: 0 });

    let faits = 0;
    for (let i = 0; i < sources.length; i += PAQUET) {
      const paquet: { s: Source; octets: Uint8Array; empreinte: string }[] = [];
      for (const s of sources.slice(i, i + PAQUET)) {
        try {
          const o = await s.lire();
          if (o.length > LIMITES_IMPORT.octetsParDocument) {
            ecartes.push({ nom: s.nom, raison: "Ce fichier pèse plus de 15 Mo." });
            continue;
          }
          paquet.push({ s, octets: o, empreinte: await empreinteDe(o) });
        } catch (err) {
          ecartes.push({ nom: s.nom, raison: err instanceof Error ? err.message : "Ce fichier ne s'ouvre pas." });
        }
      }
      // Ce qui est déjà arrivé ne repart pas : un envoi coupé reprend ici.
      const deja = new Set(
        (
          (await fetch("/api/pieces-importees/connues", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ empreintes: paquet.map((p) => p.empreinte) }),
          })
            .then((r) => r.json())
            .catch(() => ({ connues: [] }))) as { connues: string[] }
        ).connues
      );
      const aEnvoyer = paquet.filter((p) => !deja.has(p.empreinte));
      for (let j = 0; j < aEnvoyer.length; j += EN_PARALLELE) {
        const raisons = await Promise.all(
          aEnvoyer.slice(j, j + EN_PARALLELE).map((p) => envoyerPiece(id, p.s.nom, p.octets, p.empreinte))
        );
        raisons.forEach((raison, k) => {
          if (raison) ecartes.push({ nom: aEnvoyer[j + k].s.nom, raison });
        });
      }
      faits = Math.min(sources.length, i + PAQUET);
      setPhase({ quoi: "envoi", nom: nomEnvoi, total: sources.length, faits });
    }

    setRefuses(ecartes);
    await fetch("/api/pieces-importees/envois", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fermer: id }),
    }).catch(() => null);
    setPhase({ quoi: "lecture", lues: 0, recues: 0 });
  }

  // ── Relecture : les noms qu'il tape, le genre s'il manque ──
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [genres, setGenres] = useState<Record<string, "devis" | "facture">>({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function ranger() {
    if (phase.quoi !== "relecture" || !envoiId) return;
    setEnCours(true);
    setErreur(null);
    const r = await rangerAction(
      phase.etat.id,
      phase.pieces.map((p) => ({ id: p.id, nom: noms[p.id] ?? "", genre: p.genre ?? genres[p.id] ?? null }))
    );
    setEnCours(false);
    if (!r.ok) {
      setErreur(r.raison);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  const jauge = (fait: number, total: number) => (
    <div className="mt-[28px] h-[6px] overflow-hidden rounded-full" style={{ backgroundColor: colors.rustTint }}>
      <div
        data-atlas="jauge-import"
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${total ? Math.round((fait / total) * 100) : 0}%`, backgroundColor: colors.plein }}
      />
    </div>
  );
  const chiffre = (fait: number, total: number) => (
    <p className="mt-[16px] text-[30px] leading-[1.1]" style={{ fontFamily: font.display, fontVariantNumeric: "tabular-nums lining-nums" }}>
      {nombre(fait)} <span className="text-[15px]" style={{ fontFamily: font.body, color: colors.muted }}>sur {nombre(total)}</span>
    </p>
  );

  if (phase.quoi === "choisir" || phase.quoi === "preparer") {
    return (
      <section className="mx-[26px] mt-[26px]">
        <p className={`mb-[10px] ${libelleCaps}`} style={{ color: colors.inkSoft }}>
          Vos devis et factures
        </p>
        <input
          ref={choix}
          type="file"
          multiple
          accept=".pdf,.zip,.jpg,.jpeg,.png,application/pdf,application/zip,image/jpeg,image/png"
          className="hidden"
          data-atlas="choisir-pieces"
          onChange={(e) => {
            void choisis(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => choix.current?.click()}
          disabled={phase.quoi === "preparer"}
          className="atlas-plein inline-flex min-h-[47px] items-center rounded-full px-5 text-[16px] font-medium"
          style={{ backgroundColor: colors.plein, color: colors.cream }}
        >
          {phase.quoi === "preparer" ? "Un instant…" : "Choisir mes fichiers"}
        </button>
        <p className="mt-[12px] text-[14.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          PDF, photos ou dossier .zip.
          <br />
          Jusqu’à {nombre(LIMITES_IMPORT.documentsParEnvoi)} documents par envoi.
        </p>
        {phase.quoi === "choisir" && phase.refus && (
          <p data-atlas="refus-import" className="mt-[18px] text-[15px] leading-[1.55]" style={{ color: colors.alert }}>
            {phase.refus}
          </p>
        )}
      </section>
    );
  }

  if (phase.quoi === "envoi") {
    return (
      <section className="mx-[26px] mt-[10px]" data-atlas="envoi-import">
        <p className={libelleCaps} style={{ color: colors.muted }}>
          {phase.nom}
        </p>
        {jauge(phase.faits, phase.total)}
        {chiffre(phase.faits, phase.total)}
        <p className="mt-[26px] text-[16px] leading-[1.5]">Gardez l’appli ouverte pendant l’envoi.</p>
        <p className="mt-[8px] text-[14px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          Si elle se ferme, choisissez à nouveau le même fichier : l’envoi reprend où il en était.
        </p>
      </section>
    );
  }

  if (phase.quoi === "lecture") {
    return (
      <section className="mx-[26px] mt-[10px]" data-atlas="lecture-import">
        <p className={libelleCaps} style={{ color: colors.muted }}>
          Lecture
        </p>
        {jauge(phase.lues, phase.recues)}
        {phase.recues > 0 && chiffre(phase.lues, phase.recues)}
        <p className="mt-[26px] text-[16px] leading-[1.5]">Vous pouvez fermer l’appli. La lecture continue sans vous.</p>
        <p className="mt-[8px] text-[14px] leading-[1.5]" style={{ color: colors.inkSoft }}>
          Vos clients apparaîtront quand vous aurez tout rangé.
        </p>
        <button
          type="button"
          onClick={() => router.push("/clients")}
          className="atlas-plein mt-[28px] flex min-h-[54px] w-full items-center justify-center rounded-full text-[18px]"
          style={{ backgroundColor: colors.plein, color: colors.cream, fontFamily: font.display }}
        >
          Fermer
        </button>
        <Refuses refuses={refuses} />
      </section>
    );
  }

  // Relecture
  const { etat, pieces } = phase;
  const nommees = pieces.filter((p) => (noms[p.id] ?? "").trim() && (p.genre ?? genres[p.id])).length;
  const aRanger = etat.pretes + nommees;
  const reste = pieces.length - nommees;
  return (
    <section className="mx-[26px] mt-[10px]" data-atlas="relecture-import">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        {nombre(etat.recues)} documents lus
      </p>
      <p className="mt-[14px] text-[16px] leading-[1.5]">
        {nombre(etat.pretes)} prêts à ranger{pieces.length > 0 ? `, ${nombre(pieces.length)} à vérifier.` : "."}
      </p>
      <ul className="mt-[10px]">
        {pieces.map((p) => (
          <li key={p.id} className="py-[16px]" style={{ borderBottom: `1px solid ${colors.line}` }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px]" style={{ fontFamily: font.display }}>
                {p.numero ? `n° ${p.numero}` : "Sans numéro"}
              </span>
              {p.montantTtc && (
                <span className="text-[14.5px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Number(p.montantTtc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </span>
              )}
            </div>
            {p.jour && (
              <p className="text-[13px]" style={{ color: colors.muted }}>
                {jourCourt(p.jour)}
              </p>
            )}
            {!p.genre && (
              <div className="mt-[10px] flex gap-2" role="radiogroup" aria-label="Devis ou facture">
                {(["devis", "facture"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={genres[p.id] === g}
                    onClick={() => setGenres((x) => ({ ...x, [p.id]: g }))}
                    className="min-h-[44px] rounded-full px-5 text-[15px]"
                    style={
                      genres[p.id] === g
                        ? { backgroundColor: colors.plein, color: colors.cream }
                        : { boxShadow: `inset 0 0 0 1px ${colors.line}` }
                    }
                  >
                    {g === "devis" ? "Devis" : "Facture"}
                  </button>
                ))}
              </div>
            )}
            <input
              data-atlas="nom-piece"
              value={noms[p.id] ?? ""}
              onChange={(e) => setNoms((x) => ({ ...x, [p.id]: e.target.value }))}
              placeholder="Nom du client"
              autoComplete="off"
              enterKeyHint="done"
              className="mt-[10px] w-full rounded-[12px] px-[14px] py-[12px] text-[16px]"
              style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}`, color: colors.ink }}
            />
          </li>
        ))}
      </ul>
      {erreur && (
        <p className="mt-[16px] text-[15px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
      <button
        type="button"
        data-atlas="ranger-pieces"
        disabled={enCours || aRanger === 0}
        onClick={() => void ranger()}
        className="atlas-plein mt-[24px] flex min-h-[54px] w-full items-center justify-center rounded-full text-[18px] disabled:opacity-45"
        style={{ backgroundColor: colors.plein, color: colors.cream, fontFamily: font.display }}
      >
        {enCours ? "Un instant…" : reste > 0 ? `Ranger ${nombre(aRanger)} documents` : "Tout ranger"}
      </button>
      <Refuses refuses={refuses} />
    </section>
  );
}

/** Ce qui n'est pas parti, nommé : un dossier qui se tairait laisserait croire qu'il est complet. */
function Refuses({ refuses }: { refuses: Refuse[] }) {
  if (refuses.length === 0) return null;
  return (
    <details className="mt-[26px]" data-atlas="refuses-import">
      <summary className="min-h-[44px] cursor-pointer text-[15px]" style={{ color: colors.alert }}>
        {refuses.length === 1 ? "1 fichier non importé" : `${nombre(refuses.length)} fichiers non importés`}
      </summary>
      <ul className="mt-[6px]">
        {refuses.map((r, i) => (
          <li key={i} className="py-[6px] text-[13.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
            {r.nom} : {r.raison}
          </li>
        ))}
      </ul>
    </details>
  );
}

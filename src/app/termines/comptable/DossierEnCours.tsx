"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE, ORDRE_CATEGORIES } from "@/lib/couleurs-comptable";
import { LIBELLE_MOTIF, MOTIFS_VIREMENT, type Categorie, type Decoupage } from "@/lib/pour-mon-comptable";
import { checkUpAction, joindreFactureAction, motifAction, relierTicketAction, ticketPerduAction } from "./actions";
import ArretDuDossier from "./ArretDuDossier";
import FeuilleAchat, { type DepartDeLaFeuille } from "../tva/FeuilleAchat";
import { rangerTicketAction } from "../tva/actions";
import { nettoyerPhotoDuTicket } from "@/components/atlas/nettoyer-photo";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { jourIso } from "@/lib/jour";

/**
 * L'ÉCRAN DU DOSSIER EN COURS — écrans 2 et 4 de `appli/pour-mon-comptable.html`.
 *
 * Le Check up est le seul bouton plein. Ce qui attend sa réponse vient juste
 * dessous, une carte par ligne ; puis la légende et les périodes. Tout geste
 * revient en valeur, avec sa phrase, et l'écran se relit après.
 */

export type Periode = {
  cle: string;
  nom: string;
  etat: string;
  manque: boolean;
  sorties: string;
  entrees: string;
  parCategorie: Partial<Record<Categorie, number>>;
  totalSorties: number;
};

export type ARegarder = {
  id: string;
  /** `carte` : un achat sans ticket ; `virement` : un virement envoyé sans pièce ; `entree` : un virement reçu sans facture confirmée. */
  genre: "carte" | "virement" | "entree";
  qui: string;
  jour: string;
  montant: string;
  categorie: Categorie;
  /** Les tickets possibles quand il y en a plusieurs. */
  tickets: { id: string; fournisseur: string; jour: string }[];
  /**
   * La raison du comptable, quand il a rejeté la ligne (lot 4) : la carte
   * vit alors dans Mes dossiers, et propose aussi un ticket unique du même
   * montant, puisque celui qu'Atlas avait relié ne lui convenait pas.
   */
  rejet?: string | null;
};

export type Facture = { id: string; nom: string; societe: string; montant: string | null };

const DECOUPAGES: { cle: Decoupage; nom: string }[] = [
  { cle: "mois", nom: "Mois" },
  { cle: "trimestre", nom: "Trimestre" },
  { cle: "annee", nom: "Année" },
];

export default function DossierEnCours({
  dossier,
  banque,
  periodes,
  aRegarder,
  factures,
}: {
  dossier: { du: string; premier: boolean; aujourdhui: string };
  banque: { nom: string; lue: string | null } | null;
  periodes: Record<Decoupage, Periode[]>;
  aRegarder: ARegarder[];
  factures: Facture[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [decoupage, setDecoupage] = useState<Decoupage>("mois");
  const [bilan, setBilan] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  function checkUp() {
    setRefus(null);
    demarrer(async () => {
      const r = await checkUpAction();
      if (!r.ok) {
        setRefus(r.raison);
        return;
      }
      setBilan(
        r.vues === 0
          ? "Rien à vérifier."
          : `${r.vues} ${r.vues > 1 ? "lignes vues" : "ligne vue"}, ${r.relies} ${r.relies > 1 ? "reliées" : "reliée"}. ${
              r.restent > 0 ? `${r.restent} ${r.restent > 1 ? "attendent" : "attend"} votre réponse.` : "Tout est justifié."
            }`
      );
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mx-6 mt-4 flex items-center gap-2.5 text-[13.5px]" style={{ color: colors.inkSoft }} data-atlas="source-du-releve">
        <span className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: banque ? colors.plein : colors.muted }} />
        <span className="min-w-0 flex-1">{banque ? `${banque.nom} reliée${banque.lue ? `, lue le ${banque.lue}` : ""}` : "Aucune banque reliée"}</span>
        <Link href="/reglages/banque" className="min-h-[36px] py-2 text-[13.5px] font-medium" style={{ color: colors.rust }}>
          {banque ? "Ma banque" : "Relier ma banque"}
        </Link>
      </p>

      <div className="mx-6 mt-5">
        <button
          type="button"
          data-atlas="check-up"
          disabled={enCours}
          onClick={checkUp}
          className="atlas-plein min-h-[46px] w-full rounded-full px-5 py-3 text-[15px] font-medium disabled:opacity-60"
          style={{ backgroundColor: colors.plein, color: colors.card }}
        >
          {enCours ? "Vérification…" : "Check up"}
        </button>
        {bilan && (
          <p className="mt-2 text-center text-[13px]" style={{ color: colors.inkSoft }} data-atlas="bilan-check-up">
            {bilan}
          </p>
        )}
        {refus && (
          <p role="alert" className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
            {refus}
          </p>
        )}
      </div>

      <ArretDuDossier du={dossier.du} premier={dossier.premier} aujourdhui={dossier.aujourdhui} aJustifier={aRegarder.length} />

      {aRegarder.length > 0 && (
        <div className="mx-6 mt-5 flex flex-col gap-3" data-atlas="a-regarder">
          {aRegarder.map((a) => (
            <CarteARegarder key={a.id} a={a} factures={factures} />
          ))}
        </div>
      )}

      <div className="mx-6 mt-5 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px]" style={{ color: colors.inkSoft }}>
        {ORDRE_CATEGORIES.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[c] }} />
            {c === "virement" ? "Virement" : NOM_CATEGORIE[c]}
          </span>
        ))}
      </div>

      <div className="mx-6 mt-5 flex rounded-full p-[3px]" style={{ backgroundColor: colors.rustTint }} role="group" aria-label="Découpage">
        {DECOUPAGES.map((d) => (
          <button
            key={d.cle}
            type="button"
            aria-pressed={decoupage === d.cle}
            onClick={() => setDecoupage(d.cle)}
            className="min-h-[40px] flex-1 rounded-full text-[14px] font-medium"
            style={decoupage === d.cle ? { backgroundColor: colors.card, color: colors.ink, boxShadow: `0 0 0 1px ${colors.line}` } : { color: colors.inkSoft }}
          >
            {d.nom}
          </button>
        ))}
      </div>

      {periodes[decoupage].length === 0 ? (
        <p className="mx-6 mt-6 text-[14px]" style={{ color: colors.muted }}>
          Aucune ligne de banque pour l’instant.
        </p>
      ) : (
        <ul className="mx-6 mt-4" data-atlas="periodes">
          {periodes[decoupage].map((p) => (
            <li key={p.cle} style={{ borderTop: `1px solid ${colors.lineSoft}` }}>
              <Link href={`/termines/comptable/${p.cle}`} className="block py-3.5" data-atlas="periode">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[18px]" style={{ fontFamily: font.display }}>
                    {p.nom}
                  </span>
                  <span className={`text-[13px] ${p.manque ? "font-medium" : ""}`} style={{ color: p.manque ? colors.alert : colors.rust }}>
                    {p.etat}
                  </span>
                </span>
                <span className="mt-2 flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.lineSoft }}>
                  {ORDRE_CATEGORIES.map((c) =>
                    p.parCategorie[c] && p.totalSorties > 0 ? (
                      <i key={c} className="block h-full" style={{ width: `${((p.parCategorie[c] ?? 0) / p.totalSorties) * 100}%`, backgroundColor: COULEUR_CATEGORIE[c] }} />
                    ) : null
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Une ligne qui attend sa réponse. Ses gestes, sur la planche : choisir parmi
 * deux tickets ; photographier le ticket (Ma TVA, qui le lit) ; « Ticket
 * perdu », annoncé AVANT d'être validé ; pour un virement, joindre une facture
 * de fournisseur ou dire ce que c'est.
 */
export function CarteARegarder({ a, factures }: { a: ARegarder; factures: Facture[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [etape, setEtape] = useState<"ouvert" | "perdu" | "facture" | "motif">("ouvert");
  const [refus, setRefus] = useState<string | null>(null);
  const objectif = useRef<HTMLInputElement>(null);
  // **La photo se prend ICI, pour CETTE ligne** (lot 5, 24 octobre 2026) :
  // la même feuille que Ma TVA, et le ticket rejoint sa ligne à l'enregistrement.
  const [feuille, setFeuille] = useState<(DepartDeLaFeuille & { aujourdHui: string }) | null>(null);

  function photographier(fichier: File) {
    setRefus(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("ticket", await nettoyerPhotoDuTicket(fichier));
      const r = await rangerTicketAction(fd);
      const aujourdHui = jourIso(new Date());
      setFeuille(r.ok ? { photoCle: r.cle, lu: r.lu, lecture: r.lecture, refus: null, aujourdHui } : { photoCle: null, lu: null, lecture: null, refus: r.raison, aujourdHui });
    });
  }

  function jouer(geste: () => Promise<{ ok: true } | { ok: false; raison: string }>) {
    setRefus(null);
    demarrer(async () => {
      const r = await geste();
      if (!r.ok) setRefus(r.raison);
      else router.refresh();
    });
  }

  const bouton = "min-h-[44px] rounded-full px-5 py-2.5 text-[14px] font-medium disabled:opacity-60";
  const leger = "min-h-[44px] px-2 text-[14px] font-medium disabled:opacity-60";

  return (
    <article className="rounded-[18px] px-[18px] py-4" style={{ backgroundColor: colors.card }} data-atlas="ligne-a-regarder">
      <p className="flex items-center gap-2 text-[12.5px]" style={{ color: COULEUR_CATEGORIE[a.categorie] }}>
        <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[a.categorie] }} />
        {NOM_CATEGORIE[a.categorie]}
      </p>
      <p className="mt-2 text-[17px] leading-[1.3]" style={{ fontFamily: font.display }}>
        {a.qui}, le {a.jour}
      </p>
      <p className="mt-0.5 text-[20px] tabular-nums" style={{ fontFamily: font.display }}>
        {a.montant}
      </p>
      {a.rejet !== undefined && (
        <p className="mt-1.5 text-[13.5px] leading-[1.45]" style={{ color: colors.carteRougeTexte }} data-atlas="raison-du-comptable">
          Votre comptable l’a rejetée : {a.rejet ?? "sans raison écrite"}.
        </p>
      )}

      {a.genre === "entree" ? (
        <p className="mt-1.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
          Sa facture se confirme sur l’accueil.{" "}
          <Link href="/" className="font-medium" style={{ color: colors.rust }}>
            Y aller
          </Link>
        </p>
      ) : etape === "perdu" ? (
        <>
          <p className="mt-1.5 text-[13.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Validée sans ticket, la ligne porte la mention « ticket perdu ». Sa TVA ne sera pas déduite.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" data-atlas="valider-ticket-perdu" disabled={enCours} onClick={() => jouer(() => ticketPerduAction(a.id))} className={`atlas-plein ${bouton}`} style={{ backgroundColor: colors.plein, color: colors.card }}>
              Valider
            </button>
            <button type="button" disabled={enCours} onClick={() => setEtape("ouvert")} className={leger} style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </div>
        </>
      ) : etape === "facture" ? (
        <>
          {factures.length === 0 ? (
            <p className="mt-1.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
              Aucune facture de fournisseur rangée.{" "}
              <Link href="/reglages/fournisseurs" className="font-medium" style={{ color: colors.rust }}>
                En ajouter une
              </Link>
            </p>
          ) : (
            <div className="mt-3 flex flex-col overflow-hidden rounded-[12px]" style={{ gap: 1, backgroundColor: colors.lineSoft }}>
              {factures.map((f) => (
                <button key={f.id} type="button" disabled={enCours} onClick={() => jouer(() => joindreFactureAction(a.id, f.id))} className="flex min-h-[52px] items-center justify-between gap-3 px-3.5 py-3 text-left disabled:opacity-60" style={{ backgroundColor: colors.cream, color: colors.ink }} data-atlas="choix-facture">
                  <span className="min-w-0">
                    <span className="block text-[14.5px]">{f.societe}</span>
                    <span className="block text-[12px]" style={{ color: colors.muted }}>
                      {f.nom}
                    </span>
                  </span>
                  {f.montant && <span className="flex-none text-[15px] tabular-nums" style={{ fontFamily: font.display }}>{f.montant}</span>}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center">
            <button type="button" disabled={enCours} onClick={() => setEtape("ouvert")} className={`-mx-2 ${leger}`} style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </div>
        </>
      ) : etape === "motif" ? (
        <>
          <p className="mt-1.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
            C’est :
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MOTIFS_VIREMENT.map((m) => (
              <button key={m} type="button" disabled={enCours} onClick={() => jouer(() => motifAction(a.id, m))} className="min-h-[42px] rounded-full px-3.5 py-2 text-[13.5px] disabled:opacity-60" style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.cream, color: colors.ink }} data-atlas="choix-motif">
                {LIBELLE_MOTIF[m]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center">
            <button type="button" disabled={enCours} onClick={() => setEtape("ouvert")} className={`-mx-2 ${leger}`} style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </div>
        </>
      ) : a.tickets.length > 1 || (a.rejet !== undefined && a.tickets.length > 0) ? (
        <>
          <p className="mt-1.5 text-[13.5px]" style={{ color: colors.inkSoft }}>
            {a.tickets.length > 1 ? "Plusieurs tickets du même montant. Lequel ?" : "Un ticket du même montant :"}
          </p>
          <div className="mt-3 flex flex-col overflow-hidden rounded-[12px]" style={{ gap: 1, backgroundColor: colors.lineSoft }}>
            {a.tickets.map((t) => (
              <button key={t.id} type="button" disabled={enCours} onClick={() => jouer(() => relierTicketAction(a.id, t.id))} className="flex min-h-[52px] flex-col justify-center px-3.5 py-3 text-left disabled:opacity-60" style={{ backgroundColor: colors.cream, color: colors.ink }} data-atlas="choix-ticket">
                <span className="text-[14.5px]">{t.fournisseur}</span>
                <span className="text-[12px]" style={{ color: colors.muted }}>
                  {t.jour}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center">
            <button type="button" disabled={enCours} onClick={() => setEtape("perdu")} className={`-mx-2 ${leger}`} style={{ color: colors.inkSoft }}>
              {a.tickets.length > 1 ? "Aucun des deux" : "Ce n’est pas lui"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[13.5px]" style={{ color: colors.alert }}>
            {a.genre === "virement" ? "Aucune facture jointe." : "Aucun ticket ne correspond."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {a.genre === "virement" ? (
              <>
                <button type="button" disabled={enCours} onClick={() => setEtape("facture")} className={`atlas-plein ${bouton}`} style={{ backgroundColor: colors.plein, color: colors.card }} data-atlas="joindre-facture">
                  Joindre la facture
                </button>
                <button type="button" disabled={enCours} onClick={() => setEtape("motif")} className={leger} style={{ color: colors.inkSoft }} data-atlas="autre-chose">
                  C’est autre chose
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={enCours} onClick={() => objectif.current?.click()} className={`atlas-plein inline-flex items-center ${bouton}`} style={{ backgroundColor: colors.plein, color: colors.card }} data-atlas="photographier-ticket">
                  {enCours ? "Envoi…" : "Photographier le ticket"}
                </button>
                <button type="button" disabled={enCours} onClick={() => setEtape("perdu")} className={leger} style={{ color: colors.inkSoft }} data-atlas="ticket-perdu">
                  Ticket perdu
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Sans `capture` : le téléphone propose l'appareil ET la photothèque, un
          ticket photographié la veille reste atteignable (comme Ma TVA). */}
      <input
        ref={objectif}
        type="file"
        accept={ACCEPT_PHOTOS}
        className="hidden"
        data-atlas="photo-du-ticket-entree"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) photographier(f);
        }}
      />
      {feuille && (
        <FeuilleAchat
          ouverte
          onFermer={() => setFeuille(null)}
          depart={feuille}
          aujourdHui={feuille.aujourdHui}
          mouvementId={a.id}
          onEnregistre={() => {
            setFeuille(null);
            router.refresh();
          }}
        />
      )}

      {refus && (
        <p role="alert" className="mt-2 rounded-lg px-3 py-2 text-[13px]" style={{ backgroundColor: colors.carteRougeFond, color: colors.carteRougeTexte }}>
          {refus}
        </p>
      )}
    </article>
  );
}

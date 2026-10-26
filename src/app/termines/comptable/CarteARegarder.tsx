"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { COULEUR_CATEGORIE, NOM_CATEGORIE } from "@/lib/couleurs-comptable";
import { ecartDeMontant, ecartEnMots, justesDAbord, libelleMotif, motifsDuSens, type Motif } from "@/lib/pour-mon-comptable";
import { enEuros } from "@/lib/euros";
import { ACCEPT_PHOTOS } from "@/lib/exif";
import { jourIso } from "@/lib/jour";
import { nettoyerPhotoDuTicket } from "@/components/atlas/nettoyer-photo";
import FeuilleAchat, { type DepartDeLaFeuille } from "../tva/FeuilleAchat";
import { rangerTicketAction } from "../tva/actions";
import {
  abandonnerFactureHorsAtlasAction,
  confirmerEntreeAction,
  deposerFactureHorsAtlasAction,
  joindreFactureAction,
  joindreFactureHorsAtlasAction,
  motifAction,
  relierTicketAction,
  ticketPerduAction,
  type PieceDeposee,
} from "./actions";
import type { ARegarder, Facture } from "./a-regarder";
import Icone from "./Icone";

/**
 * UNE LIGNE QUI ATTEND SA RÉPONSE — la carte de la planche choisie le
 * 25 octobre 2026 (`appli/soignee/termines-comptable.html`).
 *
 * En grand, le nom et le montant ; ce qui manque, en rouge, avec son signe ;
 * un geste cerné, et l'autre réponse dessous. Ses gestes : choisir parmi deux
 * tickets ; photographier le ticket (la feuille de Ma TVA, qui le lit) ;
 * « Ticket perdu », annoncé AVANT d'être validé ; pour un virement envoyé,
 * joindre une facture de fournisseur ou dire ce que c'est ; pour un virement
 * REÇU, choisir la facture d'Atlas, joindre une facture faite hors d'Atlas, ou
 * dire ce que c'est. Avant cela, il renvoyait vers l'accueil, où rien
 * n'apparaissait quand aucune facture ne faisait le montant.
 *
 * **Une pièce qui ne tombe pas juste montre l'écart avant d'être jointe** (sa
 * remarque du même jour). Le serveur refuse sans son accord et rend les deux
 * montants ; joindre quand même reste possible (un acompte, deux factures pour
 * un virement), et l'écart reste écrit sur le relevé et chez le comptable.
 */

type Ecart = {
  ligne: number;
  piece: number;
  /** Comment la pièce se nomme dans l'encart : « La facture F-2026-012 ». */
  nom: string;
  /** D'où elle vient : ce qui décide des deux réponses proposées. */
  source: "ticket" | "facture" | "recu" | "hors-atlas";
  /** La facture faite hors d'Atlas déjà rangée : reprise, elle quitte le stockage. */
  deposee?: PieceDeposee;
  joindre: () => void;
};

type Etape =
  | { e: "ouvert" }
  | { e: "perdu" }
  | { e: "facture" }
  | { e: "motif" }
  | { e: "lecture" }
  | { e: "ecart"; ecart: Ecart }
  /** Le total d'une facture faite hors d'Atlas ne s'est pas lu : il le tape. */
  | { e: "total"; piece: PieceDeposee };

type Resultat = { ok: true; fait?: string } | { ok: false; raison: string; ecart?: { ligne: number; piece: number } };

export default function CarteARegarder({ a, factures, onFait }: { a: ARegarder; factures: Facture[]; onFait?: (texte: string) => void }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [etape, setEtape] = useState<Etape>({ e: "ouvert" });
  const [refus, setRefus] = useState<string | null>(null);
  const [totalTape, setTotalTape] = useState("");
  const objectif = useRef<HTMLInputElement>(null);
  const fichierHorsAtlas = useRef<HTMLInputElement>(null);
  // **La photo se prend ICI, pour CETTE ligne** (lot 5, 24 octobre 2026) :
  // la même feuille que Ma TVA, et le ticket rejoint sa ligne à l'enregistrement.
  const [feuille, setFeuille] = useState<(DepartDeLaFeuille & { aujourdHui: string }) | null>(null);

  const fini = (texte: string) => {
    onFait?.(texte);
    router.refresh();
  };

  /**
   * Joue un geste. Un refus porteur d'un écart ouvre l'encart des deux
   * montants ; `nomDeLaPiece` et `source` disent comment le montrer, et
   * `malgre` rejoue le même geste avec son accord.
   */
  function jouer(geste: (malgreEcart: boolean) => Promise<Resultat>, succes: string, ecart?: { nom: string; source: Ecart["source"] }, malgreEcart = false) {
    setRefus(null);
    demarrer(async () => {
      const r = await geste(malgreEcart);
      if (r.ok) return fini(r.fait ?? succes);
      if (r.ecart && ecart) {
        setEtape({
          e: "ecart",
          ecart: {
            ...r.ecart,
            ...ecart,
            joindre: () => jouer(geste, succes, ecart, true),
          },
        });
        return;
      }
      setRefus(r.raison);
    });
  }

  function photographier(fichier: File) {
    setRefus(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("ticket", await nettoyerPhotoDuTicket(fichier));
      const r = await rangerTicketAction(fd);
      const aujourdHui = jourIso(new Date());
      setFeuille(
        r.ok
          ? {
              photoCle: r.cle,
              lu: r.lu,
              lecture: r.lecture,
              refus: null,
              aujourdHui,
            }
          : {
              photoCle: null,
              lu: null,
              lecture: null,
              refus: r.raison,
              aujourdHui,
            },
      );
    });
  }

  /** La facture faite hors d'Atlas : rangée, lue, comparée au virement. */
  function deposer(fichier: File) {
    setRefus(null);
    setEtape({ e: "lecture" });
    demarrer(async () => {
      const fd = new FormData();
      fd.set("mouvementId", a.id);
      fd.set("fichier", fichier.type.startsWith("image/") ? await nettoyerPhotoDuTicket(fichier) : fichier);
      const r = await deposerFactureHorsAtlasAction(fd);
      if (r.ok) return fini(r.fait);
      if (r.piece && r.ecart) {
        const piece = r.piece;
        setEtape({
          e: "ecart",
          ecart: {
            ...r.ecart,
            nom: "La facture lue",
            source: "hors-atlas",
            deposee: piece,
            joindre: () => joindreLue(piece, true),
          },
        });
        return;
      }
      if (r.piece) {
        setTotalTape("");
        setEtape({ e: "total", piece: r.piece });
        return;
      }
      setEtape({ e: "facture" });
      setRefus(r.raison);
    });
  }

  function joindreLue(piece: PieceDeposee, malgreEcart: boolean) {
    setRefus(null);
    demarrer(async () => {
      const r = await joindreFactureHorsAtlasAction(a.id, piece, malgreEcart);
      if (r.ok) return fini(r.fait);
      if (r.ecart && r.piece) {
        const p = r.piece;
        setEtape({
          e: "ecart",
          ecart: {
            ...r.ecart,
            nom: "La facture",
            source: "hors-atlas",
            deposee: p,
            joindre: () => joindreLue(p, true),
          },
        });
        return;
      }
      setRefus(r.raison);
    });
  }

  /** Une facture déposée et jamais jointe quitte le stockage, et l'appareil photo se rouvre. */
  function reprendre(piece: PieceDeposee | null) {
    setEtape({ e: "facture" });
    if (piece) demarrer(async () => void (await abandonnerFactureHorsAtlasAction(piece.cle)));
    fichierHorsAtlas.current?.click();
  }

  const fermer = () => {
    setRefus(null);
    setEtape({ e: "ouvert" });
  };

  const creux = "inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-medium disabled:opacity-60";
  const styleCreux = {
    boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
    backgroundColor: colors.card,
    color: colors.ink,
  };
  const texte = "min-h-[46px] w-full px-2.5 text-center text-[16px] font-medium disabled:opacity-60";
  const marque = (montantBrut: string | null) => (montantBrut === null ? null : ecartDeMontant(a.montantBrut, montantBrut).genre === "juste");

  const motifs = motifsDuSens(a.genre === "entree" ? "entree" : "sortie");
  const rejetee = a.rejet !== undefined;

  return (
    <article className="rounded-[18px] px-[18px] py-4" style={{ backgroundColor: rejetee ? colors.carteRougeFond : colors.card }} data-atlas="ligne-a-regarder">
      {rejetee ? (
        <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: colors.carteRougeTexte }}>
          <i className="inline-block h-[7px] w-[7px] flex-none rounded-full" style={{ backgroundColor: "currentColor" }} />
          Rejetée par votre comptable
        </p>
      ) : (
        <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: colors.inkSoft }}>
          <i className="inline-block h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: COULEUR_CATEGORIE[a.categorie] }} />
          {NOM_CATEGORIE[a.categorie]}
          <span className="ml-auto font-normal">{a.jour}</span>
        </p>
      )}
      <p className="mt-2 flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-[19px] leading-[1.25] [overflow-wrap:anywhere]" style={{ fontFamily: font.display }}>
          {a.qui}
        </span>
        <span className="flex-none whitespace-nowrap text-[22px] leading-[1.1] tabular-nums" style={{ fontFamily: font.display }}>
          {a.montant}
        </span>
      </p>
      {rejetee && (
        <>
          <p className="mt-0.5 text-[14.5px]" style={{ color: colors.inkSoft }}>
            {a.jour}
          </p>
          <p className="mt-2 text-[15px] leading-[1.45]" style={{ color: colors.ink }} data-atlas="raison-du-comptable">
            {a.rejet ? `« ${a.rejet} »` : "Sans raison écrite."}
          </p>
        </>
      )}

      {etape.e === "lecture" ? (
        <p className="mt-2.5 flex items-center gap-2 text-[15px]" style={{ color: colors.inkSoft }} role="status">
          <span style={{ color: colors.or }}>
            <Icone nom="sablier" />
          </span>
          Lecture de la facture…
        </p>
      ) : etape.e === "ecart" ? (
        <EncartEcart
          ecart={etape.ecart}
          sens={a.genre === "entree" ? "entree" : "sortie"}
          enCours={enCours}
          onAutre={() =>
            etape.ecart.source === "hors-atlas"
              ? reprendre(etape.ecart.deposee ?? null)
              : setEtape(etape.ecart.source === "ticket" ? { e: "ouvert" } : { e: "facture" })
          }
        />
      ) : etape.e === "total" ? (
        <>
          <p className="mt-2.5 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            Le total ne se lit pas. Tapez-le.
          </p>
          <label
            className="mt-3 flex min-h-[52px] items-center gap-3 rounded-[12px] px-3.5"
            style={{
              boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
              backgroundColor: colors.cream,
            }}
          >
            <span className="text-[15px]" style={{ color: colors.inkSoft }}>
              Son total
            </span>
            <input
              inputMode="decimal"
              value={totalTape}
              onChange={(e) => setTotalTape(e.target.value)}
              placeholder="0,00"
              className="min-w-0 flex-1 bg-transparent text-right text-[17px] tabular-nums outline-none"
              data-atlas="total-facture-hors-atlas"
            />
            <span className="text-[15px]">€</span>
          </label>
          <div className="mt-3.5 flex flex-col gap-0.5">
            <button
              type="button"
              disabled={enCours || totalTape.trim() === ""}
              onClick={() => joindreLue({ ...etape.piece, total: totalTape }, false)}
              className={creux}
              style={styleCreux}
              data-atlas="joindre-facture-hors-atlas"
            >
              <Icone nom="coche" taille={21} />
              Joindre
            </button>
            <button type="button" disabled={enCours} onClick={() => reprendre(etape.piece)} className={texte} style={{ color: colors.inkSoft }}>
              Reprendre la photo
            </button>
          </div>
        </>
      ) : etape.e === "perdu" ? (
        <>
          <p
            className="mt-2.5 rounded-[14px] px-3.5 py-3 text-[15px] leading-[1.45]"
            style={{
              backgroundColor: colors.carteAmbreFond,
              color: colors.ink,
            }}
          >
            Validée sans ticket, la ligne porte la mention « ticket perdu ». <b className="font-semibold">Sa TVA ne sera pas déduite.</b>
          </p>
          <div className="mt-3.5 flex flex-col gap-0.5">
            <button
              type="button"
              data-atlas="valider-ticket-perdu"
              disabled={enCours}
              onClick={() => jouer(() => ticketPerduAction(a.id), "Ligne justifiée, ticket perdu.")}
              className={creux}
              style={styleCreux}
            >
              <Icone nom="coche" taille={21} />
              Valider
            </button>
            <button type="button" disabled={enCours} onClick={fermer} className={texte} style={{ color: colors.inkSoft }}>
              Annuler
            </button>
          </div>
        </>
      ) : etape.e === "facture" && a.genre === "entree" ? (
        <>
          <p className="mt-2.5 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            {a.factures.length > 0 ? "Laquelle ? Les factures qui attendent leur paiement :" : "Aucune facture d’Atlas n’attend de paiement."}
          </p>
          <ul className="mt-3">
            {justesDAbord(a.factures, a.montantBrut, (f) => f.resteBrut).map((f) => (
              <li key={f.id}>
                <Piece
                  nom={f.qui ?? `Facture ${f.numero}`}
                  sous={f.qui ? `Facture ${f.numero}, reste à payer` : "Reste à payer"}
                  montant={f.reste}
                  juste={marque(f.resteBrut)}
                  disabled={enCours}
                  data="choix-facture-atlas"
                  onClick={() =>
                    jouer((m) => confirmerEntreeAction(a.id, f.id, m), "Facture confirmée.", {
                      nom: `La facture ${f.numero} attend`,
                      source: "recu",
                    })
                  }
                />
              </li>
            ))}
            <li>
              <Piece
                nom="Une facture faite hors d’Atlas"
                sous="La photographier ou choisir le PDF"
                disabled={enCours}
                data="facture-hors-atlas"
                onClick={() => fichierHorsAtlas.current?.click()}
              />
            </li>
          </ul>
          <button type="button" disabled={enCours} onClick={fermer} className={`mt-1 ${texte}`} style={{ color: colors.inkSoft }}>
            Annuler
          </button>
        </>
      ) : etape.e === "facture" ? (
        <>
          {factures.length === 0 ? (
            <p className="mt-2.5 text-[15px]" style={{ color: colors.inkSoft }}>
              Aucune facture de fournisseur rangée.{" "}
              <Link href="/reglages/fournisseurs" className="font-medium" style={{ color: colors.rust }}>
                En ajouter une
              </Link>
            </p>
          ) : (
            <>
              <p className="mt-2.5 text-[15px]" style={{ color: colors.inkSoft }}>
                Laquelle ?
              </p>
              <ul className="mt-3">
                {justesDAbord(factures, a.montantBrut, (f) => f.montantBrut).map((f) => (
                  <li key={f.id}>
                    <Piece
                      nom={f.societe}
                      sous={f.nom}
                      montant={f.montant}
                      juste={marque(f.montantBrut)}
                      disabled={enCours}
                      data="choix-facture"
                      onClick={() =>
                        jouer((m) => joindreFactureAction(a.id, f.id, m), "Facture jointe.", { nom: `La facture ${f.societe}`, source: "facture" })
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" disabled={enCours} onClick={fermer} className={`mt-1 ${texte}`} style={{ color: colors.inkSoft }}>
            Annuler
          </button>
        </>
      ) : etape.e === "motif" ? (
        <>
          <p className="mt-2.5 text-[15px]" style={{ color: colors.inkSoft }}>
            C’est :
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {motifs.map((m: Motif) => (
              <button
                key={m}
                type="button"
                disabled={enCours}
                onClick={() =>
                  jouer(() => motifAction(a.id, m), `Ligne justifiée : ${libelleMotif(m, a.genre === "entree" ? "entree" : "sortie").toLowerCase()}.`)
                }
                className="min-h-[50px] rounded-full px-1 text-[15px] font-medium leading-[1.2] disabled:opacity-60"
                style={styleCreux}
                data-atlas="choix-motif"
              >
                {libelleMotif(m, a.genre === "entree" ? "entree" : "sortie")}
              </button>
            ))}
          </div>
          <button type="button" disabled={enCours} onClick={fermer} className={`mt-1.5 ${texte}`} style={{ color: colors.inkSoft }}>
            Annuler
          </button>
        </>
      ) : a.tickets.length > 1 || (a.rejet !== undefined && a.tickets.length > 0) ? (
        <>
          <p className="mt-2.5 text-[15px] leading-[1.45]" style={{ color: colors.inkSoft }}>
            {a.tickets.length > 1 ? "Plusieurs tickets du même montant. Lequel ?" : "Un ticket du même montant :"}
          </p>
          <ul className="mt-3">
            {a.tickets.map((t) => (
              <li key={t.id}>
                <Piece
                  nom={t.fournisseur}
                  sous={t.jour}
                  disabled={enCours}
                  data="choix-ticket"
                  onClick={() => jouer((m) => relierTicketAction(a.id, t.id, m), "Ticket relié.", { nom: "Le ticket", source: "ticket" })}
                />
              </li>
            ))}
          </ul>
          <button type="button" disabled={enCours} onClick={() => setEtape({ e: "perdu" })} className={`mt-1 ${texte}`} style={{ color: colors.inkSoft }}>
            {a.tickets.length > 1 ? "Aucun des deux" : "Ce n’est pas lui"}
          </button>
        </>
      ) : (
        <>
          {!rejetee && (
            <p className="mt-2.5 flex items-start gap-2 text-[15px] font-semibold leading-[1.35]" style={{ color: colors.alert }}>
              <Icone nom="alerte" taille={19} epaisseur={2} className="mt-px" />
              {a.genre === "entree"
                ? a.factures.some((f) => marque(f.resteBrut))
                  ? "Sa facture n’est pas encore confirmée."
                  : "Aucune facture d’Atlas ne fait ce montant."
                : a.genre === "virement"
                  ? "Aucune facture jointe."
                  : "Aucun ticket ne correspond."}
            </p>
          )}
          <div className="mt-3.5 flex flex-col gap-0.5">
            {a.genre === "carte" ? (
              <>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => objectif.current?.click()}
                  className={creux}
                  style={styleCreux}
                  data-atlas="photographier-ticket"
                >
                  <Icone nom="photo" taille={21} />
                  {enCours ? "Envoi…" : "Photographier le ticket"}
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setEtape({ e: "perdu" })}
                  className={texte}
                  style={{ color: colors.inkSoft }}
                  data-atlas="ticket-perdu"
                >
                  Ticket perdu
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setEtape({ e: "facture" })}
                  className={creux}
                  style={styleCreux}
                  data-atlas={a.genre === "entree" ? "choisir-la-facture" : "joindre-facture"}
                >
                  <Icone nom="facture" taille={21} />
                  {a.genre === "entree" ? "Choisir la facture" : "Joindre la facture"}
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setEtape({ e: "motif" })}
                  className={texte}
                  style={{ color: colors.inkSoft }}
                  data-atlas="autre-chose"
                >
                  C’est autre chose
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
      <input
        ref={fichierHorsAtlas}
        type="file"
        accept={`${ACCEPT_PHOTOS},application/pdf`}
        className="hidden"
        data-atlas="fichier-facture-hors-atlas"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) deposer(f);
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
            fini("Ticket rangé, il rejoint sa ligne.");
          }}
        />
      )}

      {refus && (
        <p
          role="alert"
          className="mt-2.5 rounded-[12px] px-3.5 py-2.5 text-[14px]"
          style={{
            backgroundColor: colors.carteRougeFond,
            color: colors.carteRougeTexte,
          }}
        >
          {refus}
        </p>
      )}
    </article>
  );
}

/** Un rang à choisir : une pièce, et son montant vert quand il tombe juste, rouge sinon. */
function Piece({
  nom,
  sous,
  montant,
  juste,
  disabled,
  data,
  onClick,
}: {
  nom: string;
  sous: string;
  montant?: string | null;
  juste?: boolean | null;
  disabled: boolean;
  data: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[62px] w-full items-center gap-3 py-2.5 text-left disabled:opacity-60"
      style={{ boxShadow: `inset 0 1px 0 ${colors.line}`, color: colors.ink }}
      data-atlas={data}
    >
      <span className="h-[22px] w-[22px] flex-none rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${colors.chevron}` }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium">{nom}</span>
        <span className="mt-0.5 block text-[14px]" style={{ color: colors.inkSoft }}>
          {sous}
        </span>
      </span>
      {montant && (
        <span
          className="flex-none text-[17px] tabular-nums"
          style={{
            fontFamily: font.display,
            color: juste ? colors.carteVertTexte : colors.alert,
          }}
          data-juste={juste ? "oui" : "non"}
        >
          {montant}
        </span>
      )}
    </button>
  );
}

/**
 * Les deux montants, avant de joindre. Sur un virement reçu, une facture plus
 * grande est presque toujours un paiement en partie : la réponse qui l'accepte
 * vient en premier. Ailleurs, choisir une autre pièce vient d'abord, et joindre
 * quand même reste dessous.
 */
function EncartEcart({ ecart, sens, enCours, onAutre }: { ecart: Ecart; sens: "entree" | "sortie"; enCours: boolean; onAutre: () => void }) {
  const enPartie = sens === "entree" && ecart.piece > ecart.ligne;
  const oui = enPartie ? (ecart.source === "recu" ? "Oui, une partie" : "Elle paie une partie") : null;
  const autre =
    ecart.source === "hors-atlas"
      ? "Reprendre la photo"
      : ecart.source === "ticket"
        ? "Choisir un autre ticket"
        : enPartie
          ? "Choisir une autre facture"
          : "Choisir une autre pièce";
  const creux = "inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-5 text-[16px] font-medium disabled:opacity-60";
  const styleCreux = {
    boxShadow: `inset 0 0 0 1.5px ${colors.line}`,
    backgroundColor: colors.card,
    color: colors.ink,
  };
  const texte = "min-h-[46px] w-full px-2.5 text-center text-[16px] font-medium disabled:opacity-60";
  return (
    <>
      <div className="mt-3 rounded-[14px] px-4 py-3.5" style={{ backgroundColor: colors.carteAmbreFond }} data-atlas="ecart-de-montant">
        <p className="flex items-center gap-2 text-[15px] font-bold" style={{ color: colors.carteAmbreTexte }}>
          <Icone nom="alerte" taille={19} epaisseur={2} />
          Pas le même montant
        </p>
        <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[15px]" style={{ color: colors.ink }}>
          <span>La ligne de banque</span>
          <b className="text-right text-[18px] font-normal tabular-nums" style={{ fontFamily: font.display }}>
            {enEuros(ecart.ligne / 100)}
          </b>
          <span>{ecart.nom}</span>
          <b className="text-right text-[18px] font-normal tabular-nums" style={{ fontFamily: font.display }}>
            {enEuros(ecart.piece / 100)}
          </b>
        </div>
        <p className="mt-2.5 text-[15px] leading-[1.45]" style={{ color: colors.ink }}>
          {ecartEnMots(ecart, sens)}
        </p>
      </div>
      <div className="mt-3.5 flex flex-col gap-0.5">
        {oui ? (
          <>
            <button type="button" disabled={enCours} onClick={ecart.joindre} className={creux} style={styleCreux} data-atlas="joindre-malgre-ecart">
              <Icone nom="coche" taille={21} />
              {oui}
            </button>
            <button type="button" disabled={enCours} onClick={onAutre} className={texte} style={{ color: colors.inkSoft }}>
              {autre}
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={enCours} onClick={onAutre} className={creux} style={styleCreux}>
              <Icone nom="facture" taille={21} />
              {autre}
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={ecart.joindre}
              className={texte}
              style={{ color: colors.inkSoft }}
              data-atlas="joindre-malgre-ecart"
            >
              La joindre quand même
            </button>
          </>
        )}
      </div>
    </>
  );
}

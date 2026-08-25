"use client";

import { useState } from "react";
import { colors, libelleCaps, texteSituation, font } from "@/lib/design-tokens";
import type { PropositionExtraction, LigneExtraite, LectureDictee } from "@/server/ai/schemas/extraction";
import type { EtatFraicheurBrouillon } from "@/lib/brouillon-etat";
import { reservesLisibles, phraseDuReste } from "@/lib/brouillon-reserves";
import DevisDepuisDictee from "../DevisDepuisDictee";
import {
  genererBrouillonAction,
  enregistrerBrouillonAction,
  confirmerBrouillonAction,
} from "./actions";

export type BrouillonInitial = {
  contenu: PropositionExtraction;
  statut: "brouillon" | "confirme";
  modifieParHumain: boolean;
  lecture: LectureDictee;
  fraicheur: EtatFraicheurBrouillon;
} | null;

// Ce que le patron doit lire quand personne n'a compris sa dictée. Dire
// « recopiée » plutôt que rien : il corrigera de lui-même ce qui doit l'être,
// au lieu de faire confiance à une analyse qui n'a pas eu lieu.
const MENTION_LITTERALE =
  "Votre dictée a été recopiée mot à mot : aucun modèle n'était disponible pour la comprendre. " +
  "Chaque phrase est donc reprise telle quelle — relisez-la de près avant de confirmer.";

type Props = {
  chantierId: string;
  brouillonInitial: BrouillonInitial;
  transcriptionDisponible: boolean;
  /** Une note vocale existe, mais elle n'a pas été transcrite (aucun prestataire). */
  dicteeNonTranscrite: boolean;
  onApplique: (prestations: { id: string; libelle: string }[], materiel: { id: string; libelle: string }[]) => void;
};

// Brouillon structuré issu de la dictée. Tout ce qui s'affiche ici est une
// proposition : rien n'entre dans les données du chantier avant la
// confirmation explicite du patron.
export default function BrouillonSection({
  chantierId,
  brouillonInitial,
  transcriptionDisponible,
  dicteeNonTranscrite,
  onApplique,
}: Props) {
  const [contenu, setContenu] = useState<PropositionExtraction | null>(brouillonInitial?.contenu ?? null);
  const [statut, setStatut] = useState<"brouillon" | "confirme" | null>(brouillonInitial?.statut ?? null);
  const [lecture, setLecture] = useState<LectureDictee>(brouillonInitial?.lecture ?? "modele");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Proposition concurrente : le brouillon a été corrigé à la main, une
  // nouvelle analyse existe, et le patron doit trancher lui-même.
  const [conflit, setConflit] = useState<PropositionExtraction | null>(null);

  async function generer(remplacer = false) {
    setEnCours(true);
    setErreur(null);
    try {
      const resultat = await genererBrouillonAction(chantierId, remplacer);
      if (resultat.statut === "conflit") {
        setConflit(resultat.propositionNouvelle);
        return;
      }
      if (resultat.statut === "transcription_absente") {
        setErreur("Aucune transcription disponible pour ce chantier.");
        return;
      }
      // Dire la vérité plutôt que de proposer du vide : votre dictée n'a pas
      // été écoutée, et aucune prestation ne sera fabriquée à partir de rien.
      if (resultat.statut === "transcription_simulee") {
        setErreur(
          "Votre dictée n'a pas été transcrite : aucun prestataire de transcription " +
            "n'est encore raccordé (voir le document « à faire », point 1). Rien n'a donc " +
            "pu en être extrait. Vous pouvez saisir les prestations à la main ci-dessous."
        );
        return;
      }
      if (resultat.statut === "echec") {
        setErreur(resultat.erreur);
        return;
      }
      setContenu(resultat.brouillon.contenu);
      setStatut(resultat.brouillon.statut);
      setLecture(resultat.brouillon.lecture);
      setConflit(null);
    } catch {
      setErreur("Impossible de générer le brouillon pour l'instant. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  // Chaque correction est persistée : le brouillon doit survivre au
  // rechargement de la page.
  async function persister(nouveau: PropositionExtraction) {
    setContenu(nouveau);
    try {
      const r = await enregistrerBrouillonAction(chantierId, nouveau);
      if (!r.succes) setErreur(r.erreur);
    } catch {
      setErreur("Vos corrections n'ont pas pu être enregistrées. Vérifiez votre connexion.");
    }
  }

  async function confirmer() {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await confirmerBrouillonAction(chantierId);
      if (!r.succes) {
        setErreur(r.erreur);
        return;
      }
      setStatut("confirme");
      onApplique(
        r.prestationsCreees.map((p) => ({ id: p.id, libelle: p.libelle })),
        r.materielCree.map((m) => ({ id: m.id, libelle: m.libelle }))
      );
    } catch {
      setErreur("La confirmation n'a pas pu aboutir. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  function majLigne(liste: "prestations" | "materiel", index: number, champ: keyof LigneExtraite, valeur: string) {
    if (!contenu) return;
    const lignes = contenu[liste].map((l, i) => (i === index ? { ...l, [champ]: valeur || null } : l));
    setContenu({ ...contenu, [liste]: lignes });
  }

  function retirerLigne(liste: "prestations" | "materiel", index: number) {
    if (!contenu) return;
    persister({ ...contenu, [liste]: contenu[liste].filter((_, i) => i !== index) });
  }

  function majChamp(champ: "dureePrevue" | "tailleEquipe" | "gestionDechets" | "contraintesAcces" | "remarques", valeur: string) {
    if (!contenu) return;
    setContenu({ ...contenu, [champ]: valeur || null });
  }

  if (!transcriptionDisponible && !contenu) {
    // Renvoyer vers la note vocale quand elle a DÉJÀ été enregistrée et
    // transcrite envoie le patron refaire ce qu'il vient de faire — et lui
    // laisse croire qu'il s'y est mal pris. C'est la transcription qui manque,
    // pas la dictée.
    if (dicteeNonTranscrite) {
      return (
        <Carte>
          <span className={libelleCaps} style={{ color: colors.muted }}>
            Brouillon
          </span>
          <p className={texteSituation} style={{ color: colors.muted }}>
            Votre dictée est bien enregistrée, mais elle n&apos;a pas été transcrite :
            aucun prestataire de transcription n&apos;est encore raccordé. Rien n&apos;a donc
            pu en être extrait — et rien ne sera inventé.
          </p>
          <a
            href={`/chantiers/${chantierId}/transcription`}
            className={`self-start ${libelleCaps}`}
            style={{ color: colors.rust }}
          >
            Écrire ce que vous avez dit
          </a>
        </Carte>
      );
    }
    return (
      <Carte>
        <span className={libelleCaps} style={{ color: colors.muted }}>
          Brouillon
        </span>
        <p className={texteSituation} style={{ color: colors.muted }}>
          Enregistrez une note vocale et lancez sa transcription pour obtenir un brouillon d&apos;informations.
        </p>
        <a
          href={`/chantiers/${chantierId}/note-vocale`}
          className={`self-start ${libelleCaps}`}
          style={{ color: colors.rust }}
        >
          Aller à la note vocale
        </a>
      </Carte>
    );
  }

  return (
    <Carte>
      <div className="flex items-baseline justify-between gap-3">
        <span className={libelleCaps} style={{ color: colors.muted }}>
          Brouillon issu de la dictée
        </span>
        {/* « Confirmé » en gris, et non en accent : rien n'est attendu du patron
            sur un brouillon déjà appliqué, et la couleur ne se pose que sur ce
            qui réclame un geste de lui. */}
        {statut === "confirme" && (
          <span className={libelleCaps} style={{ color: colors.muted }}>
            Confirmé
          </span>
        )}
      </div>

      {!contenu && (
        <>
          <p className={texteSituation} style={{ color: colors.muted }}>
            La transcription est disponible. Générez un brouillon structuré, puis corrigez-le avant de le confirmer.
          </p>
          <button
            type="button"
            onClick={() => generer()}
            disabled={enCours}
            className={`self-start disabled:opacity-40 ${libelleCaps}`}
            style={{ color: colors.rust }}
          >
            {enCours ? "Analyse en cours…" : "Générer le brouillon"}
          </button>
          {/* Le chemin court, à côté du chemin détaillé : le patron pressé ne
              doit pas avoir à traverser quatre écrans pour obtenir son devis. */}
          <DevisDepuisDictee chantierId={chantierId} transcriptionDisponible variante="secondaire" />
        </>
      )}

      {/* Recopie, et non analyse : le patron doit savoir ce qu'il relit. */}
      {contenu && lecture === "litterale" && <Avertissement>{MENTION_LITTERALE}</Avertissement>}

      {/* Brouillon issu d'une transcription qui n'est plus celle du chantier :
          signalé, jamais supprimé — il peut porter des corrections humaines. */}
      {contenu && brouillonInitial?.fraicheur.obsolete && (
        <Avertissement>{brouillonInitial.fraicheur.message}</Avertissement>
      )}

      {contenu && (
        <div className="flex flex-col gap-4">
          {/* ── UNE FOIS CONFIRMÉ, CE QUI A UNE VRAIE CASE EN DESSOUS DISPARAÎT ──
              **Sa capture du 25 août 2026 :** *« je peux rien modifier, les
              cases ne sont pas cliquables »*. Elles étaient en lecture seule —
              et sur iPhone, un champ en lecture seule n'ouvre même pas le
              clavier : rien ne se passe, il croit à une panne.

              Ce n'était pas un bête verrou à retirer. Confirmer RECOPIE les
              prestations, le matériel, la durée et l'équipe dans le chantier :
              corriger la ligne du brouillon ne toucherait plus la vraie, et il
              aurait sous les yeux deux versions dont une seule compte. On les
              retire donc de l'écran une fois confirmés — les vraies sont juste
              en dessous, et elles, elles s'écrivent.

              **Les trois notes, elles, restent ET s'écrivent** : déchets,
              contraintes d'accès, remarques n'ont AUCUNE autre case dans toute
              l'application. Les figer, c'était perdre l'information pour de
              bon. C'est ce que la lecture seule faisait. */}
          {statut !== "confirme" && (
            <>
              <ListeLignes
                titre="Prestations"
                lignes={contenu.prestations}
                lectureSeule={false}
                onChange={(i, champ, v) => majLigne("prestations", i, champ, v)}
                onCommit={() => persister(contenu)}
                onRetirer={(i) => retirerLigne("prestations", i)}
              />

              <div className="grid grid-cols-2 gap-3">
                <ChampBrouillon
                  label="Durée"
                  value={contenu.dureePrevue ?? ""}
                  lectureSeule={false}
                  onChange={(v) => majChamp("dureePrevue", v)}
                  onCommit={() => persister(contenu)}
                />
                <ChampBrouillon
                  label="Équipe"
                  value={contenu.tailleEquipe ?? ""}
                  lectureSeule={false}
                  onChange={(v) => majChamp("tailleEquipe", v)}
                  onCommit={() => persister(contenu)}
                />
              </div>

              <ListeLignes
                titre="Matériel"
                lignes={contenu.materiel}
                lectureSeule={false}
                onChange={(i, champ, v) => majLigne("materiel", i, champ, v)}
                onCommit={() => persister(contenu)}
                onRetirer={(i) => retirerLigne("materiel", i)}
              />
            </>
          )}

          <ChampBrouillon
            label="Déchets / branchages"
            value={contenu.gestionDechets ?? ""}
            lectureSeule={false}
            onChange={(v) => majChamp("gestionDechets", v)}
            onCommit={() => persister(contenu)}
          />
          <ChampBrouillon
            label="Contraintes d'accès"
            value={contenu.contraintesAcces ?? ""}
            lectureSeule={false}
            onChange={(v) => majChamp("contraintesAcces", v)}
            onCommit={() => persister(contenu)}
          />
          <ChampBrouillon
            label="Remarques"
            value={contenu.remarques ?? ""}
            lectureSeule={false}
            onChange={(v) => majChamp("remarques", v)}
            onCommit={() => persister(contenu)}
          />

          {/* « À confirmer » est la seule chose de cet encart qui réclame un
              geste du patron : c'est donc la seule à porter l'or. */}
          <Reserves titre="À confirmer" teinte={colors.or} items={contenu.ambiguites} />
          <Reserves
            titre="Non mentionné dans la dictée"
            teinte={colors.muted}
            items={contenu.informationsManquantes}
          />

          {statut !== "confirme" && (
            <div className="flex flex-col gap-2.5">
              {/* L'action teintée des écrans refaits (voir le pied de Photos) :
                  elle se voit comme un geste sans disputer la place au bouton
                  principal du bas de page, qui, lui, valide tout l'écran. */}
              <button
                type="button"
                onClick={confirmer}
                disabled={enCours}
                className={`rounded-full py-3.5 disabled:opacity-40 ${libelleCaps}`}
                style={{ backgroundColor: colors.rustTint, color: colors.rust, minHeight: 48 }}
              >
                {enCours ? "Application…" : "Confirmer et ajouter au chantier"}
              </button>
              <button
                type="button"
                onClick={() => generer()}
                disabled={enCours}
                // Aligné à gauche comme toutes les actions en toutes lettres de
                // ces deux écrans : seule une PLAGE occupe la largeur entière.
                className={`self-start disabled:opacity-40 ${libelleCaps}`}
                style={{ color: colors.muted }}
              >
                Régénérer depuis la dictée
              </button>
            </div>
          )}
        </div>
      )}

      {erreur && (
        <p className={texteSituation} style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {conflit && (
        <div className="fixed inset-0 z-[50] flex items-end" style={{ backgroundColor: "rgba(20,18,14,0.35)" }}>
          <div className="w-full rounded-t-[26px] px-[26px] pb-9 pt-3" style={{ backgroundColor: colors.cream }}>
            <div className="mx-auto mb-6 h-1 w-10 rounded-full" style={{ backgroundColor: colors.line }} />
            <p
              className="mb-2 text-center text-[19px] leading-[1.15]"
              style={{ color: colors.ink, fontFamily: font.display }}
            >
              Remplacer vos corrections ?
            </p>
            <p className={`mb-6 text-center ${texteSituation}`} style={{ color: colors.muted }}>
              Vous avez modifié ce brouillon à la main. Une nouvelle analyse de la dictée est prête : l&apos;appliquer
              effacera vos corrections.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setConflit(null)}
                className={`py-3.5 ${libelleCaps}`}
                style={{ backgroundColor: colors.card, color: colors.ink, borderRadius: 5, minHeight: 48 }}
              >
                Conserver mes corrections
              </button>
              <button
                onClick={() => {
                  setConflit(null);
                  generer(true);
                }}
                className={`py-3.5 ${libelleCaps}`}
                style={{ color: colors.alert }}
              >
                Remplacer par la nouvelle analyse
              </button>
            </div>
          </div>
        </div>
      )}
    </Carte>
  );
}

// Un avertissement qui ne s'entoure pas d'un fond teinté : un cheveu d'or à
// gauche, comme l'« ourlet » de la maquette, où le trait prend la couleur
// d'attente uniquement là où quelque chose est dû. Ici, la relecture est due.
/**
 * Une liste de réserves, plafonnée — et ce qui est coupé se dit.
 *
 * **Sa demande du 25 août 2026 :** *« le à confirmer est trop long, synthétise-le.
 * Moins de mots ! »* Quatorze lignes de gris le séparaient de ses prestations.
 *
 * **Le reste s'affiche en compte, jamais en silence.** Une liste tronquée sans
 * un mot se lit comme une liste complète : il chiffrerait sans la réserve qu'on
 * lui a cachée (`CLAUDE.md` §4 ter).
 */
function Reserves({ titre, teinte, items }: { titre: string; teinte: string; items: string[] }) {
  const { montrees, reste } = reservesLisibles(items);
  if (montrees.length === 0) return null;
  const suite = phraseDuReste(reste);
  return (
    <div className="flex flex-col gap-1.5">
      <span className={libelleCaps} style={{ color: teinte }}>
        {titre}
      </span>
      {montrees.map((t, i) => (
        <p key={i} className={texteSituation} style={{ color: colors.muted }}>
          {t}
        </p>
      ))}
      {suite && (
        <p className={texteSituation} style={{ color: colors.muted }}>
          {suite}
        </p>
      )}
    </div>
  );
}

function Avertissement({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={`py-1 pl-[15px] ${texteSituation}`}
      style={{ color: colors.ink, borderLeft: `1px solid ${colors.or}` }}
    >
      {children}
    </p>
  );
}

// `gap-3` et non `gap-2` : les listes de l'écran principal sont repérées par
// `div.flex.flex-col.gap-2`, y compris par les tests de bout en bout. Un
// conteneur du brouillon portant la même signature rendrait ce repère ambigu —
// et ferait passer une proposition pour une donnée validée.
function Carte({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-3 px-[15px] py-4"
      style={{ backgroundColor: colors.card, borderRadius: 4 }}
    >
      {children}
    </div>
  );
}

function ChampBrouillon({
  label,
  value,
  lectureSeule,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  lectureSeule: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className={libelleCaps} style={{ color: colors.muted }}>
        {label}
      </span>
      <input
        value={value}
        readOnly={lectureSeule}
        placeholder="Non mentionné"
        // Étiquette explicite : l'écran porte aussi des champs « Durée » et
        // « Équipe » pour les données déjà validées — les deux ne doivent jamais
        // être confondus, ni par un lecteur d'écran, ni par un test.
        aria-label={`${label} (brouillon)`}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        className="border-0 px-[15px] py-3 outline-none"
        style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px", borderRadius: 4 }}
      />
    </label>
  );
}

function ListeLignes({
  titre,
  lignes,
  lectureSeule,
  onChange,
  onCommit,
  onRetirer,
}: {
  titre: string;
  lignes: LigneExtraite[];
  lectureSeule: boolean;
  onChange: (index: number, champ: keyof LigneExtraite, valeur: string) => void;
  onCommit: () => void;
  onRetirer: (index: number) => void;
}) {
  return (
    // gap-3 : même raison que dans Carte — ne jamais imiter la signature des
    // listes de données validées.
    <div className="flex flex-col gap-3">
      <span className={libelleCaps} style={{ color: colors.muted }}>
        {titre}
      </span>
      {lignes.length === 0 && (
        <p className={texteSituation} style={{ color: colors.muted }}>
          Rien de détecté dans la dictée.
        </p>
      )}
      {lignes.map((ligne, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 p-3"
          style={{ backgroundColor: colors.cream, borderRadius: 4 }}
        >
          <div className="flex items-center gap-2">
            <input
              value={ligne.libelle}
              readOnly={lectureSeule}
              aria-label={`${titre} ${i + 1}`}
              onChange={(e) => onChange(i, "libelle", e.target.value)}
              onBlur={onCommit}
              className="min-w-0 flex-1 border-0 px-3 py-2 outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px", borderRadius: 4 }}
            />
            {!lectureSeule && (
              // La même croix que dans `AnimatedRow`, et pour deux raisons.
              // « RETIRER » en capitales espacées prend quatre-vingt-dix pixels
              // sur les trois cent onze de la ligne — le libellé s'y trouvait
              // coupé en plein milieu, vu en capture. Et le geste de retrait
              // s'écrit de la même façon partout dans l'application.
              <button
                type="button"
                onClick={() => onRetirer(i)}
                aria-label={`Retirer ${ligne.libelle}`}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ color: colors.muted }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ligne.quantite ?? ""}
              readOnly={lectureSeule}
              placeholder="Quantité"
              aria-label={`Quantité ${titre} ${i + 1}`}
              onChange={(e) => onChange(i, "quantite", e.target.value)}
              onBlur={onCommit}
              className="min-w-0 border-0 px-3 py-2 outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px", borderRadius: 4 }}
            />
            <input
              value={ligne.unite ?? ""}
              readOnly={lectureSeule}
              placeholder="Unité"
              aria-label={`Unité ${titre} ${i + 1}`}
              onChange={(e) => onChange(i, "unite", e.target.value)}
              onBlur={onCommit}
              className="min-w-0 border-0 px-3 py-2 outline-none"
              style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px", borderRadius: 4 }}
            />
          </div>
          <input
            value={ligne.description ?? ""}
            readOnly={lectureSeule}
            placeholder="Description (facultative)"
            aria-label={`Description ${titre} ${i + 1}`}
            onChange={(e) => onChange(i, "description", e.target.value)}
            onBlur={onCommit}
            className="border-0 px-3 py-2 outline-none"
            style={{ backgroundColor: colors.card, color: colors.ink, fontSize: "16px", borderRadius: 4 }}
          />
          {ligne.aConfirmer && (
            <span className={libelleCaps} style={{ color: colors.or }}>
              À confirmer
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

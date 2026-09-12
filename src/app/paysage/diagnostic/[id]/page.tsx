import Link from "next/link";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireDiagnostic } from "@/server/repositories/diagnostics";
import { compterFichesServables, lireImagesFiche, lireNomTaxon } from "@/server/repositories/fiches-phyto";
import { listerChantiers } from "@/server/repositories/chantiers";
import {
  decrireObservation,
  GESTE_APRES_REFUS,
  LIBELLE_CONFIANCE,
  MOTIFS_REFUS,
  phraseFichesConnues,
  REFUS_PAR_LA_BIBLIOTHEQUE,
  type LigneVue,
  type Mention,
  type MotifRefus,
  type Observation,
  type ResultatFige,
} from "@/lib/diagnostic-vegetal";
import { dateCitee } from "@/lib/mois";
import PrendreUnePhoto from "../PrendreUnePhoto";
import RattacherAUnChantier from "./RattacherAUnChantier";
import Reessayer from "./Reessayer";

/**
 * L'écran de résultat — **quatre issues, et pas une de plus**.
 *
 *   `rendu`               le problème, la sûreté et l'essence, la gravité, la conduite
 *   `complement_demande`  UNE photo de plus, et l'écran dit laquelle — et pourquoi
 *   `inconclusif`         « je ne peux pas confirmer » — vu · pourquoi · le geste
 *   `echoue`              personne n'a regardé — réessayer, ou les réglages
 *
 * **Le refus est l'écran principal, pas un cas d'erreur.** Trois fiches réelles
 * en base sur la cinquantaine visée : c'est celui-là qu'il verra le plus
 * souvent. Il dit ce qui a été vu, pourquoi ça ne suffit pas, et le geste qui
 * débloque — un geste PROPRE à chaque refus. Jusqu'au 12 septembre 2026, une
 * seule phrase suivait les sept refus (« une photo plus proche peut suffire »),
 * y compris sous celle qui dit qu'aucune photo ne départagera : l'écran ne
 * savait pas quel refus il affichait, parce que la base rangeait la phrase et
 * non la clé (migration 0087).
 *
 * **Et `inconclusif` n'est PAS `echoue`.** Le premier dit « la base ne sait
 * pas », le second « personne n'a regardé ». Les confondre enverrait chercher
 * un défaut dans les fiches alors qu'il est dans la configuration.
 *
 * **Tout ce qui s'affiche sort d'une fiche, d'un taxon de la base, ou d'une
 * liste fermée de `diagnostic-vegetal.ts`.** Ce que le modèle a écrit en texte
 * libre — le nom qu'il donne à l'essence, ses réserves — ne monte jamais ici.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Diagnostic — Atlas" };

export default async function ResultatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const diagnostic = await lireDiagnostic(ctx, id);
  if (!diagnostic) notFound();

  const resultat = diagnostic.resultat as ResultatFige | null;
  const observation = diagnostic.observation as Observation | null;
  const essenceNom = diagnostic.taxonId ? await lireNomTaxon(diagnostic.taxonId) : null;
  const essence = observation?.essence
    ? { nom: essenceNom, certitude: observation.essence.certitude }
    : null;

  return (
    <div
      style={{
        backgroundColor: colors.cream,
        color: colors.ink,
        fontFamily: font.body,
        minHeight: "100%",
      }}
    >
      <div className="pb-16" data-atlas="ecran-diagnostic-resultat">
        <EnTeteEcran
          surtitre="Diagnostic végétal"
          titre={titrePour(diagnostic.statut, resultat)}
          retour={{ href: "/paysage/diagnostic", libelle: "Retour au diagnostic" }}
        />

        <section className="mx-[26px] mt-[24px]">
          {diagnostic.statut === "rendu" && resultat ? (
            <Rendu resultat={resultat} ficheId={diagnostic.ficheId} essenceNom={essenceNom} />
          ) : diagnostic.statut === "complement_demande" ? (
            <Complement
              consigne={diagnostic.complementConsigne}
              diagnosticId={id}
              vu={observation ? decrireObservation(observation, essence) : []}
            />
          ) : diagnostic.statut === "inconclusif" ? (
            <SansConclusion
              refus={diagnostic.refus}
              phraseAncienne={diagnostic.panne}
              vu={observation ? decrireObservation(observation, essence) : []}
              fichesConnues={await compterFichesServables()}
            />
          ) : diagnostic.statut === "echoue" ? (
            <PersonneNaRegarde panne={diagnostic.panne} diagnosticId={id} />
          ) : (
            <EnAnalyse />
          )}

          {(diagnostic.statut === "rendu" || diagnostic.statut === "inconclusif") && (
            <div className="mt-[30px]">
              <Bouton href="/paysage/diagnostic">{diagnostic.statut === "rendu" ? "Nouvelle photo" : "Recommencer"}</Bouton>
            </div>
          )}

          {diagnostic.statut === "rendu" && resultat && (
            <Details resultat={resultat} diagnosticId={id} chantierId={diagnostic.chantierId} ctx={ctx} />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Le titre suit l'issue — **et les deux refus ne portent pas le même**.
 *
 * « Sans conclusion » sur une panne de fournisseur laisserait croire que la
 * photo n'a rien donné, alors que personne ne l'a regardée : il chercherait une
 * meilleure photo au lieu de sa configuration (`AGENTS.md` — une erreur qui
 * accuse à tort coûte plus cher que pas d'erreur du tout).
 */
function titrePour(statut: string, resultat: ResultatFige | null): string {
  if (statut === "rendu" && resultat) return resultat.nom;
  if (statut === "echoue") return "La photo n’a pas été regardée";
  if (statut === "complement_demande") return "Une photo de plus";
  if (statut === "inconclusif") return "Sans conclusion";
  return "Analyse en cours";
}

// ── L'issue principale : le résultat ────────────────────────────────────────

async function Rendu({
  resultat,
  ficheId,
  essenceNom,
}: {
  resultat: ResultatFige;
  ficheId: string | null;
  essenceNom: string | null;
}) {
  // **Les images sont lues EN DIRECT, pas figées dans le résultat.** Le
  // diagnostic est figé — le nom, la gravité, la conduite, c'est-à-dire ce sur
  // quoi il a agi. La photo de référence, elle, est une aide à l'œil : la geler
  // par identifiant la casserait au premier réimport de la fiche (les images
  // sont remplacées, donc renumérotées), et une image morte est pire qu'une
  // image un peu différente.
  const images = ficheId ? await lireImagesFiche(ficheId) : [];
  const source = resultat.details.sources[0] ?? null;

  return (
    <div data-atlas="diagnostic-rendu">
      {/* **La sûreté et l'essence, ensemble, en clair — sa planche du
          11 septembre 2026.** « Probable · Platane » à la place de « CONFIANCE
          PROBABLE » en capitales dorées : le premier mot dit ce qu'Atlas pense,
          le second sur quoi — l'essence est la règle la plus structurante du
          moteur, et elle n'apparaissait nulle part. Jamais un pourcentage :
          aucun modèle employé ici ne fournit de probabilité calibrée. */}
      <p className="text-[17px] leading-[1.4]" style={{ color: colors.ink }} data-atlas="diagnostic-confiance">
        {LIBELLE_CONFIANCE[resultat.confiance]}
        {essenceNom && (
          <>
            <span style={{ color: colors.muted }}> · </span>
            {essenceNom}
          </>
        )}
      </p>

      <p className="mt-[12px] text-[15px] leading-[1.6]" style={{ color: colors.inkSoft }}>
        {resultat.explication}
      </p>

      {/* **La photo de référence est sur l'écran PRINCIPAL, et c'est sa
          demande du 20 août 2026 :** « il faut absolument mettre des photos,
          l'utilisateur a besoin de comparer avec une vraie photo qui comporte
          la maladie ». Comparer suppose de voir les deux ensemble — la reléguer
          derrière « Voir les détails » aurait vidé le geste de son sens. */}
      {images.length > 0 && <PhotosDeReference images={images} />}

      {/* **Ce que la source exige pour CONFIRMER, en pleine page.**
          Sa règle du 20 août 2026 : « si la source scientifique exige une
          analyse en laboratoire pour confirmer, Atlas ne doit jamais afficher
          "confirmé" ». Le ranger dans « Voir les détails » aurait laissé croire
          qu'il n'y en avait pas — et c'est justement l'information qui empêche
          de traiter un arbre sur la foi d'une photo. */}
      {resultat.methodeConfirmation && (
        <div
          className="mt-[20px] rounded-[4px] px-[14px] py-[12px]"
          style={{ background: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          data-atlas="diagnostic-confirmation"
        >
          <p className={libelleCaps} style={{ color: colors.muted }}>
            Ce qui reste à confirmer
          </p>
          <p className="mt-[6px] text-[14px] leading-[1.6]" style={{ color: colors.ink }}>
            {resultat.methodeConfirmation}
          </p>
          {resultat.informationsRequises.length > 0 && (
            <ul className="mt-[8px] list-disc pl-[18px] text-[13px] leading-[1.6]" style={{ color: colors.inkSoft }}>
              {resultat.informationsRequises.map((info, i) => (
                <li key={i}>{info}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Bloc cle="Gravité" repere="diagnostic-gravite">
        {resultat.graviteLibelle}
      </Bloc>

      <Bloc cle="Que faire ?" repere="diagnostic-conduite" fort>
        {resultat.conduite}
      </Bloc>

      {/* **La source et sa date, sur l'écran principal.** Un conseil
          phytosanitaire sans sa source ne vaut rien devant un client — et c'est
          ce qui distingue Atlas d'un moteur de recherche. Une page d'organisme
          bouge sans changer d'adresse : la date dit ce qui avait été lu. */}
      {source && (
        <p className="mt-[18px] text-[12.5px] leading-[1.55]" style={{ color: colors.muted }} data-atlas="diagnostic-source">
          <span style={{ color: colors.inkSoft }}>{source.organisme}</span>
          {" · consultée le "}
          {dateCitee(source.consulteeLe)}
        </p>
      )}

      {/* Les mentions de sécurité viennent du CODE, jamais de la fiche : une
          règle générale ne doit pas pouvoir manquer parce qu'une fiche est mal
          remplie — c'est la fiche bâclée qui en a le plus besoin. */}
      {resultat.mentions.map((mention, i) => (
        <MentionAffichee key={i} mention={mention} />
      ))}
    </div>
  );
}

/**
 * À quoi ça ressemble vraiment.
 *
 * **Le crédit et la licence sont AFFICHÉS, pas rangés dans un coin.** La plupart
 * des licences libres l'exigent — une photo sous CC-BY sans son auteur visible
 * est une photo employée hors licence —, et c'est de toute façon la moindre des
 * choses envers celui qui l'a prise. C'est aussi ce qui permet de vérifier d'un
 * coup d'œil qu'aucune image n'est arrivée là sans qu'on sache d'où.
 */
function PhotosDeReference({
  images,
}: {
  images: { id: string; legende: string | null; credit: string; licence: string; partie: string | null }[];
}) {
  return (
    <div className="mt-[20px]" data-atlas="diagnostic-photos-reference">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        À quoi ça ressemble
      </p>
      {/* **Sa règle du 20 août 2026 :** « les photos de référence sont
          uniquement des indices, jamais une preuve suffisante ». Une image
          posée sans un mot se lit comme une confirmation — surtout quand elle
          ressemble à celle qu'on vient de prendre. La phrase est ici, sous le
          titre, avant qu'on ait comparé. */}
      <p className="mt-[6px] text-[12px] leading-[1.5]" style={{ color: colors.muted }}>
        Une ressemblance n’est pas une preuve : ces photos servent à comparer, pas à confirmer.
      </p>
      <div className="mt-[10px] flex flex-col gap-[14px]">
        {images.map((image) => (
          <figure key={image.id} className="m-0">
            {/* `img` et non `next/image` : ces photos sortent d'une route
                authentifiée, et l'optimiseur de Next ne sait pas s'y
                authentifier. Le poids est borné à l'import (500 Ko), ce qui est
                la vraie raison pour laquelle on peut s'en passer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/phyto/image/${image.id}`}
              alt={image.legende ?? "Photo de référence"}
              loading="lazy"
              className="block w-full rounded-[4px]"
              style={{ border: `1px solid ${colors.line}` }}
            />
            <figcaption className="mt-[6px] text-[11.5px] leading-[1.5]" style={{ color: colors.muted }}>
              {image.legende && <span style={{ color: colors.inkSoft }}>{image.legende} — </span>}
              {image.credit} · {image.licence}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function MentionAffichee({ mention }: { mention: Mention }) {
  return (
    <div
      className="mt-[16px] rounded-[4px] px-4 py-3"
      style={{ backgroundColor: colors.card, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
      data-atlas={`diagnostic-mention-${mention.type}`}
    >
      <p className="text-[13px] leading-[1.55]" style={{ color: colors.ink }}>
        {mention.texte}
      </p>
      {"note" in mention && mention.note && (
        <p className="mt-[6px] text-[12px] leading-[1.5]" style={{ color: colors.muted }}>
          {mention.note}
        </p>
      )}
      {"reference" in mention && mention.reference && (
        <p className="mt-[6px] text-[12px] leading-[1.5]" style={{ color: colors.muted }}>
          {mention.reference}
        </p>
      )}
    </div>
  );
}

// ── Ce qui a été vu — commun aux refus et à la relance ──────────────────────

/**
 * « Vu sur la photo » : les mots du vocabulaire fermé, et l'essence de la BASE.
 *
 * C'est ce qui rend un refus lisible — il sait si Atlas a regardé la bonne
 * chose — et c'est ce qui le distingue d'une panne. Rien ici ne vient d'une
 * phrase de modèle (`decrireObservation`).
 */
function Vu({ lignes }: { lignes: LigneVue[] }) {
  if (lignes.length === 0) return null;
  return (
    <div data-atlas="diagnostic-vu">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        Vu sur la photo
      </p>
      <ul className="mt-[8px] list-none p-0">
        {lignes.map((ligne, i) => (
          <li
            key={i}
            className="py-[9px] text-[15px] leading-[1.5]"
            style={{ borderTop: `1px solid ${colors.line}`, color: colors.ink }}
          >
            {ligne.titre}
            {ligne.detail && (
              <span className="mt-[2px] block text-[12.5px]" style={{ color: colors.muted }}>
                {ligne.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── L'issue « une photo de plus » ───────────────────────────────────────────

/**
 * **La consigne est RECOPIÉE de la base**, jamais composée ici ni par un
 * modèle : elle vient de la ligne de `confusions_phyto` qui relie les deux
 * fiches au coude à coude, ou de la constante qui demande l'essence. Une
 * consigne inventée enverrait photographier ce qui ne tranche rien.
 */
function Complement({ consigne, diagnosticId, vu }: { consigne: string | null; diagnosticId: string; vu: LigneVue[] }) {
  return (
    <div data-atlas="diagnostic-complement">
      <Vu lignes={vu} />
      <p className="mt-[22px] text-[17px] leading-[1.5]" style={{ color: colors.ink }}>
        {consigne}
      </p>
      <div className="mt-[24px]">
        <PrendreUnePhoto diagnosticId={diagnosticId} libelle="Prendre cette photo" />
      </div>
      <div className="mt-[18px]">
        <Bouton href="/paysage/diagnostic" creux>
          Recommencer
        </Bouton>
      </div>
      {/* L'invariant « une seule relance » (§135.5), dit là où il s'applique. */}
      <p className="mt-[12px] text-center text-[12.5px]" style={{ color: colors.muted }}>
        Une seule photo de plus, jamais deux.
      </p>
    </div>
  );
}

// ── L'issue « je ne peux pas confirmer » ────────────────────────────────────

/**
 * Vu · pourquoi ça ne suffit pas · le geste — **propres à chaque refus**.
 *
 * `refus` est la clé (migration 0087) : la phrase et le geste sont lus dans les
 * listes fermées de `diagnostic-vegetal.ts`. Quand le refus tient à la
 * bibliothèque, le compte des fiches situe le manque — dans la base, pas dans
 * sa photo. `phraseAncienne` porte la phrase d'une ligne d'avant la migration
 * dont aucune clé n'a été reconnue : elle se montre telle quelle, sans geste.
 */
function SansConclusion({
  refus,
  phraseAncienne,
  vu,
  fichesConnues,
}: {
  refus: MotifRefus | null;
  phraseAncienne: string | null;
  vu: LigneVue[];
  fichesConnues: number;
}) {
  const geste = refus ? GESTE_APRES_REFUS[refus] : null;
  return (
    <div data-atlas="diagnostic-sans-conclusion">
      <Vu lignes={vu} />
      <div className={vu.length > 0 ? "mt-[6px] pt-[14px]" : ""} style={vu.length > 0 ? { borderTop: `1px solid ${colors.line}` } : undefined}>
        <p className={libelleCaps} style={{ color: colors.muted }}>
          Pourquoi ça ne suffit pas
        </p>
        <p className="mt-[6px] text-[15px] leading-[1.55]" style={{ color: colors.ink }} data-atlas="diagnostic-refus">
          {refus ? MOTIFS_REFUS[refus] : phraseAncienne}
        </p>
        {refus && REFUS_PAR_LA_BIBLIOTHEQUE.includes(refus) && (
          <p className="mt-[12px] text-[14px] leading-[1.55]" style={{ color: colors.inkSoft }} data-atlas="diagnostic-fiches-connues">
            {phraseFichesConnues(fichesConnues)}
          </p>
        )}
      </div>
      {geste && (
        <p className="mt-[22px] text-[17px] leading-[1.5]" style={{ color: colors.ink }} data-atlas="diagnostic-geste">
          {geste}
        </p>
      )}
    </div>
  );
}

// ── L'issue « personne n'a regardé » ────────────────────────────────────────

/**
 * Ce n'est pas un verdict sur la plante : c'est la configuration, ou le
 * fournisseur. La photo est gardée — on réessaie avec elle, ou l'on va voir
 * Réglages. Le mot du fournisseur reste, en petit, pour qui dépanne.
 */
function PersonneNaRegarde({ panne, diagnosticId }: { panne: string | null; diagnosticId: string }) {
  return (
    <div data-atlas="diagnostic-echoue">
      <p className="text-[17px] leading-[1.5]" style={{ color: colors.ink }}>
        Votre photo est gardée. Ce n’est pas elle qui est en cause.
      </p>
      <div className="mt-[30px]">
        <Reessayer diagnosticId={diagnosticId} />
      </div>
      {panne && (
        <div className="mt-[30px] border-t pt-[14px]" style={{ borderColor: colors.line }}>
          <p className={libelleCaps} style={{ color: colors.muted }}>
            Détail
          </p>
          <p className="mt-[6px] text-[12.5px] leading-[1.55]" style={{ color: colors.muted }} data-atlas="diagnostic-panne">
            {panne}
          </p>
        </div>
      )}
    </div>
  );
}

/** Une ligne encore ouverte : l'analyse est en cours, rien n'est à lire. */
function EnAnalyse() {
  return (
    <p className="text-[15px] leading-[1.6]" style={{ color: colors.inkSoft }} data-atlas="diagnostic-en-analyse">
      La photo est en cours d’analyse.
    </p>
  );
}

// ── Les détails, repliés ────────────────────────────────────────────────────

async function Details({
  resultat,
  diagnosticId,
  chantierId,
  ctx,
}: {
  resultat: ResultatFige;
  diagnosticId: string;
  chantierId: string | null;
  ctx: { utilisateurId: string; entrepriseId: string };
}) {
  const chantiers = await listerChantiers(ctx);

  return (
    <details className="mt-[26px]" data-atlas="diagnostic-details">
      <summary className="cursor-pointer text-[13px]" style={{ color: colors.rust }}>
        Voir les détails
      </summary>

      <div className="mt-[16px]">
        <Ligne cle="Nom scientifique" valeur={resultat.nomScientifique} />
        <Ligne cle="Agent en cause" valeur={resultat.details.agentCausal} />
        <Ligne
          cle="Parties atteintes"
          valeur={resultat.details.partiesAtteintes.map((p) => p.replace(/_/g, " ")).join(", ") || null}
        />
        {/* Les trois listes de la migration 0057 — elle promettait de les
            afficher, et rien ne les rendait. Recopiées de la source. */}
        <Liste cle="Ce qui le distingue" valeurs={resultat.criteresDiscriminants} />
        <Liste cle="Ce qui l’écarte" valeurs={resultat.details.criteresExclusion} />
        <Liste cle="Ce qui le favorise" valeurs={resultat.details.facteursFavorisants} />
        <Ligne cle="Prévention" valeur={resultat.details.prevention} />
        <Ligne cle="Comment ça évolue" valeur={resultat.details.gestion} />
        {/* Le traitement ne s'affiche QUE ici, et toujours avec ses sources :
            recommander un produit phytosanitaire engage l'artisan. */}
        <Ligne cle="Traitement" valeur={resultat.details.traitement} />

        <div
          className="mt-[18px] border-t pt-[14px]"
          style={{ borderColor: colors.line }}
          data-atlas="diagnostic-sources"
        >
          <p className={libelleCaps} style={{ color: colors.muted }}>
            La fiche
          </p>
          {resultat.details.sources.length === 0 ? (
            <p className="mt-[8px] text-[12.5px]" style={{ color: colors.muted }}>
              Aucune source enregistrée.
            </p>
          ) : (
            <ul className="mt-[8px]">
              {resultat.details.sources.map((s, i) => (
                <li key={i} className="mb-[8px] text-[12.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
                  {s.organisme} — {s.titre}
                  <span style={{ color: colors.muted }}> · consultée le {dateCitee(s.consulteeLe)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-[6px] text-[11.5px]" style={{ color: colors.muted }}>
            Fiche version {resultat.details.versionFiche}
            {resultat.details.sourcesAJourLe ? ` · à jour au ${dateCitee(resultat.details.sourcesAJourLe)}` : ""}
          </p>
        </div>

        <div className="mt-[18px] border-t pt-[14px]" style={{ borderColor: colors.line }}>
          <RattacherAUnChantier
            diagnosticId={diagnosticId}
            chantierId={chantierId}
            chantiers={chantiers.map((c) => ({ id: c.id, nom: c.nom }))}
          />
        </div>
      </div>
    </details>
  );
}

// ── Petites pièces ──────────────────────────────────────────────────────────

function Bloc({ cle, children, repere, fort }: { cle: string; children: React.ReactNode; repere: string; fort?: boolean }) {
  return (
    <div className="mt-[20px] border-t pt-[14px]" style={{ borderColor: colors.line }}>
      <p className={libelleCaps} style={{ color: colors.muted }}>
        {cle}
      </p>
      <p className={`mt-[6px] ${fort ? "text-[17px] leading-[1.5]" : "text-[15px] leading-[1.55]"}`} style={{ color: colors.ink }} data-atlas={repere}>
        {children}
      </p>
    </div>
  );
}

/** Un champ absent ne s'affiche pas : une donnée manquante reste manquante. */
function Ligne({ cle, valeur }: { cle: string; valeur: string | null }) {
  if (!valeur) return null;
  return (
    <div className="mb-[12px]">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        {cle}
      </p>
      <p className="mt-[3px] text-[13.5px] leading-[1.55]" style={{ color: colors.ink }}>
        {valeur}
      </p>
    </div>
  );
}

/** Une liste vide ne s'affiche pas davantage. */
function Liste({ cle, valeurs }: { cle: string; valeurs: string[] }) {
  if (valeurs.length === 0) return null;
  return (
    <div className="mb-[12px]">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        {cle}
      </p>
      <ul className="mt-[3px] list-disc pl-[18px] text-[13.5px] leading-[1.55]" style={{ color: colors.ink }}>
        {valeurs.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
    </div>
  );
}

function Bouton({ href, children, creux }: { href: string; children: React.ReactNode; creux?: boolean }) {
  return (
    <div className="flex justify-center">
      <Link
        href={href}
        // **Passé au vert des boutons le 4 septembre 2026.** Il l'a relevé
        // lui-même — *« j'avais demandé à changer tous les boutons en vert
        // clair »* —, et ce bouton-ci avait échappé au balayage du 3 : il ne
        // portait pas `atlas-plein`, et le contrôle ne regardait QUE ce qui la
        // portait. Il la porte maintenant, et il est donc gardé.
        //
        // **Le creux ne prend ni l'aplat ni le geste** — *« surtout pas ceux
        // qui sont creux »*, sa consigne du 31 août.
        className={`inline-flex items-center justify-center px-9 py-[13px] text-[17px] ${creux ? "" : "atlas-plein"}`}
        style={{
          borderRadius: 9999,
          fontFamily: font.display,
          backgroundColor: creux ? "transparent" : colors.plein,
          color: creux ? colors.rust : surPlein,
          border: creux ? `1px solid ${colors.line}` : undefined,
        }}
      >
        {children}
      </Link>
    </div>
  );
}

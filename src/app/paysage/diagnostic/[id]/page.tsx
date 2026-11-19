import Link from "next/link";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import IconeTrait from "@/components/atlas/IconeTrait";
import { colors, font, libelleCaps, surPlein } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireDiagnostic } from "@/server/repositories/diagnostics";
import { compterFichesServables, lireEssence, lireImagesFiche } from "@/server/repositories/fiches-phyto";
import { listerChantiers } from "@/server/repositories/chantiers";
import {
  decrireObservation,
  GESTE_APRES_REFUS,
  legendeDePhoto,
  MOTIFS_REFUS,
  partiesEnPhrase,
  phraseFichesConnues,
  phrasesDeConfiance,
  REFUS_PAR_LA_BIBLIOTHEQUE,
  type LigneVue,
  type Mention,
  type MotifRefus,
  type NotesSource,
  type Observation,
  type ResultatFige,
} from "@/lib/diagnostic-vegetal";
import { dateCitee } from "@/lib/mois";
import PrendreUnePhoto from "../PrendreUnePhoto";
import RattacherAUnChantier from "./RattacherAUnChantier";
import Reessayer from "./Reessayer";
import { garderLaPage } from "@/server/garde-page";

/**
 * L'écran de résultat — **quatre issues, et pas une de plus**.
 *
 *   `rendu`               la fiche, dans son ordre du 22 septembre 2026 (`FicheRendue`)
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
export const metadata = { title: "Diagnostic, Cause" };

export default async function ResultatPage({ params }: { params: Promise<{ id: string }> }) {
  await garderLaPage();
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const diagnostic = await lireDiagnostic(ctx, id);
  if (!diagnostic) notFound();

  const resultat = diagnostic.resultat as ResultatFige | null;
  const observation = diagnostic.observation as Observation | null;
  const essenceDeLaBase = diagnostic.taxonId ? await lireEssence(diagnostic.taxonId) : null;
  const essence = observation?.essence
    ? { nom: essenceDeLaBase?.nom ?? null, certitude: observation.essence.certitude }
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
        {diagnostic.statut === "rendu" && resultat ? (
          // **La fiche rendue prend l'allure des pages soignées** (sa planche du
          // 19 novembre 2026, `appli/soignee/fiche-de-diagnostic.html`). Les
          // trois autres issues gardent la leur : la planche ne les montrait
          // pas, et rien n'est retouché qui n'a pas été demandé.
          <FicheRendue
            resultat={resultat}
            ficheId={diagnostic.ficheId}
            essence={essenceDeLaBase}
            diagnosticId={id}
            chantierId={diagnostic.chantierId}
            ctx={ctx}
          />
        ) : (
          <>
            <EnTeteEcran
              surtitre="Diagnostic végétal"
              titre={titrePour(diagnostic.statut)}
              retour={{ href: "/paysage/diagnostic", libelle: "Retour au diagnostic" }}
            />
            <section className="mx-[26px] mt-[24px]">
              {diagnostic.statut === "complement_demande" ? (
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

              {diagnostic.statut === "inconclusif" && (
                <div className="mt-[30px]">
                  <Bouton href="/paysage/diagnostic">Recommencer</Bouton>
                </div>
              )}
            </section>
          </>
        )}
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
function titrePour(statut: string): string {
  if (statut === "echoue") return "La photo n’a pas été regardée";
  if (statut === "complement_demande") return "Une photo de plus";
  if (statut === "inconclusif") return "Sans conclusion";
  return "Analyse en cours";
}

// ── L'issue principale : la fiche ────────────────────────────────────────────

/** La voix des intitulés soignés : 13 px, capitales, encre douce. */
const RUBRIQUE = "text-[13px] font-semibold uppercase tracking-[0.12em]";

/**
 * La fiche rendue, **dans son ordre du 22 septembre 2026** : le nom, les
 * parties atteintes, à quoi ça ressemble, est-ce grave pour l'arbre, que faire,
 * comment le reconnaître, comment ça arrive, comment ça se propage. Tout le
 * reste va dans « Voir les détails ».
 *
 * **Et sa planche du 19 novembre** : la grammaire soignée (retour cerné, titre
 * seul, ni surtitre ni pastille de l'assistant), le nom latin en italique, les
 * questions en vrais titres, « Que faire ? » encadré d'or ; rien sous la photo,
 * sa légende et la source tout en bas des détails ; l'INRAE nommé nulle part
 * ailleurs (contrôle 10 de `import-fiches-phyto.ts`).
 *
 * Un bloc dont la fiche ne dit rien ne s'affiche pas : une donnée manquante
 * reste manquante. Les fiches d'avant la migration 0187 n'ont donc ni « Est-ce
 * grave pour l'arbre ? » ni « Comment ça arrive » tant qu'elles ne les ont pas
 * reçus de leurs sources.
 */
async function FicheRendue({
  resultat,
  ficheId,
  essence,
  diagnosticId,
  chantierId,
  ctx,
}: {
  resultat: ResultatFige;
  ficheId: string | null;
  essence: { nom: string; article: "un" | "une" | "des" | null } | null;
  diagnosticId: string;
  chantierId: string | null;
  ctx: { utilisateurId: string; entrepriseId: string };
}) {
  // **Les images sont lues EN DIRECT, pas figées dans le résultat.** Le
  // diagnostic est figé : le nom, la gravité, la conduite, c'est-à-dire ce sur
  // quoi il a agi. La photo de référence, elle, est une aide à l'œil : la geler
  // par identifiant la casserait au premier réimport de la fiche (les images
  // sont remplacées, donc renumérotées), et une image morte est pire qu'une
  // image un peu différente.
  const images = ficheId ? await lireImagesFiche(ficheId) : [];
  const parties = partiesEnPhrase(resultat.details.partiesAtteintes);
  const notes = resultat.notesSource ?? null;
  const graviteTexte = resultat.graviteSelonLaSource ?? null;

  return (
    <div data-atlas="diagnostic-rendu">
      <EnTeteEcran
        allure="soignee"
        assistant={false}
        titre={resultat.nom}
        retour={{ href: "/paysage/diagnostic", libelle: "Retour au diagnostic" }}
      />
      {resultat.nomScientifique && (
        <p
          className="px-[22px] pt-2 text-[18px] italic leading-[1.3]"
          style={{ fontFamily: font.display, color: colors.inkSoft }}
          data-atlas="diagnostic-nom-scientifique"
        >
          {resultat.nomScientifique}
        </p>
      )}

      <div className="px-[22px]">
        <section className="mt-6 rounded-[6px] p-[18px]" style={{ backgroundColor: colors.card }}>
          {parties && (
            <>
              <p className={RUBRIQUE} style={{ color: colors.inkSoft }}>
                Parties atteintes
              </p>
              <p className="mt-1.5 text-[19px] leading-[1.3]" style={{ fontFamily: font.display }} data-atlas="diagnostic-parties">
                {parties}
              </p>
              <hr className="my-4 h-px border-0" style={{ backgroundColor: colors.line }} />
            </>
          )}
          {/* « Probable sur un peuplier. » : sa règle du 22 septembre, plus de
              point médian entre le mot et l'essence. Jamais un pourcentage :
              aucun modèle employé ici ne fournit de probabilité calibrée. */}
          <div className="flex items-center gap-3 text-[17px] leading-[1.35]" data-atlas="diagnostic-confiance">
            <span style={{ color: colors.or }}>
              <IconeTrait nom="diagnostic" taille={24} epaisseur={1.7} />
            </span>
            <div>
              {phrasesDeConfiance(resultat.confiance, essence).map((ligne) => (
                <p key={ligne}>{ligne}</p>
              ))}
            </div>
          </div>
        </section>

        {/* **La photo de référence est sur l'écran PRINCIPAL**, sa demande du
            20 août 2026 : « l'utilisateur a besoin de comparer avec une vraie
            photo qui comporte la maladie ». Et sa phrase du même jour, sous le
            titre, avant qu'on ait comparé : une image posée sans un mot se lit
            comme une confirmation. */}
        {images.length > 0 && (
          <section className="mt-10" data-atlas="diagnostic-photos-reference">
            <h2 className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display }}>
              À quoi ça ressemble
            </h2>
            <p className="mt-2 text-[14.5px] leading-[1.45]" style={{ color: colors.inkSoft }}>
              Une ressemblance n’est pas une preuve : ces photos servent à comparer, pas à confirmer.
            </p>
            {images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element -- pansement assumé : ces photos sortent d’une route authentifiée, que l’optimiseur de next/image ne sait pas traverser ; poids borné à l’import (500 Ko)
              <img
                key={image.id}
                src={`/api/phyto/image/${image.id}`}
                alt={image.legende ?? "Photo de référence"}
                loading="lazy"
                className="mt-3.5 block h-auto w-full rounded-[6px]"
              />
            ))}
          </section>
        )}

        {(notes || graviteTexte) && (
          <section className="mt-10" data-atlas="diagnostic-gravite">
            <h2 className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display }}>
              Est-ce grave pour l’arbre ?
            </h2>
            {notes && <Jauges notes={notes} />}
            {graviteTexte && <p className="mt-3 text-[16px] leading-[1.6]">{graviteTexte}</p>}
          </section>
        )}

        {/* « Que faire ? » encadré d'or : c'est la réponse qu'on vient chercher.
            Ce que la source exige pour CONFIRMER y vit aussi, jamais dans les
            détails : sa règle du 20 août, « si la source exige une analyse en
            laboratoire, Atlas ne doit jamais afficher "confirmé" ». */}
        <section
          className="mt-10 rounded-[6px] p-[18px]"
          style={{
            backgroundColor: colors.card,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${colors.or} 55%, transparent)`,
          }}
        >
          <h2 className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display }}>
            Que faire ?
          </h2>
          <p className="mt-3 text-[17px] leading-[1.55]" data-atlas="diagnostic-conduite">
            {resultat.conduite}
          </p>
          {resultat.methodeConfirmation && (
            <div data-atlas="diagnostic-confirmation">
              <hr className="my-4 h-px border-0" style={{ backgroundColor: colors.line }} />
              <p className={RUBRIQUE} style={{ color: colors.inkSoft }}>
                Ce qui reste à confirmer
              </p>
              <p className="mt-1.5 text-[16px] leading-[1.6]">{resultat.methodeConfirmation}</p>
              {resultat.informationsRequises.length > 0 && <Puces valeurs={resultat.informationsRequises} />}
            </div>
          )}
        </section>

        {resultat.criteresDiscriminants.length > 0 && (
          <section className="mt-10" data-atlas="diagnostic-reconnaitre">
            <h2 className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display }}>
              Comment le reconnaître
            </h2>
            <Puces valeurs={resultat.criteresDiscriminants} />
          </section>
        )}

        {resultat.commentCaArrive && (
          <section className="mt-10" data-atlas="diagnostic-comment-ca-arrive">
            <h2 className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display }}>
              Comment ça arrive
            </h2>
            <p className="mt-3 text-[16px] leading-[1.6]">{resultat.commentCaArrive}</p>
          </section>
        )}

        {resultat.details.gestion && (
          <section className="mt-10" data-atlas="diagnostic-propagation">
            <h2 className="text-[22px] leading-[1.2]" style={{ fontFamily: font.display }}>
              Comment ça se propage
            </h2>
            <p className="mt-3 text-[16px] leading-[1.6]">{resultat.details.gestion}</p>
          </section>
        )}

        {/* Les mentions de sécurité viennent du CODE, jamais de la fiche : une
            règle générale ne doit pas pouvoir manquer parce qu'une fiche est
            mal remplie. C'est la fiche bâclée qui en a le plus besoin. */}
        {resultat.mentions.map((mention, i) => (
          <MentionAffichee key={i} mention={mention} />
        ))}

        <Link
          href="/paysage/diagnostic"
          // Le bouton plein des pages soignées : 56 px, coins de 14 px, le vert
          // « D à plat » de sa décision du 3 septembre (`colors.plein`).
          className="atlas-plein mt-8 flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-[14px] px-[22px] text-[17px] font-semibold"
          style={{ backgroundColor: colors.plein, color: surPlein }}
        >
          <IconeTrait nom="photo" taille={22} epaisseur={1.7} />
          Nouvelle photo
        </Link>

        <DetailsDeLaFiche
          resultat={resultat}
          images={images}
          diagnosticId={diagnosticId}
          chantierId={chantierId}
          ctx={ctx}
        />
      </div>
    </div>
  );
}

/**
 * Les trois notes de la source, en barres seules : sa demande du 19 novembre,
 * « à côté de impact, agressivité, supprime 1 sur 3, laisse juste les trois
 * petits trucs de couleur ». Le nombre reste dit à qui ne voit pas l'écran.
 */
function Jauges({ notes }: { notes: NotesSource }) {
  const lignes: [string, number][] = [
    ["Impact", notes.impact],
    ["Agressivité", notes.agressivite],
    ["Fréquence", notes.frequence],
  ];
  return (
    <ul className="mt-4 rounded-[6px] px-[18px] py-1" style={{ backgroundColor: colors.card }} data-atlas="diagnostic-jauges">
      {lignes.map(([nom, note], i) => (
        <li
          key={nom}
          className="flex min-h-[56px] items-center gap-3.5"
          style={i > 0 ? { boxShadow: `inset 0 1px 0 ${colors.line}` } : undefined}
        >
          <span className="flex-1 text-[16px]">{nom}</span>
          <span className="flex gap-[5px]" role="img" aria-label={`${note} sur 3`}>
            {[1, 2, 3].map((rang) => (
              <i
                key={rang}
                className="block h-2 w-[22px] rounded-full"
                style={{ backgroundColor: rang <= note ? colors.or : colors.line }}
              />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Une liste à puces d'or, comme sur les pages soignées. */
function Puces({ valeurs, petite }: { valeurs: string[]; petite?: boolean }) {
  return (
    <ul className={petite ? "mt-2" : "mt-3.5"}>
      {valeurs.map((v, i) => (
        <li
          key={i}
          className={`relative pl-[22px] ${petite ? "text-[15.5px]" : "text-[16px]"} leading-[1.55] ${i > 0 ? "mt-3" : ""}`}
        >
          <span
            aria-hidden="true"
            className="absolute left-[2px] top-[0.62em] h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.or }}
          />
          {v}
        </li>
      ))}
    </ul>
  );
}

/** Une mention de sécurité : un aplat ambré, son pictogramme, la phrase du code. */
function MentionAffichee({ mention }: { mention: Mention }) {
  const precision = "note" in mention ? mention.note : mention.reference;
  return (
    <div
      className="mt-8 flex items-start gap-3.5 rounded-[6px] p-[18px]"
      style={{ backgroundColor: colors.carteAmbreFond }}
      data-atlas={`diagnostic-mention-${mention.type}`}
    >
      <span className="mt-px" style={{ color: colors.carteAmbreTexte }}>
        <IconeTrait nom="alerte" taille={24} epaisseur={1.7} />
      </span>
      <div>
        <p className="text-[15px] leading-[1.5]">{mention.texte}</p>
        {precision && (
          <p className="mt-1.5 text-[14px] leading-[1.5]" style={{ color: colors.inkSoft }}>
            {precision}
          </p>
        )}
      </div>
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

/**
 * « Voir les détails » : une ligne de 64 px qu'on touche du pouce, et son
 * chevron qui se retourne une fois ouverte.
 *
 * **Tout en bas, sous « Rattacher à un chantier », sa demande du 19 novembre
 * 2026** : la légende de la photo, son auteur et sa licence, puis la source
 * (« comme ça, c'est quand même mentionné dans la fiche, mais c'est tout à la
 * fin »). Le crédit reste ainsi sur la fiche, ce que la licence d'une photo
 * libre demande.
 */
async function DetailsDeLaFiche({
  resultat,
  images,
  diagnosticId,
  chantierId,
  ctx,
}: {
  resultat: ResultatFige;
  images: { id: string; legende: string | null; credit: string; licence: string }[];
  diagnosticId: string;
  chantierId: string | null;
  ctx: { utilisateurId: string; entrepriseId: string };
}) {
  const chantiers = await listerChantiers(ctx);
  const d = resultat.details;

  return (
    <details
      className="group mt-6"
      style={{ boxShadow: `inset 0 1px 0 ${colors.line}, inset 0 -1px 0 ${colors.line}` }}
      data-atlas="diagnostic-details"
    >
      <summary
        className="flex min-h-[64px] cursor-pointer list-none items-center justify-between text-[17px] font-semibold [&::-webkit-details-marker]:hidden"
        style={{ color: colors.rust }}
      >
        Voir les détails
        <span className="transition-transform duration-200 group-open:rotate-180" style={{ color: colors.chevron }}>
          <IconeTrait nom="deplier" taille={22} epaisseur={2} />
        </span>
      </summary>

      <div className="pb-6 pt-1">
        <Detail cle="Agent en cause" valeur={d.agentCausal} />
        <Detail cle="Quand ça se voit" valeur={d.quandCaSeVoit ?? null} />
        <Detail cle="Et les autres arbres du jardin ?" valeur={d.autresEssences ?? null} />
        <DetailListe cle="Ça pourrait aussi être" valeurs={d.criteresExclusion} />
        <DetailListe cle="Ce qui le favorise" valeurs={d.facteursFavorisants} />
        <Detail cle="Prévention" valeur={d.prevention} />
        {/* Le traitement ne s'affiche QUE ici, et toujours avec sa source :
            recommander un produit phytosanitaire engage l'artisan. */}
        <Detail cle="Traitement" valeur={d.traitement} />
        <div className="mt-[22px]">
          <p className={RUBRIQUE} style={{ color: colors.inkSoft }}>
            La fiche
          </p>
          <p className="mt-1.5 text-[15.5px] leading-[1.6]">
            {d.sources.length > 0 ? `${d.sources.map((s) => s.titre).join(". ")}. ` : ""}
            Fiche version {d.versionFiche}
            {d.sourcesAJourLe ? `, à jour au ${dateCitee(d.sourcesAJourLe)}` : ""}.
          </p>
        </div>

        <div className="mt-[22px] pt-[18px]" style={{ boxShadow: `inset 0 1px 0 ${colors.line}` }}>
          <RattacherAUnChantier
            diagnosticId={diagnosticId}
            chantierId={chantierId}
            chantiers={chantiers.map((c) => ({ id: c.id, nom: c.nom }))}
          />
        </div>

        <div
          className="mt-[22px] space-y-2.5 pt-[18px] text-[13px] leading-[1.5]"
          style={{ boxShadow: `inset 0 1px 0 ${colors.line}`, color: colors.inkSoft }}
          data-atlas="diagnostic-sources"
        >
          {images.map((image) => (
            <p key={image.id} data-atlas="diagnostic-credit-photo">
              {legendeDePhoto(image.legende, image.credit, image.licence)}
            </p>
          ))}
          {d.sources.length === 0 ? (
            <p>Aucune source enregistrée.</p>
          ) : (
            d.sources.map((s, i) => (
              <p key={i}>
                Source : {s.organisme}, page consultée le {dateCitee(s.consulteeLe)}.
              </p>
            ))
          )}
        </div>
      </div>
    </details>
  );
}

/** Un champ absent ne s'affiche pas : une donnée manquante reste manquante. */
function Detail({ cle, valeur }: { cle: string; valeur: string | null }) {
  if (!valeur) return null;
  return (
    <div className="mt-[22px] first:mt-0">
      <p className={RUBRIQUE} style={{ color: colors.inkSoft }}>
        {cle}
      </p>
      <p className="mt-1.5 text-[15.5px] leading-[1.6]">{valeur}</p>
    </div>
  );
}

/** Une liste vide ne s'affiche pas davantage. */
function DetailListe({ cle, valeurs }: { cle: string; valeurs: string[] }) {
  if (valeurs.length === 0) return null;
  return (
    <div className="mt-[22px] first:mt-0">
      <p className={RUBRIQUE} style={{ color: colors.inkSoft }}>
        {cle}
      </p>
      <Puces valeurs={valeurs} petite />
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

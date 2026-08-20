import Link from "next/link";
import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font, libelleCaps } from "@/lib/design-tokens";
import { getCurrentCtx } from "@/server/session-ctx";
import { lireDiagnostic } from "@/server/repositories/diagnostics";
import { listerChantiers } from "@/server/repositories/chantiers";
import type { Mention, ResultatFige } from "@/lib/diagnostic-vegetal";
import PrendreUnePhoto from "../PrendreUnePhoto";
import RattacherAUnChantier from "./RattacherAUnChantier";

/**
 * L'écran de résultat — **quatre états, et pas un de plus**.
 *
 *   `rendu`               le problème, la confiance, la gravité, la conduite
 *   `complement_demande`  UNE photo de plus, et l'écran dit laquelle
 *   `inconclusif`         « je ne peux pas confirmer » — une réponse, pas une panne
 *   `echoue`              personne n'a regardé (fournisseur absent ou en panne)
 *
 * **Les deux derniers s'affichent aussi proprement que le premier**, et c'est
 * le cœur de ce que le patron a demandé : *« si le diagnostic reste
 * insuffisamment fiable, Atlas doit afficher clairement qu'il ne peut pas
 * confirmer l'identification »*. Un écran qui traiterait le refus comme une
 * erreur technique lui ferait croire à un défaut de l'application là où il n'y
 * a qu'une photo qui ne suffit pas.
 *
 * **Et `inconclusif` n'est PAS `echoue`.** Le premier dit « la base ne sait
 * pas », le second « personne n'a regardé ». Les confondre enverrait chercher
 * un défaut dans les fiches alors qu'il est dans la configuration.
 *
 * **Ce que l'écran principal montre, et rien d'autre :** le nom, la confiance,
 * une phrase, la gravité, la conduite. Tout le reste — catégorie, agent causal,
 * prévention, traitement, sources — est derrière « Voir les détails ».
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Diagnostic — Atlas" };

export default async function ResultatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentCtx();
  const diagnostic = await lireDiagnostic(ctx, id);
  if (!diagnostic) notFound();

  const resultat = diagnostic.resultat as ResultatFige | null;

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
            <Rendu resultat={resultat} />
          ) : diagnostic.statut === "complement_demande" ? (
            <Complement consigne={diagnostic.complementConsigne} diagnosticId={id} />
          ) : (
            <SansConclusion
              phrase={diagnostic.motifRefus}
              technique={diagnostic.statut === "echoue"}
            />
          )}

          {diagnostic.statut !== "complement_demande" && (
            <div className="mt-[30px]">
              <Bouton href="/paysage/diagnostic">Nouvelle photo</Bouton>
            </div>
          )}

          {diagnostic.statut === "rendu" && (
            <Details resultat={resultat!} diagnosticId={id} chantierId={diagnostic.chantierId} ctx={ctx} />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Le titre suit l'état — **et les deux refus ne portent pas le même**.
 *
 * « Sans conclusion » sur une panne de fournisseur laisserait croire que la
 * photo n'a rien donné, alors que personne ne l'a regardée : il chercherait une
 * meilleure photo au lieu de sa configuration. C'est le travers que
 * `AGENTS.md` nomme — une erreur qui accuse à tort coûte plus cher que pas
 * d'erreur du tout.
 */
function titrePour(statut: string, resultat: ResultatFige | null): string {
  if (statut === "rendu" && resultat) return resultat.nom;
  if (statut === "echoue") return "Analyse impossible";
  if (statut === "complement_demande") return "Une photo de plus";
  return "Sans conclusion";
}

// ── L'état principal : le résultat ──────────────────────────────────────────

function Rendu({ resultat }: { resultat: ResultatFige }) {
  return (
    <div data-atlas="diagnostic-rendu">
      {/* La confiance en TROIS MOTS, jamais un pourcentage — aucun modèle
          employé ici ne fournit de probabilité calibrée. */}
      <p className={libelleCaps} style={{ color: colors.or }} data-atlas="diagnostic-confiance">
        {resultat.confianceLibelle}
      </p>

      <p className="mt-[14px] text-[15px] leading-[1.6]" style={{ color: colors.inkSoft }}>
        {resultat.explication}
      </p>

      <Bloc cle="Gravité" repere="diagnostic-gravite">
        {resultat.graviteLibelle}
      </Bloc>

      <Bloc cle="Que faire ?" repere="diagnostic-conduite">
        {resultat.conduite}
      </Bloc>

      {/* Les mentions de sécurité viennent du CODE, jamais de la fiche : une
          règle générale ne doit pas pouvoir manquer parce qu'une fiche est mal
          remplie — c'est la fiche bâclée qui en a le plus besoin. */}
      {resultat.mentions.map((mention, i) => (
        <MentionAffichee key={i} mention={mention} />
      ))}
    </div>
  );
}

function MentionAffichee({ mention }: { mention: Mention }) {
  return (
    <div
      className="mt-[16px] rounded-[4px] px-4 py-3"
      style={{ backgroundColor: colors.card, borderLeft: `2px solid ${colors.or}` }}
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

// ── L'état « une photo de plus » ────────────────────────────────────────────

/**
 * **La consigne est RECOPIÉE de la base**, jamais composée ici ni par un
 * modèle : elle vient de la ligne de `confusions_phyto` qui relie les deux
 * fiches au coude à coude. Une consigne inventée enverrait photographier ce qui
 * ne tranche rien.
 */
function Complement({ consigne, diagnosticId }: { consigne: string | null; diagnosticId: string }) {
  return (
    <div data-atlas="diagnostic-complement">
      <p className={libelleCaps} style={{ color: colors.or }}>
        Une photo de plus
      </p>
      <p className="mt-[14px] text-[16px] leading-[1.5]" style={{ color: colors.ink }}>
        {consigne}
      </p>
      <p className="mt-[10px] text-[12.5px] leading-[1.55]" style={{ color: colors.muted }}>
        C’est la seule chose qui manque pour trancher.
      </p>
      <div className="mt-[24px]">
        <PrendreUnePhoto diagnosticId={diagnosticId} libelle="Prendre cette photo" />
      </div>
      <div className="mt-[18px]">
        <Bouton href="/paysage/diagnostic" creux>
          Recommencer
        </Bouton>
      </div>
    </div>
  );
}

// ── L'état « je ne peux pas confirmer » ─────────────────────────────────────

function SansConclusion({ phrase, technique }: { phrase: string | null; technique: boolean }) {
  return (
    <div data-atlas="diagnostic-sans-conclusion">
      <p className={libelleCaps} style={{ color: colors.muted }}>
        {technique ? "Analyse impossible" : "Sans conclusion"}
      </p>
      <p className="mt-[14px] text-[15px] leading-[1.6]" style={{ color: colors.ink }}>
        {phrase ?? "Je ne peux pas confirmer l’identification à partir de cette photo."}
      </p>
      <p className="mt-[12px] text-[12.5px] leading-[1.55]" style={{ color: colors.muted }}>
        {technique
          ? "Ce n’est pas la photo qui est en cause."
          : "Une photo plus proche, ou prise sous un autre angle, peut suffire."}
      </p>
    </div>
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
        <Ligne cle="Catégorie" valeur={resultat.details.categorie.replace(/_/g, " ")} />
        <Ligne cle="Agent en cause" valeur={resultat.details.agentCausal} />
        <Ligne
          cle="Parties atteintes"
          valeur={resultat.details.partiesAtteintes.map((p) => p.replace(/_/g, " ")).join(", ") || null}
        />
        <Ligne cle="Prévention" valeur={resultat.details.prevention} />
        <Ligne cle="Gestion" valeur={resultat.details.gestion} />
        {/* Le traitement ne s'affiche QUE ici, et toujours avec ses sources :
            recommander un produit phytosanitaire engage l'artisan. */}
        <Ligne cle="Traitement" valeur={resultat.details.traitement} />

        <div className="mt-[18px] border-t pt-[14px]" style={{ borderColor: colors.line }}>
          <p className={libelleCaps} style={{ color: colors.muted }}>
            D’où vient cette fiche
          </p>
          {resultat.details.sources.length === 0 ? (
            <p className="mt-[8px] text-[12.5px]" style={{ color: colors.muted }}>
              Aucune source enregistrée.
            </p>
          ) : (
            <ul className="mt-[8px]">
              {resultat.details.sources.map((s, i) => (
                <li key={i} className="mb-[8px] text-[12.5px] leading-[1.5]" style={{ color: colors.inkSoft }}>
                  <b style={{ fontWeight: 600 }}>{s.organisme}</b> — {s.titre}
                  <span style={{ color: colors.muted }}> (consultée le {s.consulteeLe})</span>
                  {s.champs.length > 0 && (
                    <span style={{ color: colors.muted }}> · appuie : {s.champs.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-[6px] text-[11.5px]" style={{ color: colors.muted }}>
            Fiche version {resultat.details.versionFiche}
            {resultat.details.sourcesAJourLe ? ` · sources à jour le ${resultat.details.sourcesAJourLe}` : ""}
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

function Bloc({ cle, children, repere }: { cle: string; children: React.ReactNode; repere: string }) {
  return (
    <div className="mt-[20px] border-t pt-[14px]" style={{ borderColor: colors.line }}>
      <p className={libelleCaps} style={{ color: colors.muted }}>
        {cle}
      </p>
      <p className="mt-[6px] text-[15px] leading-[1.55]" style={{ color: colors.ink }} data-atlas={repere}>
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

function Bouton({ href, children, creux }: { href: string; children: React.ReactNode; creux?: boolean }) {
  return (
    <div className="flex justify-center">
      <Link
        href={href}
        className="inline-flex items-center justify-center px-9 py-[13px] text-[17px]"
        style={{
          borderRadius: 9999,
          fontFamily: font.display,
          backgroundColor: creux ? "transparent" : colors.rust,
          color: creux ? colors.rust : colors.card,
          border: creux ? `1px solid ${colors.line}` : undefined,
        }}
      >
        {children}
      </Link>
    </div>
  );
}

import { notFound } from "next/navigation";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import PointsQuiSoufflent from "@/components/atlas/PointsQuiSoufflent";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors, font, libelleCaps, texteSituation } from "@/lib/design-tokens";
import { etatTranscription } from "@/lib/etat-transcription";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantier } from "@/server/repositories/chantiers";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import { estTranscriptionSimulee } from "@/server/ai/providers/transcription/dev";
import TexteDicte from "./TexteDicte";
import RafraichirPendantTranscription from "./RafraichirPendantTranscription";
import DevisDepuisDictee from "../DevisDepuisDictee";

// Consultation seule : le lancement et la relance de la transcription vivent sur
// l'écran Note vocale, jamais en double ici. Le modèle ne porte qu'une
// transcription par chantier — aucun historique n'est affiché.
export const dynamic = "force-dynamic";

/**
 * ─── LA PLAGE NE PORTE QUE SES MOTS — 5 septembre 2026 ──────────────────────
 *
 * **Le défaut réparé.** Les cinq états de la dictée sortaient du MÊME
 * paragraphe, dans la MÊME plage : son texte, « aucune note vocale »,
 * « transcription en cours… », l'échec, et l'excuse du texte non transcrit.
 * Seule la couleur changeait, encre ou gris. Une transcription **échouée**
 * avait donc la forme d'une transcription réussie — sur un téléphone, en plein
 * soleil, à bout de bras.
 *
 * L'écran d'avant portait déjà le commentaire qui l'interdisait — *« un texte
 * de remplacement n'est pas une transcription »* —, mais il ne visait que le
 * CONTENU. La forme, elle, continuait de dire l'inverse.
 *
 * **La règle, maintenant, tient en une phrase :** la plage est réservée à ce
 * qu'il a dit. Tout le reste — attente, échec, absence — se pose sur le fond de
 * page, avec le geste qui débloque. C'est le cadre lui-même qui dit ce qu'il
 * porte, sans une phrase de plus (planche `appli/relire-sa-dictee.html`).
 *
 * **Ce qui n'est PAS revenu ici :** lancer ou relancer la transcription. Deux
 * endroits pour le même geste, c'est un de trop — l'écran Note vocale le tient.
 */
export default async function TranscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantier(ctx, id);
  if (!chantier) notFound();

  const note = await getNoteVocale(ctx, id);
  // La lecture est PARTAGÉE avec l'écran des informations (`etat-transcription.ts`) :
  // deux façons de décider si une dictée a été comprise finiraient par se
  // contredire, et c'est ce que le patron croit de sa propre dictée qui en dépend.
  const simulee = estTranscriptionSimulee(note?.transcription);
  const etat = etatTranscription(note ?? null, simulee);

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      <div className="pb-16">
        {/* **La flèche HÉRITE de celle de la fiche du chantier**, mot pour mot,
            depuis que celle-ci a disparu (4 septembre 2026, `ARCHITECTURE.md`
            §254). Cet écran était à un cran d'elle : il prend sa place, il
            n'invente pas une destination. */}
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre={chantier.nom}
          titre="Transcription"
        />

        {/* ── SES MOTS ─────────────────────────────────────────────────────
            La plage, et rien d'autre dedans. La phrase qui la décrivait est
            partie le 30 août 2026 : l'écran s'appelle « Transcription » et
            montre le texte, il n'a pas à le redire (`CLAUDE.md` §3). */}
        {etat === "ecoutee" && (
          <>
            <div className="mx-6 mt-6 rounded-[4px] px-5 py-5" style={{ backgroundColor: colors.card }}>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: colors.ink }}>
                {note!.transcription}
              </p>
            </div>

            {/* La suite du parcours, et non un simple lien vers l'écran
                suivant. Une dictée transcrite contient déjà tout ce qu'il faut
                pour écrire le devis : la lui faire re-saisir écran par écran
                était le « problème qui traîne » du 4 août. */}
            <div className="mt-6 px-6">
              <DevisDepuisDictee chantierId={id} transcriptionDisponible />
              <a
                href={`/chantiers/${id}/informations`}
                className="mt-4 block text-center text-[14px] font-medium"
                style={{ color: colors.muted }}
              >
                Ou vérifier les informations une par une
              </a>
            </div>

            <TexteDicte chantierId={id} texteActuel={note!.transcription!} ouvrir={false} />
          </>
        )}

        {/* ── ÇA TRAVAILLE ────────────────────────────────────────────────
            Pas de plage : il n'y a rien à lire, et rien à corriger — ce qui
            sera écrit ici serait écrasé par la transcription qui arrive. Les
            trois points sont le signe d'attente déjà employé partout dans
            l'application (`PointsQuiSoufflent`), pas un geste de plus. */}
        {etat === "en_cours" && (
          <div className="mt-7 px-6">
            <p className="text-[15px] leading-relaxed" style={{ color: colors.ink }}>
              Transcription en cours.
            </p>
            <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
              L&apos;écran se met à jour tout seul.
            </p>
            {/* `w-fit` : `.atlas-souffle` est un conteneur FLEX qui centre ses
                points — posé dans un bloc pleine largeur, il les envoyait au
                milieu de l'écran, seuls, loin de la phrase qu'ils accompagnent.
                Vu en capture, jamais par un test. */}
            <p className="mt-4 w-fit" style={{ color: colors.or }}>
              <PointsQuiSoufflent />
            </p>
            <RafraichirPendantTranscription />
          </div>
        )}

        {/* ── ÉCHEC ───────────────────────────────────────────────────────
            La raison d'abord, puis les deux gestes qui débloquent : refaire
            passer la dictée, ou écrire ce qu'il a dit. Un refus nomme toujours
            sa raison ET sa sortie. */}
        {etat === "echouee" && (
          <div className="mt-7 px-6">
            <p className={libelleCaps} style={{ color: colors.alert }}>
              Échec
            </p>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: colors.ink }}>
              {note?.transcriptionErreur ?? "Erreur inconnue"}. Votre enregistrement est intact.
            </p>
            <a
              href={`/chantiers/${id}/note-vocale`}
              className={`mt-5 block ${libelleCaps}`}
              style={{ color: colors.rust }}
            >
              Relancer depuis la note vocale
            </a>
          </div>
        )}
        {etat === "echouee" && (
          <TexteDicte chantierId={id} texteActuel="" ouvrir={false} libelleFerme="Écrire ce que j'ai dit" aligne="gauche" />
        )}

        {/* ── LA DICTÉE EST LÀ, LA TRANSCRIPTION N'EST PAS VENUE ──────────
            Ne PAS le renvoyer à la note vocale : ce serait lui faire refaire ce
            qu'il vient de faire, et lui laisser croire qu'il s'y est mal pris.
            La case s'ouvre d'elle-même : c'est la seule chose utile ici. */}
        {etat === "non_transcrite" && (
          <>
            <div className="mt-7 px-6">
              <p className="text-[15px] leading-relaxed" style={{ color: colors.ink }}>
                Votre dictée n&apos;a pas été transcrite.
              </p>
              <p className={`mt-2 ${texteSituation}`} style={{ color: colors.muted }}>
                Elle est enregistrée : rien n&apos;est perdu.
              </p>
            </div>
            <TexteDicte chantierId={id} texteActuel="" ouvrir />
          </>
        )}

        {/* ── LA TRANSCRIPTION N'A JAMAIS ÉTÉ LANCÉE ─────────────────────── */}
        {etat === "jamais_lancee" && (
          <>
            <div className="mt-7 px-6">
              <p className="text-[15px] leading-relaxed" style={{ color: colors.ink }}>
                Cette dictée n&apos;a pas encore été transcrite.
              </p>
              <a
                href={`/chantiers/${id}/note-vocale`}
                className={`mt-5 block ${libelleCaps}`}
                style={{ color: colors.rust }}
              >
                Aller à la note vocale
              </a>
            </div>
            <TexteDicte chantierId={id} texteActuel="" ouvrir={false} libelleFerme="Écrire ce que j'ai dit" aligne="gauche" />
          </>
        )}

        {/* ── RIEN À RELIRE ───────────────────────────────────────────────
            Un seul geste possible : il prend la place du bouton principal
            plutôt que de se cacher en petits caractères. Écrire un texte ici
            serait refusé de toute façon — il n'y a aucune note à quoi le
            rattacher (`actions.ts`). */}
        {etat === "aucune_note" && (
          <div className="mt-7 px-6">
            {/* **La phrase de la planche disait « Aucune dictée sur ce
                chantier. »** Celle-ci est gardée mot pour mot : c'est le terme
                de l'application — la note vocale —, celui du bouton juste en
                dessous, et `test-transcription-e2e.ts` l'éprouve. Rien ne
                gagnait à la raccourcir de deux mots. */}
            <p className="text-[15px] leading-relaxed" style={{ color: colors.ink }}>
              Aucune note vocale pour ce chantier.
            </p>
            <div className="mt-6">
              <PrimaryButton href={`/chantiers/${id}/note-vocale`}>Enregistrer une note vocale</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

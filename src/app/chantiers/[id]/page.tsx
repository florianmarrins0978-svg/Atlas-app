import { notFound } from "next/navigation";
import Link from "next/link";
import {
  statutLabel,
  getStatutAffiche,
  getNextAction,
  getNextActionHref,
  getSecondarySteps,
} from "@/lib/chantier-etat";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { getCurrentCtx } from "@/server/session-ctx";
import { getChantierPourHub } from "@/server/repositories/chantiers";
import { listerPhotos } from "@/server/repositories/photos";
import { getNoteVocale } from "@/server/repositories/notes-vocales";
import { jourLisible } from "@/lib/jour";
import AnneauNoteVocale from "./AnneauNoteVocale";
import TiroirFiche from "./TiroirFiche";

// Écran connecté à la base réelle. Charge le chantier uniquement dans le
// contexte de l'entreprise active (withEntreprise, via le repository) — un
// chantier inexistant ou appartenant à une autre entreprise produit le même
// résultat (null) et déclenche notFound() dans les deux cas, sans distinction
// observable par l'appelant. Design et comportement strictement identiques à
// la version simulée précédente.
export const dynamic = "force-dynamic";

export default async function FicheChantierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ctx = await getCurrentCtx();
  const chantier = await getChantierPourHub(ctx, id);
  if (!chantier) notFound();

  const statut = getStatutAffiche(chantier);
  const nextAction = getNextAction(chantier);

  const [photos, note] = await Promise.all([listerPhotos(ctx, id), getNoteVocale(ctx, id)]);

  // **La ligne « Photos · 6 photos » disparaît des étapes.** Elle comptait ce
  // que la pellicule montre désormais, et deux fois la même information sur un
  // écran, c'est une de trop (`docs/INTEGRER-ORIGINE.md` §6 bis). Elle n'est
  // pas perdue : la pellicule mène au même endroit, et sa case « + » aussi.
  const etapes = getSecondarySteps(chantier.id, chantier, nextAction?.key).filter((s) => s.key !== "photos");

  return (
    <div style={{ backgroundColor: colors.cream, color: colors.ink, fontFamily: font.body, minHeight: "100%" }}>
      {/* Le talon laisse la place à la prise du tiroir (65 px) : sans lui, la
          dernière chose de la fiche se glisse dessous.

          `atlas-scene-fiche` est ce qui RECULE quand le tiroir monte — c'est
          la profondeur qui dit « on est passé au-dessus ». */}
      <div className="atlas-scene-fiche pb-[86px]">
        {/* Retour à gauche ; à droite, la sortie du chantier planifié. */}
        {/* Ordre de lecture : statut → nom → client. Même grammaire que les
            autres écrans depuis le 10 août 2026 — le surtitre porte l'état,
            qui est ce qu'on vient lire en premier. */}
        <EnTeteEcran
          retour={{ href: "/", libelle: "Retour à la liste des chantiers" }}
          surtitre={statutLabel[statut]}
          titre={chantier.nom}
          precision={`${chantier.clientNom ?? "Client non renseigné"} · ${chantier.adresseChantier ?? "Adresse non renseignée"}`}
          action={
            /* « Pourquoi n'y ai-je pas accès ??? » — sa question du 3 août
               2026. La clôture n'existait que dans l'onglet Terminés, où un
               chantier n'entre qu'une fois sa date d'intervention passée. Le
               sien était prévu dans deux jours : la facture était injoignable,
               sans que rien ne dise ni où ni quand elle le deviendrait.

               Aucune barrière de date ici, et c'est délibéré : un chantier se
               finit parfois plus tôt que prévu, et c'est le patron qui sait
               quand il est fait, pas le calendrier. Le geste reste sans danger
               — `terminerChantier` est idempotente, exige un devis réellement
               envoyé, et n'émet rien : elle bâtit la facture qu'il vérifiera
               (arrêt 3, `docs/AGENT.md` §2.3). */
            chantier.datePlanifiee ? (
              <Link
                href={`/chantiers/${chantier.id}/facture`}
                className="mt-1 flex-shrink-0 px-3 py-2 text-[9.5px] font-medium uppercase"
                style={{
                  color: colors.rust,
                  letterSpacing: "0.28em",
                  border: `1px solid ${colors.line}`,
                  borderRadius: 4,
                }}
              >
                Fin de chantier
              </Link>
            ) : undefined
          }
        />

        {/* Action principale unique, ou message calme si rien n'est requis */}
        <div className="px-[26px] pt-7">
          {nextAction ? (
            <>
              <PrimaryButton href={getNextActionHref(chantier.id, nextAction)}>{nextAction.label} →</PrimaryButton>
              {/* La sortie de secours, à hauteur de la fiche.
                  Le patron, le 4 août : « je ne peux toujours pas rédiger mon
                  devis seulement à la main si je le souhaite ». Elle existait —
                  mais uniquement au bas de l'écran Informations, c'est-à-dire
                  après avoir traversé photos et dictée. Et les étapes affichaient
                  « Prix — en attente des informations », qui se lit comme un
                  verrou alors que rien n'est verrouillé.

                  Elle disparaît une fois le devis parti : rédiger à la main un
                  devis déjà chez le client n'a plus de sens, et le rouvrir passe
                  par « Corriger et renvoyer ». */}
              {!chantier.devisEnvoyeAt && (
                <a
                  href={`/chantiers/${chantier.id}/devis-complet`}
                  className="mt-4 block text-center text-[9.5px] font-medium uppercase"
                  style={{ color: colors.rust, letterSpacing: "0.28em" }}
                >
                  Ou rédiger le devis à la main →
                </a>
              )}
            </>
          ) : (
            <div className="px-5 py-5 text-center" style={{ backgroundColor: colors.card, borderRadius: 4 }}>
              {/* « Rien à faire pour l'instant » était vrai et inutile : il ne
                  disait ni quand, ni quoi ensuite. Un écran qui ne dit pas où
                  l'on va se lit comme une application en panne. */}
              <p className="text-[14px]" style={{ color: colors.muted }}>
                {chantier.datePlanifiee
                  ? `Intervention prévue le ${jourLisible(chantier.datePlanifiee)}.`
                  : "Ce chantier est planifié."}
              </p>
              <p className="mt-1 text-[13px]" style={{ color: colors.muted }}>
                Une fois le chantier fait, touchez{" "}
                <strong style={{ color: colors.rust }}>Fin de chantier</strong>, en haut : vous vérifierez la
                facture avant qu&apos;elle n&apos;existe pour votre client.
              </p>
            </div>
          )}
        </div>

        {/* L'anneau muet : l'accès direct à la note vocale, seul et centré,
            entre le pavé de bas de fiche et le tiroir. Il ne s'affiche que
            s'il y a une note — un anneau qui ne joue rien serait un bouton en
            panne. La ligne « Note vocale » reste dans le tiroir : l'anneau est
            l'accès DIRECT, pas le seul chemin. */}
        {/* **`storageKey` et non `note` seule.** L'audio est effacé une fois la
            transcription obtenue (`docs/RGPD.md` §4) : la note existe encore,
            mais il n'y a plus rien à écouter. L'anneau se tairait sous le doigt
            sans rien dire — un bouton en panne. Le texte, lui, reste : la ligne
            « Note vocale » du tiroir y mène, et cet écran-là explique
            l'effacement au lieu de le subir. */}
        {note?.storageKey && (
          <div className="mt-7">
            <AnneauNoteVocale
              chantierId={chantier.id}
              storageKey={note.storageKey}
              dureeSecondes={note.dureeSecondes}
            />
          </div>
        )}
      </div>

      {/* Le tiroir affleure en bas : la pellicule et les étapes. Il est FIXÉ,
          donc le contenu au-dessus lui laisse la place de sa prise. */}
      <TiroirFiche
        chantierId={chantier.id}
        photos={photos.map((p) => ({ id: p.id, storageKey: p.storageKey }))}
        etapes={etapes}
        resume={{
          gauche: "Le chantier",
          droite: statutLabel[statut],
        }}
      />
    </div>
  );
}

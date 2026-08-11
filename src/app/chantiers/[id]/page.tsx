import { notFound } from "next/navigation";
import Link from "next/link";
import {
  statutLabel,
  getStatutAffiche,
  getNextAction,
  getSecondarySteps,
} from "@/lib/chantier-etat";
import EnTeteEcran from "@/components/atlas/EnTeteEcran";
import { colors, font } from "@/lib/design-tokens";
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
  // **L'étape suivante n'est plus retirée de la liste.** Depuis que le corps de
  // la fiche ne porte que l'anneau (11 août 2026), le tiroir est le SEUL endroit
  // où elle vive : l'exclure la ferait disparaître de l'application. Les photos
  // restent hors liste — elles sont la pellicule, juste au-dessus.
  const etapes = getSecondarySteps(chantier.id, chantier, undefined).filter((s) => s.key !== "photos");

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
          precision={`${chantier.clientNom ?? "Client non renseigné"} — ${chantier.adresseChantier ?? "adresse non renseignée"}`}
          // La maquette pose le client AVANT le titre, en serif gris, et ne
          // ferme pas l'en-tête d'un trait. Demandé le 11 août 2026 : « je veux
          // que ça ressemble exactement à la maquette ».
          precisionPlacee="avant"
          cheveu={false}
          // La pastille rejoint la ligne de la flèche, comme sur la maquette :
          // à côté du titre elle lui prenait la moitié de la largeur, et
          // « Intervention prévue vendredi 15 août. » se cassait en quatre
          // lignes au lieu de deux.
          actionPlacee="retour"
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
                className="flex-shrink-0 px-3 py-2 text-[9.5px] font-medium uppercase"
                style={{
                  color: colors.rust,
                  letterSpacing: "0.28em",
                  border: `1px solid ${colors.line}`,
                  borderRadius: 4,
                }}
              >
                Créer la facture
              </Link>
            ) : undefined
          }
        />

        {/* **Le corps de la fiche ne porte QUE l'anneau.** Demandé par le patron
            le 11 août 2026, maquette en main : *« exactement, respecte
            strictement ma maquette »*.

            Sa maquette (`maquettes/atlas-note-vocale.html`) ne montre aucun
            bouton : un statut, un titre, une phrase calme, l'anneau. Le pavé
            vert « Ajouter des photos » écrasait tout et faisait de la dictée un
            à-côté, alors qu'elle EST le produit.

            Rien n'est perdu pour autant — et c'est la condition pour que ce
            soit un allègement et non une amputation : l'étape suivante et la
            rédaction à la main descendent dans le tiroir, à un glissement. Les
            supprimer aurait défait deux demandes qu'il avait faites lui-même
            (le 3 et le 4 août). */}
        <div className="px-[26px] pt-7">
          {nextAction ? null : (
            /* Aligné à gauche, comme la maquette : centré, un paragraphe de
               quatre lignes se lit en escalier et ne ressemble plus à une
               phrase qu'on vous adresse. */
            <div className="px-5 py-5" style={{ backgroundColor: colors.card, borderRadius: 4 }}>
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
                <strong style={{ color: colors.rust }}>Créer la facture</strong>, en haut : vous la vérifierez
                avant qu&apos;elle n&apos;existe pour votre client.
              </p>
            </div>
          )}
        </div>

        {/* **L'anneau est là DÈS L'ARRIVÉE, avec ou sans note.** Demandé par le
            patron le 11 août 2026, devant la fiche d'un chantier neuf : *« il
            est en plein milieu et dès qu'on arrive sur la page, il y est, qu'on
            ait cliqué dessus ou non »*. Avant, il n'apparaissait qu'une fois la
            dictée faite — et la dictée arrivait DERRIÈRE les photos. Sur un
            chantier neuf, c'est-à-dire au moment précis où l'on veut parler, le
            cœur du produit était donc caché.

            Sans enregistrement il devient un micro ; avec, il redevient le
            lecteur. Une seule exception, et elle est vraie : quand l'audio a été
            purgé après transcription (`docs/RGPD.md` §4), la note EXISTE mais il
            n'y a plus rien à écouter — proposer d'en dicter une autre à cet
            endroit effacerait le travail déjà fait. La ligne « Note vocale » du
            tiroir mène alors à l'écran qui explique l'effacement. */}
        {(!note || note.storageKey) && (
          <div className="mt-4">
            <AnneauNoteVocale
              chantierId={chantier.id}
              storageKey={note?.storageKey ?? null}
              dureeSecondes={note?.dureeSecondes ?? null}
            />
          </div>
        )}
      </div>

      {/* Le tiroir affleure en bas : la pellicule et les étapes. Il est FIXÉ,
          donc le contenu au-dessus lui laisse la place de sa prise. */}
      <TiroirFiche
        chantierId={chantier.id}
        photos={photos.map((p) => ({ id: p.id, storageKey: p.storageKey }))}
        etapes={[
          ...etapes,
          // **La sortie de secours suit le même chemin que le reste.**
          // Le patron, le 4 août : « je ne peux toujours pas rédiger mon devis
          // seulement à la main si je le souhaite ». Elle vivait sous le bouton
          // principal ; celui-ci ayant quitté le corps de la fiche, elle
          // descend ici plutôt que de disparaître.
          //
          // Elle s'efface une fois le devis parti : rédiger à la main un devis
          // déjà chez le client n'a plus de sens, et le rouvrir passe par
          // « Corriger et renvoyer ».
          ...(chantier.devisEnvoyeAt
            ? []
            : [
                {
                  key: "devis-a-la-main" as const,
                  label: "Devis à la main",
                  meta: "Le rédiger soi-même",
                  done: false,
                  href: `/chantiers/${chantier.id}/devis-complet`,
                },
              ]),
        ]}
        // **La fiche doit continuer de dire QUOI FAIRE ENSUITE.**
        //
        // Vider le corps (11 août 2026, à sa demande) a fait tomber six suites
        // d'un coup — toutes sur la même phrase manquante. Ce n'était pas du
        // bruit : le bouton portait la seule indication de la marche à suivre,
        // et le tiroir fermé ne montre qu'un état. Un écran qui ne dit pas où
        // l'on va se lit comme une application en panne — c'est déjà la raison
        // d'être du pavé calme, plus haut, pour le cas « rien à faire ».
        //
        // Le bandeau du tiroir porte donc l'action quand il y en a une, et
        // l'état quand il n'y en a plus. Même emplacement que la maquette, qui
        // y met « 2 340 € · devis accepté » — un chantier où il n'y a
        // effectivement plus rien à faire.
        resume={{
          gauche: "Le chantier",
          droite: nextAction ? `${nextAction.label} →` : statutLabel[statut],
        }}
      />
    </div>
  );
}

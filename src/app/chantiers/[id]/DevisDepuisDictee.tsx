"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, libelleCaps } from "@/lib/design-tokens";
import { preparerDevisDepuisDicteeAction, repondreQuestionsChiffrageAction } from "./informations/actions";
import { precisionLisible, type QuestionChiffrage } from "@/lib/questions-chiffrage";
import { attendreLeDevis } from "@/lib/attente-devis";

// Le geste unique : de la dictée au devis.
//
// **Pourquoi ce bouton existe.** Le patron, le 4 août 2026 : « toujours pas de
// devis créé tout seul à partir de la note vocale ! Problème qui traîne. »
// Chaque maillon existait — brouillon, prestations, prix, devis — et chacun
// était éprouvé. Aucun ne menait au suivant : il enchaînait cinq boutons sur
// quatre écrans, et s'il en oubliait un, un devis à 0,00 € l'attendait au bout.
//
// `docs/AGENT.md` §2 décrivait pourtant l'agent qui « transcrit, structure,
// cherche les tarifs, RÉDIGE LE DEVIS », avec **un seul arrêt** : le patron
// vérifie et valide. C'est cet arrêt-là, et lui seul, qui reste.
//
// Ce que le bouton ne fait pas : envoyer. Le devis est préparé, pas parti.

type Props = {
  chantierId: string;
  /**
   * Sans dictée, il n'y a rien à enchaîner : le bouton ne s'affiche pas.
   *
   * **Ce n'est plus « transcription faite », mais « dictée faite ».** Depuis le
   * 11 août 2026, la chaîne lance elle-même la transcription si elle manque
   * (`devis-depuis-dictee.ts`) : exiger ici qu'elle soit déjà obtenue
   * empêcherait précisément le geste unique que le patron a demandé.
   */
  transcriptionDisponible: boolean;
  /**
   * `"principal"` — le pavé vert, sur l'écran Transcription.
   * `"secondaire"` — la ligne discrète, sur l'écran Informations.
   * `"anneau"` — l'écriture nue sous l'anneau de la fiche. **Aucun cadre,
   * aucun fond** : le patron a choisi cette forme le 11 août 2026, parmi six,
   * et pour une raison qu'il faut connaître avant d'y toucher — sa fiche n'a
   * plus aucun bouton depuis ce matin-là, et y remettre un pavé vert lui
   * rendrait le poids qu'on venait de lui retirer.
   */
  variante?: "principal" | "secondaire" | "anneau";
  /**
   * La chaîne part TOUTE SEULE à l'arrivée, sans bouton et sans qu'il touche
   * rien.
   *
   * **Sa panne du 21 août 2026** — voir `src/lib/devis-a-preparer.ts` pour le
   * récit. Il dicte chez sa cliente, ferme l'application, revient, ouvre le
   * chantier : le devis doit être là. Personne n'est resté pour appuyer sur
   * « Mon devis → », alors l'écran s'en charge.
   *
   * Dans ce mode il n'y a plus rien à pousser : le composant ne rend que ce
   * qui se passe — le travail en cours, l'arrêt d'avant-chiffrage, ou ce qui
   * a échoué avec une sortie vers le devis tel quel.
   */
  auto?: boolean;
  /**
   * Est-on DÉJÀ sur le devis ?
   *
   * **Deux notions vivaient dans `auto`, et elles se sont séparées le 30 août
   * 2026** : « la chaîne part toute seule » et « on est déjà arrivé ». Sur la
   * page du devis les deux coïncident — `refresh` suffit, et `push` vers
   * l'adresse courante ne rejouerait pas le rendu serveur. Sur la fiche client,
   * la chaîne part toute seule elle aussi (l'avion vient d'envoyer la note),
   * mais il reste à FAIRE LE CHEMIN : sans cette distinction, l'écran
   * rafraîchissait la fiche et le devis n'arrivait jamais.
   *
   * Par défaut il vaut `auto`, pour que les appels d'avant ne changent pas.
   */
  surLeDevis?: boolean;
};

type Etat =
  | { type: "repos" }
  | { type: "encours" }
  /**
   * La réponse ne revient pas, et on attend le devis lui-même.
   *
   * **`secondes` n'est pas un ornement.** Un écran qui dit « ça travaille »
   * sans jamais changer se lit comme un écran figé, et c'est exactement ce que
   * le patron a vécu pendant six minutes : il a fini par recharger, faute de
   * savoir si quelque chose se passait encore.
   */
  | { type: "attente"; secondes: number }
  | { type: "conflit" }
  // L'arrêt d'avant-chiffrage : ce qui manque et qui fait le prix.
  | { type: "questions"; questions: QuestionChiffrage[] }
  | { type: "sansPrix"; raison: string }
  | { type: "message"; texte: string };

/**
 * Ce que le bouton dit pendant qu'il travaille, ou `null` s'il est au repos.
 *
 * **Le compteur n'est pas une coquetterie.** Un écran qui répète « ça
 * travaille » sans jamais changer se lit comme un écran figé — c'est ce que le
 * patron a vécu six minutes avant de recharger. Un nombre qui monte dit au
 * moins que quelque chose se passe encore, et jusqu'à quand on l'a laissé.
 */
function libelleEnCours(etat: Etat): string | null {
  if (etat.type === "encours") return "Atlas prépare le devis…";
  if (etat.type === "attente") {
    return etat.secondes < 15
      ? "Atlas prépare le devis…"
      : `Atlas prépare toujours le devis… (${etat.secondes} s)`;
  }
  return null;
}

export default function DevisDepuisDictee({
  chantierId,
  transcriptionDisponible,
  variante = "principal",
  auto = false,
  surLeDevis = auto,
}: Props) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ type: "repos" });

  async function lancer(remplacer = false) {
    setEtat({ type: "encours" });
    try {
      const r = await preparerDevisDepuisDicteeAction(chantierId, remplacer);
      if (r.statut === "prepare") {
        // **Ne jamais l'emmener sur un devis muet.**
        //
        // Le 7 août 2026, il dicte quatre prestations, arrive sur son devis, et
        // le trouve vide : « gros bug, corrige ça et que ça ne se reproduise
        // plus jamais ». Le refus de chiffrer était juste — il n'avait dit ni
        // durée ni équipe — mais il partait sans un mot, et un écran vide ne
        // ressemble jamais à une décision : il ressemble à une panne.
        //
        // La raison s'affiche donc AVANT le devis, avec ce qu'il y a à faire.
        // Le devis, lui, porte désormais les prestations, prix à compléter.
        if (r.rapport.prixImpossible) {
          setEtat({ type: "sansPrix", raison: r.rapport.prixImpossible });
          return;
        }
        // **On l'emmène droit au devis.** Il l'a demandé le 5 août 2026 : « une
        // fois qu'on valide la note vocale, cette page s'ouvre, j'ai accès à la
        // page où il n'y a que le devis, et là je fais mes modifications. Je ne
        // veux pas tous les autres trucs intermédiaires. »
        //
        // Le compte rendu qui s'affichait ici — ce qui a été retenu, à
        // combien — était un écran de plus entre sa dictée et son devis. Ce
        // qu'il devait dire se lit maintenant sur le devis lui-même : les
        // lignes y sont, le total aussi, et la mention « recopiée mot à mot »
        // s'affiche là-bas quand aucun modèle n'a compris la dictée.
        // **Déjà sur le devis en mode automatique** : `push` vers l'adresse
        // courante ne rejoue pas le rendu serveur, et l'écran resterait sur
        // « Atlas prépare le devis… » devant un devis pourtant écrit.
        if (surLeDevis) router.refresh();
        else router.push(`/chantiers/${chantierId}/devis-complet`);
        return;
      }
      if (r.statut === "conflit") return setEtat({ type: "conflit" });
      if (r.statut === "transcription_absente") {
        return setEtat({ type: "message", texte: "Aucune dictée transcrite sur ce chantier : il n'y a rien à reprendre." });
      }
      if (r.statut === "transcription_simulee") {
        return setEtat({
          type: "message",
          texte:
            "Votre dictée n'a pas été transcrite : aucun prestataire de transcription n'est encore raccordé. " +
            "Écrivez ce que vous avez dit sur l'écran Transcription, et le devis se fera à partir de là.",
        });
      }
      if (r.statut === "questions") return setEtat({ type: "questions", questions: r.questions });
      setEtat({ type: "message", texte: r.erreur });
    } catch {
      // **La réponse s'est perdue — le travail, lui, a peut-être abouti.**
      //
      // Le patron, le 12 août 2026 : *« il s'est passé plus de six minutes et
      // j'ai dû recharger la page pour que le devis arrive. »* Le serveur avait
      // fini depuis longtemps ; c'est la réponse qui n'est jamais revenue, et
      // l'écran restait sur « Atlas prépare le devis… » sans rien savoir.
      //
      // On cesse donc de dépendre de cet unique aller-retour : on demande à
      // intervalles si le devis est là, et on y va dès qu'il l'est. Recharger la
      // page n'est plus son travail. Voir `src/lib/attente-devis.ts`.
      setEtat({ type: "attente", secondes: 0 });
      const issue = await attendreLeDevis(chantierId, {
        surAttente: (secondes) => setEtat({ type: "attente", secondes }),
      });
      if (issue === "pret") {
        if (surLeDevis) return router.refresh();
        return router.push(`/chantiers/${chantierId}/devis-complet`);
      }
      setEtat({
        type: "message",
        texte:
          "La préparation n'a pas abouti, et le devis n'est pas arrivé. Rechargez la page : " +
          "s'il est là, tout est bon ; sinon, reprenez « Mon devis ».",
      });
    }
  }

  // ─── Le départ automatique ────────────────────────────────────────────
  //
  // **Une seule fois, et le garde n'est pas une précaution de style.** React
  // monte deux fois en développement, et un `router.refresh()` peut remonter
  // l'arbre : sans lui, deux chaînes partiraient sur le même chantier et
  // s'écraseraient l'une l'autre — prestations en double, ou brouillon repris
  // à mi-course.
  const dejaLance = useRef(false);
  useEffect(() => {
    if (!auto || dejaLance.current || !transcriptionDisponible) return;
    dejaLance.current = true;
    void lancer();
    // `lancer` ne dépend que des props, et le garde ci-dessus est ce qui
    // décide du rejeu — pas la liste de dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, transcriptionDisponible]);

  if (!transcriptionDisponible) return null;

  return (
    <div className={`flex flex-col gap-2 ${variante === "anneau" ? "items-center" : ""}`}>
      {auto ? (
        /* **Rien à pousser : on rend ce qui se passe.** Le bouton n'aurait
           aucun sens ici — personne n'est venu appuyer, l'écran travaille de
           lui-même parce qu'il a fermé l'application entre-temps. */
        <p
          role="status"
          aria-live="polite"
          data-atlas="preparation-automatique"
          className="text-center text-[15px]"
          style={{ color: colors.rust }}
        >
          {libelleEnCours(etat)?.replace("le devis", "votre devis") ??
            (etat.type === "repos" ? "Atlas reprend votre dictée et écrit le devis…" : "")}
        </p>
      ) : variante === "anneau" ? (
        /* **L'écriture nue, et rien autour.** Choisie par le patron le 11 août
           2026 sur six formes essayées — l'écriture, le trait, le bouton
           plein, la pastille, l'anneau qui s'étire, le bandeau du tiroir.

           Elle porte l'OR et non le vert pin, contre l'usage : l'or est la voix
           de ce qu'on lit, le vert celle de ce qu'on fait
           (`design-tokens.ts`). Ici, le vert aurait fait un second centre à
           côté de l'anneau — deux objets à regarder là où il n'en faut qu'un.
           C'est la seule action de l'application qui parle en or, et c'est
           pour rester sous l'anneau plutôt qu'à côté de lui. */
        <button
          type="button"
          onClick={() => lancer()}
          disabled={etat.type === "encours" || etat.type === "attente"}
          data-atlas="mon-devis"
          className={`px-2 py-2 disabled:opacity-40 ${libelleCaps}`}
          style={{ color: colors.or }}
        >
          {libelleEnCours(etat) ?? "Mon devis"}
        </button>
      ) : variante === "principal" ? (
        <button
          type="button"
          onClick={() => lancer()}
          disabled={etat.type === "encours" || etat.type === "attente"}
          className="atlas-plein w-full rounded-full py-3.5 text-[15px] font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: colors.rust }}
        >
          {libelleEnCours(etat) ?? "Créer le devis à partir de ma dictée"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => lancer()}
          disabled={etat.type === "encours" || etat.type === "attente"}
          // Seule la variante discrète prend la voix des libellés : c'est la
          // seule à ne vivre que sur l'écran Informations. La variante mise en
          // avant est sur l'écran Transcription, qui n'est pas encore refait —
          // et lui donner cette voix seule y ferait une fausse note.
          className={`self-start disabled:opacity-40 ${libelleCaps}`}
          style={{ color: colors.rust }}
        >
          {/* Sans la flèche : en capitales espacées, la phrase tient tout juste
              sur une ligne, et la flèche la faisait passer à deux — seule sur
              la seconde. Vu en capture, jamais par une suite. */}
          {libelleEnCours(etat) ?? "Aller jusqu'au devis d'un seul geste"}
        </button>
      )}

      {etat.type === "repos" && variante === "principal" && (
        <p className="text-center text-[12px]" style={{ color: colors.muted }}>
          Prestations, durée, équipe, prix : tout est repris de ce que vous avez dit. Rien ne part au client.
        </p>
      )}

      {etat.type === "message" && (
        <p role="alert" className="text-[13px]" style={{ color: colors.alert }}>
          {etat.texte}
        </p>
      )}

      {etat.type === "sansPrix" && (
        <div className="rounded-[4px] px-4 py-4" style={{ backgroundColor: colors.rustTint }}>
          <p className="text-[13px] leading-snug" style={{ color: colors.rust }}>
            {etat.raison}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.push(`/chantiers/${chantierId}/devis-complet`)}
              className="atlas-plein rounded-full px-4 py-2.5 text-[14px] font-medium"
              style={{ backgroundColor: colors.rust, color: colors.cream }}
            >
              Ouvrir le devis et poser les prix
            </button>
            <button
              type="button"
              onClick={() => router.push(`/chantiers/${chantierId}/informations`)}
              className="text-[13px] font-medium"
              style={{ color: colors.rust }}
            >
              Compléter la durée et l&apos;équipe
            </button>
          </div>
        </div>
      )}

      {etat.type === "questions" && (
        <QuestionsChiffrage
          chantierId={chantierId}
          questions={etat.questions}
          onAbandon={() => setEtat({ type: "repos" })}
          onEchec={(texte) => setEtat({ type: "message", texte })}
          onPrepare={() => router.push(`/chantiers/${chantierId}/devis-complet`)}
        />
      )}

      {etat.type === "conflit" && (
        <div className="rounded-[4px] px-4 py-3" style={{ backgroundColor: colors.rustTint }}>
          <p className="text-[13px]" style={{ color: colors.rust }}>
            Vous avez corrigé ce brouillon à la main. Repartir de la dictée effacerait vos corrections.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setEtat({ type: "repos" })}
              className="rounded-full py-2.5 text-[14px] font-medium"
              style={{ backgroundColor: colors.card, color: colors.ink }}
            >
              Conserver mes corrections
            </button>
            <button
              type="button"
              onClick={() => lancer(true)}
              className="text-[14px] font-medium"
              style={{ color: colors.alert }}
            >
              Repartir de la dictée
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * L'arrêt d'avant-chiffrage, à l'écran.
 *
 * **Ce que cet écran doit être, et ce qu'il ne doit surtout pas devenir.**
 * `docs/AGENT.md` §2 : un arrêt doit rester « franchissable en quelques
 * secondes ». Deux ou trois questions, la réponse à portée de pouce, et on
 * repart. S'il devient un formulaire, le patron le contournera — et le
 * contournement, ici, c'est un devis faux de 800 €.
 *
 * D'où trois partis pris :
 *
 * - **Aucune phrase qui explique.** Sa consigne du 30 août 2026 devant cet
 *   écran-ci : *« trop de phrases inutiles, il faut aller droit au but,
 *   l'utilisateur n'aime pas lire »*. Il portait, sous le titre, deux lignes
 *   disant que la dictée était incomplète — et sous CHAQUE question, une ligne
 *   disant ce qu'elle changeait. Elles sont parties, `pourquoi` avec elles :
 *   un champ que plus rien n'affiche revient à l'écran au premier remaniement.
 *   La prestation, la question, les réponses — rien d'autre (`CLAUDE.md` §3).
 * - **Les choix connus sont des boutons**, jamais une liste déroulante : un
 *   appui contre trois, sur un téléphone, une main dans le gant.
 * - **On peut passer outre.** Il connaît son métier mieux que ces règles ; le
 *   devis part alors sans la précision, et l'écran ne prétend pas le contraire.
 */
function QuestionsChiffrage({
  chantierId,
  questions,
  onAbandon,
  onEchec,
  onPrepare,
}: {
  chantierId: string;
  questions: QuestionChiffrage[];
  onAbandon: () => void;
  onEchec: (texte: string) => void;
  onPrepare: () => void;
}) {
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);

  const toutesRepondues = questions.every((q) => (reponses[q.id] ?? "").trim() !== "");

  async function valider() {
    setEnvoi(true);
    try {
      const r = await repondreQuestionsChiffrageAction(
        chantierId,
        questions
          .filter((q) => (reponses[q.id] ?? "").trim() !== "")
          .map((q) => ({
            sujet: q.id,
            libellePrestation: q.libellePrestation,
            valeur: reponses[q.id]!.trim(),
            lisible: precisionLisible(q, reponses[q.id]!.trim()),
          }))
      );
      // Répondu ou non, la chaîne va jusqu'au devis : appuyer sur ce bouton
      // EST sa décision. Ce qu'il a laissé de côté ressort signalé sur le
      // devis, jamais oublié en silence.
      if (r.statut === "prepare") return onPrepare();
      onEchec("statut" in r && r.statut === "echec" ? r.erreur : "La préparation n'a pas abouti. Réessayez.");
    } catch {
      onEchec("Vos réponses n'ont pas pu être enregistrées. Réessayez.");
    }
  }

  return (
    <div className="rounded-[4px] px-4 py-4" style={{ backgroundColor: colors.rustTint }}>
      <p className="text-[13px] font-medium" style={{ color: colors.rust }}>
        Avant de chiffrer
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {questions.map((q, i) => (
          <div key={q.id} data-atlas="question-chiffrage">
            {/* La prestation ne se répète pas d'une question à l'autre : deux
                questions sur le même arbre l'écrivaient deux fois de suite. */}
            {q.libellePrestation !== questions[i - 1]?.libellePrestation && (
              <p className="text-[12px]" style={{ color: colors.muted }}>
                {q.libellePrestation}
              </p>
            )}
            <p className="text-[15px] font-medium" style={{ color: colors.ink, marginTop: 2 }}>
              {q.question}
            </p>

            {q.options ? (
              <div className="mt-2 flex flex-col gap-2">
                {q.options.map((o) => {
                  const choisie = reponses[q.id] === o.valeur;
                  return (
                    <button
                      key={o.valeur}
                      type="button"
                      onClick={() => setReponses((r) => ({ ...r, [q.id]: o.valeur }))}
                      className="rounded-full px-4 py-2.5 text-left text-[14px] font-medium"
                      style={{
                        backgroundColor: choisie ? colors.rust : colors.card,
                        color: choisie ? colors.cream : colors.ink,
                      }}
                    >
                      {o.libelle}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={q.question}
                  value={reponses[q.id] ?? ""}
                  onChange={(e) => setReponses((r) => ({ ...r, [q.id]: e.target.value }))}
                  className="w-28 rounded-[4px] px-3 py-2.5 text-[15px]"
                  style={{ backgroundColor: colors.card, color: colors.ink }}
                />
                <span className="text-[14px]" style={{ color: colors.muted }}>
                  {q.unite}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={valider}
        disabled={envoi}
        className="atlas-plein mt-5 w-full rounded-full py-3 text-[15px] font-medium disabled:opacity-40"
        style={{ backgroundColor: colors.rust, color: colors.cream }}
      >
        {envoi ? "Atlas termine le devis…" : toutesRepondues ? "Continuer vers le devis" : "Continuer sans répondre à tout"}
      </button>
      <button
        type="button"
        onClick={onAbandon}
        className="mt-2 w-full text-[13px]"
        style={{ color: colors.muted }}
      >
        Revenir en arrière
      </button>
    </div>
  );
}

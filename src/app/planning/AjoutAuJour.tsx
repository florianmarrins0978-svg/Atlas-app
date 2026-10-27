"use client";

import { colors } from "@/lib/design-tokens";
import type { JourIso } from "@/lib/disponibilites";
import type { GestesCarte } from "./types-du-planning";
import { Choisir, MotEnOr, Petit } from "./ElementsDuPlanning";
import { CommentIlSigne, RelanceDuDevisExpire } from "./RelancesDuDevis";
import { AjoutDeTemps, AjoutDunClient } from "./AjoutDunClient";

/**
 * LE GESTE D'AJOUT D'UNE JOURNÉE — écrit une fois, posé à deux endroits.
 *
 * **Il appartient au JOUR, pas au chantier.** Sur la planche 86 il vit sous la
 * liste des chantiers de la journée, après le dernier volet ; le laisser dans
 * le volet d'un chantier le ferait apparaître autant de fois qu'il y a de
 * chantiers, et laisserait croire qu'on ajoute quelque chose À ce chantier.
 *
 * Sa demande du 21 août tient toujours : *« le "+ Ajouter un chantier", tu le
 * mets en dessous, un rond avec un plus ; je ne veux pas qu'il soit affilié à
 * la case matin ou après-midi »*.
 */
export function AjoutAuJour({
  cle,
  jour,
  ouvert,
  setOuvert,
  sansDate,
  poser,
  poserUnClient,
  attenteClient,
  poserALaPlace,
  devisExpires,
  relancerLeDevisExpire,
  relireLeDevisExpire,
  morceaux,
  morceauEnMain,
  onPrendreMorceau,
}: {
  cle: string;
  jour: JourIso;
} & Pick<
  GestesCarte,
  | "ouvert"
  | "setOuvert"
  | "sansDate"
  | "poser"
  | "poserUnClient"
  | "attenteClient"
  | "poserALaPlace"
  | "devisExpires"
  | "relancerLeDevisExpire"
  | "relireLeDevisExpire"
  | "morceaux"
  | "morceauEnMain"
  | "onPrendreMorceau"
>) {
  const ici = ouvert?.cle === cle ? ouvert.quoi : null;
  /**
   * **CE QUI ATTEND UN JOUR, ET PAS SEULEMENT « SANS DATE » — 11 sept. 2026.**
   *
   * Sa panne, capture à l'appui : *« j'en ai que deux […] ça devait être un
   * chantier en attente et un client »*. Une demi-journée de M. Julien
   * attendait sous « Sans date », et la voie qui mène aux chantiers en attente
   * avait DISPARU — parce qu'elle ne comptait que les chantiers sans date, et
   * qu'un morceau rendu n'en est pas un : son chantier, lui, a une date.
   *
   * Pour lui, les deux sont la même chose — du travail qui attend un jour —, et
   * le tiroir du bas les compte déjà ensemble depuis la veille. C'est ici que
   * la règle manquait.
   */
  // **Et ceux qui attendent leur lien** — son choix B du 7 octobre 2026 : un
  // client qui n'arrive pas à choisir ses dates se pose d'ici, comme les autres.
  const aEnAttente = sansDate.length > 0 || morceaux.length > 0 || attenteClient.length > 0;

  // ─── LE GESTE NE DISPARAÎT PLUS, PARCE QU'IL MÈNE QUELQUE PART ───────────
  //
  // **Sa remarque du 23 août 2026 :** *« lorsqu'aucun chantier n'attend de
  // jour, il ne faudrait pas que le bouton "Ajouter un chantier" apparaisse à
  // l'écran, car il peut nous induire en erreur »*. La raison en était juste :
  // ce geste ne CRÉAIT rien, il posait un chantier qui attendait déjà une date.
  // Sans aucun en attente, il ne pouvait mener qu'à un cul-de-sac.
  //
  // **Depuis sa planche du 10 septembre, il crée.** *« Que je puisse le faire
  // sans devoir passer par la fiche client et le devis. »* Un jour vide n'est
  // donc plus un cul-de-sac : « Un client » y mène toujours quelque part. La
  // règle qu'il a posée — un geste qui ne mène nulle part se retire — est
  // exactement ce qui commande de le montrer maintenant.
  //
  // **Ce qui disparaît, c'est la VOIE qui ne mène nulle part**, et elle seule :
  // « Un chantier en attente » ne s'offre pas quand aucun n'attend.
  return (
    <>
      {ici === "ajout-voies" ? (
        /* ─── SES RÉPONSES DU 17 ET DU 18 SEPTEMBRE 2026 ─────────────────────
           *« Le C, pas d'Annuler »* : les trois voies gardent leurs mots, et
           l'on referme par où l'on est entré — « Ajouter » devenu « Fermer »,
           à sa place, sous les voies. Puis, sur sa planche du 18 : des mots en
           or plutôt que des capsules, et *« quand on clique sur ajouter il
           doit y avoir marqué client en attente »*. */
        <div className="mt-3.5 pt-3">
          <div className="flex flex-wrap items-center gap-x-[18px]">
            {aEnAttente && (
              <VoieDAjout
                data-atlas="voie-chantier"
                onClick={() => setOuvert({ quoi: "ajout-qui", cle })}
              >
                Client en attente
              </VoieDAjout>
            )}
            {/* **Sa porte à part** — sa demande du 7 octobre 2026 : un devis
                expiré ne passe jamais par « Client en attente », le client n'a
                plus rien où signer. */}
            {devisExpires.length > 0 && (
              <VoieDAjout
                data-atlas="voie-expire"
                onClick={() => setOuvert({ quoi: "ajout-expire", cle })}
              >
                Devis expiré
              </VoieDAjout>
            )}
            <VoieDAjout
              data-atlas="voie-client"
              onClick={() => setOuvert({ quoi: "ajout-client", cle })}
            >
              Un client
            </VoieDAjout>
            {/* **Ce qui n'est pas un client** — sa réponse du 10 septembre :
                un rendez-vous à la banque, une livraison, une formation
                prennent une demi-journée comme le reste. */}
            <VoieDAjout
              data-atlas="voie-temps"
              onClick={() => setOuvert({ quoi: "ajout-temps", cle })}
            >
              Autre chose
            </VoieDAjout>
          </div>
          <GesteAjouter ouvert onClick={() => setOuvert(null)} />
        </div>
      ) : ici === "ajout-qui" ? (
        <div className="mt-3.5 pt-3">
          {/* **LE NOM POSE LE CHANTIER, ET C'EST TOUT** — sa remarque du
              9 septembre 2026. Il y avait ici un second temps : on touchait le
              nom, et trois boutons demandaient « Matin, Après-midi ou
              Journée ». La durée du chantier étant déjà en base, cette
              question-là ne comblait aucun trou — elle proposait d'écraser ce
              que le devis avait fixé (voir `poser`). Un geste, une pose. */}
          <Choisir>
            {sansDate.map((s) => (
              <Petit key={s.id} data-qui={s.id} onClick={() => poser(s.id, jour)}>
                {s.nom}
              </Petit>
            ))}
            {/* **Une demi-journée rendue se prend, elle ne se pose pas d'un
                coup** : le jour a deux moitiés, et choisir laquelle à sa place
                serait décider de son chantier. On la met au doigt — le geste du
                tiroir, écrit une fois — et les « Poser ici » de la journée
                s'allument juste au-dessus. */}
            {morceaux.map((m) => (
              <Petit
                key={`morceau-${m.chantier.id}`}
                data-qui-morceau={m.chantier.id}
                retenue={morceauEnMain === m.chantier.id}
                onClick={() => {
                  onPrendreMorceau(m.chantier.id);
                  setOuvert(null);
                }}
              >
                {m.chantier.nom}, ½
              </Petit>
            ))}
            {/* **Son devis est parti, il n'a pas choisi** : le nom ne pose pas
                encore, il demande comment il signera. Poser ne vaut jamais
                accord (`pose-a-sa-place.ts`). */}
            {attenteClient.map((c) => (
              <Petit
                key={`lien-${c.id}`}
                data-qui-lien={c.id}
                onClick={() => setOuvert({ quoi: "ajout-signature", cle, chantierId: c.id })}
              >
                {c.nom}, devis envoyé
              </Petit>
            ))}
          </Choisir>
          {/* **« Annuler » ramène aux deux voies**, sa demande du 10 septembre :
              sans lui, changer d'avis oblige à refermer le geste entier. */}
          <div className="mt-2 flex justify-end">
            <Petit data-atlas="annuler-ajout" onClick={() => setOuvert({ quoi: "ajout-voies", cle })}>
              Annuler
            </Petit>
          </div>
        </div>
      ) : ici === "ajout-signature" && ouvert?.quoi === "ajout-signature" ? (
        <CommentIlSigne
          jour={jour}
          chantier={attenteClient.find((c) => c.id === ouvert.chantierId) ?? null}
          onAnnuler={() => setOuvert({ quoi: "ajout-qui", cle })}
          poserALaPlace={poserALaPlace}
        />
      ) : ici === "ajout-expire" ? (
        <div className="mt-3.5 pt-3">
          <Choisir>
            {devisExpires.map((c) => (
              <Petit
                key={`expire-${c.id}`}
                data-qui-expire={c.id}
                onClick={() => setOuvert({ quoi: "ajout-relance", cle, chantierId: c.id, etape: "choix" })}
              >
                {c.nom}
              </Petit>
            ))}
          </Choisir>
          <div className="mt-2 flex justify-end">
            <Petit data-atlas="annuler-ajout" onClick={() => setOuvert({ quoi: "ajout-voies", cle })}>
              Annuler
            </Petit>
          </div>
        </div>
      ) : ici === "ajout-relance" && ouvert?.quoi === "ajout-relance" ? (
        ouvert.etape === "signe" ? (
          /* **La même question que « Poser à sa place »**, et le même
             composant : seul change ce qui l'écrit, un lien NEUF d'abord. */
          <CommentIlSigne
            jour={jour}
            chantier={devisExpires.find((c) => c.id === ouvert.chantierId) ?? null}
            onAnnuler={() => setOuvert({ ...ouvert, etape: "choix" })}
            poserALaPlace={relancerLeDevisExpire}
          />
        ) : (
          <RelanceDuDevisExpire
            jour={jour}
            chantier={devisExpires.find((c) => c.id === ouvert.chantierId) ?? null}
            onRenvoyer={() => setOuvert({ ...ouvert, etape: "signe" })}
            onPoser={(id) => poser(id, jour)}
            relire={relireLeDevisExpire}
            onAnnuler={() => setOuvert({ quoi: "ajout-expire", cle })}
          />
        )
      ) : ici === "ajout-client" ? (
        <AjoutDunClient
          jour={jour}
          onAnnuler={() => setOuvert({ quoi: "ajout-voies", cle })}
          onPose={(chantier) => {
            setOuvert(null);
            poserUnClient(chantier);
          }}
        />
      ) : ici === "ajout-temps" ? (
        <AjoutDeTemps
          jour={jour}
          onAnnuler={() => setOuvert({ quoi: "ajout-voies", cle })}
          onPose={(chantier) => {
            setOuvert(null);
            poserUnClient(chantier);
          }}
        />
      ) : (
        /* **Plus de filet au-dessus d'« Ajouter »** — sa demande du 23 août
           2026 : *« la ligne qui se trouve entre le nom et le "+ Ajouter un
           chantier", supprime-la »*. La planche 86 n'en porte pas : c'est
           l'écran qui en avait ajouté un, et il refermait la journée juste
           avant le geste qui la prolonge. */
        <GesteAjouter ouvert={false} onClick={() => setOuvert({ quoi: "ajout-voies", cle })} />
      )}
    </>
  );
}

/**
 * « AJOUTER », ET LE MÊME MOT DEVENU « FERMER » — au milieu, en or.
 *
 * **C'était un rond cerné d'or avec un « + »** (sa demande du 21 août 2026 :
 * *« un rond avec un plus »*). Sa planche du 18 septembre 2026 l'a remplacé par
 * le mot seul, en or, comme tout ce qui s'appuie sur cette fiche : *« j'en ai
 * marre des gros boutons »*. Il garde sa place — sous les chantiers, en bas de
 * la fiche — et son repère `ajouter` : ouvert, il dit « Fermer » et referme,
 * c'est sa réponse C du 17 septembre (*« le C, pas d'Annuler »*).
 *
 * **À gauche, à 16 px, avec son « + » dessiné — sa planche du 25 octobre 2026**
 * (`appli/soignee/planning.html`). Centré sous chaque jour, le mot flottait
 * cinq fois au milieu de la page ; au bout de la plage du jour, il dit à quel
 * jour il ajoute.
 */
function GesteAjouter({ ouvert, onClick }: { ouvert: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-start">
      <button
        type="button"
        data-atlas="ajouter"
        aria-label={ouvert ? "Fermer" : "Ajouter"}
        onClick={onClick}
        className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 border-0 bg-transparent px-0.5 text-[16px] font-semibold"
        style={{ color: colors.or, WebkitTapHighlightColor: "transparent" }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 flex-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
        >
          <path d={ouvert ? "M6.5 6.5l11 11M17.5 6.5l-11 11" : "M12 5v14M5 12h14"} />
        </svg>
        {ouvert ? "Fermer" : "Ajouter"}
      </button>
    </div>
  );
}

/**
 * L'une des voies de « Ajouter » — même dessin, trois destinations.
 *
 * **Un mot en or, plus une capsule** — sa planche du 18 septembre 2026. La
 * forme est celle de tout geste de cette fiche (`MotEnOr`) ; les repères des
 * suites (`voie-chantier`, `voie-client`, `voie-temps`) ne bougent pas.
 */
function VoieDAjout({
  children,
  onClick,
  ...reste
}: {
  children: React.ReactNode;
  onClick: () => void;
} & React.ComponentPropsWithoutRef<"button">) {
  return (
    <MotEnOr onClick={onClick} {...reste}>
      {children}
    </MotEnOr>
  );
}

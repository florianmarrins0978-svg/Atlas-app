"use client";

import { useState } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
import { composerMessageClient, lienTransmission, type CanalClient } from "@/lib/message-client";
import { destinataireLisible } from "@/lib/numero-lisible";
import { marquerDepartMessagerie, useRetourDeMessagerie } from "@/lib/depart-messagerie";
import { enregistrerCoordonneeClientAction } from "./actions";
import type { Civilite } from "@/lib/civilite";

// Ouvre l'application de messagerie du patron, message prêt à partir, **au bon
// destinataire**.
//
// Pourquoi ce bouton existe : aucun prestataire d'e-mail ni de SMS n'est
// raccordé (docs/A-FAIRE.md §5), et le brancher suppose un abonnement ET un nom
// de domaine — deux achats que le patron n'a pas encore faits. En attendant, le
// dernier mètre du parcours n'existait pas : le lien était affiché, à recopier
// à la main dans un SMS. Sur dix chantiers par semaine, vingt gestes.
//
// **Deux défauts corrigés le 2026-08-04, tous deux vus sur ses captures.**
//
// 1. *Le numéro n'était pas rempli.* Le bouton passait d'abord par
//    `navigator.share`, qui ouvre la feuille de partage d'iOS. Elle transmet un
//    texte — et **rien d'autre** : ni numéro, ni adresse. Le patron arrivait
//    donc sur un message tout écrit avec un champ « À : » vide, et devait
//    retaper le numéro qu'Atlas connaissait. Le partage n'est plus le chemin
//    principal : quand la coordonnée est connue, on ouvre directement `sms:` ou
//    `mailto:`, qui la portent. Il reste offert à part, pour WhatsApp ou toute
//    autre application.
// 2. *Impossible de changer d'avis.* Le canal venait de la fiche du client et
//    ne se rediscutait plus ici. « Si je veux l'envoyer par e-mail, je ne peux
//    pas revenir le choisir. » Les deux voies sont désormais offertes, et si la
//    coordonnée manque, elle se saisit sur place — il n'existe aucun autre
//    écran pour la renseigner, et renvoyer le patron « sur la fiche du client »
//    l'enverrait vers une porte qui n'existe pas.
//
// Ce que cela ne donne PAS, et qui reste au point 5 : Atlas ne sait pas que le
// message est parti, donc pas de relance automatique à sept jours. La réponse
// du client, elle, revient normalement — il répond sur la page web.

type Props = {
  clientId: string | null;
  clientNom: string;
  /** Ce qu'il a choisi au-dessus du nom (migration 0038). */
  clientCivilite: Civilite | null;
  entrepriseNom: string;
  /** Le canal convenu sur la fiche du client — un défaut, pas une contrainte. */
  canal: CanalClient;
  telephone: string;
  email: string;
  lien: string;
  /** Le PDF du devis, pour la ligne des trois actions. */
  lienPdf: string;
  nomFichierPdf: string;
  /** Le devis est-il DÉJÀ chez le client ? Commande le libellé du bouton. */
  relance: boolean;
};

// **Le libellé dit ce que le geste FAIT, et ce n'est pas la même chose selon
// que le devis est déjà parti ou non.** « Ouvrir le SMS tout prêt » décrit le
// premier envoi ; devant un devis que le client a déjà en main, il fait croire
// qu'on va lui en envoyer un second. C'est « relancer » — le même lien, tel
// quel — et c'est le mot que le patron a retenu sur la maquette 34.
const LIBELLE: Record<
  CanalClient,
  { bouton: string; relance: string; bascule: string; champ: string; exemple: string; manque: string; invite: string }
> = {
  sms: {
    bouton: "Ouvrir le SMS tout prêt",
    relance: "Relancer par SMS",
    bascule: "Plutôt par SMS",
    champ: "Numéro de téléphone",
    exemple: "06 12 34 56 78",
    manque: "n'a pas de numéro enregistré",
    invite: "saisissez-le ci-dessous.",
  },
  email: {
    bouton: "Ouvrir l'e-mail tout prêt",
    relance: "Relancer par e-mail",
    bascule: "Plutôt par e-mail",
    champ: "Adresse e-mail",
    exemple: "client@exemple.fr",
    manque: "n'a pas d'adresse e-mail enregistrée",
    invite: "saisissez-la ci-dessous.",
  },
};

export default function TransmettreAuClient({
  clientId,
  clientNom,
  clientCivilite,
  entrepriseNom,
  canal,
  telephone,
  email,
  lien,
  lienPdf,
  nomFichierPdf,
  relance,
}: Props) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [coordonnees, setCoordonnees] = useState<Record<CanalClient, string>>({ sms: telephone, email });
  // Le canal retenu ici prime sur celui de la fiche : le patron change d'avis
  // au moment d'envoyer, pas au moment de créer le chantier.
  const [canalChoisi, setCanalChoisi] = useState<CanalClient>(canal);
  const [saisie, setSaisie] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  // **Ramener le patron chez lui, avec un mot.**
  //
  // Le 7 août 2026 : « lorsque j'envoie le SMS et que je reviens sur la page, il
  // faut que la page se remette sur la première page automatiquement, avec un
  // petit message ». Aujourd'hui il revenait sur l'écran du devis, identique à
  // ce qu'il avait quitté — rien ne disait que quelque chose s'était passé.
  //
  // Le retour se détecte par `visibilitychange` : iOS ne recharge pas la page
  // quand on revient de Messages, il la réveille. Aucun événement de navigation
  // ne se produit, et un `focus` seul se déclenche aussi en changeant d'onglet
  // sans jamais être parti.
  useRetourDeMessagerie();

  const message = composerMessageClient({ clientNom, clientCivilite, entrepriseNom, lien });
  const autre: CanalClient = canalChoisi === "sms" ? "email" : "sms";
  const destinataire = coordonnees[canalChoisi];

  /**
   * L'adresse `sms:` ou `mailto:`, destinataire compris.
   *
   * Portée par un vrai lien plutôt que par `window.location.href` : elle
   * devient alors **lisible dans la page**, donc vérifiable. Le défaut d'hier —
   * un message ouvert sans destinataire — ne se voyait nulle part ailleurs que
   * dans la messagerie du patron, c'est-à-dire trop tard.
   */
  function adresse(canalCible: CanalClient, cible: string) {
    return lienTransmission({ canal: canalCible, destinataire: cible, message });
  }

  async function partagerAutrement() {
    setErreur(null);
    // Le partage n'emporte aucun destinataire — c'est exactement pour cela
    // qu'il n'est plus le chemin principal. Il reste utile pour WhatsApp,
    // Signal, ou tout ce que le patron a installé.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: message.objet, text: message.corps });
      } catch (e) {
        // Un partage annulé n'est pas une panne : le patron a changé d'avis.
        if (e instanceof Error && e.name === "AbortError") return;
        setErreur("Le partage n'a pas abouti. Le lien reste copiable ci-dessus.");
      }
      return;
    }
    setErreur("Le partage n'est pas disponible sur cet appareil. Le lien reste copiable ci-dessus.");
  }

  async function enregistrerEtOuvrir() {
    const valeur = saisie.trim();
    if (!valeur) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      // Conservée sur la fiche du client, pas seulement pour cet envoi : la
      // ressaisir au chantier suivant serait le même geste perdu deux fois.
      if (clientId) await enregistrerCoordonneeClientAction(clientId, canalChoisi, valeur);
      setCoordonnees((c) => ({ ...c, [canalChoisi]: valeur }));
      setSaisie("");
      // La coordonnée vient d'être saisie : aucun lien de la page ne la portait
      // encore. On en fabrique un et on le déclenche — `location.assign` plutôt
      // qu'une écriture sur `location.href`, que le lint interdit à raison.
      marquerDepartMessagerie("devis", clientNom);
      window.location.assign(adresse(canalChoisi, valeur));
    } catch {
      setErreur("La coordonnée n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <>
      {destinataire ? (
        <>
          <a
            href={adresse(canalChoisi, destinataire)}
            data-transmission={canalChoisi}
            onClick={() => marquerDepartMessagerie("devis", clientNom)}
            className="block w-full rounded-full py-3 text-center text-[15px] font-medium text-white"
            style={{ backgroundColor: colors.rust }}
          >
            {relance ? LIBELLE[canalChoisi].relance : LIBELLE[canalChoisi].bouton}
          </a>
          {/* Dire à qui : le patron doit voir le destinataire AVANT d'ouvrir sa
              messagerie, pas le découvrir dedans.
              La phrase est d'un seul tenant : coupée en morceaux, JSX avalait
              l'espace avant le tiret et affichait « Au 0679984514— c'est vous ».
              Même défaut que « Créer la facture » en haut de la fiche.

              **Le numéro est espacé** (`numeroLisible`) : collé, il se vérifiait
              chiffre par chiffre ou pas du tout. Le lien `sms:`, lui, continue
              de porter le numéro brut — c'est `lienTransmission` qui retire les
              espaces, et non cette ligne. */}
          <p className="mt-2 text-center text-[12px]" style={{ color: colors.muted }}>
            {`${canalChoisi === "sms" ? "Au" : "À"} ${destinataireLisible(canalChoisi, destinataire)} — c'est vous qui l'envoyez.`}
          </p>
        </>
      ) : (
        <p className="mt-3 text-center text-[13px]" style={{ color: colors.muted }}>
          {/* La phrase entière par canal, et non des morceaux recollés : « pas
              d'adresse e-mail enregistré — saisissez-le » cumulait deux fautes
              d'accord. Le patron relève ce genre de chose, et il a raison. */}
          {clientNom} {LIBELLE[canalChoisi].manque}
          {clientId ? ` — ${LIBELLE[canalChoisi].invite}` : "."}
        </p>
      )}

      {!destinataire && clientId && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            inputMode={canalChoisi === "sms" ? "tel" : "email"}
            placeholder={LIBELLE[canalChoisi].exemple}
            aria-label={LIBELLE[canalChoisi].champ}
            className="w-full rounded-[4px] border-0 px-4 py-3 outline-none"
            style={{ backgroundColor: colors.cream, color: colors.ink, fontSize: "16px" }}
          />
          <PrimaryButton
            onClick={enregistrerEtOuvrir}
            disabled={enregistrement || saisie.trim() === ""}
          >
            {enregistrement ? "Enregistrement…" : "Enregistrer et ouvrir le message"}
          </PrimaryButton>
        </div>
      )}

      {/* Changer d'avis. Toujours présent, jamais présélectionné : la voie
          normale reste celle convenue avec le client sur sa fiche.

          **Il a failli disparaître, et ce serait une régression.** Aucune des
          cinq mises en page de la maquette 34 ne le portait — je l'avais omis.
          Or c'est une demande explicite du 4 août : « si je veux l'envoyer par
          e-mail, je ne peux pas revenir le choisir ». Il reprend donc sa place
          juste sous la ligne du destinataire, qui nomme déjà le canal — c'est
          là qu'on se rend compte qu'on s'est trompé de voie. */}
      <button
        type="button"
        onClick={() => {
          setCanalChoisi(autre);
          setSaisie("");
          setErreur(null);
        }}
        className="mt-3 block w-full text-center text-[15px] font-semibold"
        // **L'or, et non le gris — sa demande du 13 août.** Il était en gris
        // 13 px sous la ligne du destinataire, et se lisait comme une mention
        // légale : « il faut le mettre en gras ou en doré, et légèrement plus
        // gros ». L'or est la couleur de ce qu'on LIT dans la charte, mais
        // c'est ici le seul endroit où il porte un geste — assumé : cette ligne
        // n'est pas une action de plus, c'est la MÊME action par l'autre voie.
        // Quinze pixels : deux de plus que la rangée du dessous, un de moins
        // que le bouton plein. Elle se voit sans disputer la place.
        style={{ color: colors.or }}
      >
        {LIBELLE[autre].bascule} →
      </button>

      {/* **Les actions secondaires, en encre foncée — sa demande du 12 août.**
          Elles étaient dispersées : « Copier le lien » vivait dans l'écran,
          « Partager » ici, et le PDF plus haut. Autant d'endroits à retoucher
          le jour où l'un change. Elles tiennent maintenant une seule ligne.

          **Elles ne sont plus que deux depuis le 13 août** : *« je pense qu'il
          faudrait aussi retirer copier le lien, ça ne sert à rien »*. Il a
          raison — le lien part par le SMS, par l'e-mail ou par « Partager », et
          le presse-papier n'était qu'un quatrième chemin vers la même chose.

          Le point médian n'est pas un ornement : trois libellés séparés par du
          blanc se lisent comme une phrase découpée, et on ne sait plus où finit
          l'un. Il est `aria-hidden` — un lecteur d'écran annoncerait « point ».

          « Partager » plutôt que « Partager autrement (WhatsApp…) » : à trois sur
          une ligne de 390 px, la parenthèse débordait. L'arbitrage est dans la
          maquette 34. */}
      <div
        className="mt-3 flex items-center justify-center text-[13px]"
        style={{ color: colors.ink }}
      >
        <a
          href={lienPdf}
          download={nomFichierPdf}
          className="px-2 font-medium"
        >
          Télécharger le PDF
        </a>
        <span aria-hidden="true" style={{ color: colors.line }}>
          ·
        </span>
        <button
          type="button"
          onClick={partagerAutrement}
          className="px-2 font-medium"
          style={{ color: colors.ink }}
        >
          Partager
        </button>
      </div>

      {erreur && (
        <p role="alert" className="mt-2 text-center text-[13px]" style={{ color: colors.rust }}>
          {erreur}
        </p>
      )}
    </>
  );
}



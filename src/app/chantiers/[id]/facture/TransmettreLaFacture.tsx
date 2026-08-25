"use client";

import { useState } from "react";
import PrimaryButton from "@/components/atlas/PrimaryButton";
import { colors } from "@/lib/design-tokens";
import { composerMessageFacture, lienTransmission, type CanalClient } from "@/lib/message-client";
import { marquerDepartMessagerie } from "@/lib/depart-messagerie";
import { enregistrerCoordonneeClientAction } from "../export/actions";
import { preparerLienFactureAction } from "./actions";

// **« On ne propose que le SMS. »**
//
// Le patron, le 10 août 2026, capture à l'appui (`TODO.md` §8). L'écran de la
// facture prenait le canal de la fiche du client et n'en démordait plus : un
// client sans portable — donc un client sur deux — ne pouvait tout simplement
// pas être facturé. Le devis, lui, offrait le choix depuis le 4 août
// (`TransmettreAuClient.tsx`) ; c'est la même infirmité qui avait été corrigée
// là-bas, et elle est restée ici deux semaines de plus.
//
// **Ce qui est partagé, et pourquoi rien n'est recopié.** Le message part de
// `composerMessageFacture`, l'adresse de `lienTransmission`, la coordonnée
// s'enregistre par `enregistrerCoordonneeClientAction` — la même que l'écran du
// devis. Deux implémentations d'un même geste finissent toujours par diverger,
// et c'est le client qui lit la mauvaise (`CLAUDE.md` §3).
//
// **Le bouton est la capsule, et c'est son choix du 12 août 2026** — « code
// la A », parmi les cinq gestes de
// `docs/maquettes/39-le-bouton-de-la-facture-a-lessai.html` (`TODO.md` §8,
// point 2). Il était le dernier de cet écran dessiné sur place, ce qui l'avait
// fait manquer la décision du 11 août. **Ne pas le repeindre ici** : une action
// principale dessinée à la main échappe à toute décision d'ensemble, et c'est
// par là que le défaut reviendrait.

const LIBELLE: Record<
  CanalClient,
  { bouton: string; bascule: string; champ: string; exemple: string; manque: string; invite: string }
> = {
  sms: {
    // **Sa demande du 24 août 2026 :** *« corrige en envoyer par SMS, retire la
    // flèche »*. « Ouvrir le SMS tout prêt » décrivait le mécanisme — ce qui
    // s'ouvre — au lieu du geste. Et la flèche promettait un écran de plus.
    bouton: "Envoyer par SMS",
    bascule: "Envoyer par SMS",
    champ: "Numéro de téléphone",
    exemple: "06 12 34 56 78",
    manque: "n'a pas de numéro enregistré",
    invite: "saisissez-le ci-dessous.",
  },
  email: {
    bouton: "Envoyer par e-mail",
    bascule: "Envoyer par e-mail",
    champ: "Adresse e-mail",
    exemple: "client@exemple.fr",
    manque: "n'a pas d'adresse e-mail enregistrée",
    invite: "saisissez-la ci-dessous.",
  },
};

export default function TransmettreLaFacture({
  factureId,
  clientId,
  clientNom,
  clientCivilite,
  entrepriseNom,
  modeleMessage,
  numeroFacture,
  echeanceLisible,
  canal,
  jetonInitial = null,
  telephone,
  email,
  origine,
}: {
  factureId: string;
  clientId: string | null;
  clientNom: string;
  clientCivilite: "mr" | "mme" | null;
  entrepriseNom: string;
  /**
   * Son gabarit de message, écrit dans « Devis & factures ». `null` : Atlas.
   *
   * **`modeleMessage`, jamais `messageClient`** : ce nom est pris ailleurs dans
   * l'application, où il désigne le mot laissé par le CLIENT — l'inverse.
   */
  modeleMessage: string | null;
  numeroFacture: string;
  echeanceLisible: string | null;
  /** Le canal convenu sur la fiche du client — un défaut, jamais une contrainte. */
  canal: CanalClient;
  /** Le lien déjà préparé par l'envoi, s'il existe : évite un second appui. */
  jetonInitial?: string | null;
  telephone: string;
  email: string;
  /** Adresse complète du site, bâtie côté serveur : un chemin seul ne s'ouvre nulle part. */
  origine: string;
}) {
  const [canalChoisi, setCanalChoisi] = useState<CanalClient>(canal);
  const [coordonnees, setCoordonnees] = useState<Record<CanalClient, string>>({ sms: telephone, email });
  const [saisie, setSaisie] = useState("");
  // **Jamais `useState(jetonInitial)` — le piège coûte un appui.**
  //
  // L'envoi arrête la facture, ce qui MONTE ce composant (avec `jetonInitial`
  // encore nul), puis rafraîchit l'écran. Un état initialisé une fois ignore la
  // valeur qui arrive ensuite : l'écran redemandait donc de préparer un lien
  // déjà prêt. On dérive, pour que la prop rafraîchie soit lue.
  const [jetonLocal, setJeton] = useState<string | null>(null);
  const jeton = jetonLocal ?? jetonInitial;
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const autre: CanalClient = canalChoisi === "sms" ? "email" : "sms";
  const destinataire = coordonnees[canalChoisi];
  const lienFacture = jeton ? `${origine}/factures/${jeton}` : null;

  /**
   * L'adresse `sms:` ou `mailto:`, destinataire compris.
   *
   * Portée par un vrai lien plutôt que par `window.location.href` : elle devient
   * alors lisible dans la page, donc vérifiable. Un message qui s'ouvre sans
   * destinataire ne se voit sinon que dans la messagerie du patron — trop tard.
   */
  function adresse(cible: string, canalCible: CanalClient = canalChoisi): string {
    if (!lienFacture) return "";
    return lienTransmission({
      canal: canalCible,
      destinataire: cible,
      message: composerMessageFacture({
        clientCivilite,
        clientNom,
        entrepriseNom,
        modele: modeleMessage,
        numeroFacture,
        echeanceLisible,
        lien: lienFacture,
      }),
    });
  }

  /** Prépare le lien, ou retrouve celui qui existe déjà. Rend le jeton, ou rien. */
  async function preparerLien(canalVoulu: CanalClient): Promise<string | null> {
    const r = await preparerLienFactureAction(factureId, canalVoulu);
    if (!r.succes) {
      setErreur(r.erreur);
      return null;
    }
    setJeton(r.jeton);
    return r.jeton;
  }

  async function envoyer() {
    setEnCours(true);
    setErreur(null);
    try {
      await preparerLien(canalChoisi);
    } catch {
      setErreur("Le lien de la facture n'a pas pu être préparé.");
    } finally {
      setEnCours(false);
    }
  }

  async function basculer() {
    setCanalChoisi(autre);
    setSaisie("");
    setErreur(null);
    // Le lien ne change pas de jeton — c'est le registre qui doit dire par où
    // la facture part réellement. Sans cela, une facture envoyée par courriel
    // resterait inscrite « SMS » pour toujours.
    if (jeton) {
      try {
        await preparerLienFactureAction(factureId, autre);
      } catch {
        // Le patron n'a rien à faire de cet échec : son message part quand même,
        // et le canal enregistré n'est qu'une trace. Le taire vaut mieux que
        // l'alarmer sur ce qui ne l'empêche de rien.
      }
    }
  }

  async function enregistrerEtOuvrir() {
    const valeur = saisie.trim();
    if (!valeur) return;
    setEnCours(true);
    setErreur(null);
    try {
      // Conservée sur la fiche du client, pas seulement pour cet envoi : la
      // ressaisir au chantier suivant serait le même geste perdu deux fois.
      // Et il n'existe aucun autre écran pour la renseigner — renvoyer le
      // patron « sur la fiche du client » l'enverrait vers une porte fermée.
      if (clientId) await enregistrerCoordonneeClientAction(clientId, canalChoisi, valeur);
      setCoordonnees((c) => ({ ...c, [canalChoisi]: valeur }));
      setSaisie("");
      const jetonPret = jeton ?? (await preparerLien(canalChoisi));
      if (!jetonPret) return;
      // La coordonnée vient d'être saisie : aucun lien de la page ne la portait
      // encore. On en fabrique un et on le déclenche — `location.assign` plutôt
      // qu'une écriture sur `location.href`, que le lint interdit à raison.
      marquerDepartMessagerie("facture", clientNom);
      window.location.assign(
        lienTransmission({
          canal: canalChoisi,
          destinataire: valeur,
          message: composerMessageFacture({
        clientCivilite,
            clientNom,
            entrepriseNom,
        modele: modeleMessage,
            numeroFacture,
            echeanceLisible,
            lien: `${origine}/factures/${jetonPret}`,
          }),
        })
      );
    } catch {
      setErreur("La coordonnée n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {lienFacture && destinataire ? (
        <>
          {/* Même geste que pour le devis : on retient le départ vers la
              messagerie, et le retour ramène à l'accueil avec un mot
              (`src/lib/annonce-transmission.ts`). La phrase diffère — une
              facture n'attend pas de réponse.

              **La capsule, choisie par le patron le 12 août 2026** parmi les
              cinq gestes de `docs/maquettes/39-le-bouton-de-la-facture-a-lessai.html`.
              Ce bouton était le dernier de l'écran à être dessiné SUR PLACE —
              un aplat à 4 px de rayon — et c'est pour cela qu'il avait manqué
              la décision du 11 août (« la capsule, partout »). Il passe donc
              par `PrimaryButton`, jamais par un dessin recopié ici : c'est très
              exactement le défaut qu'on répare, et le repeindre à la main le
              ferait revenir au prochain changement de charte. */}
          <PrimaryButton
            href={adresse(destinataire)}
            onClick={() => marquerDepartMessagerie("facture", clientNom)}
            repere={`transmission-${canalChoisi}`}
          >
            {LIBELLE[canalChoisi].bouton}
          </PrimaryButton>
          {/* **Le destinataire et le lien qui vivaient ici sont RETIRÉS** — sa
              demande du 24 août 2026 : *« pareil sous ouvrir le SMS tout prêt »*,
              après *« tout ce qui est en gris, supprime »*.

              Ce qu'on perd, et qu'il faut savoir avant de le rétablir : il ne
              voit plus À QUI le message part avant d'ouvrir sa messagerie. Sa
              messagerie le lui montre juste après, et il peut encore reculer —
              rien n'est envoyé par Atlas. C'est son arbitrage, pas un oubli. */}
        </>
      ) : lienFacture ? (
        <p className="text-center text-[13px]" style={{ color: colors.muted }}>
          {/* La phrase entière par canal, et non des morceaux recollés : « pas
              d'adresse e-mail enregistré — saisissez-le » cumulait deux fautes
              d'accord. Le patron relève ce genre de chose, et il a raison. */}
          {clientNom || "Ce client"} {LIBELLE[canalChoisi].manque}
          {clientId ? ` — ${LIBELLE[canalChoisi].invite}` : "."}
        </p>
      ) : (
        <>
          <p className="mb-3 text-center text-[13px]" style={{ color: colors.muted }}>
            Votre client ne l&apos;a pas encore reçue.
          </p>
          <PrimaryButton disabled={enCours} onClick={envoyer}>
            {enCours ? "Préparation…" : "Envoyer la facture au client"}
          </PrimaryButton>
        </>
      )}

      {lienFacture && !destinataire && clientId && (
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
          <PrimaryButton onClick={enregistrerEtOuvrir} disabled={enCours || saisie.trim() === ""}>
            {enCours ? "Enregistrement…" : "Enregistrer et ouvrir le message"}
          </PrimaryButton>
        </div>
      )}

      {/* ── L'AUTRE VOIE, collée sous la première ──────────────────────────
          Sa demande du 24 août 2026 : *« corrige envoyé par e-mail en gras
          doré, colle-le sous envoyer par SMS »*.

          **ET IL ENVOIE POUR DE BON, il ne bascule plus.** C'est la condition
          pour que ce libellé soit vrai : appeler un bouton « Envoyer par
          e-mail » alors qu'il se contente d'intervertir deux boutons, c'est un
          écran qui ment — il appuie, rien ne s'ouvre, et il appuie encore.
          Quand le client a l'adresse, ce lien ouvre le courriel tout prêt,
          exactement comme la capsule au-dessus fait pour le SMS.

          **Sans coordonnée, il bascule encore** — et c'est le seul cas où il le
          doit : c'est ainsi que le champ de saisie apparaît, et sans lui la
          voie serait fermée pour toujours. */}
      {lienFacture && coordonnees[autre] ? (
        <a
          href={adresse(coordonnees[autre], autre)}
          onClick={() => {
            marquerDepartMessagerie("facture", clientNom);
            // Le registre doit dire par où la facture est REELLEMENT partie.
            // L'échec ne le concerne pas : son message part quand même.
            void preparerLienFactureAction(factureId, autre).catch(() => undefined);
          }}
          data-bascule-canal={autre}
          className="mt-2 block w-full text-center text-[15px] font-bold"
          style={{ color: colors.or }}
        >
          {LIBELLE[autre].bascule}
        </a>
      ) : (
        <button
          type="button"
          onClick={basculer}
          data-bascule-canal={autre}
          className="mt-2 block w-full text-center text-[15px] font-bold"
          style={{ color: colors.or }}
        >
          {LIBELLE[autre].bascule}
        </button>
      )}

      {erreur && (
        <p role="alert" className="mt-2 text-center text-[13px]" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}
    </>
  );
}

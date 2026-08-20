"use client";

import { composerMessageClient, lienTransmission } from "@/lib/message-client";
import type { CiviliteChoisie } from "@/lib/civilite";

/**
 * **UNE seule façon d'ouvrir sa messagerie, et elle vit ici.**
 *
 * Elle habitait l'écran d'envoi (`ExportClient`) jusqu'au 20 août 2026, parce
 * que c'est de là que partait le devis. Depuis que « Choisir la date » ouvre la
 * feuille sur le DEVIS lui-même (`ARCHITECTURE.md` §136), le départ a changé
 * d'écran — et cette ouverture doit le suivre, sans être recopiée.
 *
 * La recopier aurait donné deux façons d'écrire au client, et c'est exactement
 * là que se logent les défauts déjà payés : un numéro espacé qui ouvre un SMS
 * sans destinataire, un lien collé au texte qui n'est pas cliquable
 * (`CLAUDE.md` §3 — jamais de règle dupliquée).
 */
export type OuvertureMessagerie = {
  /** Le chemin du lien client, tel que l'envoi vient de le rendre. */
  chemin: string;
  /** L'origine complète, bâtie côté serveur : un chemin seul ne s'ouvre nulle part. */
  origine: string;
  canalClient: "sms" | "email";
  clientTelephone: string;
  clientEmail: string;
  clientNom: string;
  clientCivilite: CiviliteChoisie;
  entrepriseNom: string;
};

/**
 * Ouvrir SA messagerie **dès l'appui sur « Envoyer le devis »**.
 *
 * *Sa demande du 18 août 2026 : « quand je clique sur le bouton envoyer le
 * devis, tout de suite ça m'ouvre l'application, soit SMS soit email […]
 * supprime les étapes qu'il y a entre ».* Il avait raison de la faire : le
 * devis était prêt, le message était prêt, et il fallait encore viser un
 * second bouton sur l'écran suivant.
 *
 * **Le message et l'adresse viennent du module commun** — les refaire ici
 * donnerait deux façons d'écrire au client, et c'est là que se logent les
 * défauts payés : un numéro espacé qui ouvre un SMS sans destinataire, un
 * lien collé au texte qui n'est pas cliquable (`src/lib/message-client.ts`).
 *
 * ─── CE QUI RESTE DERRIÈRE, ET POURQUOI ON NE L'A PAS RETIRÉ ───────────────
 * L'ouverture part d'une continuation asynchrone : l'envoi doit d'abord
 * aboutir en base pour qu'un lien existe. Or un navigateur peut refuser une
 * navigation vers `sms:` qui ne suit pas immédiatement le doigt — et sur
 * iOS, il la refuse **sans un mot**.
 *
 * L'écran « Devis prêt » reste donc en place, avec son bouton. S'il s'ouvre,
 * le patron ne le voit qu'au retour de Messages — c'est là qu'il doit être
 * de toute façon. S'il ne s'ouvre pas, il retrouve exactement l'écran
 * d'aujourd'hui, et rien n'est perdu. Le contraire — retirer le bouton en
 * pariant sur l'ouverture — serait la quatrième fois qu'il appuie sur
 * quelque chose qui ne répond pas.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function ouvrirLaMessagerie({
  chemin,
  origine,
  canalClient,
  clientTelephone,
  clientEmail,
  clientNom,
  clientCivilite,
  entrepriseNom,
}: OuvertureMessagerie) {
  const destinataire = canalClient === "sms" ? clientTelephone : clientEmail;
  // Sans coordonnée, il n'y a rien à ouvrir — l'écran de repli la demande.
  // (L'envoi est d'ailleurs déjà bloqué en amont dans ce cas.)
  if (!destinataire.trim()) return;

  const message = composerMessageClient({
    clientNom,
    clientCivilite,
    entrepriseNom,
    lien: `${origine}${chemin}`,
  });
  // **Aucune marque de départ ici, et c'est mesuré, pas supposé.** Le bandeau
  // « Devis transmis à … » s'arme sur le bouton de l'écran suivant, où le
  // geste EST le départ. Ici l'ouverture peut être refusée sans un mot, et
  // aucun événement du navigateur ne distingue « parti vers Messages » de
  // « changé d'écran » — le détail de la mesure est dans
  // `src/lib/depart-messagerie.ts`. Annoncer un envoi qui n'a pas eu lieu
  // serait pire que ne rien annoncer.

  // **Un vrai lien qu'on touche pour lui, et non `location.assign`.** Deux
  // raisons, et la seconde suffirait :
  //   · c'est EXACTEMENT le mécanisme du bouton de l'écran suivant, celui qui
  //     fonctionne sur son téléphone depuis le 4 août. Ouvrir la messagerie
  //     par un autre chemin, c'est se donner un second comportement à
  //     éprouver — et un seul des deux le serait ;
  //   · l'adresse devient LISIBLE dans la page, donc vérifiable. Le défaut
  //     d'hier — un message ouvert sans destinataire — ne se voyait nulle
  //     part ailleurs que dans sa messagerie, c'est-à-dire trop tard
  //     (`TransmettreAuClient`, même argument).
  //
  // Le lien reste dans le document après l'appui : le retirer aussitôt
  // annulerait la navigation sur certains navigateurs, et priverait le
  // contrôle de la seule trace qu'il puisse lire.
  ouvrirAdresse(lienTransmission({ canal: canalClient, destinataire, message }), canalClient);
}

/**
 * La mécanique nue : toucher pour lui un lien `sms:` ou `mailto:`.
 *
 * **Extraite le 20 août 2026**, quand la fiche de chantier a eu besoin du même
 * geste pour son compte rendu (`FicheChantierClient`). Le message, lui, n'est
 * pas le même — un devis n'est pas un compte rendu de passage —, mais la façon
 * d'ouvrir doit l'être : deux mécaniques d'ouverture, ce serait deux
 * comportements à éprouver sur son téléphone, et un seul le serait.
 *
 * Le raisonnement complet — pourquoi un lien plutôt que `location.assign`, et
 * pourquoi il reste dans le document — est juste au-dessus.
 */
export function ouvrirAdresse(adresse: string, canal: "sms" | "email"): void {
  if (typeof document === "undefined") return;
  const porte = document.createElement("a");
  porte.href = adresse;
  porte.setAttribute("data-transmission-directe", canal);
  porte.style.display = "none";
  document.body.appendChild(porte);
  porte.click();
}

"use client";

import { useActionState, useRef, useState } from "react";
import { repondreAction } from "./actions";
import type { EnvoiPourClient } from "@/server/repositories/envois-devis";
import { joursEnToutesLettres, dansDelaiRetractation } from "@/lib/jour";
import {
  libelleAutreDate,
  libelleRetenir,
  phraseDureeDesTravaux,
  refusDesJoursRetenus,
} from "@/lib/libelle-dates";
import { toucherUnJourDuClient } from "@/lib/propositions-de-jours";
import Calendrier from "@/components/atlas/Calendrier";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, voile } from "@/lib/design-tokens";

export default function FormulaireReponse({
  envoi,
  aujourdHui,
}: {
  envoi: EnvoiPourClient;
  aujourdHui: string;
}) {
  const [etat, action, enCours] = useActionState(repondreAction, undefined);
  const [choixDate, setChoixDate] = useState<string>("");
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * **ELLE POSE SES JOURS, PAS UNE DATE — sa demande du 20 septembre 2026 :**
   * *« lorsqu'elle clique sur proposer des jours, s'il y a plusieurs jours il
   * faut mettre le même système que nous : les 4 dates s'affichent, elle
   * clique sur un jour sélectionné pour le désélectionner et reclique ailleurs
   * pour le déplacer »*.
   *
   * C'était un seul jour jusqu'ici. Sur un chantier de quatre jours, elle
   * proposait donc une date que le serveur étalait en bloc d'affilée derrière
   * elle — sans qu'elle voie jamais les quatre jours qu'elle engageait.
   *
   * **Le geste vient de SON écran d'envoi à lui**, `toucherUnJourDuClient`,
   * qui n'est que `toucherUnJour` avec une seule proposition autorisée : deux
   * façons de poser un bloc finiraient par diverger (`CLAUDE.md` §3).
   * ═══════════════════════════════════════════════════════════════════════
   */
  const [joursAutres, setJoursAutres] = useState<string[]>([]);
  const [precision, setPrecision] = useState<string>("");
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * **LE CALENDRIER MONTE DU BAS — sa réponse A, le 4 septembre 2026.**
   *
   * Sa règle du 31 août : *« je veux que le choix de la date qui arrive au
   * client par SMS tienne sur une seule page ! Il ne doit pas avoir à scroll
   * pour voir toutes les infos »*. Elle tenait — tant que la
   * contre-proposition restait repliée. Ouverte, mesuré sur son écran de
   * 390 × 664 : la page passait à **990 px**, et ses trois issues finissaient
   * à 963 px, sous le pli. C'est-à-dire hors de vue à l'instant précis où le
   * client cherche une autre date — le moment où ce parcours évite
   * l'aller-retour téléphonique.
   *
   * Trois formes lui ont été soumises (`appli/ecran-de-son-client.html`), les
   * trois mesurées comme tenant dans l'écran. Il a retenu **la feuille** : le
   * calendrier monte par-dessus, et la page derrière garde exactement la
   * hauteur qu'elle avait.
   *
   * **C'est la feuille de la maison** (`BottomSheet`), pas une seconde : en
   * écrire une autre aurait donné deux tiroirs à tenir d'accord
   * (`CLAUDE.md` §3). Elle ne porte aucune couleur de l'artisan — cette page
   * n'en reçoit aucune (`layout.tsx`, `estPageDuClient`), et ses jetons
   * retombent sur la charte d'origine.
   * ═══════════════════════════════════════════════════════════════════════
   */
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * **ON NE FERME PLUS UN DEVIS D'UN SEUL DOIGT — sa réponse « la A », le
   * 20 septembre 2026**, devant `appli/le-refus-par-erreur.html`.
   *
   * Ce qui l'a provoquée, de sa main : *« j'ai sans faire exprès cliqué sur je
   * ne donne pas suite, aucun moyen d'annuler, il faut mettre une sécurité
   * avant l'envoi »*. Il n'y en avait aucune, et il n'y a pas de retour :
   * `enregistrerReponse` refuse toute seconde réponse (`deja_repondu`), et la
   * page ne rend plus que « Réponse enregistrée ».
   *
   * **Pourquoi ce bouton-là, et lui seul.** Des trois issues, c'est la seule à
   * la fois irrattrapable et coûteuse. « Une correction » ne part déjà pas sans
   * un mot écrit (`message_manquant`). « J'accepte » ne perd rien : il reste le
   * téléphone, et le devis est signé de toute façon.
   *
   * **La feuille, et non un second bouton sur place** : trois formes lui ont
   * été montrées, et celle-ci ne coûte aucun pixel à une page qui n'en a plus
   * (sa règle du 31 août). Un dédoublement sur place ferait apparaître
   * « Confirmer » sous le doigt qui vient d'appuyer.
   * ═══════════════════════════════════════════════════════════════════════
   */
  const [confirmationRefus, setConfirmationRefus] = useState(false);
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * **LA LISTE SE REPLIE UNE FOIS LES JOURS RETENUS — son choix du
   * 4 septembre.**
   *
   * La feuille avait ramené la page de 990 à 664 px. Restait un cas : une date
   * à moins de quatorze jours fait apparaître la case de rétractation — 125 px
   * — et la page repassait à **790 px** pour 664 d'écran.
   *
   * Deux façons d'y arriver lui ont été soumises. Il a retenu celle-ci : une
   * fois ses jours retenus au calendrier, les dates proposées et la ligne
   * « je propose » n'ont plus rien à décider — elles cèdent la place à ce
   * qu'elle a choisi.
   *
   * **Rien ne se perd : « changer » redéplie la liste entière**, d'où l'on peut
   * reprendre une date proposée aussi bien que rouvrir le calendrier. Une liste
   * repliée sans retour ferait d'un simple appui un choix définitif.
   *
   * **Et le choix continue de partir au serveur.** Repliés, les boutons radio
   * quittent le document : un champ caché prend le relais, sans quoi le
   * formulaire n'enverrait plus AUCUN choix de date.
   * ═══════════════════════════════════════════════════════════════════════
   */
  const [listeDepliee, setListeDepliee] = useState(false);
  const listeRepliee = choixDate === "autre" && joursAutres.length > 0 && !listeDepliee;
  /**
   * Ce que la page refuse d'elle-même, sans aller au serveur.
   *
   * Une demande de correction sans un mot obligerait le patron à rappeler,
   * c'est-à-dire à refaire l'aller-retour que tout ce parcours supprime. Le
   * dépôt le refuse déjà (motif `message_manquant`) — la règle reste là-bas,
   * seule la phrase est ici.
   */
  const [refus, setRefus] = useState<string | null>(null);
  const champMessage = useRef<HTMLTextAreaElement>(null);

  const joursDe = (d: string) => envoi.joursProposes?.[envoi.datesProposees.indexOf(d)] ?? [d];
  /**
   * **COMBIEN DE JOURS LE CHANTIER PREND — lu sur ce qu'il a proposé, jamais
   * sur une durée.**
   *
   * Le client ne reçoit ni créneau ni durée : c'est une consigne du patron,
   * tenue par un contrôle qui inspecte la charge envoyée à cette page
   * (`test-creneaux-planning.ts`). Les jours proposés, eux, sont déjà écrits
   * sous ses yeux — leur compte suffit, et il ne lui apprend rien de plus.
   */
  const nombreDeJours = Math.max(
    1,
    ...envoi.datesProposees.map((d) => joursDe(d).length)
  );
  const plusieursJours = nombreDeJours > 1;
  const phraseDuree = phraseDureeDesTravaux(nombreDeJours);

  const joursEffectifs = choixDate === "autre" ? joursAutres : choixDate ? joursDe(choixDate) : [];
  const premierJour = joursEffectifs[0] ?? "";

  /**
   * Retoucher un choix déjà coché le DÉFAIT — sa demande du 26 août 2026 :
   * *« si par erreur j'ai sélectionné un des 3 champs je ne peux plus le
   * désélectionner »*.
   *
   * **Un bouton radio ne se défait pas, par construction** : le navigateur ne
   * connaît que « passer de l'un à l'autre ». Le client qui touche la mauvaise
   * ligne restait donc engagé sur une date qu'il n'a pas choisie — et c'est SA
   * date de chantier qui en dépend.
   *
   * **Pourquoi `onClick` et pas `onChange`** : sur une case déjà cochée, le
   * navigateur ne signale AUCUN changement, donc `onChange` ne se déclenche
   * jamais. `onClick`, lui, part à chaque appui.
   *
   * **Et pourquoi la comparaison tient** : React ne repeint pas entre les deux
   * gestionnaires d'un même événement. `choixDate` porte donc encore la valeur
   * d'AVANT l'appui — sur une case neuve elle diffère et l'on ne défait rien,
   * sur la case déjà cochée elle est égale et l'on vide. Les deux cas passent
   * par la même ligne, sans drapeau à tenir.
   *
   * Le clavier continue de passer par `onChange` : les flèches changent de
   * ligne sans jamais rien défaire, ce qui est le comportement attendu.
   */
  const devalider = (valeur: string) => {
    if (choixDate === valeur) setChoixDate("");
  };
  const libelleProposition = (d: string) => joursEnToutesLettres(joursDe(d));
  const montrerRetractation = premierJour !== "" && dansDelaiRetractation(premierJour, aujourdHui);

  if (etat && "succes" in etat) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.line}`,
          boxShadow: "0 8px 24px rgba(20,18,14,0.08)",
        }}
      >
        <p className="text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
          {etat.succes}
        </p>
        <p className="mt-2 text-[14px]" style={{ color: colors.muted }}>
          Vous pouvez fermer cette page.
        </p>
        {/* **PLUS DE BOUTON ICI — sa correction du 9 septembre 2026 :** *« il y
            a marqué deux fois télécharger, garde celui sous le TTC »*.

            Il en portait un, à deux centimètres de celui du devis juste
            au-dessus : deux boutons identiques sur un même écran font hésiter
            — est-ce le même fichier ? — et celui du haut ne bouge pas quand
            on répond. **L’écran de RETOUR, lui, le garde** : quand le client
            rouvre son SMS le lendemain, la carte du devis n’est plus là
            (`page.tsx`, le cadre « C’est noté »). */}
      </div>
    );
  }

  // **4 px entre les blocs, et non 6 — 14 septembre 2026.** Cette page n'a plus
  // un pixel de marge depuis qu'il a fait reprendre les espacements le
  // 4 septembre : au pire cas — une date dans les quatorze jours, donc la case
  // de rétractation dépliée — elle repassait au-dessus de l'écran. Deux pixels
  // par couture, et rien d'autre ne bouge.
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="jeton" value={envoi.jeton} />

      <section className="rounded-2xl p-2.5"
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.line}`,
          boxShadow: "0 4px 14px rgba(20,18,14,0.06)",
        }}>
        {/* **Des JOURS, jamais des demi-journées** — sa consigne, tenue par
            `test-creneaux-planning.ts`. Depuis le 18 septembre 2026, chaque
            proposition porte ses jours (« le vendredi 18 septembre et le mardi
            22 septembre ») : le client lit où l'artisan viendra, et choisit
            entre les deux si deux lui sont offertes. Sa règle du même jour pour
            les mois : `joursEnToutesLettres`. La valeur du bouton reste le
            PREMIER jour — c'est par lui que le serveur retrouve la liste. */}
        <h2 className="text-[16px]" style={{ fontFamily: font.display, color: colors.ink }}>
          {plusieursJours ? <>Quels jours vous arrangent&nbsp;?</> : <>Quelle date vous arrange&nbsp;?</>}
        </h2>

        {/* **LE NOMBRE DE JOURS SE LIT ICI, SUR LA PAGE — sa quatrième demande
            du 20 septembre 2026, qu'il a dû redire :** *« en dessous de "quels
            jours vous arrangent ?" et au-dessus de la touche pour valider,
            écris le nombre de jours »*.

            Posée d'abord dans la feuille du calendrier, elle ne se lisait que
            si le client l'ouvrait — c'est-à-dire seulement quand les dates
            proposées ne lui convenaient pas. Il lisait quatre dates sans jamais
            savoir que le chantier en prend quatre, au moment précis où il
            choisit. */}
        {phraseDuree && (
          <p className="mt-0.5 text-[13px]" style={{ color: colors.inkSoft }}>
            {phraseDuree}
          </p>
        )}

        <div className="mt-1.5 flex flex-col gap-0.5">
          {/* Repliée, la liste ne rend plus qu'une ligne : les jours retenus, et
              de quoi revenir. Voir `listeRepliee` pour le pourquoi. */}
          {listeRepliee && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px]" style={{ color: colors.ink }}>
                {joursEnToutesLettres(joursAutres)}
              </span>
              <button
                type="button"
                onClick={() => setListeDepliee(true)}
                className="shrink-0 text-[13px] underline underline-offset-4"
                style={{ color: colors.inkSoft }}
              >
                changer
              </button>
            </div>
          )}
          {/* Repliés, les boutons radio quittent le document — et avec eux le
              choix que le formulaire envoie. Ce champ prend leur place. */}
          {listeRepliee && <input type="hidden" name="choixDate" value="autre" />}

          {!listeRepliee && envoi.datesProposees.map((d) => (
            <label key={d} className="flex items-center gap-3 text-[15px]" style={{ color: colors.ink }}>
              <input
                type="radio"
                name="choixDate"
                value={d}
                checked={choixDate === d}
                onChange={(e) => setChoixDate(e.target.value)}
                onClick={() => devalider(d)}
                className="h-5 w-5"
              />
              <span>{libelleProposition(d)}</span>
            </label>
          ))}

          {/* **« Je propose » n'apparaît que si l'artisan l'a permis**
              (17 août 2026, sa demande : *« il faut que l'utilisateur puisse
              choisir avant d'envoyer s'il autorise ou non le client à choisir
              une date »*). Le choix est FIGÉ dans l'envoi : cet écran dira
              demain ce qu'il dit aujourd'hui.

              **Cacher ne suffit pas** : cette page est publique et son
              formulaire se rejoue. Le serveur refuse la contre-proposition de
              son côté (`enregistrerReponse`, motif `autre_date_refusee`) — une
              règle tenue à un seul endroit, jamais deux. */}
          {envoi.autreDateAutorisee && !listeRepliee && (
            <label className="flex items-center gap-3 text-[15px]" style={{ color: colors.ink }}>
              <input
                type="radio"
                name="choixDate"
                value="autre"
                checked={choixDate === "autre"}
                onClick={() => devalider("autre")}
                // La feuille s'ouvre sur la SÉLECTION, jamais sur l'appui :
                // `onChange` ne part pas quand la case est déjà cochée, donc
                // le geste qui la décoche ne la rouvre pas dans la foulée.
                onChange={(e) => {
                  setChoixDate(e.target.value);
                  setFeuilleOuverte(true);
                }}
                className="h-5 w-5"
              />
              <span>{libelleAutreDate(nombreDeJours)}</span>
            </label>
          )}

          {/* **Le champ caché vit DEHORS.** Il est ce qui part au serveur : le
              poser dans la feuille le ferait disparaître du formulaire dès
              qu'elle se referme, et les jours choisis ne seraient jamais
              envoyés. Des jours séparés par des virgules : le serveur les
              revérifie un à un de toute façon. */}
          {envoi.autreDateAutorisee && (
            <input type="hidden" name="joursAutres" value={joursAutres.join(",")} />
          )}

          {envoi.autreDateAutorisee && !listeRepliee && choixDate === "autre" && joursAutres.length > 0 && (
            <button
              type="button"
              onClick={() => setFeuilleOuverte(true)}
              className="mt-0.5 self-start text-[13px] underline underline-offset-4"
              style={{ color: colors.inkSoft }}
            >
              {joursEnToutesLettres(joursAutres)}, changer
            </button>
          )}

          <BottomSheet
            open={envoi.autreDateAutorisee && feuilleOuverte}
            /* **Refermer sans avoir choisi DÉFAIT le choix.** Sinon le client
               reste sur « je propose » sans jour, et son acceptation est
               refusée par le serveur — un refus qu'il ne comprendrait pas,
               puisque rien à l'écran ne dit qu'il manque quelque chose. */
            onBackdropClick={() => {
              setFeuilleOuverte(false);
              setRefus(null);
              if (joursAutres.length === 0) setChoixDate("");
            }}
          >
            <div className="flex flex-col gap-0.5">
              {/* **Un calendrier, et non plus le sélecteur du téléphone.**
                  Sa demande du 8 août 2026 : « qu'il ait accès au calendrier
                  pour pouvoir proposer une date, avec un système pour qu'il
                  n'ait pas accès aux dates déjà prises par un autre client. »

                  `<input type="date">` accepte bien une fenêtre, mais il ne sait
                  pas griser des jours au milieu : le client choisissait un jour
                  déjà pris et ne l'apprenait qu'après coup, par un refus. Ici
                  les jours pris sont barrés et ne répondent pas.

                  Le champ caché reste : c'est lui qui part au serveur, et le
                  serveur revérifie de toute façon — l'affichage n'est qu'un
                  instantané, deux clients peuvent viser le même jour. */}
              {/* `dureeDemiJournees={null}` : le client n'apprend rien du
                  découpage du planning de son artisan — ni créneau, ni durée.
                  Consigne du patron, tenue par `test-creneaux-planning.ts`. Sa
                  phrase sous le calendrier reste vraie sans rien chiffrer.

                  **Les jours barrés lui arrivent DÉJÀ prêts** : `joursOccupes`
                  est la liste des jours où CE chantier, de SA durée, ne peut
                  pas commencer (`lireParJeton`). Rien à recalculer ici, et
                  rien de plus à lui apprendre. */}
              <Calendrier
                debut={envoi.fenetre.debut}
                fin={envoi.fenetre.fin}
                occupes={envoi.joursOccupes}
                retenus={joursAutres}
                aujourdHui={aujourdHui}
                dureeDemiJournees={null}
                onBasculer={(jour) =>
                  setJoursAutres((actuels) => toucherUnJourDuClient(actuels, jour, nombreDeJours))
                }
              />
              {/* **Le compte se relit ICI aussi**, au moment où les jours
                  s'allument : la feuille recouvre la carte, et la phrase de la
                  page est alors hors de vue. Les deux ne se lisent jamais en
                  même temps. */}
              {phraseDuree && (
                <p className="mt-2 text-center text-[13px]" style={{ color: colors.inkSoft }}>
                  {phraseDuree}
                </p>
              )}
              {/* Le bouton ne s'éteint pas faute de jours : il répond, et c'est
                  sa réponse qui dit ce qui manque — la même règle que les trois
                  issues plus bas, et que l'écran d'envoi du patron. */}
              {/* **La phrase se lit DANS la feuille.** Celle du formulaire vit
                  plus bas, donc derrière elle : un refus posé là serait caché
                  par ce qui vient de le provoquer. */}
              {refus && (
                <p role="alert" className="mt-2 text-[14px]" style={{ color: colors.alert }}>
                  {refus}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  /* **Elle ne retient pas moins de jours que le chantier n'en
                     prend.** Trois jours pour un chantier de quatre partaient
                     sans un mot, et l'artisan n'aurait pas eu de quoi faire le
                     travail. */
                  const manque = refusDesJoursRetenus(joursAutres.length, nombreDeJours);
                  if (manque) return setRefus(manque);
                  setRefus(null);
                  setFeuilleOuverte(false);
                  // Ce qu'elle vient de retenir devient la ligne ; le reste se replie.
                  setListeDepliee(false);
                }}
                // Le vert des BOUTONS (`colors.plein`), tranché le 3 septembre
                // 2026 sur `appli/boutons-verts.html` — et non le vert pin, qui
                // est celui des textes et des liserés.
                className="atlas-plein mt-3 rounded-full py-3 text-[16px] font-medium"
                style={{ backgroundColor: colors.plein, color: colors.card }}
              >
                {libelleRetenir(nombreDeJours)}
              </button>
            </div>
          </BottomSheet>
        </div>

        {/* **Le message vit dans la MÊME carte que la date**, depuis le 31 août
            2026. Il avait la sienne : trente-deux pixels de marges et huit de
            gouttière pour séparer deux choses qui se répondent — la date qu'on
            retient, et le mot qu'on laisse. Réunies, elles tiennent dans
            l'écran ; séparées, le dernier bouton passait sous le pli.

            Le champ existait déjà, intitulé « Une précision ? (facultatif) », et
            le client y écrivait — « Le devis comprend une fautes ». Deux défauts
            s'y cachaient : son intitulé ne laissait pas deviner qu'on pouvait y
            signaler une erreur, et surtout **rien ne l'affichait jamais** au
            patron. Le message partait dans le vide.

            **L'invitation tient en une ligne.** Elle en occupait deux : une
            question, puis une phrase disant qu'on avait le droit d'y répondre —
            celle-là, le patron l'avait demandée le 13 août, et elle n'est pas
            perdue : « votre artisan la lira » la porte, et le nomme. Un client qui repère une faute et
            n'ose pas l'écrire touche « Je ne donne pas suite », et le patron lit
            un refus là où il n'y avait qu'une coquille. */}
        <label className="mt-2.5 block text-[13px] font-medium" style={{ color: colors.inkSoft }} htmlFor="precision">
          Une erreur&nbsp;? Écrivez-la, votre artisan la lira.
        </label>
        <textarea
          id="precision"
          name="precision"
          ref={champMessage}
          /* Une ligne, pas deux : 23 px des 53 qui manquaient. Le champ
             continue d'accepter autant de texte — il défile. */
          rows={1}
          maxLength={500}
          value={precision}
          onChange={(e) => {
            setPrecision(e.target.value);
            if (e.target.value.trim() !== "") setRefus(null);
          }}
          placeholder="« Mon nom est mal écrit », « plutôt le matin »…"
          className="mt-1.5 w-full resize-y rounded-xl px-3 py-2 text-[15px]"
          style={{ border: `1px solid ${colors.line}`, backgroundColor: colors.card, color: colors.ink }}
        />
      </section>

      {/* **Le cadre de rétractation quitte le terre cuite du 3 août.**
          `#B5502F` a été abandonné le 3 août 2026 ; il vivait encore ici, faute
          d'être passé par les jetons. `colors.alert` est la teinte d'alerte du
          produit, et elle s'éclaircit sur les deux chartes sombres pour rester
          lisible (`chartes.ts`, `detacher`).

          **Le délai se compte sur le PREMIER jour** : c'est celui où les
          travaux commencent, et le seul qui puisse tomber avant la fin des
          quatorze jours. */}
      {montrerRetractation && (
        <section
          className="rounded-2xl p-2"
          style={{
            border: `1px solid ${voile(colors.alert, 0.25)}`,
            backgroundColor: voile(colors.alert, 0.05),
          }}
        >
          <label className="flex items-start gap-3 text-[14px] leading-relaxed" style={{ color: colors.ink }}>
            {/* Jamais pré-cochée : c'est cette demande, et elle seule, qui
                autorise l'artisan à intervenir avant la fin du délai légal. */}
            <input
              type="checkbox"
              name="demarrageAnticipe"
              value="oui"
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Cette date se situe dans mon délai de rétractation de 14 jours.
              <strong> Je demande expressément que les travaux commencent avant sa fin.</strong>
            </span>
          </label>
        </section>
      )}

      {/* Elle se tait pendant qu'une feuille est ouverte : celle du calendrier
          porte sa propre phrase, et deux fois la même à deux endroits ne se lit
          pas. */}
      {!feuilleOuverte && !confirmationRefus && (refus ?? (etat && "erreur" in etat ? etat.erreur : null)) && (
        <p role="alert" className="text-[14px]" style={{ color: colors.alert }}>
          {refus ?? (etat && "erreur" in etat ? etat.erreur : null)}
        </p>
      )}

      {/* Trois issues, et non deux.
          Un client qui repère une faute ne veut ni accepter ni renoncer : il
          veut le même devis, corrigé. Sans cette voie, il touchait « Je ne
          donne pas suite » — et le patron lisait un refus là où il n'y avait
          qu'une coquille. C'est un chantier perdu pour une faute de frappe.

          Le bouton reste discret, au milieu : la voie normale est d'accepter,
          et un client hésitant ne doit pas être poussé vers la correction.

          **Il n'est plus éteint, et il ne porte plus sa phrase grise.** Un
          bouton désactivé oblige à écrire dessous pourquoi — trente pixels de
          plus, sur un écran qui doit tenir d'un seul tenant — et sans cette
          phrase il se lit comme une application cassée. Il répond donc, et
          c'est sa réponse qui dit ce qui manque, au moment où cela mord
          (`CLAUDE.md` §217, la même leçon sur l'écran de connexion). */}
      <div className="flex flex-col gap-1.5">
        <button
          type="submit"
          name="decision"
          value="accepte"
          disabled={enCours}
          className="atlas-plein rounded-full py-3 text-[17px] disabled:opacity-50"
          style={{ backgroundColor: colors.plein, color: colors.card, fontFamily: font.display }}
        >
          {enCours ? "Envoi…" : "J'accepte ce devis"}
        </button>
        <button
          type="submit"
          name="decision"
          value="correction"
          disabled={enCours}
          onClick={(e) => {
            if (precision.trim() !== "") return;
            // Rien n'est envoyé : le client est renvoyé au champ, curseur
            // dedans, plutôt qu'à un refus venu du serveur trois secondes plus
            // tard.
            e.preventDefault();
            setRefus("Écrivez d'abord ce qui doit être corrigé.");
            champMessage.current?.focus();
          }}
          className="rounded-full py-2.5 text-[14px] font-medium disabled:opacity-40"
          style={{ color: colors.rust, boxShadow: `inset 0 0 0 1px ${voile(colors.rust, 0.3)}` }}
        >
          Une correction avant d&apos;accepter
        </button>
        {/* **Ce bouton n'envoie plus rien par lui-même** : il ouvre la feuille.
            C'est tout ce que sa sécurité du 20 septembre demande, et cela ne
            coûte pas un pixel à la page. */}
        <button
          type="button"
          /* **Le repère existe pour les suites, et il a une raison.** Celle
             qui mesure « tout tient dans un écran » visait
             `button[value="refuse"]` : ce bouton n'envoie plus rien par
             lui-même, le `value` est parti dans la feuille, et la mesure
             rendait ZÉRO — un vert qui ne mesure rien (`CLAUDE.md` §5). Un
             repère survit à la prochaine réécriture de ce bouton. */
          data-atlas="ne-pas-donner-suite"
          disabled={enCours}
          onClick={() => {
            setRefus(null);
            setConfirmationRefus(true);
          }}
          className="rounded-full py-2.5 text-[14px] disabled:opacity-50"
          style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
        >
          Je ne donne pas suite
        </button>
      </div>

      {/* **La feuille de confirmation vit DANS le formulaire**, et c'est ce qui
          permet à son bouton d'être un vrai `submit` : posée ailleurs dans la
          page, elle enverrait un formulaire vide. `BottomSheet` ne déplace rien
          dans le document — il se pose en `fixed` là où il est écrit. */}
      <BottomSheet open={confirmationRefus} onBackdropClick={() => setConfirmationRefus(false)}>
        <h2 className="text-center text-[17px]" style={{ fontFamily: font.display, color: colors.ink }}>
          Vous ne donnez pas suite&nbsp;?
        </h2>
        <p className="mt-1.5 text-center text-[14px]" style={{ color: colors.muted }}>
          Votre artisan en sera prévenu.
        </p>
        <div className="mt-4 flex flex-col gap-1.5">
          {/* **Le geste définitif reste discret, le geste sûr porte l'encre.**
              C'est l'ordre des issues de la page, et il tient ici : celui qui
              revient doit se trouver du premier coup d'œil. */}
          <button
            type="submit"
            name="decision"
            value="refuse"
            disabled={enCours}
            className="rounded-full py-2.5 text-[14px] disabled:opacity-50"
            style={{ color: colors.muted, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
          >
            {enCours ? "Envoi…" : "Oui, je ne donne pas suite"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmationRefus(false)}
            className="rounded-full py-2.5 text-[15px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1px ${voile(colors.ink, 0.45)}` }}
          >
            Revenir au devis
          </button>
        </div>
      </BottomSheet>
    </form>
  );
}

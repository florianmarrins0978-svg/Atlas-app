"use client";

import { useActionState, useRef, useState } from "react";
import { repondreAction } from "./actions";
import type { EnvoiPourClient } from "@/server/repositories/envois-devis";
import { jourLisible, dansDelaiRetractation } from "@/lib/jour";
import { libelleAutreDate } from "@/lib/libelle-dates";
import Calendrier from "@/components/atlas/Calendrier";
import BottomSheet from "@/components/atlas/BottomSheet";
import BoutonTelechargerDevis from "./BoutonTelechargerDevis";

export default function FormulaireReponse({
  envoi,
  aujourdHui,
}: {
  envoi: EnvoiPourClient;
  aujourdHui: string;
}) {
  const [etat, action, enCours] = useActionState(repondreAction, undefined);
  const [choixDate, setChoixDate] = useState<string>("");
  const [dateAutre, setDateAutre] = useState<string>("");
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
   * Ce que la page refuse d'elle-même, sans aller au serveur.
   *
   * Une demande de correction sans un mot obligerait le patron à rappeler,
   * c'est-à-dire à refaire l'aller-retour que tout ce parcours supprime. Le
   * dépôt le refuse déjà (motif `message_manquant`) — la règle reste là-bas,
   * seule la phrase est ici.
   */
  const [refus, setRefus] = useState<string | null>(null);
  const champMessage = useRef<HTMLTextAreaElement>(null);

  const dateEffective = choixDate === "autre" ? dateAutre : choixDate;

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
  const montrerRetractation = dateEffective !== "" && dansDelaiRetractation(dateEffective, aujourdHui);

  if (etat && "succes" in etat) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-[16px] font-medium text-ink">{etat.succes}</p>
        <p className="mt-2 text-[14px] text-ink/60">Vous pouvez fermer cette page.</p>
        {/* **Le devis accepté s'emporte tout de suite.** C'est l'instant où le
            client le cherche — et s'il ferme la page sans l'avoir pris, l'écran
            de retour le lui redonne (`page.tsx`). Après un refus, non : on ne
            propose pas d'emporter un devis auquel on vient de renoncer. */}
        {etat.devisTelechargeable && <BoutonTelechargerDevis jeton={envoi.jeton} />}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="jeton" value={envoi.jeton} />

      <section className="rounded-2xl bg-white p-3 shadow-sm">
        <h2 className="text-[15px] font-semibold text-ink">Quelle date vous arrange&nbsp;?</h2>

        <div className="mt-1.5 flex flex-col gap-0.5">
          {envoi.datesProposees.map((d) => (
            <label key={d} className="flex items-center gap-3 text-[15px] text-ink">
              <input
                type="radio"
                name="choixDate"
                value={d}
                checked={choixDate === d}
                onChange={(e) => setChoixDate(e.target.value)}
                onClick={() => devalider(d)}
                className="h-5 w-5"
              />
              <span>{jourLisible(d)}</span>
            </label>
          ))}

          {/* **« Une autre date » n'apparaît que si l'artisan l'a permis**
              (17 août 2026, sa demande : *« il faut que l'utilisateur puisse
              choisir avant d'envoyer s'il autorise ou non le client à choisir
              une date »*). Le choix est FIGÉ dans l'envoi : cet écran dira
              demain ce qu'il dit aujourd'hui.

              **Cacher ne suffit pas** : cette page est publique et son
              formulaire se rejoue. Le serveur refuse la contre-proposition de
              son côté (`enregistrerReponse`, motif `autre_date_refusee`) — une
              règle tenue à un seul endroit, jamais deux. */}
          {envoi.autreDateAutorisee && (
            <label className="flex items-center gap-3 text-[15px] text-ink">
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
              <span>{libelleAutreDate(envoi.datesProposees.length)}</span>
            </label>
          )}

          {/* **Le champ caché vit DEHORS.** Il est ce qui part au serveur : le
              poser dans la feuille le ferait disparaître du formulaire dès
              qu'elle se referme, et la date choisie ne serait jamais envoyée. */}
          {envoi.autreDateAutorisee && <input type="hidden" name="dateAutre" value={dateAutre} />}

          {envoi.autreDateAutorisee && choixDate === "autre" && dateAutre && (
            <button
              type="button"
              onClick={() => setFeuilleOuverte(true)}
              className="mt-0.5 self-start text-[13px] text-ink/70 underline underline-offset-4"
            >
              {jourLisible(dateAutre)} — changer
            </button>
          )}

          <BottomSheet
            open={envoi.autreDateAutorisee && feuilleOuverte}
            /* **Refermer sans avoir choisi DÉFAIT le choix.** Sinon le client
               reste sur « Une autre date » sans date, et son acceptation est
               refusée par le serveur — un refus qu'il ne comprendrait pas,
               puisque rien à l'écran ne dit qu'il manque quelque chose. */
            onBackdropClick={() => {
              setFeuilleOuverte(false);
              setRefus(null);
              if (!dateAutre) setChoixDate("");
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
              {/* Le champ caché a quitté la feuille — voir plus haut. */}
              {/* `dureeDemiJournees={null}` : le client n'apprend rien du
                  découpage du planning de son artisan — ni créneau, ni durée.
                  Consigne du patron, tenue par `test-creneaux-planning.ts`. Sa
                  phrase sous le calendrier reste vraie sans rien chiffrer. */}
              <Calendrier
                debut={envoi.fenetre.debut}
                fin={envoi.fenetre.fin}
                occupes={envoi.joursOccupes}
                retenus={dateAutre ? [dateAutre] : []}
                aujourdHui={aujourdHui}
                dureeDemiJournees={null}
                onBasculer={(jour) => setDateAutre((actuel) => (actuel === jour ? "" : jour))}
              />
              {/* Le bouton ne s'éteint pas faute de date : il répond, et c'est
                  sa réponse qui dit ce qui manque — la même règle que les trois
                  issues plus bas, et que l'écran d'envoi du patron. */}
              {/* **La phrase se lit DANS la feuille.** Celle du formulaire vit
                  plus bas, donc derrière elle : un refus posé là serait caché
                  par ce qui vient de le provoquer. */}
              {refus && (
                <p role="alert" className="mt-2 text-[14px] text-[#B5502F]">
                  {refus}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!dateAutre) return setRefus("Touchez d'abord un jour dans le calendrier.");
                  setRefus(null);
                  setFeuilleOuverte(false);
                }}
                className="mt-3 rounded-full bg-[#2F3B2F] py-3 text-[16px] font-medium text-white"
              >
                Retenir cette date
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
        <label className="mt-2.5 block text-[13px] font-medium text-ink/70" htmlFor="precision">
          Une erreur&nbsp;? Écrivez-la, votre artisan la lira.
        </label>
        <textarea
          id="precision"
          name="precision"
          ref={champMessage}
          rows={2}
          maxLength={500}
          value={precision}
          onChange={(e) => {
            setPrecision(e.target.value);
            if (e.target.value.trim() !== "") setRefus(null);
          }}
          placeholder="« Mon nom est mal écrit », « plutôt le matin »…"
          className="mt-1.5 w-full resize-y rounded-xl border border-black/10 px-3 py-2 text-[15px]"
        />
      </section>

      {montrerRetractation && (
        <section className="rounded-2xl border border-[#B5502F]/25 bg-[#B5502F]/5 p-4">
          <label className="flex items-start gap-3 text-[14px] leading-relaxed text-ink">
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

      {/* Elle se tait pendant que la feuille est ouverte : celle-ci porte sa
          propre phrase, et deux fois la même à deux endroits ne se lit pas. */}
      {!feuilleOuverte && (refus ?? (etat && "erreur" in etat ? etat.erreur : null)) && (
        <p role="alert" className="text-[14px] text-[#B5502F]">
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
          className="rounded-full bg-[#2F3B2F] py-3 text-[16px] font-medium text-white disabled:opacity-50"
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
          className="rounded-full border border-[#2F3B2F]/30 py-2.5 text-[14px] font-medium text-[#2F3B2F] disabled:opacity-40"
        >
          Une correction avant d&apos;accepter
        </button>
        <button
          type="submit"
          name="decision"
          value="refuse"
          disabled={enCours}
          className="rounded-full border border-black/15 py-2.5 text-[14px] text-ink/70 disabled:opacity-50"
        >
          Je ne donne pas suite
        </button>
      </div>
    </form>
  );
}

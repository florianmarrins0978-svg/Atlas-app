"use client";

import { useActionState, useState } from "react";
import { repondreAction } from "./actions";
import type { EnvoiPourClient } from "@/server/repositories/envois-devis";
import { jourLisible, dansDelaiRetractation } from "@/lib/jour";
import { libelleAutreDate } from "@/lib/libelle-dates";
import Calendrier from "@/components/atlas/Calendrier";

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
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jeton" value={envoi.jeton} />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-semibold text-ink">Quelle date vous arrange&nbsp;?</h2>

        <div className="mt-3 flex flex-col gap-2">
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
                onChange={(e) => setChoixDate(e.target.value)}
                className="h-5 w-5"
              />
              <span>{libelleAutreDate(envoi.datesProposees.length)}</span>
            </label>
          )}

          {envoi.autreDateAutorisee && choixDate === "autre" && (
            <div className="mt-2 flex flex-col gap-1">
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
              <input type="hidden" name="dateAutre" value={dateAutre} />
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
              {dateAutre && (
                <p className="text-[13px] text-ink/70">
                  Vous avez choisi le {jourLisible(dateAutre)}.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {montrerRetractation && (
        <section className="rounded-2xl border border-[#B5502F]/25 bg-[#B5502F]/5 p-5">
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

      {/* Le champ de message.
          Il existait déjà, intitulé « Une précision ? (facultatif) », et le
          client y écrivait — « Le devis comprend une fautes ». Deux défauts s'y
          cachaient : son intitulé ne laissait pas deviner qu'on pouvait y
          signaler une erreur, et surtout **rien ne l'affichait jamais** au
          patron. Le message partait dans le vide.

          Devenu une zone de texte : une faute se décrit rarement en une ligne,
          et un champ d'une ligne dissuade d'écrire. */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-[13px] font-medium text-ink/60" htmlFor="precision">
          Une erreur, une question, une précision&nbsp;?
        </label>
        {/* **La phrase qui dit que c'est permis.** Le patron, le 13 août 2026 :
            *« écris une petite phrase sur l'encart pour laisser un mot, qu'il
            sache qu'il peut le faire »*. L'intitulé ci-dessus posait une
            question ; il ne disait pas qu'on avait le droit d'y répondre. Un
            client qui repère une faute et n'ose pas l'écrire touche « Je ne
            donne pas suite », et le patron lit un refus là où il n'y avait
            qu'une coquille — c'est très exactement le chantier perdu que ce
            champ existe pour éviter.

            Elle est AU-DESSUS du champ, jamais en dessous : une invitation lue
            après coup n'invite plus personne. */}
        <p className="mt-1 text-[13px] text-ink/70">
          Vous pouvez laisser un mot à votre artisan : il le lira tel quel.
        </p>
        <textarea
          id="precision"
          name="precision"
          rows={3}
          maxLength={500}
          value={precision}
          onChange={(e) => setPrecision(e.target.value)}
          placeholder="« Mon nom est mal écrit », « plutôt le matin », « il manque le broyage »…"
          className="mt-2 w-full resize-y rounded-xl border border-black/10 px-3 py-2 text-[15px]"
        />
      </section>

      {etat && "erreur" in etat && (
        <p role="alert" className="text-[14px] text-[#B5502F]">
          {etat.erreur}
        </p>
      )}

      {/* Trois issues, et non deux.
          Un client qui repère une faute ne veut ni accepter ni renoncer : il
          veut le même devis, corrigé. Sans cette voie, il touchait « Je ne
          donne pas suite » — et le patron lisait un refus là où il n'y avait
          qu'une coquille. C'est un chantier perdu pour une faute de frappe.

          Le bouton reste discret, au milieu : la voie normale est d'accepter,
          et un client hésitant ne doit pas être poussé vers la correction.
          Il est désactivé tant que rien n'est écrit — une demande de correction
          sans message obligerait le patron à rappeler, c'est-à-dire à refaire
          l'aller-retour que tout ce parcours supprime. */}
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          name="decision"
          value="accepte"
          disabled={enCours}
          className="rounded-full bg-[#2F3B2F] py-3.5 text-[16px] font-medium text-white disabled:opacity-50"
        >
          {enCours ? "Envoi…" : "J'accepte ce devis"}
        </button>
        <button
          type="submit"
          name="decision"
          value="correction"
          disabled={enCours || precision.trim() === ""}
          title={precision.trim() === "" ? "Écrivez d'abord ce qui doit être corrigé." : undefined}
          className="rounded-full border border-[#2F3B2F]/30 py-3 text-[15px] font-medium text-[#2F3B2F] disabled:opacity-40"
        >
          Une correction avant d&apos;accepter
        </button>
        {precision.trim() === "" && (
          <p className="-mt-1 text-center text-[12px] text-ink/45">
            Écrivez ci-dessus ce qui doit être corrigé pour activer ce bouton.
          </p>
        )}
        <button
          type="submit"
          name="decision"
          value="refuse"
          disabled={enCours}
          className="rounded-full border border-black/15 py-3 text-[15px] text-ink/70 disabled:opacity-50"
        >
          Je ne donne pas suite
        </button>
      </div>
    </form>
  );
}

"use client";

import type React from "react";
import { useActionState, useRef, useState } from "react";
import { repondreAction } from "./actions";
import type { EnvoiPourClient } from "@/server/repositories/envois-devis";
import { joursEnToutesLettres, joursSurDeuxLignes, dansDelaiRetractation } from "@/lib/jour";
import { DROIT_DE_RETRACTATION } from "@/lib/retractation";
import {
  libelleAutreDate,
  libelleRetenir,
  phraseDureeDesTravaux,
  refusDesJoursRetenus,
} from "@/lib/libelle-dates";
import { toucherUnJourDuClient } from "@/lib/propositions-de-jours";
import Calendrier from "@/components/atlas/Calendrier";
import BottomSheet from "@/components/atlas/BottomSheet";
import { colors, font, surPlein, voile } from "@/lib/design-tokens";
import { CocheFaite } from "@/components/atlas/LettreDuClient";
import NoteDuDevis from "./NoteDuDevis";

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
  const [messageOuvert, setMessageOuvert] = useState(false);
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

  const joursEffectifs = envoi.joursFixes
    ? envoi.joursFixes
    : choixDate === "autre"
      ? joursAutres
      : choixDate
        ? joursDe(choixDate)
        : [];
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
  // La même règle que le refus du serveur, sous-traitance comprise (0119).
  const montrerRetractation =
    !envoi.devis.autoliquidation && premierJour !== "" && dansDelaiRetractation(premierJour, aujourdHui);

  if (etat && "succes" in etat) {
    return (
      <div className="mt-1.5 rounded-md px-4 py-5 text-center" style={{ backgroundColor: colors.card }}>
        <span className="mx-auto mb-2.5 grid w-fit">
          <CocheFaite taille={40} />
        </span>
        <p className="text-[19px] leading-snug" style={{ fontFamily: font.display, color: colors.ink }}>
          {etat.succes}
        </p>
        <p className="mt-1.5 text-[14px]" style={{ color: colors.inkSoft }}>
          Vous pouvez fermer cette page.
        </p>
        {/* **PAS DE BOUTON ICI — sa correction du 9 septembre 2026 :** *« il y
            a marqué deux fois télécharger, garde celui sous le TTC »*. Celui
            du haut reste ; l'écran de RETOUR, quand il rouvre son SMS le
            lendemain, porte le sien (`page.tsx`). */}
      </div>
    );
  }

  const erreur = refus ?? (etat && "erreur" in etat ? etat.erreur : null);

  return (
    <form action={action} className="mt-1.5 flex flex-col">
      <input type="hidden" name="jeton" value={envoi.jeton} />

      <section className="rounded-md px-3 py-[9px]" style={{ backgroundColor: colors.card }}>
        {/* **Des JOURS, jamais des demi-journées** — sa consigne, tenue par
            `test-creneaux-planning.ts`. Chaque proposition porte ses jours :
            le client lit où l'artisan viendra, et choisit entre les deux si
            deux lui sont offertes. La valeur du bouton reste le PREMIER jour —
            c'est par lui que le serveur retrouve la liste. */}
        {envoi.joursFixes ? (
          /* **Les jours FIXÉS par l'artisan — 22 septembre 2026.** Le client
             n'arrivait pas à choisir : son artisan l'a posé au planning. Plus
             rien à choisir ici, seulement à accepter. Le champ caché n'est
             qu'une forme : le serveur prend les jours du planning, quoi qu'on
             lui poste (`enregistrerReponse`). */
          <>
            <h2 className="text-[18px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
              Votre intervention
            </h2>
            <p data-atlas="jours-fixes" className="mt-0.5 text-[15px] first-letter:uppercase" style={{ color: colors.ink }}>
              {joursEnToutesLettres(envoi.joursFixes)}
            </p>
            <input type="hidden" name="choixDate" value={envoi.joursFixes[0]} />
          </>
        ) : (
          <>
            <h2 id="question-date" className="text-[18px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
              {plusieursJours ? <>Quels jours vous arrangent&nbsp;?</> : <>Quelle date vous arrange&nbsp;?</>}
            </h2>

            {/* **LE NOMBRE DE JOURS SE LIT ICI, SUR LA PAGE — sa demande du
                20 septembre 2026, redite :** *« en dessous de "quels jours
                vous arrangent ?" et au-dessus de la touche pour valider, écris
                le nombre de jours »*. Posée dans la feuille seulement, elle ne
                se lisait que si le client cherchait une autre date. */}
            {phraseDuree && (
              <p className="mt-px text-[13.5px]" style={{ color: colors.inkSoft }}>
                {phraseDuree}
              </p>
            )}

            {/* Repliée, la liste ne rend plus qu'une ligne : les jours retenus, et
                de quoi revenir. Voir `listeRepliee` pour le pourquoi. */}
            {listeRepliee && (
              <div className="mt-1 flex min-h-10 items-center justify-between gap-3">
                <span className="text-[16.5px] leading-snug first-letter:uppercase" style={{ fontFamily: font.display, color: colors.ink }}>
                  {joursEnToutesLettres(joursAutres)}
                </span>
                <button
                  type="button"
                  onClick={() => setListeDepliee(true)}
                  className="min-h-10 shrink-0 px-1 text-[14px] font-semibold"
                  style={{ color: colors.rust }}
                >
                  changer
                </button>
              </div>
            )}
            {/* Repliés, les boutons radio quittent le document — et avec eux le
                choix que le formulaire envoie. Ce champ prend leur place. */}
            {listeRepliee && <input type="hidden" name="choixDate" value="autre" />}

            {/* **Deux dates côte à côte, en grandes cases au pouce — sa planche
                du 31 octobre 2026.** Le jour en mot, la date en serif
                (`joursSurDeuxLignes`) : une phrase entière par ligne prenait
                deux lignes chacune, et la case ne se visait qu'au rond. Toute
                la case répond, le rond reste un vrai bouton radio. */}
            {!listeRepliee && (
              <div
                role="radiogroup"
                aria-labelledby="question-date"
                className={`mt-2 grid gap-2 ${envoi.datesProposees.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {envoi.datesProposees.map((d) => {
                  const lignes = joursSurDeuxLignes(joursDe(d));
                  const choisie = choixDate === d;
                  return (
                    <label
                      key={d}
                      className="flex min-h-[50px] cursor-pointer items-center gap-2 rounded-xl px-[9px] py-1.5 transition-[box-shadow,background-color] duration-200"
                      style={{
                        backgroundColor: choisie ? colors.card : colors.cream,
                        boxShadow: `inset 0 0 0 ${choisie ? 2 : 1}px ${choisie ? colors.rust : colors.line}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="choixDate"
                        value={d}
                        checked={choisie}
                        onChange={(e) => setChoixDate(e.target.value)}
                        onClick={() => devalider(d)}
                        aria-label={libelleProposition(d)}
                        className={ROND_DE_CHOIX}
                        style={styleRond}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold leading-tight" style={{ color: colors.inkSoft }}>
                          {lignes.jours}
                        </span>
                        <span className="block text-[17px] leading-[1.18] tabular-nums" style={{ fontFamily: font.display, color: colors.ink }}>
                          {lignes.dates}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* **« Je propose » n'apparaît que si l'artisan l'a permis**
                (17 août 2026). Le choix est FIGÉ dans l'envoi : cet écran dira
                demain ce qu'il dit aujourd'hui. Le serveur refuse la
                contre-proposition de son côté (`enregistrerReponse`, motif
                `autre_date_refusee`) — une règle tenue à un seul endroit. */}
            {envoi.autreDateAutorisee && !listeRepliee && (
              <label className="mt-1 flex min-h-10 cursor-pointer items-center gap-2.5 px-0.5 text-[14px] leading-tight" style={{ color: colors.ink }}>
                <input
                  type="radio"
                  name="choixDate"
                  value="autre"
                  checked={choixDate === "autre"}
                  onClick={() => devalider("autre")}
                  onChange={(e) => {
                    setChoixDate(e.target.value);
                    setFeuilleOuverte(true);
                  }}
                  className={ROND_DE_CHOIX}
                  style={styleRond}
                />
                <span>{libelleAutreDate(nombreDeJours)}</span>
              </label>
            )}

            {/* **Le champ caché vit DEHORS.** Il est ce qui part au serveur : le
                poser dans la feuille le ferait disparaître du formulaire dès
                qu'elle se referme. Des jours séparés par des virgules : le
                serveur les revérifie un à un de toute façon. */}
            {envoi.autreDateAutorisee && (
              <input type="hidden" name="joursAutres" value={joursAutres.join(",")} />
            )}

            {envoi.autreDateAutorisee && !listeRepliee && choixDate === "autre" && joursAutres.length > 0 && (
              <button
                type="button"
                onClick={() => setFeuilleOuverte(true)}
                className="min-h-10 self-start text-left text-[14px]"
                style={{ color: colors.inkSoft }}
              >
                {joursEnToutesLettres(joursAutres)},{" "}
                <span className="font-semibold" style={{ color: colors.rust }}>changer</span>
              </button>
            )}

            <BottomSheet
              open={envoi.autreDateAutorisee && feuilleOuverte}
              /* Refermée sans rien retenir, la feuille rend la main : sans quoi
                 le client reste sur « je propose » sans jour, et son
                 acceptation est refusée par le serveur sans que rien à l'écran
                 ne dise ce qui manque. */
              onBackdropClick={() => {
                setFeuilleOuverte(false);
                setRefus(null);
                if (joursAutres.length === 0) setChoixDate("");
              }}
            >
              <div className="flex flex-col gap-0.5">
                {/* **Un calendrier, et non plus le sélecteur du téléphone** (8 août
                    2026) : les jours déjà pris sont barrés et ne répondent pas.
                    `dureeDemiJournees={null}` : le client n'apprend rien du
                    découpage du planning de son artisan (`test-creneaux-planning.ts`).
                    `joursOccupes` est la liste des jours où CE chantier ne peut
                    pas commencer (`lireParJeton`) ; le serveur revérifie. */}
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
                {/* Le compte se relit ICI aussi : la feuille recouvre la phrase de la page. */}
                {phraseDuree && (
                  <p className="mt-2 text-center text-[13.5px]" style={{ color: colors.inkSoft }}>
                    {phraseDuree}
                  </p>
                )}
                {/* **La phrase se lit DANS la feuille** : posée plus bas, elle
                    serait cachée par ce qui vient de la provoquer. */}
                {refus && (
                  <p role="alert" className="mt-2 text-center text-[14px] font-semibold" style={{ color: colors.alert }}>
                    {refus}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    /* **Autant de jours que le chantier en prend.** Trois jours
                       pour un chantier de quatre partaient sans un mot. */
                    const manque = refusDesJoursRetenus(joursAutres.length, nombreDeJours);
                    if (manque) return setRefus(manque);
                    setRefus(null);
                    setFeuilleOuverte(false);
                    setListeDepliee(false);
                  }}
                  className="atlas-plein mt-3 min-h-[52px] rounded-full text-[17px] font-semibold"
                  style={{ backgroundColor: colors.plein, color: surPlein }}
                >
                  {libelleRetenir(nombreDeJours)}
                </button>
              </div>
            </BottomSheet>
          </>
        )}

        {/* **Le mot pour l'artisan, dans la MÊME plage que la date** (31 août
            2026), et il ne s'ouvre qu'au doigt — sa planche du 31 octobre. Sa
            phrase se lit d'emblée ; la case, ouverte, prenait cinquante pixels
            à un écran qui n'en a aucun à perdre, pour un client sur dix.

            La phrase INVITE à écrire, et nomme l'artisan (13 août 2026) : un
            client qui repère une faute et n'ose pas l'écrire touche « Je ne
            donne pas suite », et le patron lit un refus là où il n'y avait
            qu'une coquille. Le message part avec la réponse, quelle qu'elle
            soit, et le patron le lit. */}
        {messageOuvert ? (
          <>
            <label
              htmlFor="precision"
              className="mt-0.5 block border-t pt-2 text-[13.5px] font-semibold leading-snug"
              style={{ color: colors.rust, borderColor: colors.line }}
            >
              {INVITE_AU_MOT}
            </label>
            <textarea
              id="precision"
              name="precision"
              ref={champMessage}
              /* Ouverte par son geste : le curseur y est déjà. */
              autoFocus
              rows={1}
              maxLength={500}
              value={precision}
              onChange={(e) => {
                setPrecision(e.target.value);
                if (e.target.value.trim() !== "") setRefus(null);
              }}
              placeholder="« Mon nom est mal écrit », « plutôt le matin »…"
              className="mt-1 block max-h-[120px] min-h-[42px] w-full resize-none rounded-[10px] border-0 px-3 py-2.5 text-[16px] leading-snug outline-none [field-sizing:content] placeholder:text-[13.5px]"
              style={{ backgroundColor: colors.cream, color: colors.ink, boxShadow: `inset 0 0 0 1px ${colors.line}` }}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setMessageOuvert(true)}
            aria-expanded={false}
            data-atlas="ouvrir-le-mot"
            className="mt-0.5 block min-h-10 w-full border-t px-0.5 pt-1 text-left text-[13.5px] font-semibold leading-snug"
            style={{ color: colors.rust, borderColor: colors.line }}
          >
            {INVITE_AU_MOT}
          </button>
        )}
      </section>

      {/* **Son droit, dit là où il accepte** — choix du 3 octobre 2026
          (L221-5). La phrase et la case ne s'empilent JAMAIS : la case dit
          déjà le délai, et la page tient dans un écran sans un pixel de marge.
          Ni l'une ni l'autre en sous-traitance (migration 0119).

          **Le délai se compte sur le PREMIER jour** : c'est celui où les
          travaux commencent, et le seul qui puisse tomber avant la fin des
          quatorze jours. */}
      {/* **La note de l'artisan, juste avant l'accord** — son choix A du
          4 novembre 2026 : lue au moment où l'on s'engage, comme sous le
          « Bon pour accord » du devis d'un confrère qu'il avait montré. */}
      {envoi.devis.note && <NoteDuDevis note={envoi.devis.note} />}
      {!montrerRetractation && !envoi.devis.autoliquidation && (
        <p className="mx-0.5 mt-1.5 text-[13px] leading-[1.36]" style={{ color: colors.inkSoft }}>
          {DROIT_DE_RETRACTATION}
        </p>
      )}
      {montrerRetractation && (
        <label
          className="mt-1.5 flex cursor-pointer items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] leading-[1.32]"
          style={{ backgroundColor: colors.carteAmbreFond, color: colors.ink }}
        >
          {/* Jamais pré-cochée : c'est cette demande, et elle seule, qui
              autorise l'artisan à intervenir avant la fin du délai légal. */}
          <input
            type="checkbox"
            name="demarrageAnticipe"
            value="oui"
            className="mt-px h-5 w-5 shrink-0"
            style={{ accentColor: colors.carteAmbreTexte }}
          />
          <span>
            Cette date se situe dans mon délai de rétractation de 14 jours.
            <strong className="font-semibold"> Je demande expressément que les travaux commencent avant sa fin.</strong>
          </span>
        </label>
      )}

      {/* Elle se tait pendant qu'une feuille est ouverte : celle du calendrier
          porte sa propre phrase, et deux fois la même ne se lit pas. */}
      {!feuilleOuverte && !confirmationRefus && erreur && (
        <p role="alert" className="mx-0.5 mt-1 text-[14px] font-semibold" style={{ color: colors.alert }}>
          {erreur}
        </p>
      )}

      {/* **Trois issues, et non deux**, dans leur ordre : accepter, corriger,
          ne pas donner suite. Un client qui repère une faute veut le même
          devis, corrigé ; sans cette voie il touchait « Je ne donne pas
          suite ». **Les deux dernières côte à côte, sous l'accord** — sa
          planche du 31 octobre : la voie normale reste la plus grande, et le
          dernier geste remonte d'une ligne entière.

          La correction n'est jamais éteinte : elle répond, et c'est sa
          réponse qui dit ce qui manque, au moment où cela mord. */}
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="submit"
          name="decision"
          value="accepte"
          disabled={enCours}
          className="atlas-plein min-h-12 rounded-full text-[19px] disabled:opacity-50"
          style={{ backgroundColor: colors.plein, color: surPlein, fontFamily: font.display }}
        >
          {enCours ? "Envoi…" : "J'accepte ce devis"}
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="submit"
            name="decision"
            value="correction"
            disabled={enCours}
            onClick={(e) => {
              if (precision.trim() !== "") return;
              // Rien n'est envoyé : le client est renvoyé au champ, curseur
              // dedans, plutôt qu'à un refus venu du serveur trois secondes
              // plus tard. Fermé, le champ s'ouvre — et prend le curseur.
              e.preventDefault();
              setRefus("Écrivez d'abord ce qui doit être corrigé.");
              if (messageOuvert) champMessage.current?.focus();
              else setMessageOuvert(true);
            }}
            className="min-h-[50px] rounded-full px-3 py-1 text-[14.5px] font-semibold leading-tight [text-wrap:balance] disabled:opacity-40"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Une correction avant d&apos;accepter
          </button>
          {/* **Ce bouton n'envoie rien par lui-même** : il ouvre la feuille de
              confirmation (20 septembre 2026). Son repère sert aux suites qui
              mesurent « tout tient dans un écran » : un repère survit à la
              prochaine réécriture du bouton, un `value` parti dans la feuille
              faisait mesurer ZÉRO (`CLAUDE.md` §5). */}
          <button
            type="button"
            data-atlas="ne-pas-donner-suite"
            disabled={enCours}
            onClick={() => {
              setRefus(null);
              setConfirmationRefus(true);
            }}
            className="min-h-[50px] rounded-full px-3 py-1 text-[14.5px] font-medium leading-tight [text-wrap:balance] disabled:opacity-50"
            style={{ color: colors.inkSoft, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            Je ne donne pas suite
          </button>
        </div>
      </div>

      {/* **La feuille de confirmation vit DANS le formulaire**, et c'est ce qui
          permet à son bouton d'être un vrai `submit` : posée ailleurs, elle
          enverrait un formulaire vide. `BottomSheet` se pose en `fixed` là où
          il est écrit. */}
      <BottomSheet open={confirmationRefus} onBackdropClick={() => setConfirmationRefus(false)}>
        <div className="text-center">
          <h2 className="text-[26px] leading-tight" style={{ fontFamily: font.display, color: colors.ink }}>
            Vous ne donnez pas suite&nbsp;?
          </h2>
          <p className="mt-1.5 text-[15px]" style={{ color: colors.inkSoft }}>
            Votre artisan en sera prévenu.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {/* **Le geste définitif reste discret, le geste sûr porte l'encre** :
              celui qui revient doit se trouver du premier coup d'œil. */}
          <button
            type="submit"
            name="decision"
            value="refuse"
            disabled={enCours}
            className="min-h-[52px] rounded-full text-[15px] font-medium disabled:opacity-50"
            style={{ color: colors.inkSoft, boxShadow: `inset 0 0 0 1.5px ${colors.line}` }}
          >
            {enCours ? "Envoi…" : "Oui, je ne donne pas suite"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmationRefus(false)}
            className="min-h-[52px] rounded-full text-[16px] font-semibold"
            style={{ color: colors.ink, boxShadow: `inset 0 0 0 1.5px ${voile(colors.ink, 0.45)}` }}
          >
            Revenir au devis
          </button>
        </div>
      </BottomSheet>
    </form>
  );
}

/** La phrase qui invite au mot : la même, fermée ou ouverte. */
const INVITE_AU_MOT = "Une erreur\u00a0? Écrivez-la, votre artisan la lira.";

/** Le rond de choix des planches : un anneau, plein d'or une fois choisi. Un vrai bouton radio. */
const ROND_DE_CHOIX =
  "h-[22px] w-[22px] flex-none cursor-pointer appearance-none rounded-full shadow-[inset_0_0_0_1.5px_var(--anneau)] transition-shadow duration-200 checked:shadow-[inset_0_0_0_7px_var(--choisi)] focus-visible:outline-2 focus-visible:outline-offset-2";
const styleRond = { "--anneau": colors.chevron, "--choisi": colors.or } as React.CSSProperties;

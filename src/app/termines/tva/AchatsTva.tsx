"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { colors, voile } from "@/lib/design-tokens";
import { nettoyerPhotoDuTicket } from "@/components/atlas/nettoyer-photo";
import FeuilleAchat, { type DepartDeLaFeuille } from "./FeuilleAchat";
import { rangerTicketAction } from "./actions";
import {
  dansLaPeriode,
  libellePeriode,
  periodeContenant,
  periodeTva,
  type PeriodiciteTva,
} from "@/server/periode-tva";
import { ACCEPT_PHOTOS } from "@/lib/exif";

/**
 * Les deux façons d'ajouter un achat, et la feuille qui le saisit.
 *
 * *Sa demande du 12 août 2026 : « il faut pouvoir scanner un ticket, mais
 * également l'écrire ».* Retenu sur maquette (`docs/maquettes/37`).
 *
 * **La LISTE des achats n'est plus ici, depuis le 3 septembre 2026.** Elle
 * n'avait aucun état : ni geste, ni saisie, ni rien à écouter. La garder dans
 * ce fichier obligeait à l'envoyer au navigateur pour rien, et surtout à la
 * dessiner juste sous les deux boutons — alors que les boutons ont rejoint la
 * ligne « Déductible » de l'addition, tout en haut. Elle est rendue par le
 * serveur, dans `page.tsx`, à sa place : sous les factures, comme la preuve du
 * second terme.
 *
 * **Écrire n'est pas la roue de secours du scanner** : c'est l'autre moitié du
 * geste. Trois cas où l'objectif ne peut rien — le ticket perdu dont il se
 * souvient, la facture reçue par e-mail qui n'existe pas sur papier, l'achat
 * noté sur un coin de table. D'où deux entrées côte à côte, et non un bouton
 * principal avec un repli discret.
 *
 * **La lecture est branchée depuis le 13 août 2026**, le patron ayant posé ses
 * clés Anthropic et OpenAI. Ce qu'elle rend est une PROPOSITION : les champs
 * arrivent pré-remplis, et c'est la valeur qu'il CONFIRME qui part en base. Un
 * ticket thermique pâlit, se froisse et sort du fond d'une poche ; la lecture
 * se trompera, et un chiffre faux entré tout seul coûterait plus cher que pas
 * de chiffre du tout.
 *
 * **La photo est rangée avant la lecture, et le reste quoi qu'elle donne.**
 * Clé absente, quota dépassé, ticket illisible : le patron garde sa preuve et
 * saisit les montants. Le geste n'est jamais perdu pour une panne qui n'est pas
 * la sienne — et l'écran DIT laquelle, au lieu d'un « réessayez » unique pour
 * trois causes différentes.
 *
 * **Ce qui n'a pas pu être éprouvé ici** : la lecture d'un vrai ticket. Cet
 * environnement n'a aucune clé. La transformation de la réponse en champs, elle,
 * l'est entièrement (`scripts/test-lecture-ticket.ts`).
 */

export default function AchatsTva({
  aujourdHui,
  periodicite,
  annee,
  numero,
}: {
  aujourdHui: string;
  /** Le rythme choisi, pour savoir où tombera la date saisie. */
  periodicite: PeriodiciteTva;
  /** La période REGARDÉE — celle où le ticket tombera, ou pas. */
  annee: number;
  numero: number;
}) {
  const periodeVue = periodeTva(periodicite, annee, numero);
  const router = useRouter();
  const objectif = useRef<HTMLInputElement>(null);

  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  // La feuille se remonte neuve à chaque ouverture (sa `key`) : ses champs
  // repartent de ce qui vient d'être lu, jamais de la saisie d'avant.
  const [ouvertures, setOuvertures] = useState(0);
  const [depart, setDepart] = useState<DepartDeLaFeuille>({ photoCle: null, lu: null, lecture: null, refus: null });

  function ouvrir(d: DepartDeLaFeuille) {
    setDepart(d);
    setOuvertures((n) => n + 1);
    setOuverte(true);
  }

  async function photographier(fichier: File) {
    setEnCours(true);
    const fd = new FormData();
    // Trouvée, redressée et réduite AVANT de partir (lot 5 de « Pour mon
    // comptable ») : la photo rangée est celle qui sera relue dans le dossier.
    fd.set("ticket", await nettoyerPhotoDuTicket(fichier));
    const r = await rangerTicketAction(fd);
    setEnCours(false);
    if (!r.ok) {
      ouvrir({ photoCle: null, lu: null, lecture: null, refus: r.raison });
      return;
    }
    ouvrir({ photoCle: r.cle, lu: r.lu, lecture: r.lecture, refus: null });
  }

  function apresEnregistrement(date: string) {
    setOuverte(false);

    // **Le défaut du 13 août 2026, et sa réparation.** Le patron a scanné un
    // ticket de gazole du 24 juillet depuis l'écran d'août. L'achat est parti
    // au bon endroit — dans juillet — et a DISPARU de sa vue : le total d'août
    // n'a pas bougé, et il a conclu que rien n'avait été pris. Il avait raison
    // de son point de vue : rien ne lui disait que c'était rangé ailleurs.
    //
    // On l'emmène donc là où l'achat atterrit. Pas un message qu'il faudrait
    // lire puis suivre : l'écran change, et l'achat est sous ses yeux.
    if (!dansLaPeriode(periodeVue, date)) {
      const cible = periodeContenant(periodicite, date);
      if (cible) {
        // **Pas de `router.refresh()` derrière ce `push`.** Les deux se sont
        // annulés : `refresh` redemande au serveur l'adresse COURANTE, et la
        // navigation en cours retombait dessus — l'écran restait sur août, le
        // ticket restait invisible, et le correctif ne corrigeait rien. Vu à la
        // sonde, jamais autrement : la ligne était bien en base, l'écran ne
        // bougeait pas. `push` suffit, la page étant `force-dynamic`.
        router.push(`/termines/tva?annee=${cible.annee}&t=${cible.numero}`);
        return;
      }
    }
    router.refresh();
  }

  /**
   * **Où cet achat va tomber — dit AVANT l'appui, pas après.** Une date hors
   * de la période regardée n'est pas une erreur — un ticket de juillet scanné
   * en août est le cas normal. Ce qui serait fautif, c'est de le laisser partir
   * sans que le patron sache où il va.
   */
  function ouIlTombe(date: string) {
    const periodeDeLaSaisie = periodeContenant(periodicite, date);
    if (periodeDeLaSaisie === null || dansLaPeriode(periodeVue, date)) return null;
    return (
      <p className="mt-2.5 rounded-xl px-3.5 py-3 text-[12.5px] leading-[1.5]" style={{ backgroundColor: voile(colors.or, 0.1), color: colors.or }}>
        Ce ticket est daté du {new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })} :
        il ira dans <b style={{ color: colors.ink, fontWeight: 500 }}>{libellePeriode(periodeDeLaSaisie)}</b>,
        pas dans {libellePeriode(periodeVue)}. L’écran vous y emmènera.
      </p>
    );
  }

  return (
    <>
      {/* **Sans `capture`.** L'attribut forcerait l'appareil photo et retirerait
          l'accès à la photothèque : un ticket déjà photographié la veille
          deviendrait inatteignable. Sans lui, le téléphone propose les deux —
          même arbitrage que la pellicule des chantiers (`ARCHITECTURE.md` §60). */}
      <input
        ref={objectif}
        type="file"
        accept={ACCEPT_PHOTOS}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void photographier(f);
        }}
      />

      {/* **LES DEUX GESTES TOUCHENT LA LIGNE « DÉDUCTIBLE » — c'est la
          proposition C du 23 août 2026, poussée jusqu'au bout.**

          Sa remarque de ce jour-là : *« on ne comprend pas trop que scanner ou
          écrire à la main, c'est pour la TVA déductible »*. Trois dosages lui
          ont été dessinés (`docs/maquettes/85-achats-tva-deductible.html`) —
          dire le lien par le titre, par une phrase, ou par la PLACE. Il a
          retenu la place.

          Depuis le 3 septembre 2026, l'écran est une addition : collectée,
          moins déductible, un trait, le reste. Les deux gestes se posent
          **entre la ligne « Déductible » et le trait**, c'est-à-dire à
          l'endroit exact du chiffre qu'ils font monter. Le libellé « Pour faire
          monter la déductible » a donc été retiré : la place le dit, et un
          écran n'explique pas le bouton d'à côté (`CLAUDE.md` §3).

          Et le retour est meilleur qu'avant : après un scan, c'est le montant
          juste au-dessus du doigt qui change — plus besoin d'aller chercher la
          ligne quinze lignes plus bas. */}
      {/* **Chacun sa couleur, sa planche du 26 octobre 2026**
          (`appli/soignee/termines-tva.html`, « vert et sable ») : les deux
          gestes se distinguent d'un coup d'œil, en tons de carte de la
          charte, lisibles dans les huit. */}
      <div className="mt-1 flex gap-2.5" data-atlas="gestes-deductible">
        <button
          type="button"
          onClick={() => objectif.current?.click()}
          disabled={enCours}
          className="flex flex-1 flex-col items-center gap-[7px] rounded-full px-2 py-[13px] text-[12.5px]"
          style={{ backgroundColor: colors.carteVertFond, color: colors.carteVertTexte }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 8.4V6.2A2.2 2.2 0 0 1 6.2 4h2.2M15.6 4h2.2A2.2 2.2 0 0 1 20 6.2v2.2M20 15.6v2.2a2.2 2.2 0 0 1-2.2 2.2h-2.2M8.4 20H6.2A2.2 2.2 0 0 1 4 17.8v-2.2" strokeLinecap="round" />
            <path d="M4 12h16" strokeLinecap="round" />
          </svg>
          {enCours && !ouverte ? "Envoi…" : "Scanner un ticket"}
        </button>
        <button
          type="button"
          onClick={() => ouvrir({ photoCle: null, lu: null, lecture: null, refus: null })}
          className="flex flex-1 flex-col items-center gap-[7px] rounded-full px-2 py-[13px] text-[12.5px]"
          style={{ backgroundColor: colors.carteAmbreFond, color: colors.carteAmbreTexte }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 20h4.2L19 9.2a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L4 15.8V20z" strokeLinejoin="round" />
            <path d="M13.6 6.6l3.8 3.8" strokeLinecap="round" />
          </svg>
          Écrire à la main
        </button>
      </div>

      <FeuilleAchat
        key={ouvertures}
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        depart={depart}
        aujourdHui={aujourdHui}
        avantLeBouton={ouIlTombe}
        onEnregistre={apresEnregistrement}
      />
    </>
  );
}

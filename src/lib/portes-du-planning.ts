import { ongletDepuisJalons, type JalonsDeRangement } from "./onglet-chantier";
import { jourIso } from "./jour";

/**
 * ─── LES PORTES D'UN CHANTIER, DEPUIS LE PLANNING ───────────────────────────
 *
 * **Sa décision du 1er septembre 2026 :** la fiche du chantier disparaît, et ce
 * qu'elle portait encore va sur les chantiers du planning. Sa raison, dite le
 * même jour : *« toutes ces infos sont déjà sur cette page — on la garde, donc
 * ça fait des doublons si on garde l'autre aussi. »*
 *
 * **Son choix d'allure, le 4 septembre : la C** — rien au repos, le chevron
 * fait monter une feuille (`appli/facture-au-planning.html`). Deux allures
 * étaient sur la planche à côté ; A dépliait les trois portes sous chaque
 * chantier et faisait passer deux journées de 374 à 794 px, mesuré.
 *
 * **CE QUI VIT ICI, ET POURQUOI PAS DANS L'ÉCRAN.** Trois portes, trois
 * conditions, et un écran ne décide de rien (`CLAUDE.md` §3). Écrite dans le
 * composant, cette règle aurait été recopiée le jour où la feuille du planning
 * et la liste des terminés auraient dû dire la même chose d'un même chantier.
 *
 * **Ce n'est pas un doublon de `getStatutAffiche`** : celui-ci répond « quel
 * état montrer », celle-ci « où peut-on aller d'ici ». Et le « le chantier a-t-il
 * eu lieu » n'est pas réécrit non plus — il vient de `ongletDepuisJalons`, la
 * règle qui range déjà un chantier entre planning et terminés. La recopier
 * aurait fait deux vérités sur la même journée, à un écran d'écart.
 */

export type ChantierPourPortes = JalonsDeRangement & {
  id: string;
  envoiEnvoyeAt?: Date | string | null;
  envoiReponse?: "acceptee" | "refusee" | "correction" | null;
};

export type PorteDuPlanning = {
  cle: "facture" | "devis" | "client";
  libelle: string;
  /** Ce que la porte dit d'elle-même — vide quand il n'y a rien à en dire. */
  etat: string;
  /** Le seul geste qui ATTEND quelque chose. Au plus un par chantier. */
  geste: boolean;
  href: string;
};

/** Ce que le devis est devenu, en un mot — ou rien, tant qu'il n'est pas parti. */
function etatDuDevis(c: ChantierPourPortes): string {
  if (!c.envoiEnvoyeAt) return "";
  if (c.envoiReponse === "acceptee") return "accepté";
  if (c.envoiReponse === "refusee") return "refusé";
  // « correction » n'est pas un refus : le client veut le même devis, corrigé.
  // Les confondre ferait croire une affaire perdue là où elle se rattrape.
  if (c.envoiReponse === "correction") return "correction demandée";
  return "parti";
}

export function portesDuPlanning(
  c: ChantierPourPortes,
  aujourdHui: string = jourIso(new Date())
): PorteDuPlanning[] {
  const portes: PorteDuPlanning[] = [];
  const aEuLieu = ongletDepuisJalons(c, aujourdHui) === "termines";

  // ── La facture ────────────────────────────────────────────────────────────
  // **Elle n'apparaît que si le chantier a eu lieu.** Proposer « Créer la
  // facture » sur un chantier de la semaine prochaine, c'est offrir un geste
  // qui ne peut mener qu'à une facture fausse — et c'est le patron qui la
  // signerait.
  if (c.factureEnvoyeeAt) {
    portes.push({
      cle: "facture",
      libelle: "La facture",
      etat: "envoyée",
      // Une facture partie ne se « fait » plus : elle se consulte. L'appeler un
      // geste lui donnait le bouton plein de l'écran, et c'est ce que la revue
      // de la planche a corrigé le 4 septembre.
      geste: false,
      href: `/chantiers/${c.id}/facture`,
    });
  } else if (aEuLieu) {
    portes.push({
      cle: "facture",
      libelle: "Créer la facture",
      etat: "",
      geste: true,
      href: `/chantiers/${c.id}/facture`,
    });
  }

  // ── Le devis ──────────────────────────────────────────────────────────────
  // **Toujours là, et c'est le seul chemin qui restait.** Un chantier posé
  // quitte l'onglet « Chantiers » (`onglet-chantier.ts`) : sans cette porte, son
  // devis n'est plus joignable que par son adresse — exactement ce qu'il
  // signalait le 8 août 2026, *« comment moi je fais pour avoir accès au
  // devis ? »*.
  //
  // **Deux destinations, et c'est la règle de la fiche, pas une nouvelle**
  // (`getSecondarySteps`, 20 août 2026) : avant l'envoi, `/export` renvoie de
  // lui-même vers le devis et la cascade se voit à l'œil ; après l'envoi, c'est
  // lui qu'il faut — il porte le lien du client et la reprise. Le planning
  // connaît l'envoi sous le nom de `envoiEnvoyeAt` : c'est le même événement.
  portes.push({
    cle: "devis",
    libelle: "Le devis",
    etat: etatDuDevis(c),
    geste: false,
    href: c.envoiEnvoyeAt ? `/chantiers/${c.id}/export` : `/chantiers/${c.id}/devis-complet`,
  });

  // ── La fiche client ───────────────────────────────────────────────────────
  // Les photos, la dictée et les coordonnées y vivent depuis le 31 août. La
  // porte MÈNE, elle ne recopie rien : c'est sa condition du 1er septembre.
  portes.push({
    cle: "client",
    libelle: "La fiche client",
    etat: "",
    geste: false,
    href: `/chantiers/${c.id}/coordonnees`,
  });

  return portes;
}


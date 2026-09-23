/**
 * LE RETOUR D'INTERVENTION — ce que le salarié laisse en partant, et ce que le
 * patron en lit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **D'OÙ ÇA VIENT.** Sa décision du 8 septembre 2026, prise sur maquette :
 * *« une feuille de preuve de fin de chantier que le salarié remplira ou non,
 * ça sera au patron de décider — mais sur cette feuille il marquera ce qu'ils
 * ont fait sur le chantier avec photo à l'appui »*, puis *« dans la catégorie
 * terminé […] une sous-catégorie retour d'intervention […] listés par client
 * […] et il faut pouvoir les garder longtemps »*.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **POURQUOI CES RÈGLES SONT PURES, ET POURQUOI ELLES SONT SEULES.**
 *
 * Les mêmes décisions servent à deux endroits : l'écran du salarié, qui dit
 * sous le bouton ce que le patron attend encore ; et la page du patron, qui
 * compte et range. Deux rédactions divergeraient au premier réglage ajouté.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **CE QUI MANQUE NE BLOQUE PLUS L'ENVOI — sa règle du 19 septembre 2026 :**
 * *« il faut qu'on puisse l'envoyer même si on ne met pas de photo ou si tout
 * n'est pas coché, parce qu'un chantier de 8 jours, il faut pouvoir faire
 * plusieurs retours d'intervention jour après jour »*. Jusque-là, l'écran
 * grisait « C'est fini » et le serveur refusait tant qu'il manquait une case
 * ou une photo — juste pour un chantier d'un jour, faux pour un chantier de
 * huit, où le retour du soir 2 est forcément incomplet. `ceQuiManque` reste :
 * il dit ce que le patron attend, il ne l'impose plus. `peutPoserLeRetour`,
 * qui verrouillait, est parti avec le verrou (`CLAUDE.md` §4 quinquies).
 *
 * Ni base, ni réseau, ni date.
 */

import { dansLaPeriode } from "./periode";

/** Une tâche du retour : le libellé recopié du devis, et si elle a été faite. */
export type TacheDuRetour = {
  libelle: string;
  faite: boolean;
};

/** Ce que le patron a réglé pour toute son équipe (migration 0080). */
export type ReglesDuRetour = {
  /** Le retour est-il exigé en fin de chantier ? */
  demande: boolean;
  /** Faut-il au moins une photo ? N'a de sens que si `demande` est vrai. */
  photoExigee: boolean;
};

/** Ce que le salarié a sous les doigts au moment d'appuyer. */
export type CeQuIlAPose = {
  taches: readonly TacheDuRetour[];
  /** Combien de photos il a cochées — le nombre suffit à décider. */
  photos: number;
};

/**
 * Ce que le patron attend encore sur ce retour — **en toutes lettres, sous le
 * bouton, AVANT l'appui**. Un rappel, pas un verrou : le retour du jour part
 * quand même (sa règle du 19 septembre 2026, en tête de ce fichier).
 *
 * **Le tableau est vide quand rien ne manque**, et l'écran n'écrit alors rien.
 *
 * **Rien n'est attendu quand le patron n'a rien demandé.** C'est sa décision du
 * 8 septembre : le salarié « remplira ou non ». Sans réglage allumé, un retour
 * vide dit seulement « je suis passé ».
 */
export function ceQuiManque(
  pose: CeQuIlAPose,
  regles: ReglesDuRetour
): string[] {
  if (!regles.demande) return [];

  const manques: string[] = [];
  if (pose.taches.every((t) => !t.faite)) manques.push("cochez ce que vous avez fait");
  if (regles.photoExigee && pose.photos === 0) manques.push("ajoutez une photo");
  return manques;
}

/**
 * La phrase qui dit ce qui manque, ou la chaîne vide.
 *
 * **Une seule fonction l'écrit**, pour l'écran comme pour le refus du serveur :
 * deux formulations du même refus finissent par se contredire, et c'est celle
 * qu'il lit sur son téléphone qui paraîtra fausse.
 */
export function phraseDeCeQuiManque(
  pose: CeQuIlAPose,
  regles: ReglesDuRetour
): string {
  return ceQuiManque(pose, regles).join(" et ");
}

/**
 * « 2 sur 3 faites » — ce que le patron lit en premier, sur la liste.
 *
 * **« Tout fait » quand rien ne manque**, plutôt que « 3 sur 3 » : c'est
 * l'information qu'il cherche, et un rapport de deux nombres égaux se relit
 * deux fois pour s'en assurer.
 *
 * Un retour sans aucune tâche — le chantier n'avait pas de devis détaillé —
 * rend la chaîne vide : il n'y a rien à compter, et « 0 sur 0 » ferait croire
 * à une perte.
 *
 * ---------------------------------------------------------------------------
 * **« TOUT FAIT » A ÉTÉ RETIRÉ LE 9 SEPTEMBRE 2026, et c'est lui qui l'a vu.**
 * Sa capture portait « tout fait · 2 photos », et son verdict : *« il y a
 * marqué tout fait, mais ce n'est pas ce qui a été fait »*.
 *
 * Le mot résumait un chiffre qu'il ne pouvait pas vérifier : quatre cochées
 * sur quatre s'écrivait pareil qu'un devis d'une seule ligne. **Un compte se
 * vérifie d'un coup d'œil, un résumé se croit** — et ce qu'il regarde ici
 * décide s'il facture un travail qui a eu lieu.
 */
export function compteDesTaches(taches: readonly TacheDuRetour[]): string {
  if (taches.length === 0) return "";
  const faites = taches.filter((t) => t.faite).length;
  return `${faites} sur ${taches.length}`;
}

/** Un retour, tel que la page du patron le reçoit. */
export type RetourEnListe = {
  id: string;
  clientNom: string;
  chantierNom: string;
  /** ISO, du plus récent au plus ancien une fois rangé. */
  poseLe: string;
  posePar: string | null;
  taches: readonly TacheDuRetour[];
  /**
   * Ses photos, avec de quoi les AFFICHER — et non leur seul nombre.
   *
   * La liste annonçait « 2 photos » sans jamais les montrer : un chiffre qu’il
   * ne pouvait pas ouvrir, sur les seules images qui prouvent le chantier
   * (sa capture du 9 septembre 2026).
   */
  photos: readonly { id: string; storageKey: string }[];
  aSignaler: string | null;
  /**
   * **LUI** l’a déjà ouvert — pas « quelqu’un ».
   *
   * Sa demande du 9 septembre 2026 : *« il faut qu’on puisse distinguer du
   * premier coup d’œil ceux pas ouverts, comme pour les SMS »*. `/termines`
   * étant ouvert au propriétaire comme à la facturation, une lecture partagée
   * ferait disparaître sa pastille parce qu’un autre a ouvert le matin.
   */
  vu: boolean;
};

/** Un client et ses retours, du plus récent au plus ancien. */
export type GroupeDeRetours = {
  client: string;
  retours: RetourEnListe[];
};

/**
 * Le nom tel qu'on le CHERCHE : sans accents ni casse.
 *
 * « Côsta » tapé à la volée doit trouver « Costa » — il tape d'une main, et un
 * filtre qui ne rend rien se lit comme une liste vide, pas comme une faute de
 * frappe.
 */
export function nomCherche(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Ce que la page affiche : filtré, puis **rangé par client**.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **POURQUOI PAR CLIENT, ET PAS PAR DATE** — c'est sa demande du 8 septembre,
 * et sa raison valait mieux que celle qu'on défendait : un retour se garde des
 * ANNÉES. Rangés par date, les deux passages chez le même client seraient à
 * quinze mois d'écart dans la liste ; rangés par client, ils se lisent côte à
 * côte, et c'est ainsi qu'on retrouve « ce qu'on avait fait la dernière fois ».
 *
 * **L'ordre des clients suit leur retour le plus récent.** Celui qui vient
 * d'arriver est en haut : le patron n'a rien à chercher le soir même. Un ordre
 * alphabétique aurait enterré le retour du jour au milieu du carnet.
 *
 * **La période** — un mois ou un jour, le filtre des fiches de sécurité (*« met
 * le filtre jours mois année de la fiche de sécurité »*, 22 septembre 2026).
 * Absente, rien n'est écarté. **Un nom tapé passe par-dessus**, comme sur les
 * fiches : il sort tous les retours du client, depuis toujours — *« il faut
 * pouvoir les garder longtemps »*, et les retrouver sans tourner la roue.
 */
export function rangerLesRetours(
  retours: readonly RetourEnListe[],
  filtres: { client?: string | null; periode?: string | null } = {}
): GroupeDeRetours[] {
  const cherche = nomCherche(filtres.client ?? "");
  const periode = filtres.periode ?? null;

  const gardes = retours.filter((r) =>
    cherche ? nomCherche(r.clientNom).includes(cherche) : !periode || dansLaPeriode(new Date(r.poseLe), periode)
  );

  const parClient = new Map<string, RetourEnListe[]>();
  for (const r of gardes) {
    const siens = parClient.get(r.clientNom);
    if (siens) siens.push(r);
    else parClient.set(r.clientNom, [r]);
  }

  const groupes = [...parClient.entries()].map(([client, siens]) => ({
    client,
    retours: [...siens].sort((a, b) => (a.poseLe < b.poseLe ? 1 : a.poseLe > b.poseLe ? -1 : 0)),
  }));

  // Le client dont le dernier retour est le plus récent passe devant.
  return groupes.sort((a, b) => {
    const da = a.retours[0]?.poseLe ?? "";
    const db = b.retours[0]?.poseLe ?? "";
    return da < db ? 1 : da > db ? -1 : 0;
  });
}

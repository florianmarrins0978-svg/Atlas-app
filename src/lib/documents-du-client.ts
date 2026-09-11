/**
 * Les pièces d'un client, rangées — la règle, sans base.
 *
 * **D'où elle vient.** Le patron, le 20 août 2026, sur la fiche d'un client :
 * *« les devis rangés sous l'encadré devis au format PDF, trié par date, de la
 * plus récente à la moins récente »*, puis *« tu peux rajouter une colonne
 * facture et ranger les factures dans le même ordre »*.
 *
 * **UNE SEULE FONCTION POUR LES TROIS COLONNES.** Il a dit « le même ordre »
 * deux fois : trois tris écrits séparément finiraient par diverger, et c'est LUI
 * qui verrait une colonne remonter le temps pendant que les deux autres la
 * descendent (`CLAUDE.md` §3). Le jour où il voudra l'ordre inverse, un seul
 * endroit change.
 *
 * **Une pièce sans date passe en dernier**, jamais en premier. Un document dont
 * on ignore le jour n'est pas le plus récent : le mettre en tête ferait croire
 * qu'on vient de l'établir.
 */

export type PieceDuClient = {
  id: string;
  /** Ce qui se lit en gras : un numéro de devis, ou le jour d'une intervention. */
  titre: string;
  /** Le jour de la pièce, au format `AAAA-MM-JJ`. `null` : inconnu. */
  jour: string | null;
  /** La ligne grise sous le titre — le jour, ou le nom du chantier. */
  precision: string | null;
  /** L'adresse qui ouvre la pièce. */
  href: string;
  /**
   * **Ce que le client a fait de sa facture** — sa réponse du 9 septembre 2026,
   * à la question « en cas de litige, tu vas où ? » : *« je vais dans mes
   * clients sur la catégorie facture »*.
   *
   * Ni « Terminés », ni la fiche du chantier : c'est ICI qu'il cherche. Une
   * preuve qu'on ne trouve pas ne prouve rien.
   *
   * **Ne concerne que les factures**, et reste absente partout ailleurs : un
   * devis parti ne s'ouvre pas, il se répond — et cette réponse-là vit déjà sur
   * l'accueil. Absente aussi sur une facture jamais envoyée : sans lien, il n'y
   * a rien à ouvrir, et « pas encore ouverte » accuserait le client d'un envoi
   * qui n'a pas eu lieu.
   */
  reception?: { ouverte: string | null; confirmee: string | null };
  /**
   * Ce que l'adresse ouvre — un PDF, ou une page.
   *
   * **Le dossier n'a pas que des PDF depuis le 23 août 2026.** Les fiches
   * d'entretien envoyées se lisent à leur adresse publique, celle-là même que
   * le client a reçue : elles ne sont figées nulle part en fichier. Annoncer
   * « PDF » sur leur vignette et proposer « Enregistrer » ferait tomber le
   * patron sur une page web nommée `.pdf` — le défaut du 7 août, dans l'autre
   * sens.
   *
   * Absent vaut `"pdf"` : les devis et les factures ne changent pas.
   */
  format?: "pdf" | "page";
};

/**
 * Du plus récent au plus ancien, les pièces sans date à la fin.
 *
 * **Le tri est stable à date égale** : deux devis émis le même jour gardent
 * l'ordre dans lequel la base les a rendus — c'est-à-dire leur numéro. Un tri
 * qui les intervertirait d'un rafraîchissement à l'autre donnerait l'impression
 * que l'écran bouge tout seul.
 */
export function rangerDuPlusRecent<T extends { jour: string | null }>(pieces: T[]): T[] {
  return pieces
    .map((piece, rang) => ({ piece, rang }))
    .sort((a, b) => {
      if (a.piece.jour === b.piece.jour) return a.rang - b.rang;
      if (a.piece.jour === null) return 1;
      if (b.piece.jour === null) return -1;
      // Les dates sont en `AAAA-MM-JJ` : leur ordre alphabétique EST leur ordre
      // chronologique. Passer par `new Date()` coûterait un fuseau horaire, et
      // un devis du 1er janvier changerait d'année selon l'endroit où on le lit.
      return a.piece.jour < b.piece.jour ? 1 : -1;
    })
    .map(({ piece }) => piece);
}

export type DerniereePrestation = {
  /** Le chantier lui-même — c'est de LUI qu'on repart quand il touche « Refaire »
   *  (`reprendreLesLignesPrix`, 8 septembre 2026). Sans cet identifiant, l'écran
   *  sait ce qu'on a fait la dernière fois mais pas où le relire. */
  id: string;
  /** Le nom du chantier — « Élagage de trois chênes ». */
  nom: string;
  jour: string | null;
  /** Ce qu'elle comprend : les prestations notées sur ce chantier. */
  comprend: string[];
};

/**
 * La dernière chose qu'on a faite chez ce client, et ce qu'elle comprenait.
 *
 * *Sa demande du 20 août :* « en dessous de l'adresse, en titre noir gras,
 * dernière prestation avec ce qu'elle comprend ».
 *
 * **« Dernière » se lit sur la date, pas sur l'ordre d'arrivée en base.** Un
 * chantier créé hier pour une intervention du mois prochain n'est pas la
 * dernière prestation — c'est la prochaine.
 *
 * Rend `null` quand le client n'a aucun chantier : l'écran n'affiche alors rien
 * plutôt qu'un titre vide.
 */
export function dernierePrestation(
  chantiers: { id: string; nom: string; jour: string | null }[],
  prestationsParChantier: Map<string, string[]>
): DerniereePrestation | null {
  const [premier] = rangerDuPlusRecent(chantiers);
  if (!premier) return null;
  return {
    id: premier.id,
    nom: premier.nom,
    jour: premier.jour,
    // **Les libellés vides ne comptent pas.** La table `prestations` les
    // autorise (`default("")`) : une ligne ouverte puis abandonnée y reste, et
    // s'afficherait comme une puce sans texte sous le titre.
    comprend: (prestationsParChantier.get(premier.id) ?? [])
      .map((l) => l.trim())
      .filter((l) => l.length > 0),
  };
}

const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
] as const;

/**
 * « 12 août 2026 » — la seule façon d'écrire une date sur la fiche d'un client.
 *
 * **Vue à la capture, pas au test :** l'écran portait « 12/08/2026 » au-dessus
 * de la dernière prestation et « 12 août 2026 » dans les colonnes, à trois
 * centimètres l'un de l'autre. Deux formats côte à côte font hésiter — est-ce
 * la même date ? — et c'est exactement le genre de détail qui use un écran
 * qu'on ouvre vingt fois par jour (`CLAUDE.md` §5).
 *
 * Le mois est abrégé : sur une colonne de 97 px, « septembre » ne tient pas.
 */
export function jourCourt(iso: string): string {
  const [annee, mois, jour] = iso.split("-");
  const nom = MOIS_COURTS[Number(mois) - 1];
  // Une date qu'on ne sait pas lire se rend telle quelle plutôt que de sortir
  // « undefined » sur l'écran d'un client.
  if (!nom || !annee || !jour) return iso;
  return `${Number(jour)} ${nom} ${annee}`;
}

/**
 * Le nom sous lequel une pièce doit ARRIVER dans son téléphone.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Le patron, le 21 août 2026 :** *« Alors oui, je veux pouvoir
 * l'enregistrer »* — devant des vignettes qui ne savaient qu'ouvrir le PDF.
 * Retenu sur planche : `docs/maquettes/83-enregistrer-le-pdf.html`,
 * **proposition C**.
 *
 * **Pourquoi ce n'est pas un détail.** Un fichier enregistré sans nom prend
 * celui de la page — c'est exactement le défaut du 7 août 2026, sur la
 * facture : *« quand je clique sur télécharger le PDF, ça me propose pas de
 * l'enregistrer »*. Le remède tenait à trois conditions, et le NOM en est une :
 * sans lui, Safari nomme le fichier d'après l'écran, sans extension. Il se
 * retrouve alors avec dix documents indistinguables dans son dossier.
 *
 * **La nature de la pièce se lit dans son adresse, jamais dans son titre.** Le
 * titre est ce qu'il LIT (« n° 2026-0029 », ou un jour) ; l'adresse est ce que
 * le serveur SERT. Deviner « c'est un devis » à partir d'un libellé, c'est se
 * fier à un mot que la prochaine demande peut changer.
 */
export function natureDeLaPiece(href: string): "facture" | "devis" | "fiche-chantier" {
  return href.includes("/api/factures/") ? "facture" : href.includes("/api/devis/") ? "devis" : "fiche-chantier";
}

/**
 * Le numéro commercial d'une pièce, ou `null` si son titre n'en porte pas.
 *
 * Un numéro s'écrit « n° 2026-0029 » à l'écran : on garde les chiffres et le
 * tiret, on jette le reste. Un nom de fichier qui porterait « n° » et son
 * espace insécable se recopie mal et se cherche encore plus mal — et sur
 * l'en-tête de la visionneuse, en 36 px, « n° » fait passer le numéro à la
 * ligne.
 */
export function numeroDeLaPiece(titre: string): string | null {
  const numero = titre.replace(/^n[°o]\s*/i, "").trim();
  return /^[0-9]{4}-[0-9]+$/.test(numero) ? numero : null;
}

export function nomDuFichierDeLaPiece(piece: PieceDuClient): string {
  const genre = natureDeLaPiece(piece.href);
  const numero = numeroDeLaPiece(piece.titre);
  if (numero) return `${genre}-${numero}.pdf`;

  // Une fiche de chantier n'a pas de numéro : elle porte son JOUR, et au format
  // de tri (AAAA-MM-JJ) plutôt que « 12 août ». Rangés dans un dossier, dix
  // fichiers se classent alors d'eux-mêmes dans l'ordre du temps.
  if (piece.jour) return `${genre}-${piece.jour}.pdf`;

  // Ni numéro ni jour : on ne fabrique pas un nom qui ferait croire à une date.
  return `${genre}.pdf`;
}

/**
 * LA DERNIÈRE CHOSE QUI S'EST PRODUITE CHEZ UN CLIENT.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 9 septembre 2026 :** *« Remplace par la dernière chose qui
 * s'est produit »*, après avoir demandé à quoi correspondait le compte de
 * chantiers de la liste — *« certains clients ont 8 chantiers, on s'attend à
 * avoir 8 devis alors qu'il y en a 0 »*.
 *
 * **Le compte était juste, et c'est bien le problème.** Il comptait tous les
 * chantiers ouverts, quel que soit leur état : un chantier naît d'une dictée,
 * bien avant qu'il y ait le moindre devis. La ligne annonçait donc du travail
 * là où la fiche n'avait rien à montrer, et c'est cette promesse-là qui l'a
 * envoyé vérifier.
 *
 * **LA RÈGLE QUI REMPLACE, ET ELLE TIENT EN UNE PHRASE : la ligne annonce ce
 * que la fiche contient.** Les trois candidats sont exactement les trois
 * registres de la fiche — Devis, Facture, Fiche — et rien d'autre. Ce qu'il lit
 * dans la liste, il le trouve en ouvrant ; c'est ce qui rend la déception
 * impossible à refaire.
 *
 * **Un chantier ouvert n'en est donc PAS un.** Il ne se voit nulle part sur la
 * fiche, et l'annoncer recréerait le défaut sous un autre nom.
 *
 * **À égalité de jour, le plus AVANCÉ du parcours gagne** — facture, puis
 * devis, puis fiche. Un devis envoyé et facturé le même jour est un chantier
 * facturé : c'est l'état le plus récent des deux, et l'ordre du parcours le dit
 * mieux que l'ordre d'arrivée en base, qui ne promet rien.
 */
export type TraceDuClient = {
  /** Le mot qu'on lit sur la ligne — celui du registre de la fiche. */
  quoi: "Devis" | "Facture" | "Fiche";
  jour: string;
};

/** Du plus avancé au moins avancé : ce qui départage deux dates identiques. */
const PARCOURS = ["Facture", "Devis", "Fiche"] as const;

export function derniereTraceDuClient(jours: {
  /** Le jour du dernier devis PARTI. `null` : aucun n'est parti. */
  devis: string | null;
  /** Le jour de la dernière facture ÉMISE. */
  facture: string | null;
  /** Le jour de la dernière fiche d'entretien ENVOYÉE. */
  fiche: string | null;
}): TraceDuClient | null {
  const candidats: TraceDuClient[] = [];
  if (jours.facture) candidats.push({ quoi: "Facture", jour: jours.facture });
  if (jours.devis) candidats.push({ quoi: "Devis", jour: jours.devis });
  if (jours.fiche) candidats.push({ quoi: "Fiche", jour: jours.fiche });
  if (candidats.length === 0) return null;

  return candidats.reduce((garde, essai) => {
    const ecart = essai.jour.localeCompare(garde.jour);
    if (ecart > 0) return essai;
    if (ecart < 0) return garde;
    return PARCOURS.indexOf(essai.quoi) < PARCOURS.indexOf(garde.quoi) ? essai : garde;
  });
}

/**
 * La date telle qu'elle s'écrit sur UNE LIGNE DE LISTE : sans l'année quand
 * c'est celle qui court.
 *
 * **Née d'une mesure, pas d'un goût — 9 septembre 2026.** La ligne d'un client
 * porte son adresse ET la dernière chose qui s'est produite. Sur son téléphone,
 * la deuxième ligne dispose de 316 px : « 4 Clos Moutier 78200
 * Fontenay-Mauvoisin · Devis 2 sept. 2026 » n'y tient pas, et se coupe. Or
 * l'adresse est ce qui sépare quatre clients du même nom (sa demande du
 * 3 septembre) — la rogner pour afficher une année qu'on connaît déjà, c'est
 * échanger ce qui sert contre ce qui ne sert pas.
 *
 * **Les quatre caractères de l'année suffisent à faire la différence** : sans
 * eux, la ligne mesure exactement ce que mesurait « · 8 chantiers », qu'elle
 * remplace. Rien ne se coupe qui ne se coupait déjà.
 *
 * **Et l'année reparaît dès qu'elle apprend quelque chose.** Un devis de l'an
 * dernier s'écrit « 12 juin 2025 » : c'est précisément le client qu'on n'a pas
 * revu, et l'omettre laisserait croire à un document récent.
 *
 * **Le même mois, la même abréviation, la même source** que `jourCourt` — un
 * second tableau de mois finirait par dire « sept. » d'un côté et « sep. » de
 * l'autre (`CLAUDE.md` §3).
 *
 * @param aujourdHui Le jour tel que l'application le compte, **posé au
 * serveur** : lu dans le navigateur, il donnerait l'horloge du téléphone, et
 * l'année changerait de valeur entre minuit et deux heures du matin.
 */
export function jourDeLaLigne(iso: string, aujourdHui: string): string {
  const complet = jourCourt(iso);
  const anneeDuJour = aujourdHui.slice(0, 4);
  // `jourCourt` rend la date telle quelle quand il ne sait pas la lire : on ne
  // rogne alors rien du tout, plutôt que d'amputer une chaîne inconnue.
  if (!complet.endsWith(` ${anneeDuJour}`)) return complet;
  return complet.slice(0, -(anneeDuJour.length + 1));
}

/**
 * QUI ATTEINT QUOI — et l'unique endroit où la question se tranche.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La règle vient du patron**, `docs/QUESTIONS.md` §10, tranchée le 13 août
 * 2026 et précisée le 23 :
 *
 * > *« Les commerciaux auront accès à l'entièreté de l'application, sauf aux
 * > réglages pour modifier la mise en page des devis et aux informations liées
 * > à l'entreprise. Et les salariés, eux, auront accès qu'à la catégorie
 * > planning. »*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI UNE FONCTION PURE, ET POURQUOI ELLE EST SEULE.**
 *
 * La même liste sert à trois choses : dessiner la barre du bas, dessiner le
 * sommaire des réglages, et REFUSER une adresse tapée à la main. Deux
 * rédactions de la même règle finissent toujours par diverger (`CLAUDE.md` §3),
 * et ici la divergence porte un nom : un salarié qui ouvre l'adresse d'un PDF de
 * devis et y lit vos marges parce que seul le BOUTON avait été retiré.
 *
 * C'est exactement ce que §10 refuse d'avance : *« Les montants ne doivent pas
 * sortir du serveur pour qui n'a pas le droit de les voir — ni dans la page, ni
 * dans le PDF, ni dans une réponse d'API. »*
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **DEUX SENS OPPOSÉS, ET C'EST DÉLIBÉRÉ.**
 *
 * | Rôle | Comment la liste se lit |
 * |---|---|
 * | commercial | **tout, SAUF** ce qui est nommé |
 * | salarié | **rien, SAUF** ce qui est nommé |
 *
 * Le salarié se garde par liste blanche parce qu'un écran neuf, ajouté demain
 * par une autre session, doit lui être **fermé d'office**. Une liste noire
 * l'aurait ouvert en silence — et personne ne s'en apercevrait avant qu'il y
 * lise un prix. Le commercial, lui, a droit à l'application entière : lui poser
 * une liste blanche obligerait à l'étendre à chaque écran neuf, et l'oubli se
 * verrait tout de suite (il vient se plaindre), donc il ne coûte rien.
 */

/**
 * LES QUATRE RÔLES. `membre` n'existe plus : repris en `salarie` (migration 0065).
 *
 * **`facturation` est arrivé le 30 août 2026**, pour figer le modèle avant le
 * premier artisan réel : *« une entreprise doit pouvoir avoir plusieurs
 * utilisateurs au service facturation, chacun avec son compte »*. Ce n'est pas
 * une session partagée « Facturation » — c'est un rôle, que plusieurs personnes
 * portent, chacune avec son identité (`membres_entreprise` a une clé unique sur
 * (entreprise, personne), jamais sur (entreprise, rôle)).
 *
 * **L'ordre de cette liste est celui de l'écran des accès** : du plus large au
 * plus fermé. Le patron le lit de haut en bas pour choisir.
 */
export type Role = "proprietaire" | "facturation" | "commercial" | "salarie";

export const ROLES: readonly Role[] = ["proprietaire", "facturation", "commercial", "salarie"] as const;

/** Ce que la personne voit du planning. Réglé PAR PERSONNE, jamais par rôle. */
export type PorteePlanning = "tout" | "ses_equipes";

export function estRole(valeur: string | null | undefined): valeur is Role {
  return typeof valeur === "string" && (ROLES as readonly string[]).includes(valeur);
}

/**
 * Le mot à l'écran. **« Patron », pas « Propriétaire »** : c'est celui de sa
 * planche (`maquettes/atlas-reglages-equipe.html`) et celui qu'il emploie.
 */
export function libelleRole(role: Role): string {
  switch (role) {
    case "proprietaire":
      return "Patron";
    case "facturation":
      return "Facturation";
    case "commercial":
      return "Commercial";
    case "salarie":
      return "Salarié";
  }
}

/**
 * Ce qu'un commercial n'atteint pas.
 *
 * Les deux premiers sont ses mots du 23 août. Les trois suivants demandent une
 * ligne chacun, parce qu'ils ne sont pas dans sa phrase :
 *
 * - **les accès** : un commercial qui donne les accès se nomme patron en deux
 *   appuis, et le rôle entier ne veut alors plus rien dire. Ce n'est pas une
 *   restriction de plus, c'est ce qui rend les autres vraies ;
 * - **l'abonnement** et **l'export des données** : le contrat Atlas, le moyen de
 *   paiement et l'export intégral de l'entreprise. C'est la même famille que
 *   « les informations liées à l'entreprise », qu'il a nommée — et sa table du
 *   13 août les excluait déjà, mot pour mot.
 */
const FERME_AU_COMMERCIAL = [
  // « la mise en page des devis » — ses mots.
  "/reglages/documents",
  // « les informations liées à l'entreprise » — ses mots. Identité, SIRET, IBAN.
  "/reglages/identite",
  "/reglages/equipe",
  "/reglages/abonnement",
  "/reglages/donnees",
  // ───────────────────────────────────────────────────────────────────────
  // **LA FACTURATION, ET C'EST SA RÈGLE DU 13 AOÛT — pas une nouveauté.**
  //
  // `docs/QUESTIONS.md` §10, sa table, ses mots : le commercial a *« les
  // chantiers, le planning, les devis et les prix — il en a besoin pour
  // vendre. **Ni les factures, ni la TVA**, ni l'IBAN, ni les accès, ni
  // l'abonnement. »*
  //
  // **Elle n'a jamais été appliquée.** Jusqu'au 30 août 2026, toutes les
  // actions d'argent — émettre une facture, la porter au relevé de TVA, noter
  // un paiement, ranger un ticket — passaient par une seule garde
  // (`peutVoirLesMontants`, c'est-à-dire « tout sauf le salarié »). Un
  // commercial émettait donc des factures, et l'écran des accès lui promettait
  // même « Les factures et le relevé de TVA » : la promesse disait l'inverse
  // de la règle.
  //
  // « Terminés » porte les deux, la liste des chantiers facturables et le
  // relevé de TVA : c'est l'écran de la facturation, il se ferme en entier.
  "/termines",
] as const;

/**
 * L'écran de la facture d'un chantier, et le PDF qu'il produit.
 *
 * **Ils ne peuvent pas s'écrire dans la liste ci-dessus** : leur adresse porte
 * l'identifiant du chantier au milieu (`/chantiers/<id>/facture`), et un
 * préfixe ne sait pas décrire cela. Le PDF suit le même sort — un écran fermé
 * dont le document reste téléchargeable ne ferme rien (`docs/QUESTIONS.md`
 * §10 : *« ni dans la page, ni dans le PDF, ni dans une réponse d'API »*).
 *
 * **Le devis, lui, reste ouvert** : le commercial le rédige et l'envoie. C'est
 * toute la frontière du rôle, et elle passe entre les deux documents.
 */
const FACTURE_DU_CHANTIER = [
  /^\/chantiers\/[^/]+\/facture(\/.*)?$/,
  /^\/api\/factures\/[^/]+(\/.*)?$/,
];

/**
 * **`/reglages/tarifs` et `/reglages/prix` NE sont PAS dans cette liste, et
 * pourtant un commercial n'y lit rien aujourd'hui.**
 *
 * Ces deux pages portent leur propre garde `estProprietaire` depuis le 23 août,
 * et elles la gardent : les rendre *lisibles sans être modifiables* est un
 * travail d'écran, qui se dessine avant de se coder. Le commercial voit donc la
 * rubrique et lit, en l'ouvrant, à qui elle appartient (`RubriqueReservee` —
 * elle explique, elle ne refuse pas).
 *
 * **Elles ne sont pas fermées ICI parce que la règle du patron dit l'inverse** —
 * *« il lit les tarifs, il ne les change pas »* (13 août) : les inscrire
 * ci-dessus graverait dans la règle un état qui n'est que provisoire, et les
 * retirerait de son sommaire le jour où l'écran sera fait. C'est noté dans
 * `TODO.md`, pas caché ici.
 */

/**
 * Ce qu'un salarié atteint, et **rien d'autre**.
 *
 * *« Les salariés, eux, auront accès qu'à la catégorie planning »* (23 août).
 * S'y ajoutent deux choses qu'il a demandées ailleurs, et une qui est une
 * obligation :
 *
 * - **la feuille de chantier en PDF** — le devis sans un seul montant, sa
 *   décision du 21 août : *« le plus simple, ça serait de mettre le devis en PDF
 *   sans les prix »*. C'est le SEUL document qu'un salarié verra jamais, et le
 *   planning est le seul endroit d'où il l'ouvre ;
 * - **ses propres réglages** — *« un salarié peut changer ses notifications ou
 *   son mot de passe »* (13 août). Quelles rubriques exactement, c'est
 *   `rubriquesReglages` qui le dit, pas cette liste-ci ;
 * - **les documents légaux**, qu'il doit accepter pour entrer : les lui fermer
 *   l'enfermerait dehors.
 *
 * **`/chantiers/…` n'y est PAS, et c'est le point le plus important de ce
 * fichier.** La fiche d'un chantier porte le devis, les prix, la facture. Ce que
 * le patron appelle « ses chantiers autorisés », un salarié l'obtient par le
 * planning — la carte du chantier (nom, client, adresse, téléphone, créneau,
 * pense-bête) et la feuille sans montants —, jamais par cette page-là.
 */
const OUVERT_AU_SALARIE = [
  "/planning",
  "/reglages",
  "/documents-legaux",
  // Les polices du rendu et les sondes de santé : aucune donnée d'entreprise.
  "/api/polices",
  "/api/health",
] as const;

/**
 * Les réglages qui appartiennent à la PERSONNE — elle les emporte d'une
 * entreprise à l'autre, et son rôle n'y change rien.
 *
 * *« Un salarié peut changer ses notifications ou son mot de passe, mais il ne
 * doit évidemment pas pouvoir modifier les tarifs ou les coordonnées
 * bancaires »* (13 août 2026).
 */
const REGLAGES_A_SOI = [
  "/reglages/compte",
  "/reglages/notifications",
  "/reglages/connexion",
  "/reglages/apparence",
] as const;

/**
 * CE QUE LA FACTURATION ATTEINT, ET RIEN D'AUTRE.
 *
 * **Une liste blanche, comme le salarié, et pas une liste noire comme le
 * commercial.** La raison est celle du haut de ce fichier, et elle vaut ici
 * plus qu'ailleurs : un écran neuf, ajouté demain par une autre session, doit
 * être **fermé d'office** à un rôle dont le métier est borné. Le commercial a
 * droit à l'application entière moins quelques pages — l'oubli s'y verrait tout
 * de suite, il vient se plaindre. La facturation, elle, ne saurait pas qu'un
 * écran de réglage vient de s'ouvrir à elle.
 *
 * **Ce qu'elle a, et pourquoi :** le cycle client → devis → facture, et rien de
 * plus. Les chantiers parce que le devis y vit, les clients parce qu'elle les
 * crée et corrige, « Terminés » parce que c'est là que la facture se fait et
 * que le relevé de TVA se lit.
 *
 * **`/planning` y est, en LECTURE seule** — sa consigne du 30 août : *« si
 * Facturation doit voir le planning uniquement pour comprendre la date d'un
 * chantier avant facturation, donne le minimum nécessaire. Ne lui donne pas
 * automatiquement l'écriture. »* Cette liste-ci ouvre l'écran ; c'est
 * `peutModifierLePlanning` qui refuse d'y écrire, et les deux sont séparées
 * exprès (le salarié vit sous le même partage depuis le 30 août).
 *
 * **`/paysage` n'y est PAS** : l'arrosage, le diagnostic végétal et les fiches
 * d'entretien sont les outils du terrain. Rien n'y sert à facturer.
 */
const OUVERT_A_LA_FACTURATION = [
  // L'accueil : la liste des chantiers. `sousChemin` ne rend vrai que pour « / »
  // exactement — « /reglages » ne commence pas par « // ».
  "/",
  "/chantiers",
  "/clients",
  "/planning",
  "/termines",
  "/reglages",
  "/documents-legaux",
  // Les documents et pièces jointes du cycle. Le PDF du devis ET celui de la
  // facture : elle envoie les deux.
  "/api/chantiers",
  "/api/devis",
  "/api/factures",
  "/api/fichiers",
  "/api/notes-vocales",
  "/api/adresses",
  "/api/polices",
  "/api/health",
] as const;

/** La feuille de chantier sans montants : `/api/chantiers/<id>/feuille/pdf`. */
const FEUILLE_SANS_MONTANTS = /^\/api\/chantiers\/[^/]+\/feuille\/pdf\/?$/;

function sousChemin(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

/**
 * Cette personne a-t-elle le droit d'ouvrir cette adresse ?
 *
 * **Ne connaît pas les chemins PUBLICS**, et ne doit pas les connaître : ceux-là
 * s'atteignent sans compte, donc sans rôle (`src/lib/chemins-publics.ts`). Les
 * mêler ici ferait naître la seconde liste que ce dépôt a déjà payée deux fois.
 */
export function cheminAutorise(role: Role, chemin: string): boolean {
  // Une adresse qu'on ne sait pas lire n'est pas une adresse autorisée.
  if (!chemin.startsWith("/")) return false;

  if (role === "proprietaire") return true;

  if (role === "commercial") {
    if (FACTURE_DU_CHANTIER.some((motif) => motif.test(chemin))) return false;
    return !FERME_AU_COMMERCIAL.some((p) => sousChemin(chemin, p));
  }

  if (role === "facturation") {
    if (!OUVERT_A_LA_FACTURATION.some((p) => sousChemin(chemin, p))) return false;
    return reglagesASoi(chemin);
  }

  if (FEUILLE_SANS_MONTANTS.test(chemin)) return true;
  if (!OUVERT_AU_SALARIE.some((p) => sousChemin(chemin, p))) return false;

  return reglagesASoi(chemin);
}

/**
 * **LES RÉGLAGES SONT OUVERTS, MAIS PAS TOUS LES RÉGLAGES** — pour le salarié
 * comme pour la facturation.
 *
 * `/reglages` mène à son compte, son mot de passe et ses notifications ; il ne
 * mène ni aux tarifs ni à l'identité de l'entreprise.
 *
 * **Ce fichier-ci décide, le sommaire ne fait qu'obéir.** `rubriques-reglages`
 * filtre SES rubriques par `cheminAutorise` — jamais l'inverse : une seconde
 * liste écrite là-bas se serait tue le jour où l'on ajoute une rubrique ici, et
 * la dépendance ne va donc que dans un sens (`CLAUDE.md` §3).
 *
 * **Écrit une fois pour les deux rôles.** Recopié, il aurait ouvert à la
 * facturation une rubrique d'entreprise le jour où on l'ajoute au salarié, ou
 * l'inverse — et l'écart ne se serait vu nulle part.
 *
 * Rend `true` pour tout ce qui n'est pas un réglage : les deux rôles sont déjà
 * passés par leur liste blanche quand ils arrivent ici.
 */
function reglagesASoi(chemin: string): boolean {
  if (!sousChemin(chemin, "/reglages")) return true;
  if (chemin === "/reglages") return true;
  return REGLAGES_A_SOI.some((h) => sousChemin(chemin, h));
}

/**
 * Où l'on renvoie quelqu'un qui a visé une adresse qui n'est pas la sienne.
 *
 * **Toujours une adresse que le rôle atteint** : un refus qui renverrait vers un
 * autre refus tournerait en boucle, et le navigateur n'afficherait plus rien du
 * tout. `/planning` est ouvert aux trois rôles — c'est ce qui rend ce repli sûr
 * par construction.
 */
export function accueilDuRole(role: Role): string {
  return role === "salarie" ? "/planning" : "/";
}

/**
 * Les onglets du bas, pour ce rôle.
 *
 * **La barre se dessine à partir de la MÊME règle qui refuse.** Un onglet
 * affiché qui mènerait à un refus se lit comme une panne ; un onglet caché dont
 * l'adresse répondrait quand même serait un mensonge. Les deux viennent d'ici.
 */
export function ongletsDuRole(role: Role, onglets: readonly { href: string }[]): { href: string }[] {
  return onglets.filter((o) => cheminAutorise(role, o.href));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES CAPACITÉS — et pourquoi elles s'écrivent TOUTES en liste blanche.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'au 30 août 2026, elles s'écrivaient `role !== "salarie"`. C'était juste
 * tant qu'il n'existait que trois rôles dont un seul était fermé — et **c'est
 * devenu un piège à l'instant où `facturation` est né** : la formule l'aurait
 * accueilli partout, en silence, sans qu'aucune ligne de ce fichier ne change.
 * Un rôle neuf serait arrivé avec le droit d'émettre des factures.
 *
 * Chaque capacité **nomme donc qui l'a**. Un cinquième rôle, ajouté demain par
 * une autre session, naît sans aucun droit et doit s'inscrire ici, un par un.
 * C'est plus long à écrire une fois, et c'est la seule version qui se relit.
 *
 * **Elles ne s'appellent pas entre elles quand elles coïncident.** Deux règles
 * qui rendent aujourd'hui le même verdict resteront deux règles : les lier
 * ferait qu'élargir l'une élargit l'autre, pour une raison sans rapport et sans
 * un mot. Le dépôt a déjà pris cette décision deux fois — `peutUtiliserLAssistant`
 * et `peutModifierLePlanning` — et elle ne se rediscute pas.
 */

/**
 * **Cette personne peut-elle voir un montant ?** — LIRE, pas écrire.
 *
 * Le patron chiffre, le commercial vend (*« il en a besoin pour vendre »*,
 * 13 août), la facturation facture. Le salarié, jamais : c'est toute la raison
 * de la feuille sans prix.
 *
 * **Ne dit rien de ce qu'on a le droit d'en FAIRE** : rédiger un devis relève
 * de `peutGererDevis`, émettre une facture de `peutFacturer`. Trois questions
 * distinctes, qui se répondaient toutes par la même fonction avant le 30 août.
 */
export function peutVoirLesMontants(role: Role): boolean {
  return role === "proprietaire" || role === "facturation" || role === "commercial";
}

/**
 * **Cette personne peut-elle rédiger, chiffrer et envoyer un DEVIS ?**
 *
 * Le devis est le document du commercial — c'est le sens même du rôle. La
 * facturation en a besoin aussi : *« consulter, rédiger, créer, modifier,
 * finaliser, envoyer au client »* (sa consigne du 30 août 2026).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI ELLE EXISTE ALORS QU'ELLE REND LE MÊME VERDICT QUE
 * `peutVoirLesMontants`.**
 *
 * Parce que ce sont deux questions différentes, et qu'elles ne coïncident que
 * par accident du moment. Le jour où quelqu'un ouvrira un total au salarié — un
 * récapitulatif de chantier, une ligne « à payer » sur sa feuille —, il
 * touchera à la lecture des montants ; il n'a aucune raison de lui donner du
 * même geste le droit de réécrire un devis envoyé.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QU'ELLE NE COUVRE PAS : LES GRILLES DE TARIFS.**
 *
 * Poser un prix SUR un devis et administrer la grille tarifaire de l'entreprise
 * sont deux gestes distincts, et le dépôt les sépare déjà : `/reglages/tarifs`
 * et `/reglages/prix` portent `exigerProprietaire` depuis le 23 août. Sa règle
 * du 13 août pour le commercial — *« il lit les tarifs, il ne les change pas »* —
 * n'a pas bougé, et ce lot ne l'élargit à personne.
 */
export function peutGererDevis(role: Role): boolean {
  return role === "proprietaire" || role === "facturation" || role === "commercial";
}

/**
 * **Cette personne peut-elle FACTURER ?**
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE N'EST PAS UNE RÈGLE NEUVE — c'est la sienne, du 13 août 2026**, écrite
 * dans `docs/QUESTIONS.md` §10, et jamais appliquée jusqu'ici :
 *
 * > *« Le commercial : les chantiers, le planning, les devis et les prix — il en
 * > a besoin pour vendre. **Ni les factures, ni la TVA**, ni l'IBAN, ni les
 * > accès, ni l'abonnement. »*
 *
 * Toutes les actions d'argent passaient par `peutVoirLesMontants`, qui ne
 * refusait que le salarié : un commercial émettait donc des factures, les
 * portait au relevé de TVA, notait des paiements. Et l'écran des accès lui
 * **promettait** « Les factures et le relevé de TVA » — la promesse disait
 * l'inverse de la règle, ce qui est la pire des deux erreurs : le patron
 * croyait avoir lu ce qu'il avait décidé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **CE QU'ELLE COUVRE, ET QUI SURPREND.**
 *
 * « Terminer le chantier » en fait partie. Ce geste ne change pas seulement un
 * état : il **crée la facture** (`terminerChantier`), et refuse même de le
 * faire tant que le devis n'est pas parti. C'est l'entrée du cycle comptable,
 * pas une case à cocher — la fermer au commercial est la conséquence honnête de
 * sa règle, et elle se paie : un commercial ne clôture plus un chantier.
 *
 * S'y ajoutent l'émission, l'échéance, le lien envoyé au client, les paiements,
 * les achats et les tickets du relevé de TVA.
 *
 * **Elle ne donne AUCUN droit sur ce qui est déjà émis.** L'immuabilité d'une
 * facture, le refus de la réémettre, l'avoir : tout cela vit dans le dépôt
 * (`repositories/factures.ts`) et ne connaît pas les rôles. Facturer est un
 * droit fonctionnel, jamais un droit de casser une protection comptable.
 */
export function peutFacturer(role: Role): boolean {
  return role === "proprietaire" || role === "facturation";
}

/**
 * **CETTE PERSONNE PEUT-ELLE MODIFIER LE PLANNING ? NON POUR LE SALARIÉ.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **La règle vient du patron, le 30 août 2026, et elle est sans nuance :**
 *
 * > *« Un salarié peut uniquement CONSULTER son planning. Il ne doit pouvoir
 * > effectuer AUCUNE modification depuis le planning. »*
 *
 * Aucune suppression, aucun déplacement, aucune replanification, aucune note,
 * aucun changement d'équipe. **Il regarde, il ne touche pas.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE FONCTION NE TOUCHE PAS : LA PORTÉE.**
 *
 * `porteePlanning` dit QUELS chantiers une personne voit — tous, ou ceux de son
 * équipe. C'est un périmètre de LECTURE, réglé par personne, et le patron l'a
 * expressément conservé. La règle ci-dessus est d'un autre ordre : elle dit ce
 * qu'on a le droit d'ÉCRIRE, et elle se lit par rôle.
 *
 * Les deux se cumulent, et l'ordre importe peu — un salarié est refusé par
 * celle-ci avant même qu'on regarde son équipe.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **POURQUOI ELLE N'EST PAS ÉCRITE COMME UN CHEMIN FERMÉ.**
 *
 * La tentation était d'ajouter `/planning` à ce qui est fermé au salarié :
 * `cheminAutorise` aurait alors refusé ses actions d'un seul trait. Elle lui
 * aurait aussi fermé **l'écran**, c'est-à-dire la seule chose qu'il ait dans
 * Atlas. La lecture et l'écriture ne se gardent pas avec la même règle, donc
 * elles ne s'écrivent pas dans la même liste.
 *
 * **Et elle n'appelle pas `peutVoirLesMontants`**, qui rendrait pourtant le
 * même verdict aujourd'hui. Ce sont deux règles différentes qui coïncident :
 * les lier ouvrirait le planning en écriture au salarié le jour où quelqu'un
 * élargirait les montants — en silence, et pour une raison sans rapport.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LE COMMERCIAL ÉCRIT, ET C'EST CONFIRMÉ — pas un reste par défaut.**
 *
 * Le `!== "salarie"` laisse passer le commercial. Ce n'était au soir du 30 août
 * 2026 qu'un non-changement : le patron avait demandé de ne pas toucher à ses
 * droits, donc on n'y avait pas touché. La question lui a été posée telle
 * quelle — *« le commercial garde-t-il le droit d'écrire sur le planning ? »* —
 * et il a répondu **oui**, le même jour.
 *
 * La différence n'est pas d'écriture mais de statut, et elle compte : un droit
 * qui subsiste faute d'avoir été examiné se resserre un jour « par prudence »,
 * au premier lot de sécurité venu. Celui-ci a été examiné, et il tient. Le
 * resserrer demande une nouvelle décision de sa part.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **LA FACTURATION LIT LE PLANNING, ELLE N'Y ÉCRIT PAS** — 30 août 2026 :
 * *« si Facturation doit voir le planning uniquement pour comprendre la date
 * d'un chantier avant facturation, donne le minimum nécessaire. Ne lui donne
 * pas automatiquement l'écriture du planning. »*
 *
 * **Et c'est pourquoi cette fonction ne s'écrit plus `!== "salarie"`.** Sous
 * l'ancienne forme, le rôle `facturation` serait né avec le droit de déplacer
 * et de supprimer des chantiers, sans qu'aucune ligne de ce fichier ne change
 * et sans qu'aucun test ne rougisse. Le partage lecture/écriture posé pour le
 * salarié le 30 août sert donc deux rôles, sans être écrit deux fois.
 */
export function peutModifierLePlanning(role: Role): boolean {
  return role === "proprietaire" || role === "commercial";
}

/**
 * L'assistant, est-ce pour cette personne ? **NON, sauf le patron.**
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **CETTE RÈGLE A CHANGÉ TROIS FOIS EN DEUX JOURS, et il faut les écrire
 * toutes les trois** — une décision dont on ne garde que le dernier état se
 * repose trois mois plus tard, et l'on refait le même chemin.
 *
 * | Quand | Ce qu'il a dit | Ce que ça donnait |
 * |---|---|---|
 * | 25 août 2026 | *« au service de l'utilisateur principal, seulement le principal »* | patron seul |
 * | 26 août, dans la journée | *« oui tu peux l'ouvrir aux commerciaux »* | patron + commercial |
 * | 26 août, le soir | *« les salariés et commerciaux ne doivent pas avoir accès à l'assistant IA »* | **patron seul, à nouveau** |
 *
 * **Son dernier mot fait foi, et il revient au premier.** Ce n'est donc pas un
 * revirement en l'air : c'est la règle du 25 août, qui n'aurait pas dû être
 * élargie.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **ELLE N'APPELLE PLUS `peutVoirLesMontants`, ET C'EST LE POINT.**
 *
 * Tant que les deux disaient la même chose, l'une appelait l'autre — c'était
 * juste (`CLAUDE.md` §3). Elles disent maintenant deux choses différentes : un
 * commercial VOIT les prix, écran par écran, parce que c'est son métier de
 * vendre ; il n'a pas pour autant un assistant qui parcourt l'entreprise
 * entière et répond en une phrase.
 *
 * **La différence n'est pas le prix, c'est la PORTÉE.** L'assistant cherche une
 * ligne dans le devis de n'importe quel client, lit les tarifs, l'identité, ce
 * que chacun a payé — sans qu'on ait à savoir où regarder. C'est un accès
 * transversal, et aucun rôle ne l'a sauf celui qui a déjà tout.
 *
 * Garder l'appel aurait été pire qu'une erreur : le jour où quelqu'un
 * élargirait `peutVoirLesMontants`, l'assistant s'ouvrirait avec, en silence.
 */
export function peutUtiliserLAssistant(role: Role): boolean {
  return role === "proprietaire";
}

/**
 * Ce que le rôle change, en français, pour l'écran qui donne un accès.
 *
 * **Le texte vit ici, avec la règle qu'il décrit.** Écrit dans l'écran, il
 * aurait vieilli à la première restriction déplacée — et une promesse fausse sur
 * un écran d'accès est pire que pas d'écran : le patron croirait avoir fermé.
 */
export function ceQueLeRoleChange(role: Role): { peut: string[]; nonPlus: string[] } {
  switch (role) {
    case "proprietaire":
      return {
        peut: ["Tout Atlas", "Les tarifs, l'identité, l'IBAN, l'abonnement", "Donner et retirer les accès"],
        nonPlus: [],
      };
    /**
     * **« Les factures et le relevé de TVA » a QUITTÉ cette colonne le 30 août
     * 2026, et c'est une correction, pas un choix.** Cet écran promettait au
     * patron l'inverse de sa propre règle du 13 août — *« ni les factures, ni
     * la TVA »* (`docs/QUESTIONS.md` §10). Il donnait donc un accès en croyant
     * en donner un autre, et rien ne pouvait le détromper.
     */
    case "facturation":
      return {
        peut: [
          "Les clients, les devis, les factures",
          "Le relevé de TVA, les paiements, les achats",
          "Le planning, en lecture",
        ],
        nonPlus: [
          "Modifier le planning",
          "Les tarifs et les grilles de prix",
          "L'identité de l'entreprise et l'IBAN",
          "Les accès et l'abonnement",
        ],
      };
    case "commercial":
      return {
        peut: [
          "Les chantiers, le planning, les devis et les prix",
          "Poser, déplacer et supprimer un chantier",
        ],
        nonPlus: [
          "Les factures et le relevé de TVA",
          "La mise en page des devis",
          "L'identité de l'entreprise et l'IBAN",
          "Les accès et l'abonnement",
        ],
      };
    case "salarie":
      return {
        peut: ["Le planning, en lecture", "La feuille de chantier, sans un seul montant"],
        nonPlus: [
          "Modifier le planning",
          "Les prix, les devis, les factures",
          "Les chantiers et les clients",
          "Les réglages de l'entreprise",
        ],
      };
  }
}

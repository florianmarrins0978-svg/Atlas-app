/**
 * Mode d'emploi : La facture, les règlements, Terminés, les retours d'intervention et Ma TVA.
 *
 * Chaque fiche se prouve contre le code (`scripts/test-mode-emploi.ts`) : la
 * règle, la recherche et le pourquoi vivent dans `src/lib/mode-emploi.ts`.
 */
import type { FicheModeEmploi } from "../mode-emploi";

const F = "src/app/chantiers/[id]/facture/FactureClient.tsx";
const R = "src/app/chantiers/[id]/facture/ReglementsRecus.tsx";
const T = "src/app/chantiers/[id]/facture/TransmettreLaFacture.tsx";
const S = "src/app/chantiers/[id]/facture/travaux-supplementaires/TravauxSupplementairesClient.tsx";
const LT = "src/app/termines/ListeTermines.tsx";
const RET = "src/app/termines/retours/ListeDesRetours.tsx";
const TVA = "src/app/termines/tva/page.tsx";
const ATT = "src/app/termines/tva/EnAttenteDePaiement.tsx";
const ACH = "src/app/termines/tva/AchatsTva.tsx";
const PUB = "src/app/factures/[jeton]/page.tsx";

const OU_FACTURE = "« Terminés » dans la barre du bas, puis la ligne du chantier, écran Facture";
const OU_REMPLIR =
  "« Terminés » dans la barre du bas, la ligne du chantier, puis « Remplir la facture » ou « Ajouter des travaux supplémentaires »";
const OU_TVA = "« Terminés » dans la barre du bas, puis « Ma TVA à déclarer »";

export const FICHES_FACTURE: FicheModeEmploi[] = [
  // --- Écran de la facture ---------------------------------------------------
  {
    id: "facture-creer",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas, puis « À facturer » sur la ligne du chantier",
    intitule: "Facturer un chantier terminé",
    motsCles: ["facturer", "facture", "creer", "faire", "preparer", "fin", "termine", "realise", "chantier", "fini"],
    geste:
      "Touchez la ligne du chantier, puis « Créer la facture » : Atlas la prépare à partir du devis. Rien ne part encore.",
    source: F,
    preuves: ["Créer la facture", "Le chantier est réalisé ?"],
    ailleurs: [{ source: LT, preuves: ["À facturer", 'data-atlas="ligne-terminee"'] }],
  },
  {
    id: "facture-titre",
    ecran: "Facture",
    ou: OU_FACTURE,
    intitule: "Donner un titre à la facture",
    motsCles: ["titre", "intitule", "objet", "nommer", "nom", "facture", "amenagement"],
    geste: "Touchez « Titre (optionnel) » sous le numéro de la facture et écrivez-le, par exemple Aménagement du jardin.",
    reserve: "Vide, rien ne s'imprime. Une fois la facture envoyée, il ne se change plus.",
    source: F,
    preuves: ['placeholder="Titre (optionnel)"', "readOnly={emise}"],
  },
  {
    id: "facture-reprendre-devis",
    ecran: "Facture",
    ou: OU_FACTURE,
    intitule: "Mettre la facture à jour après avoir renvoyé un devis corrigé",
    motsCles: ["reprendre", "devis", "corrige", "nouveau", "version", "jour", "ancien", "montants", "retard"],
    geste: "Quand l'écran dit que le devis est parti depuis, appuyez sur « Reprendre ce devis » : la facture prend ses montants.",
    reserve: "N'apparaît que sur une facture pas encore envoyée, quand un devis plus récent est parti.",
    source: F,
    preuves: ["Reprendre ce devis", "est parti depuis. Cette facture porte encore"],
  },
  {
    id: "facture-travaux-supplementaires",
    ecran: "Travaux en plus",
    ou: OU_FACTURE,
    intitule: "Ajouter des travaux supplémentaires sur la facture",
    motsCles: ["supplementaire", "supplementaires", "supplement", "rajouter", "ajouter", "travaux", "plus", "extra", "ligne"],
    geste:
      "En bas de la facture, appuyez sur « Ajouter des travaux supplémentaires », puis « + Ajouter des travaux supplémentaires » : " +
      "écrivez la description, la quantité, l'unité et le prix. Finissez par « Revenir à la facture ».",
    reserve:
      "Seulement tant que la facture n'est pas envoyée. Le devis d'origine ne bouge pas : les lignes s'ajoutent sous « Travaux supplémentaires ».",
    source: F,
    preuves: ['"Ajouter des travaux supplémentaires"', "reprise.aJour &&"],
    ailleurs: [{ source: S, preuves: ['"+ Ajouter des travaux supplémentaires"', "Revenir à la facture", '"Travaux supplémentaires"'] }],
  },
  {
    id: "facture-remplir-sans-devis",
    ecran: "Facture",
    ou: OU_FACTURE,
    intitule: "Écrire les lignes d'une facture faite sans devis",
    motsCles: ["remplir", "lignes", "ligne", "sans", "devis", "depannage", "ecrire", "saisir", "prestation"],
    geste:
      "Appuyez sur « Remplir la facture » en bas de l'écran, puis « + Ajouter une ligne » : écrivez la description, la quantité, l'unité et le prix. " +
      "Finissez par « Revenir à la facture ».",
    reserve: "Une facture sans ligne ou à 0,00 € ne peut pas être envoyée.",
    source: F,
    preuves: ['"Remplir la facture"', "initialFacture.devisId === null"],
    ailleurs: [{ source: S, preuves: ['"+ Ajouter une ligne"', "Revenir à la facture", "Ex : dessouchage de la haie"] }],
  },
  {
    id: "facture-lignes-tva",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Mettre un autre taux de TVA sur des lignes de la facture",
    motsCles: ["tva", "taux", "10", "20", "5", "categorie", "plusieurs", "changer"],
    geste:
      "Appuyez sur « + Ajouter une TVA » : une ligne s'ouvre sous un nouveau taux. Touchez le chiffre à côté de « TVA » pour le changer.",
    source: S,
    preuves: ["+ Ajouter une TVA", "aria-label={`Taux de TVA à"],
  },
  {
    id: "facture-supplement-retirer",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Retirer des travaux supplémentaires de la facture",
    motsCles: ["retirer", "supprimer", "enlever", "effacer", "virer", "supplementaires", "travaux", "lignes"],
    geste: "Appuyez sur le « − » rond, à droite du bandeau de la catégorie : toutes ses lignes partent.",
    reserve: "Il retire la catégorie entière, avec toutes ses lignes. Seulement avant l'envoi de la facture.",
    source: S,
    preuves: ['"Retirer les travaux supplémentaires"', "`Retirer les lignes à"],
  },
  {
    id: "facture-main-doeuvre",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Indiquer la main d'œuvre sur la facture",
    motsCles: ["main", "oeuvre", "mo", "heures", "dont", "facture", "indiquer"],
    geste:
      "Appuyez sur « + Main d’œuvre » et tapez le montant HT : il s'écrit « dont main d’œuvre HT » sous le Total HT. Le « − » rond la retire.",
    source: S,
    preuves: ['data-atlas="poser-main-doeuvre"', "+ Main d"],
    ailleurs: [{ source: "src/app/chantiers/[id]/devis-complet/LigneMainDoeuvre.tsx", preuves: ['data-atlas="retirer-main-doeuvre"'] }],
  },
  {
    id: "facture-remise",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Faire une remise sur la facture",
    motsCles: ["remise", "reduction", "rabais", "ristourne", "geste", "commercial", "pourcentage", "facture"],
    geste:
      "Sous le Total TTC, appuyez sur « + Remise » : 5 % s'inscrit, touchez le chiffre pour le changer. Le « − » rond la retire.",
    source: S,
    preuves: ["<BoutonRemise", "REMISE_PAR_DEFAUT"],
    ailleurs: [
      {
        source: "src/components/atlas/Remise.tsx",
        preuves: ['data-atlas="poser-prix-accorde"', 'REMISE_PAR_DEFAUT = "5"', 'aria-label="Remise, en pourcentage"'],
      },
      { source: "src/lib/reduction-devis.ts", preuves: ['LIBELLE_REDUCTION = "Remise"'] },
    ],
  },
  {
    id: "facture-reglement-recu",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Noter sur la facture un acompte ou un règlement déjà reçu",
    motsCles: ["acompte", "acomptes", "reglement", "recu", "arrhes", "avance", "deduire", "verse", "paye"],
    geste:
      "Sous le Total TTC, appuyez sur « + Règlement reçu » : une ligne se pose avec le montant proposé. " +
      "Touchez la date ou le montant pour les corriger. Le net à payer se recalcule.",
    reserve: "Grisé quand le net à payer est à zéro. Sur l'écran de la facture, les règlements se lisent seulement.",
    source: R,
    preuves: ["+ Règlement reçu", 'aria-label="Date du règlement"', 'aria-label="Montant reçu"', "Net à payer"],
    ailleurs: [{ source: S, preuves: ["<ReglementsRecus", "fige={false}"] }],
  },
  {
    id: "facture-moyen-paiement",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Choisir chèque, virement, espèces ou carte, et noter le numéro du chèque",
    motsCles: ["cheque", "virement", "especes", "carte", "moyen", "paiement", "numero", "cb", "liquide"],
    geste:
      "Sur la ligne du règlement, touchez « Chèque » et choisissez Virement, Espèces ou Carte. Pour un chèque, tapez son numéro dans la case « n° ».",
    reserve: "La case du numéro n'existe que pour un chèque.",
    source: R,
    preuves: ['aria-label="Moyen de paiement"', 'aria-label="Numéro du chèque"', 'placeholder="n°"', 'moyen: "cheque"'],
    ailleurs: [{ source: "src/lib/acomptes-facture.ts", preuves: ['cheque: "chèque"', 'virement: "virement"', 'especes: "espèces"', 'carte: "carte"'] }],
  },
  {
    id: "facture-reglement-nommer",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Renommer un règlement : arrhes, acompte, avance",
    motsCles: ["renommer", "nom", "arrhes", "acompte", "intitule", "libelle", "appeler", "reglement"],
    geste: "Touchez le nom à gauche de la ligne, par exemple « Acompte 30 % », et écrivez ce que c'est.",
    reserve: "Vidé, il reprend le nom proposé.",
    source: R,
    preuves: ['aria-label="Ce que ce règlement est"'],
  },
  {
    id: "facture-reglement-retirer",
    ecran: "Travaux en plus",
    ou: OU_REMPLIR,
    intitule: "Retirer un règlement noté sur la facture",
    motsCles: ["retirer", "supprimer", "enlever", "effacer", "annuler", "reglement", "acompte", "erreur"],
    geste: "Appuyez sur le « − » rond au début de la ligne du règlement.",
    reserve: "Seulement là où l'on remplit la facture, avant son envoi.",
    source: R,
    preuves: ['aria-label="Retirer ce règlement"'],
  },
  {
    id: "facture-acquittee",
    ecran: "Facture",
    ou: OU_FACTURE,
    intitule: "Marquer la facture acquittée, tout est déjà payé",
    motsCles: ["acquittee", "acquitte", "acquitter", "solde", "paye", "regle", "tout", "interrupteur"],
    geste:
      "Sous « Net à payer », allumez « Facture acquittée » : le reste est compté reçu à la date du jour, et la facture porte « Acquittée le » avec la date.",
    reserve:
      "Il s'allume tout seul quand les règlements couvrent tout. Seulement avant l'envoi : après, le paiement se note dans « Ma TVA à déclarer ».",
    source: R,
    preuves: ['aria-label="Facture acquittée"', "Net à payer", "basculerAcquitteeAction"],
    ailleurs: [
      { source: F, preuves: ["acquittement={!emise}"] },
      { source: "src/lib/acomptes-facture.ts", preuves: ["`Acquittée le "] },
    ],
  },
  {
    id: "facture-telecharger",
    ecran: "Facture",
    ou: OU_FACTURE,
    intitule: "Télécharger la facture, la garder sur le téléphone",
    motsCles: ["telecharger", "enregistrer", "garder", "sauvegarder", "fichier", "pdf", "partager", "ranger"],
    geste: "Sous « Voir la facture en PDF », appuyez sur « Télécharger » : le fichier porte le numéro de la facture.",
    reserve: "Avant l'envoi, le fichier finit par brouillon.",
    source: F,
    preuves: ["Télécharger (", "-brouillon.pdf", "Voir la facture en PDF"],
  },
  {
    id: "facture-envoyer",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas, la ligne du chantier, puis le bas de l'écran Facture",
    intitule: "Envoyer la facture au client",
    motsCles: ["envoyer", "facture", "client", "sms", "mail", "email", "transmettre", "expedier"],
    geste:
      "À côté de « Envoi », touchez SMS ou E-mail, puis « Envoyer la facture » : votre messagerie s'ouvre avec le message et le lien tout prêts.",
    reserve:
      "Grisé si le client n'a pas de coordonnée pour ce canal, ou si la facture est vide. En l'envoyant, vous l'arrêtez : une correction passerait par un avoir.",
    source: F,
    preuves: ["Envoyer la facture", 'libelle="E-mail"', 'libelle="SMS"', "Aucune coordonnée pour ce canal.", "Une correction passerait par un avoir."],
  },
  {
    id: "facture-renvoyer",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas, puis la ligne du chantier déjà facturé",
    intitule: "Renvoyer une facture déjà envoyée, ou l'envoyer par l'autre moyen",
    motsCles: ["renvoyer", "relancer", "nouveau", "encore", "sms", "email", "mail", "autre", "recu"],
    geste: "Sous « Facture arrêtée », appuyez sur « Envoyer par SMS » ou « Envoyer par e-mail » : le même message se rouvre.",
    reserve: "Si le lien n'est pas encore prêt, le bouton s'appelle « Envoyer la facture au client ».",
    source: T,
    preuves: ['bouton: "Envoyer par SMS"', 'bouton: "Envoyer par e-mail"', "Envoyer la facture au client"],
    ailleurs: [{ source: F, preuves: ["arrêtée.", "<TransmettreLaFacture"] }],
  },
  {
    id: "facture-coordonnee-manquante",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas, puis la ligne du chantier déjà facturé",
    intitule: "Envoyer la facture à un client sans numéro ou sans e-mail",
    motsCles: ["numero", "telephone", "adresse", "email", "manque", "pas", "coordonnee", "saisir", "ajouter"],
    geste:
      "Sur la facture arrêtée, tapez le numéro ou l'adresse dans la case qui apparaît, puis « Enregistrer et ouvrir le message ». Il reste sur la fiche du client.",
    reserve:
      "Avant l'envoi, sans coordonnée pour le canal choisi, « Envoyer la facture » reste grisé : choisissez l'autre canal.",
    source: T,
    preuves: ["Enregistrer et ouvrir le message", "enregistrerCoordonneeClientAction", 'champ: "Numéro de téléphone"'],
    ailleurs: [{ source: F, preuves: ["!destinataire"] }],
  },
  {
    id: "facture-modifier",
    ecran: "Facture",
    ou: OU_FACTURE,
    intitule: "Modifier ou corriger une facture",
    motsCles: ["modifier", "corriger", "changer", "erreur", "rectifier", "facture", "montant"],
    geste:
      "Avant l'envoi, appuyez sur « Ajouter des travaux supplémentaires » ou « Remplir la facture » en bas de l'écran. " +
      "Une fois envoyée, elle ne se modifie plus.",
    reserve: "Une correction après l'envoi passerait par un avoir.",
    source: F,
    preuves: ['"Remplir la facture"', '"Ajouter des travaux supplémentaires"', "Une correction passerait par un avoir."],
  },
  // --- Page de la facture côté client -----------------------------------------
  {
    id: "facture-page-client",
    ecran: "Facture (page du client)",
    ou: "le lien que le client reçoit par SMS ou e-mail",
    intitule: "Ce que le client voit en ouvrant le lien de sa facture",
    motsCles: ["client", "voit", "lien", "page", "recoit", "iban", "regler", "payer", "copier"],
    geste:
      "Il voit le numéro, l'échéance et « Télécharger ma facture », puis « Pour régler » : le numéro de facture et votre IBAN, chacun avec « Copier », et l'ordre du chèque.",
    reserve: "L'IBAN n'apparaît que s'il est rempli dans Mon entreprise.",
    source: PUB,
    preuves: ["Télécharger ma facture", "Pour régler", 'quoi="IBAN"', 'quoi="Numéro de facture"', "phraseDuCheque"],
    ailleurs: [{ source: "src/app/factures/[jeton]/PastilleACopier.tsx", preuves: ['"Copier"'] }],
  },
  {
    id: "facture-reception-client",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Savoir si le client a ouvert ou reçu sa facture",
    motsCles: ["ouverte", "ouvert", "recue", "recu", "lu", "vu", "confirme", "reception", "client"],
    geste:
      "Sous « Factures en attente », chaque facture dit « Ouverte le », « Réception confirmée le » ou « Pas encore ouverte. ». " +
      "Le client confirme en touchant « J'ai bien reçu cette facture » sur sa page.",
    reserve: "Cette liste n'existe que si votre TVA est déclarée aux encaissements.",
    source: ATT,
    preuves: ["<CeQueLeClientEnAFait", 'if (regime === "debits") return null;'],
    ailleurs: [
      { source: "src/lib/reception-facture.ts", preuves: ['"Réception confirmée le "', '"Ouverte le "', '"Pas encore ouverte."'] },
      { source: "src/app/factures/[jeton]/AccuseDeReception.tsx", preuves: ["J&apos;ai bien reçu cette facture"] },
    ],
  },
  // --- Terminés ---------------------------------------------------------------
  {
    id: "termines-creer-facture",
    ecran: "Terminés",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Faire une facture sans devis, pour un dépannage",
    motsCles: ["facture", "sans", "devis", "depannage", "direct", "directement", "creer", "rapide"],
    geste:
      "Touchez « Créer une facture » en or, à droite. Remplissez le client, appuyez sur « Faire la facture », " +
      "puis « Remplir la facture » pour écrire les lignes.",
    source: LT,
    preuves: ['href="/chantiers/nouveau?facture=1"', "Créer une facture"],
    ailleurs: [
      { source: "src/app/chantiers/nouveau/FormulaireNouveauChantier.tsx", preuves: ['"Faire la facture"'] },
      { source: F, preuves: ['"Remplir la facture"'] },
    ],
  },
  {
    id: "termines-quand-apparait",
    ecran: "Terminés",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Savoir quand un chantier arrive dans Terminés",
    motsCles: ["apparait", "pas", "manque", "absent", "quand", "arrive", "termine", "date", "intervention"],
    geste: "Un chantier apparaît dans « Terminés » une fois sa date d'intervention passée.",
    source: LT,
    preuves: ["Vos chantiers apparaîtront ici une fois leur date d&apos;intervention passée."],
    lieu: true,
  },
  {
    id: "termines-montant",
    ecran: "Terminés",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Voir le montant facturé d'un chantier",
    motsCles: ["montant", "combien", "facture", "prix", "total", "somme", "facturee"],
    geste: "Chaque chantier facturé porte son montant à droite de sa ligne. « À facturer » en vert attend encore sa facture.",
    source: LT,
    preuves: ["formatEuros(ligne.montant)", 'data-atlas="capsule-a-facturer"'],
    lieu: true,
  },
  // --- Retours d'intervention ---------------------------------------------------
  {
    id: "retours-lire",
    ecran: "Retours d'intervention",
    ou: "« Terminés » dans la barre du bas, puis « Retours d'intervention »",
    intitule: "Lire un retour : ce qui a été fait, les photos, ce qui est à signaler",
    motsCles: ["retour", "lire", "ouvrir", "photos", "fait", "signaler", "salarie", "detail", "tache"],
    geste:
      "Touchez la carte du jour : « Ce qui a été fait », les photos et « À signaler » s'ouvrent. Touchez une photo pour la voir en grand, « Replier » pour refermer.",
    reserve:
      "Le point doré marque un retour pas encore lu, il s'éteint à l'ouverture. Réservé à l'abonnement Entreprise.",
    source: RET,
    preuves: ["Ce qui a été fait", "À signaler", "Replier", 'aria-label="Voir la photo en grand"', 'data-atlas="retour-non-lu"'],
    ailleurs: [{ source: "src/lib/abonnements.ts", preuves: ['titre: "Les retours sont dans', 'case "retours":'] }],
  },
  {
    id: "retours-chercher",
    ecran: "Retours d'intervention",
    ou: "« Terminés » dans la barre du bas, puis « Retours d'intervention »",
    intitule: "Chercher les retours d'un client",
    motsCles: ["chercher", "rechercher", "trouver", "client", "nom", "filtrer", "retour"],
    geste: "Tapez son nom dans « Un nom de client ».",
    source: RET,
    preuves: ['placeholder="Un nom de client"'],
  },
  {
    id: "retours-date",
    ecran: "Retours d'intervention",
    ou: "« Terminés » dans la barre du bas, puis « Retours d'intervention »",
    intitule: "Voir les retours d'un jour, d'un mois ou d'une année",
    motsCles: ["jour", "mois", "annee", "date", "periode", "filtrer", "ancien", "retour"],
    geste:
      "Dans la date en haut, touchez le jour, le mois ou l'année : la liste suit. Le chevron ouvre la roue pour choisir un autre jour.",
    source: RET,
    preuves: ["<FiltreDeDate"],
    ailleurs: [{ source: "src/components/atlas/FiltreDeDate.tsx", preuves: ['aria-label="Choisir un jour"', 'portee="annee"', 'portee="mois"'] }],
  },
  // --- Ma TVA -------------------------------------------------------------------
  {
    id: "tva-periode",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Voir la TVA d'un autre mois, trimestre ou année",
    motsCles: ["mois", "trimestre", "annee", "periode", "precedent", "ancien", "calendrier", "changer"],
    geste:
      "Touchez un mois sur la frise sous le titre. Pour une autre année, touchez l'année à gauche, les chevrons, puis la période. " +
      "« Revenir à la période en cours » ramène au présent.",
    source: "src/app/termines/tva/FrisePeriodes.tsx",
    preuves: ["/termines/tva?annee=", "<CalendrierPeriodes"],
    ailleurs: [
      {
        source: "src/app/termines/tva/CalendrierPeriodes.tsx",
        preuves: ['aria-label="Choisir une période"', 'aria-label="Année précédente"', "Revenir à la période en cours"],
      },
    ],
  },
  {
    id: "tva-rythme",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Passer la déclaration de TVA de mensuelle à trimestrielle",
    motsCles: ["mensuelle", "trimestrielle", "rythme", "frequence", "trimestre", "mensuel", "trimestriel", "declaration"],
    geste: "Sous la frise des mois, touchez le mot souligné après « Déclaration », puis l'autre rythme.",
    reserve: "Seul le patron peut le changer, les autres le lisent.",
    source: "src/app/termines/tva/RythmeTva.tsx",
    preuves: ['mensuelle: "mensuelle"', 'trimestrielle: "trimestrielle"', 'data-atlas="rythme-actuel"', "Déclaration"],
    ailleurs: [{ source: TVA, preuves: ["modifiable={patron}", "estProprietaire(ctx)"] }],
  },
  {
    id: "tva-copier",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Copier le montant de TVA à payer",
    motsCles: ["copier", "coller", "montant", "chiffre", "recopier", "payer", "impots"],
    geste: "Touchez la ligne « TVA à payer » : le montant est copié et « copié » s'affiche. Pareil pour la collectée et la déductible.",
    source: TVA,
    preuves: ['"TVA à payer"', "TVA collectée", "TVA déductible"],
    ailleurs: [{ source: "src/app/termines/tva/LigneMontant.tsx", preuves: ["aria-label={`Copier ", '"copié"'] }],
  },
  {
    id: "tva-credit",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Comprendre « Crédit de TVA »",
    motsCles: ["credit", "negatif", "rembourse", "rien", "moins", "deductible"],
    geste:
      "Quand la TVA déductible dépasse la collectée, la ligne « TVA à payer » devient « Crédit de TVA » : il n'y a rien à payer sur cette période.",
    source: TVA,
    preuves: ['"Crédit de TVA"', "Math.abs(reste)"],
  },
  {
    id: "tva-scanner-ticket",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Scanner un ticket de caisse pour la TVA déductible",
    motsCles: ["scanner", "ticket", "photo", "caisse", "achat", "facture", "fournisseur", "deductible", "carburant"],
    geste:
      "Sous « TVA à payer », appuyez sur « Scanner un ticket », prenez la photo ou choisissez-la, vérifiez les montants lus, puis « Ajouter aux achats ».",
    reserve: "Gardez le papier, la photo ne le remplace pas. Un ticket d'une autre période y part, et l'écran le dit avant.",
    source: ACH,
    preuves: ['"Scanner un ticket"', '"Ajouter aux achats"', "Gardez le papier, la photo ne le remplace pas."],
  },
  {
    id: "tva-achat-main",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Ajouter un achat à la main pour la TVA déductible",
    motsCles: ["achat", "main", "ecrire", "ajouter", "saisir", "depense", "deductible", "fournisseur"],
    geste:
      "Appuyez sur « Écrire à la main », remplissez Où, Date, Total payé et Taux : la TVA se calcule. Puis « Ajouter aux achats ».",
    reserve: "Si le ticket affiche une autre TVA, écrivez la sienne : c'est elle qui compte.",
    source: ACH,
    preuves: ["Écrire à la main", 'libelle="Où"', 'libelle="Total payé"', 'libelle="Taux"', '"Ajouter aux achats"'],
  },
  {
    id: "tva-detail",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Voir les factures et les achats comptés dans la TVA",
    motsCles: ["detail", "liste", "achats", "factures", "comptees", "sont", "trouver", "justificatif"],
    geste: "Descendez dans « Ma TVA à déclarer » : « Vos factures » sous TVA collectée, « Vos achats » sous TVA déductible.",
    reserve: "Ce relevé ne vaut pas déclaration : elle reste à faire par votre outil comptable.",
    source: TVA,
    preuves: ["Vos factures", "Vos achats", "Ce relevé est préparé par Atlas à partir de vos"],
    lieu: true,
  },
  {
    id: "facture-payee",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Noter qu'une facture envoyée est payée, voir celles qui ne le sont pas",
    motsCles: ["paye", "payee", "payees", "paiement", "encaisse", "encaisser", "regle", "reglement", "attente", "impaye", "impayees"],
    geste: "Sous « Factures en attente », appuyez sur « J'ai reçu le paiement », ou « J'ai reçu une partie » pour un acompte.",
    reserve:
      "Une facture payée quitte cette liste et entre au relevé de TVA. La liste n'existe que si votre TVA est déclarée aux encaissements.",
    source: ATT,
    preuves: ["Factures en attente", "J'ai reçu le paiement", "J&apos;ai reçu une partie", 'if (regime === "debits") return null;'],
    ailleurs: [{ source: "src/app/termines/page.tsx", preuves: ["Ma TVA à déclarer"] }],
    lieu: true,
  },
  {
    id: "tva-paiement-partiel",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Noter un acompte reçu sur une facture déjà envoyée",
    motsCles: ["partie", "partiel", "acompte", "morceau", "fois", "plusieurs", "reglement", "recu", "paye", "noter"],
    geste:
      "Sous la facture, appuyez sur « J'ai reçu une partie », choisissez la date, tapez le montant, puis « Enregistrer ce règlement ».",
    reserve: "Seule la part reçue entre au relevé.",
    source: ATT,
    preuves: ["J&apos;ai reçu une partie", "Enregistrer ce règlement", "Seule la part reçue entre au relevé.", 'aria-label="Montant reçu, en euros"'],
  },
  {
    id: "tva-retirer-paiement",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Retirer un paiement noté par erreur",
    motsCles: ["retirer", "annuler", "supprimer", "enlever", "effacer", "erreur", "paiement", "acompte"],
    geste: "Sous la facture, appuyez sur la croix au bout de la ligne « Acompte payé le ».",
    reserve: "Une facture entièrement payée quitte cette liste.",
    source: ATT,
    preuves: ['"Acompte payé le "', "aria-label={`Retirer le règlement de", "×"],
  },
  {
    id: "tva-toutes-en-attente",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Voir toutes les factures pas encore payées",
    motsCles: ["toutes", "impayees", "impaye", "attente", "liste", "voir", "plus"],
    geste: "Sous les trois premières factures en attente, appuyez sur « Voir toutes les factures en attente ».",
    reserve: "La liste n'existe que si votre TVA est déclarée aux encaissements.",
    source: ATT,
    preuves: ["Voir toutes les factures en attente", "const QUELQUES = 3;"],
  },
  {
    id: "tva-ancien-iban",
    ecran: "Ma TVA",
    ou: OU_TVA,
    intitule: "Prévenir un client que votre IBAN a changé",
    motsCles: ["iban", "rib", "banque", "compte", "change", "nouveau", "ancien", "prevenir"],
    geste:
      "Sous la facture marquée « Ancien IBAN », appuyez sur « Prévenir », relisez le message, puis « Envoyer par SMS » ou « Par e-mail ».",
    reserve: "La marque n'apparaît que sur une facture partie avec l'ancien IBAN.",
    source: ATT,
    preuves: ["<MarqueAncienIban"],
    ailleurs: [
      {
        source: "src/components/atlas/AlerteAncienIban.tsx",
        preuves: ["Ancien IBAN", "Prévenir", "Envoyer par SMS", "Par e-mail", "Aucune coordonnée pour ce client"],
      },
    ],
  },
  {
    id: "avoir",
    ecran: "Facture",
    ou: "« Terminés » dans la barre du bas, puis la ligne du chantier",
    intitule: "Faire un avoir, retrouver ses avoirs",
    motsCles: ["avoir", "avoirs", "rembourser", "remboursement", "rembourse"],
    geste: "Atlas ne fait pas encore d'avoir : l'écran est dessiné, il n'est pas encore dans l'application.",
    reserve: "Une facture envoyée ne se modifie plus. En attendant, l'avoir se fait hors d'Atlas.",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["Une correction passerait par un avoir."],
    // Les mots de sa planche `appli/il-ne-paie-pas.html` : le jour où ils
    // entrent dans `src/`, cette fiche ment.
    absences: ["Je fais un avoir", 'libelle: "Avoirs"'],
    lieu: true,
  },
  {
    id: "termines-retours",
    ecran: "Retours d'intervention",
    ou: "« Terminés » dans la barre du bas, puis « Retours d'intervention »",
    intitule: "Lire les retours d'intervention de l'équipe",
    motsCles: ["retours", "retour", "intervention", "interventions", "equipe", "salarie", "compte", "rendu", "sont", "trouver"],
    geste: "Touchez « Terminés » dans la barre du bas, puis « Retours d'intervention ».",
    source: "src/app/termines/ListeTermines.tsx",
    preuves: ['href="/termines/retours"', "Retours d&apos;intervention"],
    lieu: true,
  },
  {
    id: "facture-echeance",
    ecran: "Facture",
    ou: "l'écran de la facture, tant qu'elle est brouillon",
    intitule: "Changer la date d'échéance d'une facture",
    motsCles: ["echeance", "date", "regler", "delai", "paiement", "avant", "changer"],
    geste: "Appuyez sur la date sous « À régler avant le » et choisissez-en une autre.",
    reserve: "Une facture arrêtée fige son échéance : elle ne se corrige plus.",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["À régler avant le"],
  },
  {
    id: "facture-pdf",
    ecran: "Facture",
    ou: "l'écran de la facture",
    intitule: "Voir la facture en PDF",
    motsCles: ["pdf", "facture", "voir", "apercu", "imprimer"],
    geste: "Appuyez sur « Voir la facture en PDF ».",
    source: "src/app/chantiers/[id]/facture/FactureClient.tsx",
    preuves: ["Voir la facture en PDF"],
  },
  // --- Terminés et TVA ------------------------------------------------------
  {
    id: "termines-facturer",
    ecran: "Terminés",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Retrouver les chantiers finis qui ne sont pas encore facturés",
    motsCles: ["termine", "termines", "fini", "facturer", "reste", "oublie", "liste", "factures", "attente"],
    // **L'onglet « À facturer » est parti le 13 septembre 2026** : c'est l'œil,
    // à côté du compte, qui filtre. La fiche l'enseignait encore.
    geste:
      "Touchez « Terminés » dans la barre du bas, puis l'œil à côté de « à facturer » : " +
      "il ne reste que ceux qui attendent. « À facturer » sur une ligne ouvre sa facture.",
    source: "src/app/termines/ListeTermines.tsx",
    preuves: ['data-atlas="oeil-a-facturer"', "À facturer"],
    lieu: true,
  },
  {
    id: "tva",
    ecran: "Ma TVA",
    ou: "« Terminés », dans la barre du bas",
    intitule: "Savoir combien de TVA déclarer",
    motsCles: ["tva", "declarer", "declaration", "collectee", "deductible", "impot", "etat", "periode", "voir", "vois", "combien"],
    geste: "Depuis « Terminés », appuyez sur « Ma TVA à déclarer ».",
    source: "src/app/termines/tva/page.tsx",
    // **Les mots entiers depuis le 12 septembre 2026** : l'écran écrit « TVA
    // collectée » et « TVA déductible », plus « Collectée » seul. La fiche les
    // suit — un mode d'emploi qui enseigne un mot disparu envoie chercher un
    // bouton qui n'existe plus.
    preuves: ["Ma TVA", "TVA collectée", "TVA déductible"],
  },
];

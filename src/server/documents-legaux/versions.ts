import { createHash } from "node:crypto";

/**
 * Versions publiées des documents légaux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  CES TEXTES SONT DES CANEVAS. Ils ne sont pas rédigés par un juriste et
 *  n'ont aucune valeur en l'état. Ils décrivent la STRUCTURE attendue et
 *  rendent le mécanisme d'acceptation exerçable de bout en bout ; le contenu
 *  doit être remplacé avant toute utilisation avec de vrais artisans.
 *  Voir docs/RGPD.md §9.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Règle absolue : **une version publiée ne se modifie jamais.** Corriger un
 * texte, c'est ajouter une entrée avec une nouvelle `version`. Sans cette
 * règle, une acceptation déjà recueillie désignerait un texte qui n'existe
 * plus — c'est-à-dire rien.
 *
 * L'ordre du tableau est l'ordre d'affichage à l'utilisateur — celui des
 * TYPES, pris à leur première apparition.
 *
 * **Et les versions d'un même type se déclarent dans l'ordre chronologique,
 * la plus récente EN DERNIER.** On lit ainsi l'histoire du document de haut
 * en bas, et un contrôle peut dire laquelle devrait être en vigueur —
 * `test-documents-legaux` le fait. Posée à l'envers le 9 septembre 2026,
 * elle a fait rougir ce contrôle sur une base pourtant juste.
 */

export type TypeDocumentLegal = "cgu" | "sous_traitance" | "confidentialite";

export type VersionDocument = {
  type: TypeDocumentLegal;
  version: string;
  titre: string;
  /** Sous-titre affiché sous le titre, pour dire en une phrase de quoi il s'agit. */
  resume: string;
  acceptationRequise: boolean;
  contenu: string;
};

export const VERSIONS_DOCUMENTS: VersionDocument[] = [
  {
    type: "cgu",
    version: "canevas-1",
    titre: "Conditions générales d'utilisation",
    resume: "Ce que le service fait, ce qu'il ne fait pas, et les règles d'usage.",
    acceptationRequise: true,
    contenu: `# Conditions générales d'utilisation

> **Canevas non juridique.** À remplacer avant toute mise en service réelle.

## 1. Objet

Atlas est un outil d'aide à la préparation de devis pour les artisans. Il
transcrit une note dictée, en propose une structuration modifiable, et calcule
un prix **à partir de la grille tarifaire renseignée par l'utilisateur**.

## 2. Ce qu'Atlas ne fait pas

Atlas n'est pas un logiciel de comptabilité et **n'émet aucun document légal**.
La facturation conforme relève d'un outil comptable distinct.

Atlas ne décide jamais à la place de l'utilisateur : aucun prix, aucune durée,
aucune donnée client n'est affirmé sans validation humaine explicite.

## 3. Responsabilité de l'utilisateur

L'utilisateur reste seul responsable du contenu des devis et factures qu'il
émet, des prix qu'il pratique, et des engagements pris envers ses clients.

## 4. Disponibilité

À rédiger : engagement de disponibilité, maintenance, évolutions.

## 5. Durée, résiliation, restitution des données

À rédiger : conditions de résiliation, et modalités de récupération des
données par l'utilisateur à son départ.
`,
  },
  {
    /**
     * **LA VERSION QUI ENGAGE VRAIMENT — 9 septembre 2026.**
     *
     * Sa question : *« ça sera visible où ? »*. Elle a montré que l’artisan
     * cochait `canevas-1` — quatre paragraphes dont trois disaient « à
     * rédiger » — pendant que dix-neuf articles écrits, publiés et lisibles
     * depuis son téléphone n’étaient acceptés par personne. Il avait donc de
     * bonnes conditions, et elles n’engageaient aucun de ses clients.
     *
     * **`canevas-1` reste juste en dessous, et ne bougera jamais.** C’est la
     * règle en tête de ce fichier : les acceptations déjà recueillies portent
     * l’empreinte de CE texte-là, et le corriger les ferait désigner un
     * document disparu. On ajoute, on ne remplace pas.
     *
     * **Le texte n’a pas été retapé** : il est déduit une fois de la page
     * publiée (`scripts/generer-version-cgu.ts`), et
     * `test-pages-legales-uniques` refuse ensuite tout écart entre les trois
     * endroits où il vit — `appli/`, `public/` et ici. Le retaper en aurait
     * fait une troisième version divergente (`CLAUDE.md` §3).
     *
     * **Ce qui reste à faire, et qui se VOIT :** seize [À COMPLÉTER] subsistent,
     * la raison sociale et l’hébergeur en tête. Ils s’affichent tels quels à
     * l’artisan, et c’est voulu — les cacher ferait accepter un document qui
     * paraît fini alors qu’il ne l’est pas.
     */
    type: "cgu",
    version: "2",
    titre: "Conditions générales d'utilisation",
    resume:
      "Ce qu'Atlas fait, ce qu'il ne fait pas, vos données, et le prix de l'abonnement.",
    acceptationRequise: true,
    contenu: `ARTICLE 1 — Qui édite Atlas

Atlas est édité par :

Dénomination sociale : [À COMPLÉTER]

Forme juridique : [À COMPLÉTER]

Capital social : [À COMPLÉTER]

Siège social : [À COMPLÉTER]

RCS et numéro SIREN : [À COMPLÉTER]

Numéro de TVA intracommunautaire : [À COMPLÉTER]

Directeur de la publication : [À COMPLÉTER]

Téléphone : [À COMPLÉTER]

Contact : [À COMPLÉTER — adresse e-mail dédiée]

Hébergeur : [À COMPLÉTER — dénomination, adresse, téléphone]

Pourquoi ces cases sont vides et le restent. Ces mentions sont imposées par l’article 1-1 de la loi pour la confiance dans l’économie numérique — depuis la loi SREN du 21 mai 2024, qui a remplacé l’ancien article 6-III. Les omettre est puni d’un an d’emprisonnement et de 75 000 € d’amende, portés à 375 000 € pour une personne morale (article 1-2 de la même loi). Les remplir au plausible serait donc pire que les laisser vides.

ARTICLE 2 — Ce que ce document engage

Les présentes conditions régissent l’accès à Atlas et son utilisation. Elles forment un contrat entre l’éditeur et vous — professionnel agissant dans le cadre de votre activité. Atlas n’est pas destiné aux consommateurs.

Vous les acceptez en créant un compte. Si vous n’en acceptez pas un point, n’utilisez pas le service.

Si vous créez un compte pour le compte d’une entreprise, vous déclarez avoir le pouvoir de l’engager.

Deux documents s’y ajoutent et en font partie intégrante :

· la politique de confidentialité ;

· le contrat de sous-traitance au sens de l’article 28 du RGPD, qui régit les données de vos clients — [À COMPLÉTER — document distinct, à faire rédiger].

ARTICLE 3 — Ce qu’Atlas fait — et ce qu’il ne fait pas

Atlas est un outil d’aide à la préparation du travail administratif d’un artisan : transcription d’une note dictée, rédaction de propositions de lignes de devis, planning, préparation de factures et de relevés de TVA, et outils de métier (plan d’arrosage, diagnostic végétal, fiches d’entretien).

Ce qu’Atlas n’est pas

· Atlas n’est pas un logiciel de comptabilité, et ne se substitue à aucune obligation comptable, fiscale ou déclarative. Il prépare des éléments destinés à être transmis aux outils et aux professionnels dont c’est le métier.

· Atlas ne fournit aucun conseil comptable, fiscal, juridique, technique ou d’assurance.

· Atlas n’émet aucun document en votre nom sans votre geste. Aucun devis, aucune facture, aucun envoi ne part sans que vous l’ayez validé.

Les outils de métier sont des aides au dimensionnement

Les calculs de métier — en particulier le plan d’arrosage — sont des aides à la décision fondées sur les informations que vous saisissez. Ils ne constituent ni une étude d’exécution, ni une note de calcul opposable, ni un document de conception au sens des règles de l’art.

Vous demeurez seul responsable du dimensionnement, du choix du matériel, de la conformité de l’installation et de sa mise en œuvre. Il vous appartient de vérifier chaque valeur avant d’engager un chantier. Atlas signale à l’écran ce qu’il n’a pas pu calculer ; l’absence de réserve ne vaut pas garantie d’exactitude.

ARTICLE 4 — L’assistance par intelligence artificielle

Atlas utilise des modèles d’intelligence artificielle fournis par des tiers pour transcrire vos dictées, en extraire des informations et proposer des lignes de devis.

L’intelligence artificielle prépare ; vous décidez.

Tout résultat produit par ces modèles est une proposition, susceptible d’être inexacte, incomplète ou inadaptée. Vous vous engagez à la relire et à la corriger avant tout usage. Vous demeurez seul auteur et seul responsable des devis, factures, prix, durées, quantités et documents que vous émettez à partir d’Atlas, ainsi que de leur conformité.

L’éditeur ne garantit ni l’exactitude, ni la pertinence, ni la complétude des propositions générées, et n’est pas responsable des conséquences d’un contenu généré que vous auriez validé sans vérification.

Vous êtes informé que le contenu de vos dictées et des informations de chantier est transmis aux fournisseurs listés dans la politique de confidentialité. Ne dictez pas d’information que vous ne souhaitez pas voir transmise à ces fournisseurs — notamment des données sensibles au sens de l’article 9 du RGPD (santé, situation familiale, opinions).

ARTICLE 5 — Votre compte et vos accès

· Vous vous engagez à fournir des informations exactes et à les tenir à jour.

· Vos identifiants sont personnels et confidentiels. Vous êtes responsable de leur conservation et de tout usage fait depuis votre compte.

· Vous informez l’éditeur sans délai de toute utilisation non autorisée dont vous auriez connaissance.

· En tant que titulaire du compte de l’entreprise, vous créez et supprimez les accès de vos collaborateurs et vous êtes responsable de leurs agissements sur le service, ainsi que du retrait d’un accès devenu inutile.

ARTICLE 6 — Ce que vous vous engagez à ne pas faire

· utiliser Atlas à des fins illicites, ou en violation des droits d’un tiers ;

· y verser des contenus dont vous n’avez pas le droit de disposer ;

· tenter d’accéder aux données d’une autre entreprise, contourner une mesure de sécurité, ou éprouver la résistance du service sans autorisation écrite préalable ;

· procéder à une extraction massive ou automatisée des données du service ;

· décompiler ou désassembler le service, hors les cas prévus par l’article L.122-6-1 du Code de la propriété intellectuelle ;

· revendre, sous-licencier ou mettre le service à disposition d’un tiers sans autorisation écrite ;

· soumettre au service des volumes manifestement disproportionnés au regard d’un usage professionnel normal.

ARTICLE 7 — Vos contenus vous appartiennent

Vous demeurez propriétaire de tout ce que vous versez dans Atlas : clients, chantiers, dictées, photos, prix, devis et factures.

Vous concédez à l’éditeur une licence non exclusive, limitée à la durée du contrat et strictement nécessaire à l’exécution du service : héberger, afficher, sauvegarder, transmettre aux sous-traitants listés, et générer les documents que vous demandez.

Aucun autre usage. L’éditeur n’exploite pas vos contenus à des fins commerciales, publicitaires, statistiques nominatives, ni pour entraîner des modèles d’intelligence artificielle.

Le service lui-même — son code, son interface, ses bases de connaissances métier — reste la propriété exclusive de l’éditeur. Ces conditions ne vous en cèdent aucun droit.

ARTICLE 8 — Données personnelles

Deux relations distinctes, qu’il ne faut pas confondre :

Données concernées · Rôle de l’éditeur · Votre rôle ·

Votre compte, votre entreprise, votre abonnement · Responsable de traitement · Personne concernée ·

Les données de vos clients — nom, adresse, téléphone, chantiers, devis · Sous-traitant · Responsable de traitement ·

Pour la seconde relation, l’article 28 du RGPD impose un contrat de sous-traitance écrit, distinct des présentes conditions. Il précise la liste des sous-traitants ultérieurs, que vous autorisez en l’acceptant, et dont tout changement vous est notifié avec un délai pour vous y opposer.

Le détail est dans la politique de confidentialité.

ARTICLE 9 — Disponibilité du service

L’éditeur est tenu d’une obligation de moyens quant à la disponibilité et au bon fonctionnement d’Atlas.

Aucun taux de disponibilité n’est garanti en l’absence de convention de service (SLA) souscrite séparément. Le service peut être interrompu, notamment :

· pour maintenance, corrective ou évolutive ;

· du fait d’un hébergeur, d’un opérateur, d’un fournisseur d’intelligence artificielle ou de tout autre tiers ;

· du fait de votre propre connexion, de votre matériel ou de votre configuration ;

· en cas de force majeure (article 16).

Les fonctions faisant appel à l’intelligence artificielle dépendent de services tiers : leur indisponibilité, leur lenteur ou leur modification échappent au contrôle de l’éditeur.

L’éditeur peut faire évoluer le service, en modifier ou en retirer des fonctions. Si un retrait affecte substantiellement l’usage que vous en faites, vous pouvez résilier sans frais dans les conditions de l’article 12.

ARTICLE 10 — Sauvegarde et perte de données

L’essentiel en une phrase.

Atlas met en œuvre des moyens raisonnables pour conserver vos données, mais il vous appartient d’en conserver votre propre copie — et le service vous en donne le moyen à tout moment.

Ce que l’éditeur s’engage à faire

L’éditeur met en œuvre les moyens techniques raisonnables, conformes à l’état de l’art, pour préserver l’intégrité et la disponibilité de vos données : cloisonnement des entreprises appliqué au niveau de la base de données, empreintes des mots de passe, en-têtes de sécurité, limitation de débit, et procédures de sauvegarde et de restauration documentées.

Il s’agit d’une obligation de moyens renforcée, non d’une obligation de résultat.

Ce que vous vous engagez à faire

Atlas met à votre disposition, en permanence et sans frais, une fonction d’export de l’ensemble des données de votre entreprise, dans un fichier qui s’ouvre sans Atlas : Réglages, puis Mes données.

Vous vous engagez à en faire usage régulièrement et à conserver ces copies sur un support dont vous avez la maîtrise. Cette copie est votre sauvegarde de référence.

Ce qui en découle

En cas de perte, d’altération ou d’indisponibilité de données, l’intervention de l’éditeur consiste à rétablir le service et restaurer les données à partir de ses dernières sauvegardes disponibles. Vous acceptez que cette restauration puisse comporter une perte portant sur la période séparant l’incident de la dernière sauvegarde exploitable.

L’éditeur n’est pas responsable des pertes de données résultant :

· d’une suppression, d’une modification ou d’une manipulation effectuée depuis votre compte ou celui d’un de vos collaborateurs ;

· d’un défaut de conservation de vos propres exports ;

· de la perte, du partage ou de la compromission de vos identifiants ;

· du fait d’un tiers — hébergeur, opérateur, fournisseur — ou d’un acte de malveillance dirigé contre ces tiers ;

· d’une cause de force majeure.

Les durées de conservation applicables — y compris les suppressions automatiques et les conservations imposées par la loi — figurent dans la politique de confidentialité.

ARTICLE 11 — Responsabilité

11.1 — Dommages exclus

La responsabilité de l’éditeur ne peut être engagée au titre des dommages indirects, notamment : perte d’exploitation, perte de chiffre d’affaires, de bénéfice, de marge ou d’économies escomptées, perte de clientèle ou de chance, perte de commande, atteinte à l’image ou à la réputation, ainsi que toute action dirigée contre vous par un tiers, dès lors que ces préjudices ne sont pas la suite immédiate et directe d’un manquement de l’éditeur.

11.2 — Plafond

En tout état de cause, et pour l’ensemble des dommages confondus survenus au cours d’une même année contractuelle, la responsabilité de l’éditeur est plafonnée au plus élevé des deux montants suivants :

· le total des sommes que vous avez effectivement versées au titre de l’abonnement au cours des douze mois précédant le fait générateur ;

· [À COMPLÉTER — un montant plancher, en euros].

Pourquoi un plancher, et pourquoi il n’est pas rempli ici. Un plafond dérisoire — a fortiori un plafond nul, ce que donnerait un service gratuit — est écarté par le juge comme privant l’obligation essentielle de sa substance. Le montant doit donc être réel et proportionné, et se décide avec le juriste et l’assureur, pas ici.

11.3 — Ce que rien ne peut exclure

Les limitations ci-dessus ne s’appliquent pas :

· en cas de dol ou de faute lourde de l’éditeur (article 1231-3 du Code civil) ;

· en cas de dommage corporel ;

· dans tous les cas où la loi interdit une telle limitation.

Elles ne font pas obstacle aux droits que les personnes concernées tiennent du RGPD, qui ne peuvent être écartés par contrat.

11.4 — Votre responsabilité

Vous êtes responsable de l’exactitude des données que vous saisissez, du contrôle des propositions générées avant émission, du respect de vos obligations professionnelles, comptables et fiscales, et de la licéité des traitements que vous mettez en œuvre sur les données de vos clients.

Vous garantissez l’éditeur contre toute réclamation d’un tiers résultant d’un usage du service contraire aux présentes conditions ou à la loi.

11.5 — Délai pour agir

Conformément à l’article 2254 du Code civil, toute action fondée sur les présentes doit être engagée dans un délai de douze mois à compter du jour où vous avez connu ou auriez dû connaître le fait générateur, à peine de forclusion.

ARTICLE 12 — Durée, suspension, résiliation

Le contrat est conclu pour la durée de l’abonnement souscrit et se renouvelle selon les modalités indiquées lors de la souscription.

Résiliation par vous

Vous pouvez résilier à tout moment, avec effet à la fin de la période en cours. Les sommes déjà versées au titre de la période en cours restent acquises, sauf manquement de l’éditeur.

Suspension ou résiliation par l’éditeur

L’éditeur peut suspendre l’accès, immédiatement et sans indemnité, en cas de manquement grave — notamment un usage illicite, une atteinte à la sécurité, ou un défaut de paiement persistant après mise en demeure restée sans effet pendant quinze jours.

Hors urgence ou illicéité manifeste, la suspension est précédée d’un avertissement laissant un délai raisonnable pour y remédier.

ARTICLE 13 — Récupérer vos données

Pendant toute la durée du contrat, vous pouvez exporter l’intégralité des données de votre entreprise depuis Réglages, puis Mes données, dans un format exploitable sans Atlas.

À compter de la fin du contrat, vos données restent récupérables par ce moyen pendant [À COMPLÉTER — un délai, 30 jours étant l’usage]. Passé ce délai, elles sont supprimées, à l’exception de ce que la loi impose de conserver — notamment les pièces comptables, conservées dix ans en application de l’article L.123-22 du Code de commerce.

Aucune prestation de reprise, de conversion ou d’accompagnement à la migration n’est incluse ; elle peut faire l’objet d’un devis distinct.

ARTICLE 14 — Prix, abonnement et paiement

14.1 — Les formules

Atlas est proposé par abonnement, en trois formules. Les tarifs s’entendent hors taxes ; la TVA française au taux en vigueur s’y ajoute.

Formule · Par mois · Par an · Comptes qui facturent ·

Artisan · 29 € HT · 290 € HT · 1 ·

Entreprise · 59 € HT · 590 € HT · jusqu’à 5 ·

Illimité · 120 € HT · 1 200 € HT · sans limite ·

Ce qui se compte, et ce qui ne se compte pas. Seuls comptent les comptes autorisés à établir des devis ou des factures — le propriétaire, les commerciaux et le service facturation. Les comptes « salarié », qui ne consultent que le planning, ne sont pas comptés et ne donnent lieu à aucun supplément, quel que soit leur nombre.

Chaque formule comprend, sans limitation de nombre : les devis, les factures, la transcription des dictées et leur mise en devis, le stockage des documents et des photos, les mises à jour et l’assistance.

14.2 — Essai gratuit

L’abonnement peut être précédé d’un essai gratuit de [À COMPLÉTER — 14 ou 30 jours], sans saisie de moyen de paiement. À son terme, l’accès est suspendu sauf souscription ; aucune somme n’est prélevée et aucune reconduction n’intervient d’elle-même.

14.3 — Paiement

Le paiement s’effectue par carte bancaire ou par prélèvement SEPA, à la souscription puis à chaque échéance, par l’intermédiaire du prestataire de paiement [À COMPLÉTER — nom du prestataire]. L’éditeur ne collecte ni ne conserve aucune donnée de carte bancaire : elles sont saisies sur les pages sécurisées du prestataire, qui en assure seul la conservation.

La facture correspondante est mise à disposition dans Réglages, puis Abonnement, à chaque échéance.

14.4 — Reconduction

L’abonnement se renouvelle par tacite reconduction pour une période identique, sauf résiliation avant l’échéance (article 12). Conformément à l’article L.215-1 du Code de la consommation, lorsque le souscripteur est une personne physique n’agissant pas pour les besoins de son activité professionnelle, l’éditeur l’informe de la faculté de ne pas reconduire, au plus tôt trois mois et au plus tard un mois avant l’échéance.

14.5 — Défaut de paiement

Un paiement refusé donne lieu à une relance. À défaut de régularisation dans un délai de quinze jours après mise en demeure, l’accès peut être suspendu (article 12), sans que les données soient supprimées pendant le délai prévu à l’article 13.

Entre professionnels, toute somme non réglée à échéance porte de plein droit intérêt au taux prévu à l’article L.441-10 du Code de commerce, et donne lieu à l’indemnité forfaitaire de recouvrement de 40 € prévue à l’article D.441-5.

14.6 — Changement de formule

Le passage à une formule supérieure prend effet immédiatement ; la différence est due au prorata de la période restante. Le passage à une formule inférieure prend effet à l’échéance suivante. Un changement vers une formule dont le nombre de comptes est insuffisant suppose d’avoir au préalable ramené le nombre de comptes concernés sous ce seuil.

14.7 — Révision des tarifs

L’éditeur peut réviser ses tarifs. Toute hausse est notifiée par un moyen durable au moins trente jours avant sa prise d’effet et ne s’applique qu’à compter de l’échéance suivante ; vous pouvez alors résilier sans frais avant cette date. Une période annuelle déjà réglée n’est jamais affectée en cours de route.

14.8 — Droit de rétractation

Atlas est destiné aux professionnels. Le droit de rétractation de quatorze jours prévu à l’article L.221-18 du Code de la consommation ne s’applique pas lorsque le souscripteur agit pour les besoins de son activité professionnelle et que son entreprise emploie plus de cinq salariés, ou lorsque l’objet du contrat entre dans le champ de son activité principale. [À COMPLÉTER — à faire confirmer : l’article L.221-3 étend la rétractation aux professionnels de cinq salariés au plus dont l’objet du contrat n’entre pas dans le champ de l’activité principale. Le doute doit se trancher en faveur de l’accorder.]

ARTICLE 15 — Modification des présentes conditions

L’éditeur peut modifier les présentes conditions. Toute modification substantielle vous est notifiée par un moyen durable, au moins trente jours avant son entrée en vigueur.

Si vous refusez la nouvelle version, vous pouvez résilier sans frais avant cette date. La poursuite de l’utilisation après l’entrée en vigueur vaut acceptation.

Chaque version est datée et numérotée ; les versions antérieures sont conservées et communiquées sur demande.

ARTICLE 16 — Force majeure

Aucune des parties ne répond d’un manquement causé par un événement de force majeure au sens de l’article 1218 du Code civil.

Sont notamment regardés comme tels, dès lors qu’ils réunissent les caractères de ce texte : les défaillances généralisées des réseaux de communication électronique ou de fourniture d’énergie, les défaillances d’un hébergeur ou d’un opérateur, les attaques informatiques d’une ampleur qui n’a pas pu être raisonnablement prévenue, les catastrophes naturelles, incendies et inondations, ainsi que les décisions d’une autorité publique faisant obstacle à l’exécution.

Si l’empêchement se prolonge au-delà de trente jours, chaque partie peut résilier de plein droit, sans indemnité.

ARTICLE 17 — Preuve

Les journaux techniques et enregistrements conservés par l’éditeur dans des conditions de nature à en garantir l’intégrité font foi entre les parties, jusqu’à preuve contraire, des connexions, des acceptations et des opérations réalisées sur le service.

ARTICLE 18 — Droit applicable et litiges

Les présentes conditions sont soumises au droit français.

En cas de différend, les parties s’efforcent d’abord de trouver une solution amiable. À défaut d’accord dans un délai de trente jours à compter de la première réclamation écrite, le litige est porté devant le tribunal de commerce du ressort du siège social de l’éditeur, y compris en cas de pluralité de défendeurs, d’appel en garantie ou de procédure d’urgence.

ARTICLE 19 — Dispositions diverses

· Nullité partielle. Si une clause est jugée nulle, non écrite ou inapplicable, elle est réputée non écrite dans cette seule mesure ; les autres conservent leur plein effet, et les parties s’efforcent de lui substituer une clause valable d’effet équivalent.

· Non-renonciation. Le fait de ne pas se prévaloir d’un manquement ne vaut pas renonciation à s’en prévaloir ultérieurement.

· Cession. Vous ne pouvez céder le contrat sans l’accord écrit de l’éditeur. L’éditeur peut le céder en cas d’opération sur son capital ou de transfert de son activité, à charge de vous en informer.

· Intégralité. Les présentes conditions, la politique de confidentialité et le contrat de sous-traitance forment l’intégralité de l’accord.

· Langue. La version française fait seule foi.
`,
  },
  {
    type: "sous_traitance",
    version: "canevas-1",
    titre: "Contrat de sous-traitance (article 28 RGPD)",
    resume:
      "Comment nous traitons les données de vos clients pour votre compte, et ce que nous nous engageons à faire.",
    acceptationRequise: true,
    contenu: `# Contrat de sous-traitance — article 28 du RGPD

> **Canevas non juridique.** Ce document doit être rédigé ou relu par un
> juriste avant toute utilisation avec de vrais artisans. Les rubriques
> ci-dessous reprennent le contenu que l'article 28.3 rend obligatoire — elles
> indiquent ce qui doit y figurer, elles ne le rédigent pas.

## 1. Qui est qui

**Vous, l'artisan, êtes responsable de traitement** des données de vos clients.
Vous décidez pourquoi et comment elles sont traitées.

**Nous sommes sous-traitant.** Nous traitons ces données uniquement sur vos
instructions, pour vous permettre d'utiliser Atlas.

## 2. Objet, durée, nature et finalité

- **Objet** : préparation de devis, de plannings et de factures.
- **Durée** : celle de votre abonnement, plus les délais de conservation
  prévus au §6.
- **Nature** : collecte, structuration, conservation, transmission.
- **Finalité** : vous faire gagner le temps de saisie administrative.

## 3. Données et personnes concernées

- **Types de données** : identité et coordonnées de vos clients, adresses de
  chantier, contenu des notes vocales et leurs transcriptions, photos, devis,
  factures.
- **Personnes concernées** : vos clients, le plus souvent des particuliers.

## 4. Nos engagements

Reprendre ici les huit obligations de l'article 28.3 : instructions
documentées, confidentialité du personnel, sécurité (article 32),
sous-traitance ultérieure encadrée, assistance à l'exercice des droits,
assistance aux articles 32 à 36, sort des données en fin de contrat, mise à
disposition des éléments d'audit.

## 5. Sous-traitants ultérieurs

Nous faisons appel à des prestataires pour l'hébergement, la transcription
audio et l'assistance par intelligence artificielle. **La liste nominative et
leur localisation figurent en annexe.** Toute modification vous est notifiée à
l'avance et vous pouvez vous y opposer.

> **À compléter par l'annexe réelle** — voir docs/RGPD.md §3, qui tient
> l'inventaire à jour à partir du code.

## 6. Conservation et effacement

À rédiger : durées de conservation par catégorie de donnée, et modalités
d'effacement ou de restitution en fin de contrat.

## 7. Violation de données

Nous vous alertons **sans délai** en cas de violation de données, afin que vous
puissiez respecter votre propre délai de notification de 72 heures auprès de la
CNIL.
`,
  },
  {
    type: "confidentialite",
    version: "canevas-1",
    titre: "Politique de confidentialité",
    resume: "Ce que nous faisons de vos données à vous, en tant qu'abonné.",
    acceptationRequise: false,
    contenu: `# Politique de confidentialité

> **Canevas non juridique.** À remplacer avant toute mise en service réelle.

Ce document concerne **vos** données d'abonné — pas celles de vos clients, qui
relèvent du contrat de sous-traitance.

## Ce que nous conservons

Votre adresse e-mail, le nom de votre entreprise, et les éléments nécessaires à
la gestion de votre abonnement.

## Vos droits

Accès, rectification, effacement, portabilité, opposition. À rédiger : modalités
d'exercice et adresse de contact.

## Où vivent les données

À compléter une fois l'hébergement choisi : hébergeur, pays, et mesures de
sécurité appliquées.
`,
  },
];

/**
 * Empreinte SHA-256 d'un contenu, en hexadécimal minuscule.
 *
 * C'est elle qui donne sa valeur à une acceptation : elle atteste du texte
 * exact qui a été accepté, et non d'un titre de document qui aurait pu changer
 * sous le même nom.
 */
export function empreinteContenu(contenu: string): string {
  return createHash("sha256").update(contenu, "utf8").digest("hex");
}

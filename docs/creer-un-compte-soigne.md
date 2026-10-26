# Créer un compte, soigné : ce qui a été confronté, et ce qui est proposé

Sa demande du 26 octobre 2026 : *« fais-moi une planche plus jolie à partir du
moment où on fait la création d'un compte jusqu'à arriver à rentrer dans le
compte, avec toutes les questions qui vont pré-remplir les cases des
paramètres ; certains paramètres ont évolué, donc va d'abord checker s'il n'y a
pas besoin de rajouter ou enlever des questions ou les modifier »*.

La planche : `appli/soignee/creer-un-compte.html`, adresse publiée
`https://florianmarrins0978-svg.github.io/Atlas-app/soignee/creer-un-compte.html`.
**Rien n'est codé dans `src/`.**

## Ce qui a été confronté

Les seize questions de `src/lib/creation-compte.ts` (posées du 8 au
18 septembre 2026) contre les colonnes de la table `entreprises`
(`src/server/db/schema.ts`) et les écrans Mon entreprise
(`src/app/reglages/identite/`), Équipe (`VosEquipes.tsx`) et TVA
(`PeriodiciteTva.tsx`, `ExigibiliteTva.tsx`), puis le parcours joué pour de vrai
sur l'appli (une SARL assujettie), capture à chaque écran.

**Le défaut trouvé à la capture.** La fin dit *« Tout est prêt. Vos réglages
sont remplis. Votre premier devis peut partir. »* ; Mon entreprise, ouvert juste
après, dit *« Médiateur : manquant. C'est obligatoire. »*. La fin ne compte que
ce que la porte a demandé, et la porte ne demande ni le médiateur ni la
décennale, nés le 14 septembre.

## Question par question

| Aujourd'hui | Proposé | Pourquoi | Source |
|---|---|---|---|
| Identité, e-mail, mot de passe : 3 écrans | les mêmes ; le mot de passe montre sa règle (12 caractères, les deux identiques) pendant qu'on tape | la règle se lisait seulement au refus | `mot-de-passe.ts` |
| Téléphone, puis e-mail des devis : 2 écrans | **1 écran** « Vous joindre », téléphone derrière FR +33 | le paquet de Mon entreprise ; le même champ que Réglages | `ChampTelephone.tsx` |
| Nom, forme juridique (déroulant) | nom ; forme **en liste** qui avance au premier appui, les 6 courantes et « Une autre forme » | ouvert, le déroulant cache la question (capture) ; même règle que les listes de la TVA (`avanceToutSeul`) | `formes-juridiques.ts` |
| Capital, puis ville du RCS : 2 écrans | **1 écran** | les deux dépendent de la forme | `siFormeACapital` |
| SIRET, adresse | les mêmes ; l'adresse avec ses suggestions | la même pièce que Réglages (Base Adresse Nationale) | `ChampAdresse` |
| Facturez-vous la TVA ? | la même, en deux cartes | | |
| N° de TVA, vide | **proposé**, tiré du SIRET | la règle existe déjà pour les clients | `autoliquidation.ts`, `numeroTvaFrancais` |
| *absent* (« Tous les mois » posé sans le dire) | **À quel rythme la déclarez-vous ?**, « Tous les mois » proposé | une déclaration : Atlas ne devine pas un régime fiscal | `PeriodiciteTva.tsx` |
| *absent* (« le mois où mon client me paie » posé sans le dire) | **Quand la reversez-vous ?**, proposé | même raison | `ExigibiliteTva.tsx` |
| IBAN, puis titulaire : 2 écrans | **1 écran**, IBAN par groupes de quatre, titulaire proposé | le paquet « Pour être payé » | |
| Moyens de paiement, « Virement et chèque » proposé | le même | sa décision du 18 septembre | `modalites-paiement.ts` |
| *absent* | **Avez-vous une assurance décennale ?** Oui ou Non ; si oui, **la photo de l'attestation** (l'IA lit déjà l'assureur et la fin de validité), puis **l'assureur** : nom (proposé par la lecture), adresse, couverture | obligatoire sur les devis et factures de qui en a une (loi 96-603, art. 22-2) | `lire-attestation.ts`, `attestation-lue.ts` |
| *absent* | **Votre médiateur de la consommation ?**, Passer permis, compté à la fin s'il manque | obligatoire dès qu'on travaille pour des particuliers ; c'est lui que la fin d'aujourd'hui oublie | Mon entreprise |
| *absent* (un chantier par jour posé sans le dire) | **Combien de chantiers par jour ?**, 1 proposé | la capacité du planning dès le premier jour | `VosEquipes.tsx`, `nombreEquipes` |

**Le compte annoncé** reste la règle de `totalAnnonce` : il ne monte jamais.
14 questions pour une micro-entreprise sans décennale, 20 pour une société qui
facture la TVA et a une décennale ; aujourd'hui, de 13 à 16. Son « non c'est pas
trop » du 9 septembre portait sur seize : le chiffre neuf est écrit sur la
planche pour qu'il en juge.

## Pas demandé à la porte, et pourquoi

| Réglage | Pourquoi il reste dans Réglages |
|---|---|
| Répertoire des métiers | facultatif, jamais réclamé (son choix B du 9 octobre) |
| Place des mentions légales | « En bas, avec le SIRET », gardé le 26 octobre |
| N° de contrat de la décennale | pas exigé sur un devis |
| Salariés et leurs noms, acompte, validité, logo, couleurs, messages | une valeur d'office juste ; rien de faux ne part sans eux |

## La fin

L'ordre devient : le code, les conditions, Face ID, puis **Tout est prêt**, qui
montre chaque paquet de Mon entreprise rempli et nomme ce qui manque (trois au
plus, comme `phraseDeCeQuiManque`), puis **Entrer dans Atlas**, qui entre
vraiment. Aujourd'hui « Entrer dans Atlas » ouvre encore les conditions
(`documents-legaux/page.tsx`), parce que la garde du gabarit ne se rejoue pas
sur une navigation côté client : à résoudre au codage, sans affaiblir la garde.

## À trancher par lui

- Face ID proposé juste avant d'entrer, ou laissé dans Réglages, Mot de passe.
- Les chantiers par jour demandés à la porte, ou laissés à un.

## Trouvé en chemin, non corrigé

- La TVA déclarée une fois par an (régime simplifié, CA12) n'a pas de case :
  l'appli ne connaît que le mois et le trimestre (`periodicite_tva`). Confiance
  moyenne sur la part d'artisans concernés : à voir avec un comptable avant d'y
  toucher.

## Le jour où il dit « code ça »

Niveau 3 (`src/lib/creation-compte.ts`, `creerSonCompte` qui écrit en base, et
la garde des documents légaux) : batterie entière. Aucune migration : la
périodicité, l'exigibilité, la décennale, l'attestation, le médiateur et
`nombre_equipes` sont déjà des colonnes d'`entreprises`. Grandissent
`SaisieCompte` et l'insertion de `creerSonCompte`. **Un piège** : la photo de
l'attestation est prise avant « Créer mon compte », or elle se range sous
l'entreprise ; elle ne part donc qu'une fois le compte créé, et rien n'est
écrit avant (sa règle). `test-creation-compte.ts` doit rougir d'abord sur la
fin qui dit « Tout est prêt » sans médiateur.

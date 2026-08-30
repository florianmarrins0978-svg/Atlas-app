# Mentions légales : la facture réelle d'un artisan comparée aux nôtres

**28-30 août 2026.** Comparaison demandée entre une facture réelle (L'R de
l'Arbre, EURL) et ce qu'Atlas imprime, pour vérifier ce que la loi impose et
combler ce qui manque.

**Ce qui a été trouvé et corrigé tout de suite :** deux mentions obligatoires
étaient déjà saisies dans Réglages > Identité, l'écran promettait même qu'elles
s'impriment sur la facture — et elles n'apparaissaient nulle part. C'est un
vrai défaut, pas une nuance ; il est corrigé et testé (voir plus bas).

**Ce qui reste ouvert :** deux mentions qu'Atlas ne sait pas encore saisir du
tout — capital social, numéro et ville du RCS. Elles ne concernent que les
sociétés (SARL, EURL, SASU…), pas un artisan en entreprise individuelle. Sa
décision est demandée avant de les ajouter (nouveau champ = nouvelle maquette).

---

## Ce que la facture reçue porte, comparé à Atlas

| Mention | La facture reçue | Atlas, avant ce lot | Atlas, maintenant |
|---|---|---|---|
| Nom, adresse, téléphone, e-mail de l'émetteur | ✓ | ✓ | ✓ |
| SIRET | ✓ | ✓ | ✓ |
| **Forme juridique** (EURL) | ✓ | **saisie, jamais imprimée** | ✓ imprimée |
| **Capital social** (1000 €) | ✓ | absente — aucun champ | toujours absente, voir plus bas |
| **RCS + ville d'immatriculation** | absente sur cette facture (SIRET seul) | absente | toujours absente, voir plus bas |
| **Numéro de TVA intracommunautaire** | absent (client hors UE, prestation à un particulier) | **saisi, promis « sur la facture », jamais imprimé** | ✓ imprimé |
| Nom et adresse du client | ✓ | ✓ | ✓ |
| Numéro de facture | ✓ | ✓ | ✓ |
| Date d'émission | ✓ | ✓ | ✓ |
| Date de la prestation | ✓ (« Intervention du 6/05/2025 ») | via le libellé de la ligne | inchangé |
| Désignation, quantité, prix unitaire HT | ✓ | ✓ | ✓ |
| Réduction de prix, si accordée | — | ✓ | ✓ |
| Totaux HT / TVA / TTC | ✓ | ✓ | ✓ |
| **Date d'échéance** | ✓ (06-06-2025) | ✓ | ✓ |
| **Taux des pénalités de retard** | ✓ (3× le taux légal, loi n°2008-776) | ✓ | ✓ |
| **Indemnité forfaitaire de recouvrement** | ✓ (40 €, art. D.441-5) | ✓ | ✓ |
| **Conditions d'escompte** (même une absence) | — *(silence : c'est un manque sur CETTE facture)* | ✓ (« Pas d'escompte ») | ✓ |
| Mention de franchise en base (art. 293 B), si applicable | n/a (assujettie) | ✓, jamais devinée | ✓ |
| Mode de paiement | ✓ (« Autres ») | IBAN + « virement » | inchangé |

**Verdict sur la facture reçue elle-même :** elle est bien tenue, mais il lui
manque la mention d'escompte (silence sur ce point, qui doit légalement être
dit même pour dire qu'il n'y en a pas) — un défaut qu'Atlas, lui, ne commet pas
puisqu'il l'écrit dans tous les cas.

---

## Ce qui était cassé, et qui est corrigé

**Le défaut.** Réglages > Identité fait saisir la forme juridique et le
numéro de TVA intracommunautaire depuis le 14 août. L'écran dit même, mot pour
mot : *« Votre numéro intracommunautaire figure alors sur la facture. »*
Aucun des deux n'atteignait pourtant `devis-pdf.ts` ni `facture-pdf.ts` — la
colonne existait sur `entreprises`, mais pas sur `devis` ni `factures`, qui
figent leur propre instantané de l'identité au jour de l'émission (comme le
nom, l'adresse, le SIRET). La donnée s'arrêtait donc en base, sans jamais
atteindre le papier.

**Portée :** tout artisan assujetti à la TVA sur Atlas envoyait, depuis le
14 août, des factures sans son numéro de TVA intracommunautaire — une mention
obligatoire (CGI, art. 242 nonies A). Et toute société (SARL, EURL, SASU…)
envoyait devis et factures sans sa forme juridique (Code de commerce,
art. R123-237).

**Correction :**

- Migration `0071_forme_juridique_et_tva_sur_documents.sql` — deux colonnes
  nullables sur `devis` et `factures`, additives : les documents déjà émis
  n'en portent aucune trace et ressortent identiques à eux-mêmes.
- Ces deux champs sont désormais figés à la création du devis, puis recopiés
  du devis vers la facture — même principe que le nom, l'adresse et le SIRET.
- `document-commun.ts` les imprime sous l'en-tête, une ligne chacun, seulement
  quand ils sont renseignés : la forme juridique (« EURL ») et
  « TVA intracommunautaire FR40123456789 ».
- Testé : `scripts/test-facture-pdf.ts` et `scripts/test-devis-pdf.ts`
  vérifient que la mention s'imprime quand le champ est rempli, et
  qu'aucune ligne ne s'ouvre quand il ne l'est pas.

**Preuve que le contrôle sait échouer :** les deux tests ont d'abord été
lancés contre le code d'avant (sans la correction) — ils rougissaient. C'est
en corrigeant `document-commun.ts` et les dépôts qu'ils sont passés au vert.

Batterie complète rejouée : 286/286 suites base, lint sans erreur, mémoire du
dépôt cohérente, `tsc --noEmit` propre.

---

## Ce qui reste ouvert : capital social et RCS

Deux mentions obligatoires **pour les sociétés seulement** (pas pour une
entreprise individuelle ni une micro-entreprise) n'ont **aucun champ nulle
part** dans Atlas :

| Mention | Obligation | Concerne |
|---|---|---|
| Capital social | Code de commerce, art. R123-237 | SARL, EURL, SASU, SAS, SA, SNC, SCOP, SCI |
| RCS + ville d'immatriculation | même article | idem |

**Pourquoi ce n'est pas fait dans ce lot.** Ce sont des champs qui n'existent
pas du tout — ni en base, ni à l'écran Réglages > Identité — contrairement à
la forme juridique et au numéro de TVA qui existaient déjà et qu'il fallait
seulement relier au document. Ajouter un champ à un écran est une maquette
avant d'être du code (règle du dépôt) : je ne l'ai pas dessinée sans vous
l'avoir montrée.

**Ce que ça coûterait, si vous le voulez :**

- un champ « Capital social » (texte ou nombre), affiché seulement pour les
  formes juridiques qui en ont un — pas pour EI ni Micro-entreprise ;
- **aucun second champ pour le numéro RCS** : il n'existe pas comme donnée
  séparée, c'est le SIREN (les neuf premiers chiffres du SIRET, déjà connus)
  précédé de « RCS » et suivi de la ville d'immatriculation. Il suffit donc
  d'un champ « Ville d'immatriculation au RCS » ;
- impression conditionnelle : « EURL au capital de 1 000 € — RCS Versailles
  812 345 678 », uniquement quand les deux sont renseignés.

Voulez-vous que je les ajoute (maquette d'abord, comme toujours) ?

---

## Ce qui n'a pas été touché, et pourquoi

- **Mode de paiement affiché en toutes lettres** (« Autres », « Virement »…) :
  ni la loi ni la facture reçue n'imposent ce libellé — l'IBAN et la mention
  « Paiement par virement bancaire » qu'Atlas imprime suffisent à dire comment
  payer. Rien à corriger.
- **Date de la prestation, distincte de la date d'émission** : la facture
  reçue l'écrit en tête de tableau (« Intervention du 6/05/2025 »). Sur Atlas,
  cette date vit dans le libellé de la ligne ou l'adresse du chantier, jamais
  dans un champ dédié séparé. Ce n'est pas un défaut légal — la date figure
  quelque part sur le document — mais un point de forme que je n'ai pas
  changé pour ne pas déborder du périmètre demandé. À signaler si vous
  voulez qu'elle devienne un champ à part.

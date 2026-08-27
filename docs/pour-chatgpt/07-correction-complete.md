# Atlas — La chaîne « dictée → devis », corrigée de bout en bout

**27 août 2026.** Ce dossier remplace les lots A, B et C : il décrit l'état
**final** de la correction, pas une étape. Les dossiers 01 à 06 restent des
instantanés du chemin parcouru — ce qui fait foi, c'est ce document et le dépôt.

Il est autonome : ChatGPT n'a pas le code sous les yeux. Les extraits sont
verbatim, les mesures ont été faites, et ce qui n'a **pas** pu être éprouvé est
dit comme tel.

---

## 1. Résultat final

La dictée de référence traverse maintenant la chaîne sans qu'aucune information
soit transformée en silence :

| Ce qui est dicté | Ce qu'Atlas conserve |
|---|---|
| « 800 mètres linéaires de haie de laurier » | nature `haie`, espèce `laurier`, quantité 800, unité `ml` |
| « démontage d'un érable de 40 cm et 12 m, rétention » | nature `abattage`, espèce `érable`, méthode `demontage_retention`, ⌀ 40 cm, hauteur 12 m |
| « dessouchage de deux souches de 60 cm » | nature `dessouchage`, quantité 2, unité `souche`, ⌀ 60 cm |
| « évacuation des déchets » | nature `evacuation` — accessoire, sur la ligne de l'abattage |
| « tonte de 1 200 m² de pelouse » | nature `tonte`, quantité 1 200, unité `m²` — **sa propre ligne**, « à chiffrer » |
| « deux hommes pendant une journée » | `tailleEquipe` et `dureePrevue` — **jamais** une quantité de prestation |

**Les quatre défauts mesurés le 26 août sont fermés :**

1. la quantité dictée survit jusqu'à la ligne du devis (800 × 17,50 €, plus
   « Qté 1 — 14 000 € ») ;
2. une tonte et un démontage ne partagent plus ni ligne, ni nature, ni
   apprentissage ;
3. une ligne qu'on ne sait pas chiffrer s'écrit « à chiffrer », plus « 0 € », et
   le devis ne peut ni se préparer ni s'envoyer tant qu'elle attend son prix ;
4. le rappel de prix cesse de présenter le prix d'une haie de 50 ml comme
   l'expérience d'une haie de 800.

**Batterie complète au vert.** Détail au §13.

---

## 2. Architecture retenue

### 2.1 Le référentiel des natures — `src/lib/natures-prestation.ts`

**Ce qu'il remplace.** Six modules portaient chacun leur propre liste de
travaux, en expressions régulières, et **aucune ne connaissait la tonte** :
`lignes-vendables.ts`, `lecons-prix.ts`, `apprendre-grille.ts`,
`prix-attribuable.ts`, `grille-prix.ts`, `questions-chiffrage.ts`.

Chaque nature y porte tout ce qu'elle implique :

```ts
export type Nature = {
  cle: string;
  libelle: string;
  motif: RegExp;          // mécanisme HISTORIQUE : relire les libellés d'avant
  detachable: boolean;    // le client peut-il la refuser seule ?
  accessoire: boolean;    // accompagne l'abattage (broyage, évacuation…)
  chiffrage: "grille" | "aucune";
  ordreDevis: number;     // sa place sur le document
  uniteDeMesure: string | null;
};
```

Douze natures : `abattage`, `haie`, `elagage`, `dessouchage`, `grumes`,
`fendage`, `broyage`, `evacuation`, `billonnage`, `tonte`, `plantation`,
`cloture`.

**La règle qui gouverne tout le reste :**

> IDENTITÉ MÉTIER et CAPACITÉ DE CHIFFRAGE sont deux choses, et ne se confondent
> jamais.

Une tonte est parfaitement identifiée ; aucune grille ne la chiffre. Les
confondre est **exactement** ce qui a produit le fourre-tout : « je ne sais pas
la chiffrer » se lisait « je ne sais pas ce que c'est », donc « ça va avec le
reste ».

**Une nature inconnue reste une prestation à part entière** : `null`, sa propre
ligne, « à chiffrer ». Elle ne rejoint rien — pas même une autre nature
inconnue, parce que deux travaux qu'on ne sait pas nommer ne sont pas pour
autant le même travail.

### 2.2 Le groupe commercial — `src/lib/lignes-vendables.ts`

`LigneVendable.cle` portait `"principal"` : une case qui ramassait tout. Elle
porte désormais la **nature** de ce qui est vendu, et le rôle de « ligne qui
absorbe le solde » vit dans un champ à part :

```ts
export type LigneVendable = {
  cle: string;                        // la nature, ou "autre"
  libelle: string;
  membres: string[];
  prestations: PrestationAGrouper[];  // avec leurs identifiants
  detachable: boolean;
  principal: boolean;                 // un RÔLE, plus une identité
};
```

C'est précisément ce que le mot `principal` mélangeait : « la ligne qui reçoit
le solde » et « la ligne des travaux qu'on ne sait pas classer » étaient la même
chose, donc tout travail inconnu héritait du prix ET de l'apprentissage de
l'abattage.

**Les règles métier n'ont pas bougé d'un pouce :**
- l'abattage, le broyage et l'évacuation restent sur une ligne (7 août) ;
- le billonnage disparaît quand un abattage l'accompagne, et seulement alors
  (5 août) ;
- la fente, la haie, les grumes, la souche se détachent (7 et 8 août) ;
- un accessoire SEUL redevient le chantier.

**Une généralisation, mesurée :** les accessoires rejoignent la ligne
principale même quand ce n'est pas un abattage. Sans cela, sa dictée du 7 août
— « taille d'allégement sur marronnier, broyage, évacuation » — aurait produit
trois lignes que le client aurait pu refuser une à une.

### 2.3 La ligne connaît ce qu'elle vend

La table de liaison `lignes_prix_prestations` (migration 0069, lot B) est
maintenant **utilisée partout** au lieu du rapprochement par texte : le
découpage transporte les identifiants, l'écriture au détail les pose, et
l'apprentissage les relit.

---

## 3. Migrations

**Une seule, la 0070, additive de bout en bout.** Aucune colonne supprimée,
aucune donnée relue, réinterprétée ni réécrite.

| Table | Colonne | Défaut | Pourquoi |
|---|---|---|---|
| `lignes_prix` | `a_chiffrer boolean` | `false` | le travail est identifié, son prix ne l'est pas |
| `lignes_devis` | `a_chiffrer boolean` | `false` | le document sait lui-même qu'il n'est pas complet |
| `lignes_devis` | `unite text` | `NULL` | « 800 × 17,50 € » ne disait pas 800 de quoi |
| `prestations` | `corrige_par_humain boolean` | `false` | le dépôt n'avait **aucune** provenance |
| `lecons_prix` | `signature_v2 text` | `NULL` | la V2 à côté de la V1, jamais à sa place |
| `lecons_prix` | `espece`, `quantite`, `unite` | `NULL` | la matière du futur calibrage du seuil |

Deux CHECK ajoutés sur `lecons_prix` : `(quantite IS NULL) = (unite IS NULL)` et
`quantite > 0` — le même invariant que sur `prestations`.

**Pourquoi un drapeau `a_chiffrer` et non un prix nullable.** Rendre `montant`
nullable remonterait jusqu'à `lignes_facture`, donc jusqu'à la facturation et la
numérotation — hors périmètre, et un devis facturé à NULL serait bien pire que
le zéro qu'on répare. Le drapeau vit là où la décision se prend.

**Pourquoi il descend jusqu'à `lignes_devis`.** Le devis est une photographie ;
s'il ne portait pas l'état, le contrôle avant envoi devrait relire les lignes de
prix — qui ont pu bouger depuis.

---

## 4. Fichiers importants

**Créés :**

| Fichier | Ce qu'il porte |
|---|---|
| `src/lib/natures-prestation.ts` | le référentiel, et la traduction unité → mesure |
| `src/lib/quantite-commerciale.ts` | physique vs commerciale, et l'avertissement « 2 souches » |
| `src/lib/comparabilite-prix.ts` | la signature V2, `sontComparables`, la relecture des leçons d'avant |
| `drizzle/0070_prix_a_chiffrer_et_comparabilite.sql` | la migration |

**Remaniés en profondeur :** `lignes-vendables.ts` (groupes sur prestations),
`prix-attribuable.ts` (sur les colonnes), `mesures-prestation.ts` (quantité +
provenance), `proposition-prix.ts` (décomposition et « à chiffrer »),
`apprendre-grille.ts`, `repositories/lecons-prix.ts`, `repositories/prestations.ts`,
`repositories/devis.ts`, `ai/services/extraction-service.ts`,
`ai/providers/llm/anthropic.ts`.

---

## 5. Quantité et unité

### 5.1 Deux concepts

| | Où | Ce que ça dit |
|---|---|---|
| **physique** | `prestations.quantite` / `unite` | ce qu'il y a à faire : 800 mètres de haie |
| **commerciale** | `lignes_prix.quantite` / `unite` | ce qui est vendu : 800 ml, ou 1 forfait |

**Elles ne se synchronisent pas.** Une ligne qui réunit trois prestations se
vend au forfait ; lui fabriquer une quantité (la somme ? celle du premier
membre ?) donnerait un « 800 × 750 € » que personne n'a décidé. Et écraser la
quantité physique pour qu'elle « colle » à la ligne effacerait la donnée du
chantier pour arranger le document.

La règle, formalisée et testée :

```ts
export function quantiteCommerciale(prestations: readonly PrestationVendue[]): QuantiteCommerciale {
  const forfait = { quantite: "1", unite: null, origine: "forfait" } as const;
  if (prestations.length !== 1) return forfait;
  const seule = prestations[0];
  const unite = seule.unite?.trim();
  if (!seule.quantite || !unite) return forfait;
  const valeur = Number(String(seule.quantite).replace(",", "."));
  if (!Number.isFinite(valeur) || valeur <= 0) return forfait;
  return { quantite: String(valeur), unite, origine: "prestation" };
}
```

### 5.2 La quantité atteint enfin le CALCUL

**C'est le point le plus important, et il n'était dans aucun des briefs.** La
colonne `prestations.quantite` existait depuis le lot B et **n'atteignait aucun
calcul** : le chiffrage relisait « (800 ml) » dans le libellé. Corriger la
colonne ne changeait donc rien au prix — elle était décorative.

```ts
export function caracteristiqueDeLaQuantite(cleNature, quantite, unite): Record<string, number> | null {
  const n = nature(cleNature);
  if (!n || !n.uniteDeMesure || !quantite || !unite) return null;
  if (normaliserUnite(unite) !== normaliserUnite(n.uniteDeMesure)) return null;
  // …
  switch (n.uniteDeMesure) {
    case "ml":    return { longueurMl: valeur };
    case "tonne": return { tonnageT: valeur };
    default:      return null;   // « m² » : aucune grille ne s'en sert
  }
}
```

**Ce n'est pas une déduction, c'est une correspondance d'unités.** 800 « ml »
sur une haie SONT sa longueur. 800 « m² » de haie ne sont **rien** : convertir
serait inventer.

### 5.3 Une décision qu'on ne prend PAS à sa place

« Dessouchage de deux souches de 60 cm » : sa grille donne un prix pour **une**
souche de 60 cm. Faut-il multiplier par deux, ou le déplacement est-il déjà
compris ? Multiplier serait inventer un prix ; ignorer serait facturer une
souche pour deux.

On ne tranche pas : la ligne garde le prix de grille — le comportement
d'aujourd'hui — et **l'écran le lui dit** :

> « Dessouchage de deux souches » porte 2 souches : le prix de votre grille est
> celui d'un seul. Vérifiez s'il doit être multiplié.

C'est une vraie décision métier, et elle vous revient (voir §16 bis).

---

## 6. Prestation métier ≠ groupe commercial

| | |
|---|---|
| **prestation** | une identité, une nature, ses mesures, son identifiant stable |
| **groupe commercial** | ce que le client peut accepter ou refuser **seul** |

Le groupe ne détruit plus l'identité : `LigneVendable.prestations` porte les
prestations entières, identifiants compris, et c'est par eux que le devis, le
chiffrage et l'apprentissage les retrouvent.

**Sur l'identité (votre §5).** Vous aviez raison : deux travaux différents
peuvent légitimement porter exactement le même texte. Un bug en découlait, et
il a été corrigé — une dictée qui énonce deux fois « démontage d'un érable »
n'en gardait **qu'un**, et l'autre ne se facturait jamais. Le dédoublonnage
protège désormais du **rejeu** d'une dictée, pas de ce qu'elle dit deux fois.

`correspondance-prestation.ts` n'est plus l'architecture : c'est le
rapprochement d'une **extraction** vers une prestation existante, et il reste
délibérément conservateur — le libellé identique, ou identique suivi du tiret
d'enrichissement. Aucune distance d'édition, aucun « ça se ressemble ». Partout
ailleurs, c'est l'identifiant qui circule.

---

## 7. Le prix « à chiffrer »

**« Inconnu → 0 € » est supprimé.** Sur un devis, un zéro se lit « gratuit » :
c'est un montant, donc une décision, là où il n'y a qu'une ignorance.

```ts
export type LigneProposee = {
  libelle: string;
  montant: string | null;   // null = à chiffrer
  quantite: string;
  unite: string | null;
  prixUnitaire: string;
  prestationIds: string[];
};
```

Trois chemins produisaient un zéro, et les trois produisent maintenant l'état :
le modèle « poste par poste » (case de grille vide), la répartition qui ne tient
pas debout, et la répartition qui réussit mais laisse une détachable sans prix
de grille — `repartir` documentait déjà cette ligne comme « visible comme un
prix à poser », et « à poser » veut dire « à chiffrer », pas « offert ».

**La quantité physique survit sans le prix.** Une haie de 800 ml qu'on ne sait
pas chiffrer reste une haie de 800 ml : c'est ce qu'il regarde pour poser son
montant.

**Le devis ne part pas.** `peutPreparerDevis` refuse et nomme les lignes ;
`envoyerDevis` refuse sur la photographie du document. Poser un montant positif
éteint l'état de lui-même — sinon le devis resterait bloqué après qu'il a fait
exactement ce qu'on lui demandait.

Le PDF écrit « à chiffrer » à la place de « 0,00 € », et l'unité à côté de la
quantité.

---

## 8. Comparabilité V2, compatibilité V1

### 8.1 Ce que la V1 ignorait

Trois jetons — nature, technique, tranche de diamètre — comparés par **égalité
de chaîne en SQL**. Ni espèce, ni quantité, ni unité. **50 ml et 800 ml de haie
avaient la même clé** : d'où les « 15 chantiers comparables ».

### 8.2 La V2, dans une colonne à elle

```
v2 | nature | méthode | tranche de ⌀ | unité | ordre de grandeur
```

**Aucun seuil ×2 ou ×5 n'a été inventé.** Rien dans le dépôt ne le justifie, et
le choisir « pour terminer » fabriquerait exactement le genre de chiffre qui
revient ensuite avec l'autorité de l'expérience.

Le critère retenu est **éliminatoire et certain** : deux chantiers qui ne sont
pas du même **ordre de grandeur** ne sont pas le même chantier. `50` et `55` →
`o1`. `800` → `o2`. La frontière est assumée et penche du bon côté : 95 et
105 m tombent de part et d'autre, ce qui fait **manquer** un rappel — jamais
n'en fabrique un faux. C'est déjà le raisonnement de `trancheDiametre`.

**L'espèce n'est PAS dans la clé, et c'est un choix mûri.** Une leçon d'avant
n'en porte aucune ; la mettre dans la clé rendrait toute sa mémoire introuvable
du jour au lendemain, dès que l'extraction commencerait à remplir le champ. Elle
élimine dans `sontComparables`, et **seulement quand les deux côtés la
connaissent** :

```ts
const especeA = a.espece?.trim().toLowerCase() || null;
const especeB = b.espece?.trim().toLowerCase() || null;
if (especeA && especeB && especeA !== especeB) return false;
```

Une absence d'information n'est pas une différence.

### 8.3 Les leçons d'avant restent lisibles

- leur clé V1 n'est **jamais** réécrite ;
- la lecture présélectionne largement en base (`signature = cleV1 OR
  signature_v2 = cleV2`), puis trie finement en mémoire ;
- une leçon sans V2 se relit de **son propre libellé** (`profilDepuisLibelle`),
  et **aucune espèce n'y est devinée** — ce serait prétendre connaître un champ
  qu'elle n'a jamais porté.

`lecons_prix` enregistre désormais espèce, quantité et unité : c'est la matière
qui permettra de calibrer un vrai seuil, plus tard, sur ses vrais devis.

**Un gain de côté :** une tonte, que le vocabulaire V1 ne savait pas nommer, se
retient maintenant. « La dernière tonte de 1 200 m² était à 200 € » est
exactement la mémoire qu'il demande depuis le 7 août.

---

## 9. Apprentissage

Le garde-fou du lot A reste, et **passe sur les colonnes** :

```ts
const vendues = ligne.id ? await prestationsDeLaLigne(ctx, ligne.id) : [];
const attribution = vendues.length > 0 ? prixAttribuableDes(vendues) : prixAttribuable(ligne.libelle);
```

Ce qui continue d'enseigner : une prestation seule ; « abattage + broyage +
évacuation » (sa règle du 7 août — ces 600 € SONT son prix d'abattage) ; un
broyage seul.

Ce qui n'enseigne rien : deux natures vendables sur une ligne ; un travail que
le produit ne sait pas **nommer** à côté d'un travail qu'il nomme ; des mesures
contradictoires.

**Un changement assumé, et documenté dans le test.** Une tonte SEULE est
désormais « attribuable ». Ce module répond à une seule question — *ce montant
appartient-il à un seul travail ?* — et pour une tonte seule la réponse est oui.
Ce que chaque consommateur en fait lui appartient : la grille n'a pas de case
« tonte » et ne range rien ; la mémoire de prix, elle, retient utilement.
C'est votre §6 appliqué.

**Le journal nomme les travaux**, plus seulement les natures :

> La ligne porte 2 travaux qui se vendent séparément : « Tonte de la pelouse
> (1200 m²) » (tonte), « Érable — démontage en rétention » (abattage). Son
> montant n'appartient à aucun d'eux en propre.

Un refus muet ne se diagnostique pas.

---

## 10. Troncature

`ResultatLLM` porte désormais la façon dont le modèle a arrêté d'écrire :

```ts
export type FinDeReponse = "complet" | "tronque";
export type ResultatLLM =
  | { succes: true; texte: string; fin?: FinDeReponse }
  | { succes: false; erreur: ErreurIA };
```

Le fournisseur Anthropic lit `stop_reason` — l'information **arrivait jusqu'à
lui et était jetée**. Deux lectures, dans cet ordre :

1. **l'enveloppe** (elle fait foi quand elle existe) ;
2. **la forme** — `estJsonTronque` : un objet qui s'ouvre et ne se referme
   jamais. Tous les fournisseurs ne renseignent pas `stop_reason`.

Le plafond passe de 1 024 à 4 096 jetons, **et ce n'est pas la correction** :
une dictée plus longue le dépassera aussi. La correction, c'est que la coupure
se voie.

Le repli littéral reste — un écran mort a coûté deux jours le 4 août — mais son
motif nomme désormais la troncature, il part au journal, et les écrans peuvent
le dire.

Éprouvé avec de faux fournisseurs, sans aucune clé, dans les deux sens : une
réponse tronquée mais au JSON **parfait** est refusée (l'enveloppe suffit), et
une réponse complète est acceptée.

---

## 11. Corrections humaines

**Le défaut était pire que la plainte.** Vous demandiez qu'il n'ait plus à
transformer « Haie (800 ml) » en « Haie (80 ml) ». En réalité, quand il le
FAISAIT, **rien ne changeait** : le chiffrage lisait la colonne — restée à 800 —
et le contrat du lot C, devant deux sources qui divergent, refusait de calculer
quoi que ce soit. Sa correction était invisible **et** bloquante, et rien à
l'écran ne le lui disait.

`prestations.corrige_par_humain` donne au dépôt la provenance qui lui manquait.
Trois conséquences :

1. **le libellé qu'il édite est lu** — c'est une saisie, pas une base de
   données — et sa mesure entre en colonne ;
2. **sa valeur tranche** face à un libellé que personne n'a mis à jour, au lieu
   de produire une contradiction ;
3. **aucune extraction ne repasse dessus.**

Le mécanisme est le plus simple qui tienne : un booléen, posé par les deux seuls
chemins où l'artisan agit, et lu par les trois qui décident.

**Le contrat du lot C ne bouge pas :** sans main humaine, deux sources qui
divergent restent une contradiction et le prix ne se calcule pas.

**L'écran, lui, se dessine avant d'être codé.** `CLAUDE.md` §3 bis est une règle
du dépôt, écrite par le patron après qu'un geste a été porté dans le code avant
son accord. Le chemin serveur existe et il est éprouvé
(`corrigerMesurePrestation`, `corrigerMesurePrestationAction`) ; la planche est
publiée et **essayable** :

> https://florianmarrins0978-svg.github.io/Atlas-app/corriger-une-mesure.html

C'est le seul point où j'ai délibérément arrêté le travail avant `src/`, et la
raison est écrite dans le code lui-même.

---

## 12. Bugs annexes découverts et corrigés

1. **Une dictée qui énonce deux fois le même travail n'en gardait qu'un.**
   « Je démonte un érable, puis un érable au fond du jardin » : la seconde ligne
   était absorbée par la première. Deux arbres, une prestation, et l'un des deux
   ne se facturait jamais. Corrigé et tenu dans les deux sens — le **rejeu**
   d'une dictée ne crée toujours pas de doublon.

2. **« Taille d'allégement sur marronnier » n'était un élagage pour personne.**
   Le motif exigeait « taille de/du » avec un espace ; l'apostrophe n'y était
   pas. C'est la dictée du 7 août, celle dont le devis est sorti vide.

3. **Un motif corrigé trop vite a cassé « taille de haie ».** En ajoutant
   l'apostrophe, `d(?:e|u|')\s*` laissait le regard tomber **avant** l'espace :
   « taille de haie » redevenait un élagage. Attrapé par la suite existante,
   et corrigé — le blanc fait partie du mot.

4. **Une suite se rappelait elle-même.** La première version de
   `test-comparabilite-v2-db.ts` enregistrait une leçon sur la ligne qui
   interrogeait la mémoire : trois contrôles passaient pour la mauvaise raison.
   C'est le piège du 15 août sous un autre visage.

5. **Le report automatique des réponses risquait de geler ses colonnes.** Il
   passait par `modifierPrestation`, qui marque désormais « corrigé par
   l'artisan ». `renommerPrestation` a été créée pour le chemin automatique.

---

## 13. Résultats

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npx eslint src scripts` | **0 erreur**, 8 avertissements (tous préexistants) |
| `npm test` (suites base) | **260/260** |
| `npm run test:e2e` (navigateur) | **1 suite rouge, prouvée PRÉ-EXISTANTE** (voir ci-dessous) |
| `npm run verifier:connexion` | ✅ connexion réelle derrière une origine étrangère |

**La suite rouge, et pourquoi elle n'est pas de ce lot.**
`test-carte-reponse-mene-au-geste-e2e.ts`, premier cas sur quatre : aucune carte
de réponse n'apparaît à l'accueil pour un devis accepté. Elle échoue **à
l'identique sur le commit d'avant la première ligne de ce travail** (`ed8f074`),
ce qui a été vérifié en repassant le dépôt à cet état. Elle est notée dans
`TODO.md` pour être diagnostiquée à part.

**Un défaut de mon fait, trouvé et corrigé pendant la vérification.** Au premier
passage complet de la batterie, le serveur de développement **est mort** en
plein parcours navigateur — six suites emportées. `retenirLecon` ouvrait un
second `withEntreprise` au milieu du sien : chacun ouvre une transaction, donc
prend une connexion du pool, et l'imbriquer en prend une seconde pendant qu'on
tient la première. Sous quelques requêtes simultanées, le pool se vide et
l'application attend une connexion que personne ne rendra. Corrigé
(`prestationsDeLaLigneDans`, qui lit dans la transaction courante). Les deux
suites emportées passent isolément.

Suites ajoutées : `test-natures-prestation.ts`,
`test-quantite-commerciale.ts`, `test-troncature-modele.ts`,
`test-comparabilite-v2-db.ts`, `test-correction-humaine-db.ts`, plus des cas
neufs dans six suites existantes.

---

## 14. État final A / B / C / E / F / G / H

| | Ce qu'il exige | État |
|---|---|---|
| **A** | la quantité dictée arrive au devis | ✅ 800 ml × 17,50 €, unité comprise |
| **B** | deux travaux gardent deux identités | ✅ tonte et démontage sur deux lignes, deux natures |
| **C** | inconnu n'est ni 0 ni 1 | ✅ « à chiffrer », quantité physique conservée |
| **E** | faux comparable refusé | ✅ ordre de grandeur, unité, espèce |
| **F** | lot ambigu n'enseigne rien | ✅ garde-fou sur les colonnes |
| **G** | V1 reste lisible | ✅ clés inchangées, leçons d'avant retrouvées |
| **H** | troncature identifiable | ✅ enveloppe + forme |

**Trois assertions ont été déplacées ou corrigées, et chaque raison est écrite
dans le test lui-même :**

**(a) Les trois cas E visaient `signatureLecon`, la clé V1.** C'était viser le
mauvais endroit, pour la raison exacte qui avait déjà fait déplacer le cas F :
**les clés V1 sont stockées**, et le cas G — écrit le même jour — interdit de
les changer. Les deux exigences ne pouvaient pas tenir sur la même fonction.
Ils visent la V2.

**(b) Deux cas E se contredisaient entre eux.** « 50 et 55 ml restent
comparables » était écrit avec **deux espèces différentes** (laurier et
thuyas), pendant que le cas suivant exige que deux espèces différentes ne se
rapprochent pas. Le premier prétend éprouver la proximité de **longueur** : il
le fait maintenant à espèce égale, ce qu'il aurait toujours dû faire.

**(c) Un cas de `test-prix-attribuable.ts` exigeait qu'une tonte seule soit
refusée**, sous le titre « un travail inconnu du produit ». Le référentiel la
nomme désormais, et votre §6 sépare explicitement identité et chiffrage. Le cas
a été réécrit avec un travail réellement inconnu, et un nouveau cas documente
pourquoi une tonte seule enseigne.

Aucune règle métier n'a été affaiblie pour obtenir du vert.

---

## 15. Ce qui n'a PAS pu être éprouvé ici

Cet environnement n'a **aucune clé d'IA** (`CLAUDE.md` §1 ter). Ce qui suit est
donc tenu par contrat et par faux fournisseurs, jamais par un appel réel :

1. **Ce que le modèle répond vraiment** sur `nature` et `espece`. Le contrat est
   dans l'invite, le code vérifie la nature contre le référentiel et refuse une
   taxonomie inventée — mais **personne n'a encore vu Claude remplir ces deux
   champs sur une vraie dictée.**
2. **Whisper.** La transcription n'est jouée nulle part ici.
3. **`stop_reason` réel.** Le fournisseur est éprouvé par lecture de source et
   par de faux fournisseurs ; l'API n'a pas été appelée.
4. **Les six dictées d'unités** listées en fin de `scripts/test-invites-unites.ts`
   (deux souches, trois arbres, quatre journées, deux hommes, 800 ml, 1 200 m²).

Rien de tout cela n'est simulé, et rien n'est présenté comme vérifié.

---

## 16. Le seul test réel qui reste

Un seul geste, sur son espace, où les clés sont branchées.

```
Prononcer, dans une note vocale :

« Taille de 800 mètres linéaires de haie de laurier, démontage d'un érable de
40 cm de diamètre et 12 mètres de haut avec rétention, dessouchage de deux
souches de 60 cm, évacuation des déchets et tonte de 1 200 mètres carrés de
pelouse, prévoir deux hommes pendant une journée. »
```

**Ce qu'il faut regarder, et dans cet ordre :**

| Étape | Où | Ce qui doit s'y trouver |
|---|---|---|
| transcription | écran Informations | le texte, entier, sans coupure |
| extraction | brouillon | 5 prestations, `nature` et `espece` remplies |
| prestations | Informations | 800/ml sur la haie, 2/souche sur les souches, 1200/m² sur la tonte |
| lignes de prix | écran Prix | **au moins 4 lignes** — la tonte n'est pas avec l'érable |
| devis | Devis | « 800 ml × … » sur la haie, « à chiffrer » sur la tonte |
| envoi | Devis | **refusé** tant que la tonte n'a pas de prix |

**Et une commande a été écrite pour ça** — elle joue la dictée de référence
avec sa vraie clé, montre chaque étape, et **refuse de rendre un vert sans avoir
appelé quoi que ce soit** :

```bash
npm run verifier:chaine-dictee
```

Elle affiche, dans l'ordre : ce qui est prononcé, le JSON du modèle, ce qui
entre dans les colonnes, les lignes du devis, la clé de mémoire de prix, puis
huit verdicts. **Elle n'écrit rien en base** et ne joue pas Whisper.

Sa propre logique est éprouvée sans clé, dans les deux sens
(`scripts/test-chaine-dictee-attendue.ts`) : une réponse juste passe, une
réponse abîmée est refusée et le motif désigne le coupable. Sans cela, la
commande n'aurait été vérifiée nulle part — et un mode d'emploi qui plante chez
lui est un échec déjà payé trois fois dans ce dépôt.

Ce que la commande **ne peut pas** voir, et qui se regarde dans l'application :
les montants (ils viennent de ses prix de grille), la ligne « à chiffrer » sur
la tonte, et le refus d'envoyer le devis.

---

## 16 bis. Ce que je n'ai PAS tranché, et qui vous revient

**Une seule question, et elle est métier :**

> « Dessouchage de **deux** souches de 60 cm » — le prix de grille est celui
> d'**une** souche. Faut-il le multiplier par deux ?

Multiplier serait inventer un prix ; ne pas multiplier facture une souche pour
deux. Le comportement d'aujourd'hui est conservé (pas de multiplication) et
l'écran pose la question. La même question se poserait sur « trois arbres ».

---

## Questions

1. **Contredisez-moi sur l'ordre de grandeur.** J'ai refusé d'inventer un seuil
   ×2 ou ×5 et retenu la puissance de 10. Est-ce trop grossier pour être utile —
   deux haies de 120 et 900 mètres partagent-elles vraiment un ordre de
   grandeur ? Et la frontière 95/105 vous paraît-elle acceptable ?

2. **L'espèce n'élimine que si les deux côtés la connaissent.** L'alternative —
   « une espèce inconnue ne se rapproche de rien » — est plus stricte mais
   effacerait toute la mémoire d'avant. Ai-je choisi le bon bord ?

3. **« À chiffrer » bloque l'envoi du devis.** C'est ce que demande le §10.
   Est-ce que ça ne va pas le bloquer sur des chantiers où il aurait accepté le
   0 € (une ligne offerte, un geste commercial) ? Faut-il un moyen explicite de
   dire « celle-là est offerte » ?

4. **La quantité commerciale ne se dérive que sur une ligne à UNE prestation.**
   Voyez-vous un cas légitime où une ligne qui en réunit plusieurs devrait
   quand même porter une quantité ?

5. **Qu'est-ce qui manque ?** Quelle information de sa dictée peut encore se
   perdre entre le micro et le devis, et que ce document ne mentionne pas ?

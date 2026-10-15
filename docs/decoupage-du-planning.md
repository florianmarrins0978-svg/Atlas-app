# Le planning découpé en douze fichiers

*Lot ouvert et codé le 15 octobre 2026, sur votre « vas-y, lance le découpage
du planning, mais prends ton temps, vérifie chaque chose, je veux aucun bug ».*

---

## Ce qui a été fait, en cinq lignes

1. **`PlanningClient.tsx` (6 095 lignes, 39 morceaux d'écran) est rangé en
   douze fichiers** du même dossier. Le plus gros fait désormais 1 953 lignes.
2. **Rien n'a été réécrit.** Chaque morceau a été déplacé tel quel, commentaires
   compris, par un outil qui lit le code et vérifie qu'aucun ne s'est perdu.
   Seul le mot `export` s'ajoute quand un autre fichier lit le morceau.
3. **L'écran est identique.** Le planning a été parcouru clic par clic dans
   261 états, avant et après, et le code HTML comparé au caractère près :
   261 identiques sur 261.
4. **Les liens vont dans un seul sens** : l'écran importe les morceaux, aucun
   morceau n'importe l'écran.
5. **Trois contrôles ont suivi le déménagement**, dont le mode d'emploi de
   l'assistant, que la batterie a attrapé (§3).

---

## 1. Les douze fichiers

| Fichier | Ce qu'il porte | Lignes |
|---|---|---|
| `PlanningClient.tsx` | l'écran : son état, le mois, la semaine, les actions | 1 953 |
| `CarteDuJour.tsx` | la fiche d'une journée | 998 |
| `TiroirDuBas.tsx` | le tiroir du bas | 859 |
| `ElementsDuPlanning.tsx` | les petites pièces communes : pastilles, chevron, mots | 451 |
| `FeuilleChantier.tsx` | la feuille d'un chantier, sa note, ses quatre cases | 449 |
| `AjoutDunClient.tsx` | « Ajouter » un client ou du temps sur un jour | 327 |
| `AjoutAuJour.tsx` | le bouton « Ajouter » et ses voies | 308 |
| `types-du-planning.ts` | les formes de données partagées | 300 |
| `PasLaCeJour.tsx` | l'absence d'un salarié | 268 |
| `RelancesDuDevis.tsx` | relancer un devis expiré, dire comment il signe | 213 |
| `BasculeDuMoment.tsx` | matin, après-midi, journée | 74 |
| `outils-du-planning.ts` | trois petits calculs lus de plusieurs fichiers | 38 |

---

## 2. Comment on sait qu'aucun bug n'est entré

| La preuve | Le résultat |
|---|---|
| deux outils indépendants comparent chaque morceau, avant et après | **53 sur 53 identiques** ; un seul pixel changé, le second le trouve |
| les types | verts ; et rouges dès qu'on retire un import, donc le contrôle mesure bien |
| le style | les 4 mêmes avertissements qu'avant, déjà sur `main`, aucun nouveau |
| les imports inutiles | aucun, ni avant ni après |
| le planning parcouru clic par clic, base remise à l'identique entre les deux | **261 états sur 261 au caractère près**, le même parcours, aucune erreur |
| la batterie complète | suites navigateur **184 sur 184**, suites base **462 sur 464** (les deux rouges sont au §3 et §4), construction, connexion derrière un proxy : vert |

**Le niveau demandé par le dépôt était 2** (impact borné). La batterie complète
(niveau 3) a été jouée quand même, sur votre « je veux aucun bug ».

---

## 3. Ce que la batterie a attrapé, et qui a été corrigé

**Le mode d'emploi de l'assistant pointait sur l'ancien fichier.** Chaque fiche
du mode d'emploi prouve son geste en retrouvant ses mots dans un fichier nommé
(`src/lib/fiches-mode-emploi/planning.ts`). Vingt-deux fiches cherchaient
dans `PlanningClient.tsx` des mots qui avaient déménagé. Rien ne cassait à l'écran,
mais le contrôle qui empêche l'assistant d'enseigner un geste disparu ne
mesurait plus rien. Chaque preuve pointe désormais sur le fichier où elle vit ;
aucune n'a été retirée ni réécrite. Le contrôle est vert : 32 sur 32.

**Ce qui a été corrigé avant tout essai.** L'outil de découpage regroupait
d'abord tous les imports d'un même fichier sur une ligne. Or une règle du
planning l'interdit pour les actions serveur : un type mêlé aux actions fait
tomber TOUTES les actions de l'écran
(`scripts/test-actions-serveur-sans-export-de-type.ts`). La relecture l'a vu ;
l'outil a été corrigé pour garder chaque ligne d'import telle quelle.

**Deux autres contrôles lisaient `PlanningClient.tsx` par son nom** : celui de
la commune d'une adresse lit désormais tout le dossier du planning, et celui des
flèches déclare le chevron « Ouvrir le chantier » dans son nouveau fichier, avec
sa vraie raison. Les deux ont été vus rouges sur la faute qu'ils doivent
attraper, posée dans un fichier déplacé.

---

## 4. Un rouge qui ne vient pas de ce lot

**`/reglages/vehicules` manque à la liste des écrans préparés d'avance**
(`scripts/test-prechauffage.ts`). L'écran est arrivé avec le lot des véhicules,
déjà sur `main`. Le même contrôle rejoué sur `main` seul rougit de la même
façon. Il n'est pas corrigé ici : c'est hors de ce lot.

---

## 5. Ce qui n'a pas été fait, et pourquoi

**`PlanningClient.tsx` garde 1 953 lignes, et `CarteDuJour.tsx` 998.** Ces deux
fichiers tiennent chacun un seul gros composant qui porte l'état de l'écran
(72 mémoires internes pour le premier). Les couper demanderait de faire passer
cet état d'un fichier à l'autre, donc de réécrire du comportement. C'est un
autre lot, avec un autre risque, et il se décide : celui-ci ne touche à aucune
logique.

---

## 6. Ce qui reste ouvert

| | Qui |
|---|---|
| la fusion sur `main` | **vous** : votre accord |
| l'écran des véhicules oublié du préchauffage (§4) | la session des véhicules, ou un lot à part |
| couper aussi le composant de l'écran (second lot, avec de la réécriture) | **vous** : à décider, rien ne presse |

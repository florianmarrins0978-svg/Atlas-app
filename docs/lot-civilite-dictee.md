# « Monsieur » ne va plus dans la case du nom

**7 septembre 2026** · branche `claude/name-field-title-salutation-7gf10b`

---

## Ce que vous avez demandé

> « J'ai dicté monsieur Ludovic. Le problème, c'est que dans la case du nom, il
> a écrit Monsieur. Déjà, il faut jamais qu'il y ait marqué monsieur, madame ou
> quoi que ce soit d'autre à part le nom dans cette case-là. Mais est-ce que
> c'est possible, à la rigueur, que lorsqu'il entend monsieur ou madame, il
> vienne sélectionner tout seul en haut soit le monsieur, soit le madame ? »

**Oui, c'était possible, et c'est fait.**

---

## Ce qui change à l'écran

| Vous dictez | La pastille du haut | La case du nom |
|---|---|---|
| « monsieur Ludovic » | **Mr** s'allume | Ludovic |
| « madame Roux, 06 12 34 56 78 » | **Mme** s'allume | Roux |
| « Ludovic Martin » | rien | Ludovic Martin |
| « monsieur » tout seul | **Mr** s'allume | vide |

Le mot n'est pas jeté : il va là où c'est une donnée. De là, il se recopie tout
seul sur le devis, la facture et le message au client — comme quand vous
appuyez sur la pastille à la main.

---

## Ce que ça vous évitait de payer

**Sur vos documents.** Un nom qui porte déjà « Monsieur » repart tel quel : le
devis, la facture et le SMS auraient écrit « Monsieur Ludovic » là où vous
écrivez « Mr. » — vous l'aviez déjà corrigé le 13 août.

**Sur vos clients.** « monsieur Ludovic » dicté un jour et « Ludovic » dicté le
lendemain faisaient **deux fiches** pour la même personne : le rapprochement
compare les noms.

---

## Trois décisions que j'ai prises, et ce qu'elles coûtent

**1. « Docteur » et « Maître » restent dans le nom.** Ils ne disent ni monsieur
ni madame — aucune pastille ne peut les porter. Si je les enlevais, ils
disparaîtraient sans laisser de trace, et le nom nu recevrait « Mr. » par
défaut : une femme médecin deviendrait « Mr. Rivière ». C'est le seul écart à
votre règle « rien d'autre que le nom », et il tient à ce qu'il n'y a nulle part
où les poser. **Dites-moi si vous préférez qu'on les retire quand même.**

**2. La dictée n'écrase jamais ce que vous avez fait.** Si vous avez déjà touché
« Mme », une dictée qui dit « monsieur » **ne la retourne pas**. Même règle que
pour le nom, le numéro et l'adresse depuis le début.

**3. La pastille ne dépend pas du nom.** « Monsieur, 06 79 98 45 14 » n'a aucun
nom à poser, mais vous avez bien dit monsieur : la pastille s'allume.

---

## Un cas que ça ne sait pas voir

Une enseigne qui s'appelle « Monsieur Bricolage » deviendrait « Bricolage » avec
la pastille « Mr ». Vous relisez la fiche avant de créer le chantier — ça se voit
et ça se corrige d'un appui. Je n'ai pas trouvé de règle qui distingue les deux
sans se tromper ailleurs.

---

## Ce que j'ai vérifié, et ce que je n'ai PAS pu vérifier

| | |
|---|---|
| **Vérifié ici** | 17 contrôles neufs : le mot part du nom, il désigne la bonne pastille, un patronyme qui commence pareil (« Merlin », « Meunier ») n'est pas amputé, votre saisie n'est jamais écrasée. Les deux suites **rougissent** quand on retire la correction — c'est ce qui prouve qu'elles servent |
| **PAS vérifié ici** | **le parcours en partant du micro.** Ce poste n'a pas de clé de transcription : la dictée y rend un texte de remplacement. Je tiens toute la chaîne SOUS le micro, pas le micro lui-même |

**Donc : à essayer sur votre espace.** Ouvrez « Un chantier », appuyez sur le
micro, dites « monsieur Ludovic ». La pastille « Mr » doit s'allumer et la case
du nom afficher « Ludovic ».

---

## Ce qui reste ouvert, et qui peut le trancher

| | Qui |
|---|---|
| « Docteur » / « Maître » : les retirer du nom aussi ? | **vous** |
| Corriger la civilité d'un client **déjà créé** — il n'y a toujours pas d'écran de fiche client où le faire (signalé le 13 août 2026) | **vous**, si ça vous gêne |

# Revenir au planning quand on en vient — 7 septembre 2026

**Ce que tu as signalé, capture à l'appui :** *« quand je clique sur un client
dans le planning et que je vais sur un des modules, lorsque je fais retour
j'arrive sur la page d'accueil, or je devrais arriver d'où je suis parti — donc
de cette page ! »*

**C'est corrigé, et tu avais raison sur toute la ligne.**

---

## Ce qui se passait

La feuille qui monte quand tu touches un chantier (celle du 4 septembre) ouvre
trois portes. Chacune mène à un écran **qui existait déjà**, et chacun de ces
écrans avait sa flèche de retour **fixée une fois pour toutes** :

| Ce que tu ouvrais | Où la flèche te déposait | Où elle aurait dû |
|---|---|---|
| Le devis (parti) | l'accueil | le planning, sur ta journée |
| La fiche client | l'accueil | le planning, sur ta journée |
| La facture | les chantiers terminés | le planning, sur ta journée |

Aucune de ces flèches n'était fausse le jour où elle a été écrite : ces écrans
ne s'atteignaient alors **que** depuis les listes. La feuille du planning leur a
ouvert une seconde entrée, et personne n'est allé prévenir la sortie.

---

## Ce qui a été fait

L'adresse emporte désormais d'où tu viens, et la flèche la relit. Tu reviens sur
le planning **avec la feuille du chantier déjà levée** : tu retrouves l'écran
exact que tu as quitté, pas le mois à refeuilleter.

**Rien d'autre ne change.** Si tu entres par une liste, la flèche te ramène à
cette liste, exactement comme avant. Le correctif ne retire aucun chemin : il en
reconnaît un de plus.

---

## Ce qui a été refusé, et ce que ça aurait coûté

**Le retour du navigateur** (`history.back()`) tenait en une ligne et paraissait
plus simple. Écarté : la flèche d'Atlas mène à un endroit **nommé** — elle doit
pouvoir dire où elle va, et elle ment dès que tu arrives par un signet ou que tu
recharges la page. Pire, après avoir enregistré une fiche client, elle t'aurait
redéposé sur le formulaire que tu venais de quitter.

---

## Ce qui reste ouvert, et c'est à toi de trancher

**Le devis PAS ENCORE parti.** Sa flèche mène à la fiche client, et c'est **ta
règle du 31 août** : *« je veux tout le temps revenir à cette page et seulement
celle-là »*. Elle n'a pas été touchée — revenir dessus serait défaire une
décision que tu as prise toi-même, capture à l'appui.

Conséquence concrète : depuis le planning, ouvrir un devis non parti demande
**deux** retours pour ressortir (fiche client, puis planning).

**La question, quand tu auras une minute :** depuis le planning, la flèche du
devis doit-elle ramener au planning, ou rester sur la fiche client ?

---

## Ce qui a été vérifié

| | |
|---|---|
| types, lint | vert |
| mémoire du dépôt | vert |
| suites base | *(chiffres à la fin de la batterie)* |
| suites navigateur | *(idem)* |

**Le contrôle a été confronté à la version d'avant** avant d'être cru : remis
dans l'état où le défaut existait, il rougit et **nomme la porte fautive**
(« la porte "Créer la facture" ne dit pas d'où l'on vient »). Un contrôle qui
n'a jamais échoué ne prouve rien.

**Et la suite navigateur éprouve TON geste, pas la fonction :** elle touche la
porte dans la feuille, puis la flèche, et vérifie que le planning se rouvre sur
la feuille du bon chantier. Une suite qui aurait appelé la règle avec une
adresse écrite à la main serait restée verte — ce qui manquait, c'était le
paramètre que la porte pose et que l'écran relit, deux moitiés qu'aucun contrôle
ne faisait se rencontrer.

---

**Le détail technique est dans `ARCHITECTURE.md` §273.**

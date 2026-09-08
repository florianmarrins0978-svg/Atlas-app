# Qui travaille quel jour — 8 septembre 2026

**Vos deux choix sur la maquette : C et D2.** C'est codé.

---

## 1 — Un congé n'enlève plus votre gars de tout le chantier

**Avant :** chantier jeudi + vendredi, Julien en congé le jeudi → il était
retiré des deux jours, et vous ne pouviez plus l'y remettre.

**Maintenant :** il reste coché, et la pastille dit quand il vient — **« Julien
ven. »**, cerclée au lieu d'être pleine. Vous cochez une fois, exactement comme
avant ; c'est Atlas qui retire le jour du congé.

**Une bonne surprise, et je vous dois la correction :** je vous avais annoncé
qu'il faudrait modifier votre base **deux fois**. Une seule a suffi. L'exception
se déduit toute seule de vos congés — il n'y a rien à saisir de plus, et rien à
reprendre sur vos chantiers déjà posés.

---

## 2 — Un congé peut ne prendre qu'un matin

**Votre question :** *« je peux les mettre seulement le matin ou seulement
l'après-midi ? »* La réponse était non. Un rendez-vous d'une heure vous coûtait
la journée entière de votre gars — une demi-journée de travail perdue, et
invisible : personne ne voit une date qu'on n'a pas proposée.

**Le geste ne change pas pour le cas courant.** Vous touchez un nom, c'est la
journée. Deux pastilles **Matin / Après-midi** apparaissent juste après, pour
restreindre si besoin.

**Pourquoi deux et pas trois** (« La journée » en plus) : mesuré, trois
pastilles plus le mot font 440 px pour 354 disponibles — la ligne se replie dès
qu'un écran est un peu plus étroit que le vôtre. Je ne vous propose pas quelque
chose qui ne tient que sur votre téléphone.

---

## Ce que vos remarques ont corrigé chez moi

**« La phrase dit Julien en congé mais il est quand même coché en vert, c'est
normal ? »** — Non, et c'était le défaut que vous aviez signalé au départ, que
j'avais redessiné sans le voir. **On lit l'aplat, pas la phrase.** La pastille
est maintenant cerclée : plein = tous les jours, cerne = pas partout.

**« Pas de pansement, corrigez à la racine. »** — Vous aviez raison, et ça va
plus loin que ce que je pensais : les deux règles des 7 et 8 septembre
**interdisaient** parce qu'Atlas ne savait pas dire « Julien vendredi mais pas
jeudi ». Maintenant qu'il sait le dire, les deux interdictions tombent. Il ne
reste qu'un refus, et il est nécessaire : cocher quelqu'un absent **tous** les
jours du chantier.

---

## Ce qui a été vérifié

| | |
|---|---|
| la règle, seule | 15 cas, confrontés à la version d'avant |
| le serveur | 14 cas en base — dont deux congés qui, réunis, couvrent un chantier |
| la capacité | **les huit chemins** qui lisent une absence portent la demi-journée. Un seul oublié rendrait vos dates fausses sans que ça se voie |
| l'écran, **regardé** | votre geste joué en entier : nom → journée posée → « Matin » → restreinte. Et la pastille « ✓ Julien ven. » vue à l'écran |
| batterie complète | *(chiffres à la fin)* |

---

**Le détail technique est dans `ARCHITECTURE.md` §288.**

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
| batterie complète | **319/321** suites base · **125/133** navigateur |

---

## Les 10 rouges de la batterie, et à qui ils sont

**Aucun ne vient de ce lot.** Je le dis avec ce qui le fonde, pas de mémoire :

| Ce qui rougit | Pourquoi |
|---|---|
| 6 suites autour de « Refaire », « Autre chantier », la TVA, les prix | le lot **« repartir d'un client »**, poussé aujourd'hui par une autre session |
| 1 vignette photo carrée dans la fiche client | même lot. La rendre ronde serait faux pour une photo — je n'y touche pas |
| `test-anneau-vers-devis` | elle a besoin d'une **clé de transcription**, que ce poste n'a pas. J'ai vérifié à l'écran que la porte du planning existe et pointe au bon endroit |
| `garde-travail-non-enregistre` | par conception : elle refuse de conclure sur un arbre propre, et le mien l'est |

**Ce que j'ai cassé et réparé en route**, parce que ça compte aussi : quatre
suites comparaient l'adresse d'une porte du planning par égalité, alors que
depuis le 7 septembre elle emporte d'où l'on vient. Elles rougissaient sur du
code juste. Corrigé.

**Et une erreur de méthode, la mienne :** j'ai d'abord comparé avec `main` en
laissant **deux serveurs sur le même port**. Ce diagnostic-là ne valait rien, et
je l'avais annoncé avant de m'en apercevoir. Les chiffres ci-dessus viennent
d'une batterie jouée seule, base amorcée, après nettoyage.

---

**Le détail technique est dans `ARCHITECTURE.md` §295.**

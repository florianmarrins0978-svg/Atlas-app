# On ne coche plus quelqu'un qui n'est pas là — 8 septembre 2026

**Ton signalement, capture à l'appui :**

> *« J'ai mis Julien en congé, la feuille le dit aussi, or je peux quand même
> sélectionner Julien ce jour — il doit être grisé et on ne doit pas pouvoir le
> sélectionner. »*

**Tu avais raison, et c'était pire que ce que tu voyais.**

---

## Ce qui se passait

Ta capture montre les deux vérités à trois centimètres d'écart : en haut,
« Julien n'est pas là » ; juste en dessous, « ✓ Julien » coché sur le matin du
chantier. L'application le savait, et laissait faire.

**Pourquoi.** Un congé était compté là où il change une **date** — les jours
qu'Atlas propose à tes clients, depuis le 14 août. Il n'était compté nulle part
où il change une **personne**. Les pastilles de tes salariés ne l'avaient jamais
consulté.

---

## Ce qui est fait

**La pastille est grise et ne se sélectionne plus.** Antoine, lui, ne change pas.

**Et le serveur refuse aussi.** C'est le point important : griser un bouton ne
protège de rien, ça se contourne. La même règle grise la pastille et refuse la
coche — une seule règle, pas deux, sinon elles finissent par se contredire.

**Tu peux toujours DÉCOCHER.** C'est essentiel, et c'est ton cas exact : sur ta
capture Julien était déjà coché avant que tu poses le congé. Si j'avais grisé
franchement, tu serais resté coincé avec un chantier annonçant quelqu'un
d'absent, sans aucun moyen de le retirer. Le gris te dit qu'il faut le retirer ;
il ne t'enferme pas dedans.

---

## Un arbitrage que je te dois, et que tu peux contester

**Un chantier de deux jours dont UN SEUL tombe sur le congé : la coche est
refusée.**

La raison : quand tu coches quelqu'un, ce n'est pas « pour le 10 », c'est **pour
le matin du chantier** — et ça vaut pour tous les jours qu'il occupe.
L'application ne sait pas dire « Julien le 11 mais pas le 10 ».

| Refuser dès un jour de congé | Accepter tant qu'un jour reste libre |
|---|---|
| tu ne peux pas cocher Julien sur ce chantier | Julien est annoncé un jour où il n'y sera pas |
| ça coûte : une coche à faire autrement | ça coûte : **personne ne vient** |

J'ai pris le premier. **Dis-moi si tu veux l'autre** — c'est ton chantier, pas
le mien.

---

## Ce qui a été vérifié

| | |
|---|---|
| la règle, seule | 12 cas, **confrontée à la version d'avant** : elle rougit sur ton cas exact |
| **le refus du serveur** | 6 cas en base, sous le rôle de l'application — confrontée aussi |
| l'écran, **regardé** | Julien pâle et non cliquable, Antoine intact, sur la carte du jeudi 10 |
| couleurs | aucune écrite en dur : le gris tient sur tes sept chartes, les deux sombres comprises |
| batterie complète | *(chiffres à la fin)* |

**Pourquoi deux suites et pas une.** Une suite qui passe par le navigateur
n'aurait pas vu le refus du serveur — elles tournent avec un accès qui traverse
les protections. Et c'est le serveur qui tient vraiment.

---

**Le détail technique est dans `ARCHITECTURE.md` §286.**

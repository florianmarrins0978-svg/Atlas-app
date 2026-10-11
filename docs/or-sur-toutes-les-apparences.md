# L'or reste l'or, quelle que soit l'apparence — 31 août 2026

**Sa consigne :** *« pour l'apparence, j'aimerais que tout ce qui est en doré
sur la version originale apparaisse en doré sur les autres apparences »*.

**État : fait, éprouvé, sur la branche `claude/golden-color-all-themes-exf2ji`.**

---

## 1. Ce qui n'allait pas

Atlas a **deux** accents, et le partage n'est pas décoratif : le vert pin porte
ce qu'on **fait** (le bouton, l'onglet où l'on est), l'or porte ce qu'on **lit**
(l'accueil, les libellés d'état, les filets, le sceau, le compteur de la dictée).

La planche du 14 août donnait à chaque charte son propre second accent, et le
code le recopiait tel quel dans le jeton `or` :

| Apparence | l'or d'avant | le filet d'avant |
|---|---|---|
| Pierre | `#6f8466` — une sauge | `#8b9d83` — une sauge claire |
| Beurre | `#8a6a3a` | `#c2a05f` |
| Moka | `#7c5c46` — une argile | `#b99274` |
| Prune | `#7a2f52` — un prune | `#d9a2bd` — un rose |
| Sylve | `#c3b184` | `#3d6b4a` — un vert |
| Nuit | `#c6a15b` | `#8f7130` |
| Brume | `#B98B47` *(corrigé le 27 août)* | `#6f95c4` — un bleu |

Changer d'apparence ne changeait donc pas que le fond : **cela repeignait tout
ce que l'or porte**, et sur trois apparences l'or n'existait plus du tout.

## 2. Ce qui a été fait

Les **huit** apparences portent désormais l'or d'Origine, `#B98B47`, au
caractère près — et `#C9A15E` pour ce qui se pose sur un aplat ou sur une photo.

`src/lib/chartes.ts` : deux constantes, `OR_ORIGINE` et `OR_CLAIR_ORIGINE`,
posées sur les huit. La fonction qui construit une apparence ne reçoit plus de
second accent du tout — un paramètre qui ne sert plus finit par resservir à
autre chose.

## 3. Ce qui a été mesuré avant de figer l'or

L'alerte, le bordeaux et le vert pâle, eux, s'éclaircissent sur les apparences
sombres, sinon ils disparaissent (§160). **L'or n'en a pas besoin, et ce n'est
pas une intuition :**

| | l'or sur le fond | l'or sur une plage |
|---|---|---|
| Origine — son écran de tous les jours | 2,77 | 2,91 |
| Moka — la plus faible des claires | 2,30 | 2,62 |
| Sylve | **5,25** | 4,55 |
| Nuit | **6,14** | 5,55 |

L'or se détache **mieux** sur les deux sombres que sur les cinq claires. Le
remonter « par précaution » aurait corrigé ce qui n'était pas cassé — et cessé
d'être le même or, c'est-à-dire manqué la consigne.

## 4. Deux décisions prises, et ce qu'elles coûtent

**Les valeurs de la planche pour ce second accent sont abandonnées.** Elles
étaient les siennes, choisies au pouce le 14 août devant seize propositions. Sa
consigne du 31 les remplace : les deux ne peuvent pas tenir ensemble. Elles
restent lisibles dans le tableau ci-dessus et dans les planches d'origine.

**Deux phrases de présentation ont dû changer**, sans quoi l'écran des réglages
décrirait une application disparue :

| | avant | maintenant |
|---|---|---|
| Pierre | « …sauge désaturée. **Aucun or.** » | « …sauge désaturée. » |
| Moka | « …une encre espresso, **une argile pour l'accent**. » | « …une encre espresso. » |

## 5. Ce qui n'était pas dans la demande, et qui est corrigé quand même

**Ce n'était pas une demande neuve.** Le 27 août il l'avait déjà posée pour une
seule apparence — *« lorsque je choisis l'apparence Brume, tout ce qui est en
doré sur Origine le reste aussi sur Brume »* — et l'on avait corrigé Brume
seule, sans voir que la règle valait pour les six autres. Une consigne exaucée
sur un seul cas n'est pas une consigne exaucée ; c'est ce qui a fait revenir la
même demande quatre jours plus tard.

**Et aucun contrôle ne l'attrapait.** Les deux suites d'apparences vérifiaient
que *tous les jetons sont présents* et que *tout se lit* — vertes toutes les
deux pendant que l'identité changeait. Un contrôle sur la lisibilité ne dit rien
de l'identité : il lui fallait sa propre suite. Elle existe désormais
(`scripts/test-chartes.ts`, « l'or est le même sur les huit chartes »), et elle
a été **vue rouge** contre la version d'avant, en lui remettant la sauge de
Pierre.

## 6. Ce qui a été vérifié

| | |
|---|---|
| types, lint, mémoire du dépôt | au vert |
| suites base | **292/292** |
| suites navigateur | **120/120** — par groupes de six, un serveur neuf par groupe (le conteneur ne les tient pas d'une traite) |
| connexion réelle derrière un proxy | au vert, origine étrangère transmise |
| l'écran regardé | captures des huit apparences, accueil et liste |

## 7. Ce qui reste ouvert

Rien sur ce point. À décider par lui, s'il le veut : les apparences gardent
aujourd'hui leur propre **accent plein** (le vert pin d'Origine devient bleu
marine sur Brume, aubergine sur Prune). Sa consigne ne porte que sur l'or, et
l'accent plein n'a donc pas été touché.

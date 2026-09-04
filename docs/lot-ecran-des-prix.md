# L'écran des prix — ce qui a été fait, et ce qui a été refusé

*5 septembre 2026 · `/chantiers/[id]/prix` · le seul écran où le patron engage
de l'argent avant de l'annoncer.*

---

## En cinq lignes

La case où il tape son prix **avalait sa virgule** : « 1 400,50 » partait à
**0,00 € sans un mot**. C'est corrigé, et une suite le rejoue. Les lignes qui
attendent leur prix se **voient** maintenant — il a choisi la B sur planche — et
le refus qui bloque le devis **emmène le doigt sur la case**, au lieu de le
renvoyer aux réglages.

**Rien n'a été touché en dehors de cet écran.** La batterie complète et les
captures restent dues : elles attendent qu'il arrête ses autres sessions.

---

## Le brief venait de ChatGPT — deux de ses points étaient faux

C'est la règle du dépôt : un texte collé est un avis, pas une spécification.
Ces deux-là ont été corrigés avant d'écrire une ligne, et il les a confirmés.

| Ce que le brief affirmait | Ce que le code dit |
|---|---|
| `test-lecons-prix-e2e` rougit **sur cet écran** | Elle est sur le **devis** (`Prix unitaire 1`, `Total TTC`, colonne `prix_unitaire`). Pas ce lot. Et son propre commentaire avoue que l'écran du devis vide la valeur tapée : c'est un défaut produit habillé en contournement de suite, et il appartient à la session voisine |
| « ce qui dépend de la proposition de prix par l'IA se dit *à jouer sur ton espace* » | **Aucune IA sur cet écran.** `preparerPropositionPrix` ne lit que les tarifs, la grille, la main-d'œuvre et les mesures. Tout ce lot s'éprouve ici, sans clé — l'excuse tombe |

---

## Les trois défauts, un par un

### 1. La case avalait la virgule — et écrivait zéro

**Le fichier qui le fonde :** `src/app/chantiers/[id]/prix/PrixClient.tsx`.

La case était un `<input type="number">`, relue par `new Decimal(saisi || "0")`.
Un champ numérique **rejette la virgule** : sur un clavier français,
« 1 400,50 » rend une valeur **vide**, et `"" || "0"` vaut zéro. L'écran
continuait d'afficher le bon chiffre.

C'est la même famille que le défaut corrigé sur le devis le 30 août — *« Un prix
tapé sur le devis pouvait partir à ZÉRO »*. Là, c'était un rendu en retard ;
ici, c'est le champ lui-même. **Le devis avait déjà la bonne réponse à côté :**
un champ de texte avec `inputMode="decimal"`.

**Ce qui a été fait autrement que « écrire une règle de lecture ».** Le dépôt en
portait déjà **deux** — `montantEcrivable` (écrite le 29 août pour les montants
venus du modèle) et `montantSaisi` (pour la TVA). En écrire une troisième aurait
été exactement la faute que le dépôt interdit. L'écran consomme donc
`montantEcrivable`, qui refuse le négatif, la troisième décimale et ce qu'une
colonne ne peut pas contenir — **et nomme le montant en cause** au lieu de dire
« modification impossible ».

**Le piège trouvé en l'écrivant, et que rien n'aurait attrapé autrement.** La
case affiche désormais « 1 400,50 » à la française, avec l'espace **insécable**
d'`Intl`. Quitter la case sans y toucher relance la lecture sur ce texte-là : si
elle avait refusé cette espace, le patron aurait vu son propre montant rejeté
sans avoir rien tapé. Deux fonctions justes séparément, et un aller-retour cassé
entre les deux. C'est éprouvé (`test-case-du-prix.ts`).

### 2. « À chiffrer » n'existait pas à l'écran

**Le fichier qui le fonde :** le drapeau `aChiffrer` entrait dans l'état de
`PrixClient.tsx` depuis la migration 0070, était modifié — et **n'était dessiné
nulle part**. Une ligne sans prix ressemblait trait pour trait à une ligne qu'on
n'avait pas remplie.

**Son choix, sur planche** (`ligne-qui-attend-son-prix.html`) : **la B**. Le mot
« à chiffrer » dans la case, **et** les deux plages de la ligne passées à l'or.
Il a écarté la A, qui ne teintait rien : la B se retrouve **en défilant, sans
lire**, et c'est ce qui compte sur un devis de dix lignes. Le compte des lignes
en attente s'affiche à côté de « Détail ».

**Le compte est calculé par la règle partagée**, `ligneAttendSonPrix` — celle que
le serveur, le PDF et l'envoi emploient déjà. Recompter ici « marquée et à
zéro » aurait fait une **quatrième** lecture de la même question, et c'est
exactement ce qui avait produit, le 31 août, un devis dont le total ne
correspondait pas à ses lignes.

### 3. Le refus nommait la bonne raison et offrait la mauvaise porte

`peutPreparerDevis` rend trois refus distincts ; l'écran collait sous les trois
le même « Ouvrir mes tarifs », vers `/reglages`. Quand le blocage était
« 2 lignes attendent leur prix », le seul geste proposé **quittait l'écran où se
trouve la réparation**.

La porte suit désormais la raison : les réglages **seulement** s'il n'y a aucune
ligne — c'est là qu'un tarif enregistré fera chiffrer tout seul la prochaine
fois ; sinon « Poser les montants », qui fait défiler jusqu'à la première case
en attente et y met le curseur.

---

## Une décision prise seul, et ce qu'elle coûte

**L'or d'un mot est désormais plus sombre que l'or d'un trait.**

Mesuré : `or` posé sur la plage d'un champ donne **2,62 à 3,07** selon la
charte, là où un texte demande 4,5. Il passe sur les deux chartes sombres
(Nuit 5,55, Sylve 4,55), où les pôles s'inversent. Le mot « à chiffrer » se lit
en plein soleil, d'une main : il ne pouvait pas rester à 2,91.

**Ce que cela ne remet PAS en cause.** Sa consigne du 31 août — *« tout ce qui
est en doré sur Origine reste doré sur les autres apparences »* — interdit à la
**charte** de repeindre l'or, et `or` ne bouge pas d'un caractère : filets,
sceau, marqueur d'onglet, fonds pâles gardent `#B98B47` partout. Le nouveau
jeton ne dépend pas de la charte mais du **rôle** : un mot qu'on lit, et non un
trait qu'on regarde. Sur Nuit et Sylve il vaut l'or exactement.

**Ce que ça change chez lui, et il faut le dire :** sur Origine, « à chiffrer »
et les deux intertitres « À compléter » / « À confirmer » passent d'un or clair
à un or plus sombre. C'est visible sur l'écran qu'il regarde tous les jours. Si
ça ne lui plaît pas, ça se défait en une ligne — mais le mot redevient alors
difficile à lire au soleil.

Le contrôle qui le tient : `test-chartes-lisibles.ts`, **et il sait échouer** —
en ramenant le nouveau jeton à l'ancien or, les **six chartes claires**
rougissent d'un coup et les deux sombres restent vertes. C'est exactement le
diagnostic annoncé, vérifié en le provoquant.

---

## Ce qui a été refusé, et ce que ça aurait coûté

| Refusé | Pourquoi |
|---|---|
| **La qualité des propositions** — prestations mal organisées, unités mal lues, prix historiques incohérents | Sans ses **vraies dictées** et le devis produit, on répare une qualité imaginée. C'est un lot à part entière ; il fournira les exemples |
| **Une troisième règle de lecture des montants** | Deux existent déjà. Une de plus finit toujours par diverger, et rien ne dit alors laquelle fait foi |
| **Toucher au devis, à la facture, à la fiche du chantier, à « Mes prix »** | D'autres sessions y travaillent ; deux sessions sur le même fichier, c'est du travail jeté |
| **La suite `test-lecons-prix-e2e`** | Elle est sur le devis. Son défaut de fond est réel, et il appartient à la session voisine |

---

## Trouvé au passage, signalé, pas touché

`src/components/atlas/Calendrier.tsx` l. 168-169 porte `rgba(181,80,47,0.14)` —
**l'ancienne terre cuite, qui n'est plus la couleur d'accent depuis le
31 août** — et `rgba(0,0,0,0.035)`. Les deux sont écrits en clair, donc
invisibles sur Nuit et sur Sylve. C'est la faute du 22 août revenue une
troisième fois. Le calendrier appartient à l'écran de date, sur lequel une autre
session travaille : elle a été prévenue.

---

## Les chiffres

| | |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 17 avertissements — tous antérieurs à ce lot |
| `scripts/test-case-du-prix.ts` | **10 contrôles, 0 échec** |
| `scripts/test-chartes-lisibles.ts` | **14 réussis, 0 échec** — les huit chartes |
| Les deux contrôles confrontés à l'état dégradé | **rouges, et sur le bon coupable** |

**LA BATTERIE COMPLÈTE N'A PAS ÉTÉ JOUÉE**, et il ne faut pas la croire jouée :
il a demandé qu'on le prévienne avant, parce que ses sessions partagent le même
dossier et que le serveur tombe si une autre écrit pendant la mesure. Restent
donc dues, dans la fenêtre qu'il donnera :

- `npm run verifier:avant-livraison` ;
- `scripts/test-case-du-prix-e2e.ts` — **écrite, jamais exécutée** : elle rejoue
  son geste dans un vrai navigateur, tape « 1 400,50 » et va vérifier **en base**
  que le montant y est arrivé. C'est le contrôle qui entre par sa porte à lui ;
- les **captures** de l'écran à 390 × 664, sur Origine **et** sur Nuit. Quatre
  défauts réels de ce projet ont été trouvés sur une image et par aucun test
  vert : tant qu'elles n'ont pas été regardées, ce lot n'est pas fini.

---

## Ce qui reste ouvert, et qui peut le trancher

| | Qui |
|---|---|
| L'or plus sombre sur Origine lui convient-il ? | **lui**, sur capture |
| La qualité des propositions de prix | **lui** — il donne ses dictées réelles, on en fait un lot |
| Le calendrier aux couleurs écrites en dur | la **session du devis**, prévenue |
| La saisie qui s'efface sur l'écran du **devis** (les cinq tentatives de sa suite) | la **session du devis** |

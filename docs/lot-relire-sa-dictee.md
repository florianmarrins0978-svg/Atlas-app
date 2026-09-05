# Relire sa dictée — la transcription et les informations

*5 septembre 2026 · `/chantiers/[id]/transcription` et `/chantiers/[id]/informations`
· le moment où le patron vérifie qu'on l'a compris, avant de poser ses prix.*

---

## En cinq lignes

Trois défauts, tous vus dans le code et mesurés. **Un échec de transcription a
aujourd'hui la forme d'une transcription réussie.** Sur les informations, la
proposition et vos vraies cases portent **les mêmes mots** et **les deux mêmes
tons, échangés**. Et l'or qui écrit un mot tient **2,77** là où il en faut 4,5 —
le jeton lisible existe depuis ce matin, ces deux écrans ne l'ont pas.

**Rien n'est encore modifié dans l'application.** Une planche attend son choix :

> **https://florianmarrins0978-svg.github.io/Atlas-app/relire-sa-dictee.html**

---

## Les trois, un par un

### 1. La proposition et la donnée acquise se ressemblent

**Les fichiers qui le fondent :** `informations/BrouillonSection.tsx` l. 256-289
et `informations/InformationsClient.tsx` l. 133-183.

Tant que le brouillon n'est pas confirmé, l'écran écrit **deux fois**
« Prestations », « Durée », « Équipe », « Matériel » — même voix, même graisse,
même gris. La seule différence est un fond, et c'est le pire cas possible : la
case du brouillon est **crème dans une plage claire**, la vraie case est
**claire sur fond crème**. Ce sont les deux mêmes tons, échangés.

En plein soleil, d'une main, rien ne dit laquelle compte. C'est l'écran où il
vérifie qu'on l'a compris : ce qui est SÛR et ce qui est SUPPOSÉ ne peuvent pas
s'y ressembler.

### 2. Cinq états de transcription dans le même paragraphe

**Le fichier qui le fonde :** `transcription/page.tsx` l. 30-68.

Le vrai texte de sa dictée, « Aucune note vocale », « Transcription en cours… »,
l'échec et l'excuse du texte non transcrit sortent **du même `<p>`, dans la même
plage** — seule la couleur change, encre ou gris. Une transcription **échouée** a
donc la forme d'une transcription réussie.

Le commentaire de la ligne 24 dit vouloir éviter exactement cela — *« un texte de
remplacement n'est pas une transcription »* — et l'écran le reproduit d'un cran
plus loin, sur la forme au lieu du contenu.

**Trouvé au passage :** dans l'état « en cours », l'écran n'offre **aucune
sortie** (le lien vers la note vocale est masqué, l. 93) et ne se rafraîchit pas
tout seul. Il faut savoir qu'il faut revenir.

### 3. L'or qui porte un mot ne se lit pas

**Mesuré**, sur Origine :

| | |
|---|---|
| `or` sur le fond de page | **2,77** |
| `or` sur une plage | **2,91** |
| `orTexte` (le jeton du 5 septembre) | **4,59** et **4,83** |

Trois endroits sur ces deux écrans : **« Écrire le devis »**, sa sortie de
secours, en gras or (`InformationsClient.tsx` l. 230), et les deux
**« À confirmer »** (`BrouillonSection.tsx` l. 317 et 592).

La session de l'écran des prix a posé ce matin le jeton exact pour ce rôle. Le
filet d'or de l'avertissement, lui, ne bouge pas : **c'est un trait, pas un
mot**, et la règle du 31 août tient.

---

## Aussi trouvé, réparable dans le même lot

| | |
|---|---|
| `rgba(20,18,14,0.35)` écrit en clair sur le voile du tiroir « Remplacer vos corrections ? » (`BrouillonSection.tsx` l. 361) | la faute du 22 août, **quatrième retour**. Sur Nuit et Sylve, du sombre sur du sombre — au-dessus du seul geste irréversible de l'écran |
| Quatre paragraphes disent « aucun prestataire de transcription n'est encore raccordé » | `docs/A-FAIRE.md` §1 dit l'inverse depuis le 6 août, et `CLAUDE.md` §1 ter l'interdit. **C'est de la copie factuelle : elle ne se change pas sans son accord** |

---

## Ce que la planche demande

Une seule planche pour les deux écrans, parce que c'est un seul moment. Origine
et Nuit, 390 × 664, les cinq états de la transcription et trois façons de tenir
la proposition à part.

| | |
|---|---|
| **Aujourd'hui** | les mêmes mots deux fois, les deux tons échangés |
| **Chaque mot une fois** | la proposition dit « entendue ». Le plus petit changement |
| **Un seul à la fois** | vos cases n'apparaissent qu'une fois le brouillon confirmé, déjà remplies. Un seul bouton à l'écran |

Et pour la transcription : **la plage ne porte plus que ses mots**. Un échec, une
attente, une dictée non transcrite n'ont plus la forme d'une transcription — le
cadre lui-même le dit, sans une phrase de plus.

---

## Ce qui a été refusé, et ce que ça aurait coûté

| Refusé | Pourquoi |
|---|---|
| **Découper `informations/actions.ts`** (1 083 l.) | Ça ne change rien pour lui, et déplacer mille lignes pendant que d'autres sessions poussent sur `main`, c'est du travail jeté sur un conflit |
| **Éclaircir `muted`** (3,49, sous le seuil) | C'est SON niveau, choisi sur planche, et `test-chartes-lisibles.ts` refuse délibérément de l'exiger (`CLAUDE.md` §5 bis) |
| **Une relance de transcription sur cet écran** | Deux endroits pour lancer la même chose, c'est un de trop — sa règle |
| **Toucher à `prix/`, au devis, à la facture, à la note vocale** | D'autres sessions y sont |

Et rien de ce qu'il a déjà tranché n'est rouvert : les cases s'écrivent après
confirmation, ce qui est recopié disparaît de l'encart, « Écrire le devis »
reste, les trois phrases grises du 25 août ne reviennent pas, les réserves
restent à cinq, le mot « équipe » ne s'écrit pas à une seule équipe.

---

## Les chiffres

| | |
|---|---|
| Fichiers lus dans le périmètre | **7**, 2 546 lignes |
| Planche regardée à 390 × 664 | **33 captures**, Origine et Nuit, les cinq états et les trois variantes |
| Débordement horizontal à 390 px | **aucun** — mesuré, `scrollWidth = clientWidth = 390` |

**LA BATTERIE N'A PAS ÉTÉ JOUÉE**, et il ne faut pas la croire jouée : aucune
ligne de `src/` n'est modifiée à ce stade. Elle est due avec le code, dans la
fenêtre qu'il donnera — ses sessions partagent le même dossier.

---

## Ce qui reste ouvert, et qui peut le trancher

| | Qui |
|---|---|
| Laquelle des trois façons pour les informations | **lui**, sur la planche |
| La plage qui ne porte que ses mots | **lui**, sur la planche |
| Changer la phrase « aucun prestataire raccordé », qui contredit `A-FAIRE` §1 | **lui** — c'est une affirmation, pas une tournure |

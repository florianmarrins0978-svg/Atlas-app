# La liste de vos clients — ce qui a été codé, et ce que ça coûte

**3 septembre 2026.** Vous avez regardé la maquette, puis dit : *« tu peux coder
exactement cette maquette »*. C'est fait. Ce document dit **quoi**, **pourquoi**,
et **ce que ça vous retire** — point par point, avec le fichier qui le fonde.

La maquette reste essayable :
`https://florianmarrins0978-svg.github.io/Atlas-app/vos-clients.html`

---

## Vos trois remarques, une par une

### 1. « Quatre clients s'appellent Martins : rien ne me dit lequel c'est »

**Fait.** La deuxième ligne porte désormais **le lieu**, puis le nombre de
chantiers : « 10 rue d'Enfer, Nantes · 5 chantiers ».

**Et voici ce qui n'était pas su, et qui compte plus que le correctif :** cette
adresse était **déjà dans votre base**. La fiche d'un client l'affiche depuis le
début. La seule requête de toute l'application qui ne la chargeait pas était
celle de la liste — c'est-à-dire le seul endroit où quatre noms identiques se
côtoient.

| | |
|---|---|
| ce qu'il a fallu | **une ligne** dans `src/server/repositories/fiche-client.ts` |
| ce que ça a coûté en base | rien : aucune migration, aucune donnée neuve |

**Un client sans adresse reste normal.** Sa ligne se contente de ses chantiers.
Rien n'est inventé, rien ne réclame.

### 2. « Ce qui reste dû est écrit tout petit, en bout de ligne »

**Fait.** Il passe de **9,5 px en capitales espacées** à **16 px**, à hauteur du
nom, avec « dus » en dessous. Les chiffres sont alignés en colonne : « 740,00 € »
et « 1 260,00 € » tombent sur la même virgule.

**Et il est désormais le SEUL montant de la ligne** — voir « ce que ça vous
retire », plus bas.

### 3. « Ni ordre annoncé, ni repère pour sauter quelque part »

**Fait.** Des bandes nomment les mois : SEPTEMBRE, AOÛT, JUILLET, puis PLUS
ANCIEN, puis SANS CHANTIER.

**Là encore, la liste ÉTAIT déjà rangée** — du chantier le plus récent au plus
ancien — et personne ne pouvait le savoir. La date qui commande ce tri était
calculée par l'application et **abandonnée avant d'arriver à l'écran**. Les
bandes ne changent donc pas l'ordre : elles le disent.

**Trois mois nommés, pas neuf.** Un titre par mois donnerait neuf titres pour
vingt et un clients : le repère deviendrait le bruit qu'il devait réduire.

---

## Ce qui a été fait sans que vous le demandiez, et pourquoi

| | Pourquoi |
|---|---|
| **le compte remonte en haut** et suit la frappe | il était écrit **sous le dernier résultat** : hors de l'écran au moment précis où il sert. On tape, on regarde le haut, et rien ne dit combien de noms restent |
| **le titre devient « Vos clients »**, le compte passe dessous | l'écran affichait « 21 clients » en gros et « VOS CLIENTS » en doré dessous : le compte à la place du nom, et deux fois la même chose en deux voix |
| **la barre de recherche reste collée en haut** | sur vingt et un noms on descend ; l'outil qui sert à remonter ne doit pas être resté en haut de la page |
| **ce qui est trouvé s'éclaire** dans le nom | sur quatre homonymes, une recherche sans marque ressemble à une recherche qui n'a pas filtré |
| **une loupe** dans la barre | elle dit ce que fait la plage sans un mot de plus |

---

## Ce que ça vous RETIRE — une seule chose, et il faut la dire

**Le total facturé par client (« 2 940,00 € facturés ») quitte la ligne.**

**Pourquoi :** deux sommes d'argent sur une même ligne, l'une grise l'autre
rouge, se confondent au premier coup d'œil — et c'est la rouge qui demande un
geste.

**Ce que ça coûte, et vous le saviez avant de répondre :** depuis que la fiche
d'un client a été allégée le 2 septembre, ce total **ne se lit plus nulle part
ailleurs**. Il est toujours calculé, toujours en base : le remettre est l'affaire
de dix minutes si vous le regrettez.

---

## Ce qui a été mesuré, et qui a changé une couleur

| Le gris de la deuxième ligne | Contraste sur votre fond crème |
|---|---|
| celui d'avant (`muted`) | **3,32** |
| le seuil de lecture | 4,5 |
| celui d'aujourd'hui (`inkSoft`) | **8,04** |

La ligne qui répond à « lequel des quatre Martins ? » était donc écrite **sous le
seuil de lecture** : la première chose qui s'efface en plein soleil, sur un
chantier.

**Et le détail qui dit tout :** sur la charte **Nuit**, ce même gris tenait 5,19.
**Votre liste était plus lisible la nuit qu'en plein jour.**

---

## Ce que j'avais dit et qui était FAUX

**Deux corrections, noir sur blanc.**

1. Vous m'aviez écrit que la charte d'Atlas était **Playfair Display et Inter**.
   Le code dit l'inverse : `src/app/globals.css` emploie la **serif de votre
   téléphone** (`ui-serif`) et une sans du système. Vous aviez comparé les deux
   le 10 août 2026 et retenu celle de l'iPhone, pas Playfair. La maquette et
   l'écran suivent le code.
2. Vous parliez du lien **« Mes clients »** sur l'accueil. Il s'appelle
   **« Vos clients »**. Le titre de l'écran a été aligné dessus.

---

## Ce que les contrôles ont attrapé — y compris contre moi

**Le contrôle a corrigé mon code, pas l'inverse.** Le surlignage et le filtre
sont deux façons de lire le même nom. J'ai écrit une suite qui les confronte sur
une centaine de combinaisons ; **elle a rougi au premier passage**, sur un écart
réel : en tapant « martins freres », la ligne « Martins » était écartée de la
liste — mais son nom se serait éclairé si l'écran l'avait affichée. C'est le code
qui a cédé.

**Deux défauts vus en CAPTURE, par aucun test :**

- quand une recherche ne trouvait rien, la ligne du compte se vidait et
  disparaissait : **le champ de saisie remontait de 24 px sous le doigt**, à
  chaque frappe infructueuse ;
- la phrase « Aucun client ne s'appelle… » était écrite dans le gris que je
  venais justement de condamner comme illisible.

C'est la sixième fois dans ce dépôt qu'un défaut sort d'une image et d'aucun
test.

---

## La batterie — les chiffres exacts, et ce qu'ils valent

`npm run verifier:avant-livraison`, jouée en entier sur votre poste :

| Étape | |
|---|---|
| Types | **✅** |
| Lint | **✅** |
| Mémoire du dépôt | **✅** (8 fichiers vérifiés) |
| Construction | **✅** |
| Fournisseurs d'IA | **✅** |
| Données de démonstration | **✅** |
| Suites base de données | **❌ 285/306** |
| Suites navigateur | **❌ 113/125** |
| Connexion derrière un proxy | **✅** |

**Elle n'est donc PAS verte, et il faut le dire.** 33 suites rouges. **Aucune
n'est de ce lot**, et voici comment cela se vérifie plutôt que de se supposer :
les dix suites qui couvrent cet écran ont toutes été jouées, et toutes sont
vertes — `test-bandes-clients`, `test-recherche-client`, `test-liste-clients`,
`test-fiche-client`, `test-fiche-client-db`, `test-recherche-client-e2e`,
`test-fiche-client-e2e`, `test-mode-sombre-lisible-e2e`, `test-chartes-lisibles`,
`test-aucune-fleche`.

**D'où viennent les 33, alors :**

| | |
|---|---|
| une vingtaine | **la machine, pas le code** — Windows : des chemins comparés avec des barres obliques, un `bash` que le poste n'a pas, des dossiers temporaires qu'il refuse d'effacer. C'était déjà écrit dans `TODO.md` avant ce lot |
| une dizaine | **une autre session travaille dans le même dossier, en ce moment** — les écrans de TVA et le planning sont ouverts et à moitié réécrits. Un fichier qu'elle a supprimé (`MontantCopiable.tsx`) est encore cherché par une suite |
| deux | la CI est rouge sur `main` depuis le 2 septembre, sans rapport avec nous (`TODO.md`) |

## Ce qui m'a fait recommencer la vérification

**Un vert qui ne prouvait rien.** Dans la batterie, la suite navigateur de la
recherche est passée **sans rien vérifier** : elle a une échappatoire pour le
cas où la page ne s'anime pas, elle l'a prise, et elle a rendu un vert vide. Mes
cinq contrôles neufs n'ont donc jamais été joués.

**Trouvé en regardant une capture** : l'image montrait « martins » dans le champ,
dix-huit clients en dessous, aucune croix et aucune marque.

J'ai monté un serveur bâti et tout rejoué contre lui :

| | |
|---|---|
| `test-recherche-client-e2e` | **13/13**, cette fois pour de vrai |
| `test-fiche-client-e2e` | **✅** |
| `test-mode-sombre-lisible-e2e` | **✅** — l'écran se lit aussi bien en Nuit |

**Et l'écran a été regardé**, pas seulement testé : au repos, en cherchant
« martins » (les homonymes se distinguent par leur commune, la marque s'allume),
sur une recherche vide, et défilé jusqu'en bas (la barre reste en haut). Mesuré
sur ces images : 46 lignes, 69 px de haut au minimum, **aucun libellé coupé**,
aucune boîte de zéro pixel, aucun débordement, et les cinq bandes dans l'ordre.

---

## Ce qui reste ouvert

| | Qui peut le trancher |
|---|---|
| le total facturé, s'il vous manque | **vous** — dix minutes pour le remettre |
| la CI est rouge depuis le 2 septembre sur trois suites, **sans rapport avec ce lot** | une session, sans vous (`TODO.md`) |
| la batterie ne peut pas être entièrement verte sous Windows — huit suites échouent pour des raisons de machine | une session, sans vous (`TODO.md`) |

# Repartir d'un client, et finir un chantier avec une preuve

*Lot ouvert le 8 septembre 2026. Ce document est à jour au **stade des
maquettes** : rien n'est codé dans `src/`.*

---

## Ce qui a été fait, en une ligne

Le brief a été lu et confronté au code **avant** d'écrire quoi que ce soit.
Deux questions ont été posées au patron, il les a tranchées, et **la première
proposition du lot 1 a dû être corrigée** : elle demandait exactement ce qu'il
avait écarté le 17 août. La planche des cinq propositions est publiée.

---

## 1. Les deux questions posées avant de coder, et ses réponses

### A. La confirmation du client bloque-t-elle la facture ?

**Sa réponse :** *« oui, la confirmation du client ne bloque rien. Elle vaut
preuve en plus, jamais permission. Je ne veux pas attendre un clic qui ne
viendra pas. »*

**Pourquoi la question se posait.** Le brief demandait « le client dit oui, le
chantier est fini ». Trois choses du dépôt s'y opposaient :

| | Ce que le code ou ses décisions disent |
|---|---|
| **le client n'est pas là** | son constat du 16 août 2026, *« on tond pendant que le client est au travail »*, écrit en tête de `src/app/entretien/[jeton]/page.tsx`. C'est pour cela que la preuve est un horodatage et une empreinte, pas une signature |
| **deux arrêts, jamais trois** | `PRODUCT.md` : avant l'envoi du devis, avant le départ de la facture. Un troisième a été retiré parce qu'il ne pouvait mener qu'à « oui » |
| **sa trésorerie** | une facture suspendue à un clic que personne ne fera est une facture qui ne part pas |

### B. Le salarié peut-il déposer une preuve et clore un chantier ?

**Sa réponse :** *« oui, le salarié dépose photos et "c'est fini" sur les
chantiers de sa journée, et rien d'autre : aucun montant, ni devis, ni facture,
ni un chantier qui n'est pas le sien. Que le contrôle le prouve. »*

C'est la **première brèche** dans le modèle des rôles figé le 30 août 2026, qui
disait mot pour mot : *« aucun droit d'écriture ne lui a été rouvert »*
(`docs/modele-des-roles.md` §E). Elle est délibérée et bornée.

| Ce qu'il gagne | Ce qui ne bouge pas |
|---|---|
| déposer des photos sur un chantier de SA journée | `OUVERT_AU_SALARIE` ne s'élargit pas à `/chantiers/…` |
| poser « c'est fini », horodaté, à son nom | aucun montant ne sort du serveur pour lui — ni page, ni PDF, ni réponse d'API |
| | ni le devis, ni la facture, ni le chantier d'un autre |

Les deux réponses sont consignées dans `ARCHITECTURE.md` §285.

---

## 2. Point par point, le verdict sur le brief

| Point du brief | Verdict | Sur quoi il se fonde |
|---|---|---|
| « Le rapprochement de clients existe et il marche » | **juste** | `src/lib/rapprochement-client.ts`, appelé par `trouverOuCreerClient` (`clients.ts:46`) |
| « Depuis la fiche d'un client, aucun lien ne mène à un nouveau chantier » | **juste** | `src/app/clients/[id]/page.tsx` ne porte que les registres du dossier |
| « La feuille de chantier du salarié existe, en PDF, sans montants » | **juste** | `src/server/pdf/fiche-chantier-pdf.ts`, servie par `/api/chantiers/[id]/feuille/pdf` |
| « Le compte rendu au client existe, sans photos » | **juste** | `src/app/entretien/[jeton]/page.tsx` |
| « La validation du client entre en collision avec deux décisions » | **juste** | voir A ci-dessus |
| « Donner au salarié le droit d'écrire rouvre le modèle des rôles » | **juste** | `docs/modele-des-roles.md` §E |
| **Lot 1 · « Atlas le RECONNAÎT à l'écran et propose de le reprendre »** | **REFUSÉ, et il l'a confirmé** | voir §3 |
| Lot 1 · un chemin de la fiche client vers un chantier pour lui | **retenu, avec une réserve** | voir §3 |
| « L'intervention est rattachée au chantier, le chantier au client » | **juste pour un chantier, FAUX pour le compte rendu existant** | voir §4 |

---

## 3. Ce qui a été refusé, et ce que ça aurait coûté

### La proposition de client pendant la frappe

Le brief demandait : *« pendant qu'il tape un nom déjà connu, Atlas le
RECONNAÎT à l'écran et propose de le reprendre — avec ce qui le distingue (son
lieu, son nombre de chantiers), parce qu'il a quatre Martins »*.

**C'est exactement ce que le patron a écarté le 17 août 2026**, et c'est écrit
dans le code, pas dans un souvenir de conversation :

> *« Il a explicitement écarté qu'on lui propose une liste de correspondances
> ("non justement, il ne faut pas") : le rapprochement est automatique, sans
> geste de sa part. »*
> — `src/lib/rapprochement-client.ts`

**Ce qui a été fait à la place.** Atlas décide comme aujourd'hui, et se contente
de **dire** ce qu'il a fait, avec un moyen de séparer si c'est le mauvais. Le
patron a validé : *« tes trois remarques sont justes, et j'ai fait corriger le
prompt sur la première. »*

### La réserve sur la fiche client

Cet écran a été **délibérément vidé le 2 septembre 2026** — *« tout le reste, tu
enlèves, c'est du trop »*, sa quatrième plainte en dix jours sur le nombre de
mots. Le lot 1 y ajoute donc **un geste et aucun mot**. C'est la raison pour
laquelle les deux propositions D et E tiennent en un bouton.

---

## 4. Ce que le brief n'avait pas vu

### « Terminer un chantier » CRÉE la facture

`terminerChantier` (`src/server/repositories/factures.ts:172`) **crée la
facture**, et refuse même de le faire tant que le devis n'est pas parti. Ce
n'est pas un changement d'état : c'est l'entrée du cycle comptable.

Le « c'est fini » du salarié ne peut donc pas être ce geste-là. Il en faut deux,
et le patron l'a tranché : *« deux gestes séparés pour la fin de chantier : le
tien constate, le mien facture. »* Le besoin était déjà noté dans `TODO.md`
depuis le 30 août, pour le commercial ; il devient obligatoire.

### Le compte rendu par jeton n'est PAS rattaché à un chantier

Le brief avertissait : *« ne crée pas un troisième lien direct entre une
intervention et un client »*. L'avertissement est juste — **et le compte rendu
existant fait déjà exactement cela.**

`passages_entretien` (`src/server/db/schema.ts`) porte `client_id`, jamais
`chantier_id` : c'est l'outil des **tournées d'entretien**, pas la preuve de fin
d'un chantier. Le lot 3 devra soit l'y rattacher, soit donner au chantier sa
propre page de preuve.

*Remis au lot 3 par le patron, le 8 septembre.*

---

## 5. La planche du lot 1

**Adresse :**
`https://florianmarrins0978-svg.github.io/Atlas-app/le-client-quon-connait.html`

Cinq propositions, toutes essayables. Trois cas se touchent en haut de page — un
seul Martins, quatre Martins avec son numéro, « ce n'est pas lui » — et les cinq
écrans changent ensemble. Un bouton « Nuit » montre la charte sombre.

| | Proposition | Ce qu'elle fait |
|---|---|---|
| **A** | Le mot après | le chantier s'ouvre avec une ligne : « Rangé chez M. Martins · Saint-Marc · 3 chantiers » |
| **B** | La ligne pendant qu'il tape | sous la case du nom, une phrase qui ne demande rien |
| **C** | La fiche se remplit ✦ | le nom reconnu, Atlas pose ce qu'il sait déjà — téléphone, e-mail, adresse |
| **D** | Le bouton sous son nom | « Nouveau chantier » depuis la fiche du client |
| **E** | Refaire ce qu'on lui a fait ✦ | le chantier s'ouvre avec la **prestation** déjà écrite, pas seulement le nom |

✦ *ce que nous défendons.* C répond à sa plainte réelle — « je dois tout
retaper » — au moment précis où elle se forme. E répond à ce qu'il fait neuf
fois sur dix : la même prestation, chez le même client.

**D et E ne s'opposent pas** : E porte les deux gestes. Si E est retenu, D
disparaît.

---

## 6. Ce qui a été vérifié, et ce qui ne l'a pas été

| | |
|---|---|
| les cinq écrans tiennent en **390 × 664** sans rien couper | mesuré, et le contrôle a été **vu rouge** en forçant 400 px de trop |
| aucune flèche décorative | `scripts/test-aucune-fleche.ts` — 119 032 lignes lues |
| les couleurs sont celles du produit | lues en jouant `charte("origine")` et `charte("nuit")`, pas approchées à l'œil |
| **les polices n'ont PAS pu être vues ici** | le mandataire de ce poste refuse Google Fonts : les captures montrent les replis, pas Playfair Display. Sur son téléphone, elles se chargent |
| la batterie complète | **non jouée, et elle n'a pas lieu d'être** : aucun fichier de `src/` n'est touché |

### Deux défauts trouvés sur la CAPTURE, et par aucune mesure

C'est la sixième fois dans ce dépôt (`CLAUDE.md` §5), et les deux méritent
d'être écrits parce qu'ils sont du même genre : **un contrôle vert sur un écran
faux.**

1. **« Ce n'est pas lui » restait affiché sur une fiche neuve.** Le bouton porte
   `display:block`, qui l'emporte sur le `[hidden]{display:none}` du navigateur.
   La propriété `hidden` valait bien `true` — le contrôle la lisait, et rendait
   un vert. L'image, elle, montrait le bouton. Le contrôle mesure désormais ce
   qui se **voit**.
2. **La coche contredisait le texte.** Sous « Nouvelle fiche », le sceau portait
   une coche : elle se lit comme une confirmation de reprise, soit l'inverse de
   ce que la ligne annonce. Elle devient un « + ».

### Un contrôle qui ne mesurait rien

Le premier contrôle de débordement comparait `.ecran.scrollHeight` au cadre. Or
`.ecran` est une colonne flexible dont la hauteur vaut **toujours** celle du
cadre : il rendait 664 = 664 quoi qu'on y mette. Le débordement se voit sur
`.corps`. Corrigé, puis confronté à un débordement forcé pour le voir rougir.

---

## 7. Ce qui reste ouvert, et qui peut le trancher

| Ce qui reste | Qui |
|---|---|
| **quelle proposition pour le lot 1** — A, B ou C ; D ou E | **lui**, sur la planche |
| le compte rendu du lot 3 : rattacher `passages_entretien` au chantier, ou page propre | **nous**, au lot 3, une fois le lot 2 posé |
| le lot 2 (fiche d'intervention) et le lot 3 (ce que le client reçoit) | **nous**, dans cet ordre, après son choix |

---

*Tenu à jour à chaque avancée du lot. Un document périmé le ferait travailler
sur une version disparue.*

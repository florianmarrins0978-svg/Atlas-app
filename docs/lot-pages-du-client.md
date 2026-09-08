# Les pages que voit son client — facture, devis, et la serrure Face ID

**7 et 8 septembre 2026.** Document de retour, à lire d'un bout à l'autre : un
verdict par point, le fichier qui le fonde, ce qui a été fait autrement, ce qui
a été refusé, les chiffres de la batterie, et ce qui reste ouvert.

---

## En cinq lignes

1. **La page de facture de son client** est refaite : couleurs d'Atlas, montant
   retiré, un seul bouton, IBAN et numéro à copier d'un doigt, ordre du chèque.
2. **La page de devis** aussi — et elle portait encore une couleur abandonnée
   le 3 août.
3. **Un vrai défaut a été corrigé à la racine** : une facture prenait l'IBAN du
   *devis*, parfois vieux de plusieurs mois.
4. **La serrure Face ID est réparée** : « Me déconnecter partout » ferme
   désormais aussi les clés d'appareil.
5. **Trois maquettes sont en ligne**, dont une qui attend encore un choix.

---

## 1. La facture — ses six points, un par un

Sa demande du 8 septembre, capture à l'appui.

| Ce qu'il a demandé | Verdict | Le fichier |
|---|---|---|
| « mets-le aux couleurs de l'appli » | **fait** | `src/app/factures/[jeton]/page.tsx` |
| « le montant ne doit pas apparaître » | **fait** | idem |
| « supprime "voir la facture en PDF", on garde que télécharger » | **fait** | idem |
| « une phrase pour dire qu'il faut mettre le numéro dans le libellé » | **fait** | `src/lib/modalites-paiement.ts` |
| « le numéro en cliquable, copier-coller » | **fait** | `src/app/factures/[jeton]/PastilleACopier.tsx` |
| « une phrase pour les chèques, l'ordre de l'entreprise » | **fait** | `modalites-paiement.ts` |
| « tout ça en automatique, repris des réglages » | **fait**, et aucun champ n'a été créé | Réglages → Identité existait déjà |

### Ce qui a été corrigé dans ce que je lui avais dit

**Je lui ai d'abord annoncé que la page était noire par un défaut.** C'était
faux. Elle prenait **l'allure figée de la facture** (migration 0074), c'est-à-dire
le fond et l'accent qu'il a réglés lui-même dans « Devis & factures ». Sans
réglage, elle aurait déjà été crème et verte.

**Et cela rouvre une règle qu'il a posée le 4 septembre** — *« mon client doit
retrouver en ligne exactement ce qu'il a reçu en PDF »*. Elle est révisée, par
lui, après avoir vu la proposition : **le PDF est son document et garde son
allure ; la page est l'enveloppe d'Atlas et porte les couleurs d'Atlas.** Ce ne
sont pas deux fois le même objet.

### Ce qui a été refusé

**Rien de sa demande.** Une réserve a été dite avant de coder, et elle tient
toujours : montant caché, le client qui règle sans ouvrir le PDF n'a pas le
montant sous les yeux. L'échéance reste, pour qu'il sache qu'il y a une date.

---

## 2. LA CORRECTION DE RACINE — sa question, et ce qu'elle a trouvé

> *« Lorsque l'utilisateur modifie son IBAN dans ses réglages ou le nom de sa
> société, les infos se modifient automatiquement dans le lien que recevra le
> client ? »* — puis : *« ne fais pas de pansement, corrige à la racine. »*

**La réponse était non, et le défaut était plus haut que la page.**

Une facture recopiait l'identité **du devis** (`instantaneDuDevis`), figée le
jour du devis. Un devis de janvier facturé en juin partait donc avec l'IBAN de
janvier — et si l'artisan avait changé de banque entre-temps, **son client
virait l'argent sur un compte fermé, sur une facture toute neuve.** Le nom de
l'entreprise avait le même défaut, en pire : la facture portait une raison
sociale qui n'existait plus.

### Ce qui a changé, et ce qui n'a PAS changé

| | |
|---|---|
| ce qui vient du **devis** | le client et les prix — ce qu'il a accepté |
| ce qui vient de l'**entreprise**, lu quand la facture naît | l'émetteur et ses modalités de paiement |

**Le figeage n'est pas affaibli : c'est son INSTANT qui a bougé**, du devis à la
facture. Une fois créée, tout reste figé — et c'est indispensable, parce que le
PDF servi au client est le fichier **archivé**, jamais reconstruit
(`src/app/factures/[jeton]/pdf/route.ts`).

**Une première idée a été abandonnée en cours de route, et il faut l'écrire :**
montrer l'IBAN *vivant* sur la page du client. C'est la lecture de cette route
qui l'a arrêtée — la page aurait affiché l'IBAN d'aujourd'hui à côté d'un PDF
portant celui d'hier. **Deux IBAN pour un même envoi, pire que le défaut de
départ.**

Le régime de TVA suivait déjà cette règle depuis la migration 0039 ; elle vaut
désormais pour toute l'identité.

| Fichier | Ce qu'il porte |
|---|---|
| `drizzle/0076_identite_vivante_sur_la_facture.sql` | la colonne du titulaire de compte, figée comme le reste |
| `src/server/repositories/factures.ts` | `identiteDeLEmetteur`, et `instantaneDuDevis` allégé |
| `src/lib/modalites-paiement.ts` | la règle pure : IBAN groupé, ordre du chèque, consigne du libellé |
| `scripts/test-modalites-paiement.ts` | 14 contrôles, sans base |
| `scripts/test-facture-reprend-le-devis-db.ts` | 2 contrôles neufs, **vus rouges contre la version d'hier** |

**Le contrôle a été confronté au défaut qu'il prétend attraper** : le défaut a
été remis en place une minute, la suite a rougi en désignant l'IBAN du devis,
puis le défaut a été retiré et elle a reverdi.

---

## 3. Le devis — deux défauts que la capture ne montrait pas

Sa demande : *« on va le modifier aussi comme la facture »*.

| Ce que la lecture a trouvé | Ce que c'était |
|---|---|
| le refus et le cadre de rétractation en `#B5502F` | **le terre cuite abandonné le 3 août 2026**, encore là cinq semaines plus tard |
| « J'accepte ce devis » en `#2F3B2F` | le vert des **textes**, au lieu du vert des **boutons** tranché le 3 septembre |

**La cause des deux est la même** : cette page écrivait ses couleurs **en dur**
(`bg-[#F4EFE8]`, `bg-white`), ce que `CLAUDE.md` §3 interdit. C'est pourquoi elle
n'a suivi aucun changement d'identité — et pourquoi elle n'aurait pas suivi les
huit chartes.

### Ce qui a été REFUSÉ, et ce que ça aurait coûté

> *« Pour la page du devis j'hésite à faire comme pour la facture, ne pas
> afficher le montant pour les obliger à télécharger leur devis. »*

**Refusé, et c'est le seul refus franc de ce lot.** Sur la facture, le client
DOIT déjà l'argent. Sur le devis, il **décide** — le bouton juste dessous dit
« J'accepte ce devis », et un accord donné sans voir le prix n'en est pas un.
C'est aussi la première chose qu'un litige regarderait. S'y ajoutent : les
chantiers perdus par ceux qui ne téléchargent pas, l'effet « vendeur qui cache
son prix », et ceux qui ne savent pas ouvrir un PDF.

**Mais son inquiétude était juste, et elle est traitée** : le téléchargement
tenait dans un lien souligné de 13 px que personne ne voyait. C'est devenu un
vrai bouton, sous le prix. Le mot reste le sien — « Télécharger », choisi le
31 août pour que le libellé dise ce qui se passe.

### Ce que la batterie m'a repris

**Deux fois.** Le bouton a fait déborder la page : **713 px pour 664** avec la
case de rétractation, contre sa règle du 31 août. Puis **676**. Les pixels ont
été rendus sur les espacements, jamais sur une phrase — et l'intertitre « Devis »
que j'avais ajouté est reparti : quatorze pixels pour un mot que « Devis n° »
disait déjà.

**Et un contrôle a été retourné** (`scripts/test-devis-client-e2e.ts`) : il
exigeait que le lien soit **en gras et souligné**. C'était la façon dont le
geste avait été rendu visible le 31 août, pas la règle. Il mesure désormais ce
qui compte et survivra au prochain remaniement : **le geste est une cible qu'un
doigt atteint** — au moins 40 px de haut, et il se distingue du texte.

---

## 4. La serrure Face ID — le seul défaut de sécurité connu et non réparé

**Constaté le 25 août 2026, écrit à l'écran, et jamais corrigé.**

Une clé Face ID posée depuis une session volée **rouvrait Atlas après
« Me déconnecter partout »**, et après un changement de mot de passe.
`deconnecterPartout` ne touchait pas `cles_appareil`, et `ouvrirAvecCle` ne
consultait jamais la coupure.

La raison notée pour ne pas le corriger — « il faudrait tout réenregistrer » —
ne tient pas : ce bouton n'est pas un geste courant, c'est celui qu'on appuie
quand on croit s'être fait voler quelque chose. Son prix doit être la fermeture
complète, et remettre Face ID est un toucher sur le téléphone qu'on tient.

| Fichier | Ce qu'il porte |
|---|---|
| `src/server/repositories/cles-appareil.ts` | `retirerToutesLesCles` |
| `src/server/repositories/compte.ts` | la coupure ferme aussi les clés |
| `src/app/reglages/connexion/ConnexionClient.tsx` | la phrase annonce un coût, plus une faille |
| `scripts/test-compte-db.ts` | 2 contrôles, dont un **vu rouge** contre la version d'hier |

**Ce qui n'a pas été touché, et pourquoi :** changer son mot de passe ne
déconnecte toujours aucun autre appareil. C'est un choix documenté, et il l'a
confirmé le 7 septembre — deux gestes séparés, plus prévisibles.

---

## 5. Ce qui a été abandonné en cours de route

**La porte d'Atlas** — la page de connexion « comme les plus grandes applis »,
avec Google et Apple. Trois propositions ont été dessinées et publiées ; il a
répondu *« j'ai changé d'idée, je ne fais plus ça »*. **Rien n'a été codé.**

**Conséquence à retenir : le compte développeur Apple (99 $/an) n'a pas à être
pris.** Il ne servait qu'à ça.

La planche reste en ligne — même écartée, elle raconte le chemin :
`https://florianmarrins0978-svg.github.io/Atlas-app/la-porte-d-atlas.html`

---

## 6. Les chiffres de la batterie

`npm run verifier:avant-livraison`, sur `atlas_test`, le 8 septembre 2026.

| Étape | Résultat |
|---|---|
| `typecheck` | vert |
| `lint` | **0 erreur** (19 avertissements, tous antérieurs) |
| `verifier:memoire` | vert |
| **Suites base** | rouge — voir le tri ci-dessous |
| **Suites navigateur** | interrompue après 5 suites |
| **Connexion derrière un proxy** | **vert** |

### Le tri des rouges, sans complaisance

| Suite | À qui |
|---|---|
| `test-boutons-arrondis` | **à moi** — ma pastille à copier était en coin carré, contre sa règle du 12 août. **Corrigé, suite verte** |
| `test-roles-capacites-db`, `test-salarie-planning-lecture-seule-db` | à une session voisine : leurs essais négatifs modifient un fichier dont son refactor a changé la forme |
| `test-ouvrir-port`, `test-port-remesure`, `test-prechauffage`, `test-relance-construction`, `test-fiche-pendant-relance`, `test-seed-conserve-identifiants` | l'outillage de l'atelier — rouges avant ce lot |

**Les suites navigateur se sont arrêtées après cinq suites**, sur une expiration
dans `test-adresse-suggestions-e2e`, pendant que le serveur répondait 200. Ce
n'est pas le produit.

### Ce qui a été éprouvé à la place, et qui compte

| | |
|---|---|
| `test-devis-client-e2e.ts` | **16 réussis, 0 échoué** — dont « tout tient dans un écran » |
| `test-modalites-paiement.ts` | **14 / 14** |
| `test-facture-reprend-le-devis-db.ts` | **15 / 15**, dont les deux neufs |
| `test-facture-jeton-rls.ts` | **6 / 6** |
| `test-boutons-arrondis.ts` | vert après correction |
| **les deux écrans, regardés** | captures prises sur de vraies données |

---

## 7. Ce qui reste ouvert

| Quoi | Qui tranche |
|---|---|
| **L'alerte IBAN** — prévenir des factures déjà parties quand l'IBAN change | **tranché le 8 septembre : il la veut, aux trois endroits.** À coder |
| Les six suites d'outillage rouges | une session dédiée à l'atelier |
| Les deux suites de rôles | la session qui a refait le compte |

**La maquette de l'alerte IBAN**, avec ses trois endroits :
`https://florianmarrins0978-svg.github.io/Atlas-app/changer-d-iban.html`

**Ce qu'Atlas ne fera pas, et il faut le redire :** réécrire une facture déjà
partie. Le client a le PDF dans son téléphone, et le changer sous ses yeux
ferait mentir la page. Ce qui est proposé, c'est de **prévenir**.

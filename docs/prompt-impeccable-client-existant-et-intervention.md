# Le prompt `/impeccable` : repartir d'un client, et la fiche d'intervention

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 7 septembre 2026, sur deux demandes du patron le même jour.

> *« Aujourd'hui si je veux faire un devis à un client qui existe déjà dans ma
> base de données je ne peux pas, je ne vais pas recréer des fiches client à
> chaque fois si le client c'est le même ! »*

> *« Il faut une fiche d'intervention pour le client pour qu'il puisse dire oui
> le chantier est fini et avoir accès aux photos du chantier. Fiche client →
> devis → fiche d'intervention pour le salarié avec photos, qui iront dans la
> catégorie client. Le salarié doit avoir accès à cette fiche dans le planning,
> elle doit être rattachée au client. Et sur la feuille de route de sa journée
> il doit pouvoir créer une preuve de fin de chantier, photo à l'appui. »*

**Trois vérifications faites avant d'écrire ce prompt — elles changent le
travail.** Elles sont dans le corps du prompt ; ne les redécouvre pas.

---

```
Deux demandes du patron, un seul parcours : REPARTIR D'UN CLIENT QUI EXISTE, et
FINIR UN CHANTIER AVEC UNE PREUVE. Elles se tiennent, et elles se traitent
ensemble.

═══ CE QUI EXISTE DÉJÀ, ET QU'IL NE FAUT PAS RÉÉCRIRE ═══════════════════

Trois choses ont été vérifiées dans le code le 7 septembre 2026. Ne repars pas
de zéro sur elles.

1. **LE RAPPROCHEMENT DE CLIENTS EXISTE, ET IL MARCHE.**
   `trouverOuCreerClient` (repositories/clients.ts:46) appelle `rapprocherClient`
   (lib/rapprochement-client.ts), une règle pure : même nom + une coordonnée qui
   concorde (téléphone ou e-mail) → le client est RÉUTILISÉ, pas recréé. Une
   coordonnée qui CONTREDIT interdit le rapprochement — c'est ce qui distingue
   quatre Martins.

   **Donc sa base n'a pas de doublons. Ce qui manque est un GESTE, pas une
   règle** — et c'est pour cela qu'il croit devoir tout retaper :

   · rien à l'écran ne lui dit « ce client existe déjà, je le reprends » ;
   · depuis la fiche d'un client (`/clients/[id]`), **aucun lien ne mène à un
     nouveau chantier** — vérifié : cette page ne porte que les pièces du
     dossier.

2. **LA FEUILLE DE CHANTIER DU SALARIÉ EXISTE**, en PDF, sans aucun montant
   (`server/pdf/fiche-chantier-pdf.ts`), atteinte depuis le planning
   (`/api/chantiers/[id]/feuille/pdf`). Ce qui manque : qu'elle soit VIVANTE
   dans l'application, et qu'on puisse y déposer quelque chose.

3. **LE COMPTE RENDU AU CLIENT EXISTE** : `/entretien/[jeton]`, page publique
   par jeton. Il porte l'horodatage et l'empreinte du contenu — sa décision du
   16 août 2026, quand il a demandé les signatures électroniques puis constaté
   lui-même : *« s'il n'est pas là, on ne peut pas le faire signer. »*
   **Il ne porte pas de photos.**

═══ DEUX CHOSES QU'IL FAUT LUI DIRE AVANT DE CODER ══════════════════════

**A. « Le client dit oui, le chantier est fini » entre en collision avec deux de
ses propres décisions.**

  · le 16 août, il a constaté que **le client n'est pas là** quand on finit :
    « on tond pendant que le client est au travail ». Une fiche qui attend son
    « oui » attendra souvent dans le vide ;
  · le parcours n'a que **DEUX arrêts** — avant l'envoi du devis, avant le
    départ de la facture. Un troisième a été retiré parce qu'il ne pouvait mener
    qu'à « oui ».

  **La question à lui poser, en une ligne :** la validation du client
  BLOQUE-t-elle la facture, ou l'accompagne-t-elle ? Recommandation à défendre :
  elle ne bloque pas. Le client PEUT confirmer — et sa confirmation vaut preuve
  renforcée, comme l'acceptation d'un devis —, mais son silence n'empêche pas de
  facturer un chantier réellement fait. Sinon il attendra un clic qui ne viendra
  jamais, et c'est SA trésorerie.

**B. Donner au salarié le droit de déposer une preuve ROUVRE le modèle des
rôles, figé le 30 août 2026.** Aujourd'hui un salarié voit le planning en
lecture seule et sa feuille sans un montant. Écrire une photo et clore un
chantier, c'est de l'écriture.

  Ce n'est pas un obstacle — c'est SA décision à prendre, et elle se pose
  clairement : le salarié peut-il déposer des photos et déclarer « c'est fini »,
  sans jamais voir un prix ? Recommandation à défendre : **oui, et rien d'autre**
  — un droit d'écriture étroit, limité aux chantiers de SA journée, qui ne donne
  accès ni aux montants, ni au devis, ni à la facture. Le contrôle doit prouver
  qu'un salarié qui tente d'ouvrir un prix se fait refuser.

═══ LE PARCOURS QU'IL DÉCRIT, ET CE QU'IL FAUT EN FAIRE ═════════════════

  fiche client ──▶ devis ──▶ fiche d'intervention (salarié, photos)
                                      │
                                      └──▶ rangée chez le CLIENT

  client déjà créé ──▶ devis ──▶ fiche d'intervention

Il est juste. Ce qu'il implique, et qu'aucune des deux moitiés ne peut ignorer :

  la fiche d'intervention est rattachée au CHANTIER, et le chantier au CLIENT.
  C'est déjà le modèle de la base : ne crée pas un troisième lien direct entre
  une intervention et un client, il divergerait le jour où un chantier change de
  main.

═══ LE TRAVAIL, EN TROIS LOTS — ne les mélange pas ══════════════════════

**LOT 1 — repartir d'un client (le plus urgent, et le plus simple)**

  **ATTENTION — IL A DÉJÀ ÉCARTÉ LA SOLUTION ÉVIDENTE.** Le 17 août 2026, devant
  l'idée qu'Atlas lui propose une liste de correspondances à choisir : *« non
  justement, il ne faut pas »* (écrit en tête de `lib/rapprochement-client.ts`).
  Le rapprochement est **automatique, sans geste de sa part**, et cela ne se
  rouvre pas. Une première version de ce prompt demandait exactement ce qu'il a
  refusé ; la session du 7 septembre l'a relevé, code à l'appui.

  Ce qui reste à faire, et qui respecte sa décision :

  · Atlas reprend le bon client **tout seul, comme aujourd'hui**, et le DIT
    après coup — « repris chez M. Martins, Saint-Marc, 3 chantiers ». Il ne
    choisit rien : il voit ce qui a été fait ;
  · **un moyen de séparer** si le rapprochement est faux. C'est le seul risque de
    cette fonctionnalité, et il ne se répare pas d'un clic aujourd'hui : verser
    le chiffre d'affaires d'un homme sur la fiche d'un autre ;
  · depuis la fiche d'un client, un chemin vers un nouveau chantier POUR LUI,
    déjà rempli — cette page ne porte aujourd'hui que les pièces du dossier ;
  · rien ne se retape : ce qu'Atlas sait déjà, il l'écrit.

  Le rapprochement serveur ne change pas — c'est son résultat qu'on rend
  VISIBLE, au lieu de l'appliquer en silence.

**LOT 2 — la fiche d'intervention, côté salarié**

  · vivante dans l'application, atteinte depuis SA journée au planning ;
  · elle porte ce qu'il y a à faire (la feuille de chantier existe : reprends-la,
    ne la réécris pas), et permet de déposer des PHOTOS ;
  · un geste « c'est fini », avec photo à l'appui — horodaté, et qui dit qui l'a
    posé ;
  · les photos rejoignent le dossier du CLIENT (la pellicule existe :
    `Pellicule.tsx`).

**LOT 3 — ce que le client reçoit**

  · le compte rendu par jeton existe (`/entretien/[jeton]`) : il gagne les
    photos, et un moyen de confirmer ;
  · sa confirmation est horodatée et gardée, comme l'acceptation d'un devis ;
  · elle ne bloque rien (voir A ci-dessus, à lui faire trancher).

═══ CE QUI NE SE NÉGOCIE PAS ════════════════════════════════════════════

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn).
- **La page par jeton est PUBLIQUE** : lien non devinable, lecture seule,
  expiration. Elle s'éprouve avec une suite BASE sous le rôle `atlas_app` — les
  suites navigateur traversent la RLS et ne voient pas les défauts d'isolation.
  Le 8 août 2026, un lien de facture était mort en production pendant que la
  suite navigateur était verte.
- **Des photos de chantier partent chez un client** : ce sont des données. Rien
  ne doit fuir d'un chantier à l'autre, ni d'un client à l'autre. Une photo
  visible par le mauvais jeton est un défaut de priorité haute.
- Les rôles : un salarié ne voit jamais un montant, même sur une fiche qu'il
  remplit.
- Français partout, règles pures dans src/lib/, aucune couleur écrite en clair,
  aucune flèche décorative.

═══ LA CONTRAINTE QUI PRIME SUR TOUT LE RESTE ═══════════════════════════

Sa consigne du 5 septembre 2026 (PRODUCT.md, « Accessibility & Inclusion ») :
« la plupart des patrons qui vont utiliser l'app sont des vieux qui ont du mal à
se servir de leur téléphone ; il faut que ce soit hyper intuitif et simple ».

Et le salarié, lui, est sur un chantier : gants, écran sale, une main. « Poser
une photo » doit être **un appui**, pas un parcours.

═══ LA MÉTHODE ══════════════════════════════════════════════════════════

1. Lis PRODUCT.md, CLAUDE.md, docs/AGENT.md, `docs/modele-des-roles.md`, puis
   git log -20.
2. **Réponds-lui d'abord sur A et B** — la validation qui bloque ou non, et le
   droit d'écriture du salarié. Rien ne se code avant.
3. **Dessine avant de coder** : une planche par lot dans appli/, un lien dans
   appli/essais.html, l'adresse ENTIÈRE une fois qu'elle répond 200 — jamais une
   capture de la maquette.
4. Regarde les écrans en capture, à 390 × 664, Origine ET Nuit, **y compris vus
   par un salarié**.
5. Une migration se joue AVANT la batterie, et la batterie complète est
   obligatoire : ce lot touche les rôles et une page publique.

═══ LA BATTERIE, SUR SON POSTE WINDOWS ══════════════════════════════════

- **Préviens-le AVANT de la lancer** ; son accord vaut ensuite pour toute la
  séquence.
- Sa base vit dans Docker : `docker start atlas-postgres atlas-redis`.

  ```bash
  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison
  ```

═══ LE RENDU ════════════════════════════════════════════════════════════

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert.
```

---

## Le diagnostic, en une phrase

Sa base **n'a pas de doublons** — Atlas retrouve déjà un client au nom et à la
coordonnée. Ce qui lui manque, c'est de le **voir** : rien ne lui dit que le
client a été reconnu, et aucun chemin ne part de la fiche d'un client.

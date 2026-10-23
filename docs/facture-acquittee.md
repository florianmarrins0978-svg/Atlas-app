# La facture acquittée, renvoyée après l'envoi

Votre demande du 23 octobre 2026 : l'assurance d'un client veut une facture
acquittée. La même facture, même numéro, avec la mention en plus. Planche :
`appli/facture-acquittee.html`. Vous avez dit « code ça », sans batterie.

## Ce qui est fait

| Point | Verdict | Fichier |
|---|---|---|
| L'interrupteur « Facture acquittée » sur la facture déjà envoyée | **Fait** | `ReglementsRecus.tsx` |
| Il demande comment le client a payé | **Fait** | `ReglementsRecus.tsx` |
| Le paiement entre dans Ma TVA, comme depuis Terminés | **Fait** | `paiements-facture.ts` (`basculerAcquittee`) |
| Le bouton devient « Envoyer la facture acquittée » | **Fait** | `TransmettreLaFacture.tsx` |
| Le message dit « votre facture F2026-… acquittée », sans échéance | **Fait** | `message-client.ts` |
| Le client reçoit la même facture, le tampon en plus | **Fait** | `factures.ts` (`pdfExemplaireAcquitte`) |
| La facture envoyée la première fois reste intacte | **Fait** | `envois-factures.ts`, migration `0141` |
| La page du client dit « Acquittée le … » et ne demande plus de payer | **Fait** (ajouté, voir plus bas) | `src/app/factures/[jeton]/page.tsx` |

## Ce qui a été fait autrement que sur la planche

- **Le moyen n'est pas choisi d'avance.** La planche montrait « Virement »
  déjà pris. Ce paiement entre dans Ma TVA : un virement posé d'office sur un
  chèque serait un chiffre inventé. Les quatre choix s'affichent, rien n'est
  pris, et le premier appui enregistre.
- **L'interrupteur garde son cadre doré** de la page actuelle, au lieu du
  dessin simplifié de la planche. Sur une facture déjà envoyée, la petite
  phrase « Tout est réglé avant l'envoi » ne s'affiche plus.

## Ce qui a été ajouté sans être demandé

**La page que le client ouvre.** Sans ce changement, le lien de la facture
acquittée aurait affiché « À régler avant le … » avec l'IBAN, c'est-à-dire une
demande de payer une facture déjà payée. Elle affiche maintenant
« ACQUITTÉE LE 23/10/2026 », le bouton de téléchargement et l'accusé de
réception, et rien d'autre.

## Ce qui peut différer de l'original, et pourquoi

L'exemplaire acquitté se refait à partir de ce que la facture a gardé :
lignes, montants, dates, coordonnées, couleurs. Deux choses peuvent pourtant
changer :

- **le logo** : s'il a été changé depuis, le nouveau apparaît ;
- **une facture créée sans devis** : ses conditions de paiement sont relues
  dans les Réglages d'aujourd'hui.

Les montants, le numéro et les lignes ne changent jamais.

## Les vérifications

| Contrôle | Résultat |
|---|---|
| Types, lint, règles du dépôt (tirets, flèches, couleurs, code mort, couches) | vert |
| `test-facture-acquittee-db.ts` (nouveau, 10 épreuves) | vert, **et rouge sans la correction** |
| Suites base (`npm test`) | 491/494, puis 2 des 3 rouges corrigés |
| Écran regardé : facture envoyée, appui, choix « Chèque », tampon | vu |
| Écran regardé : page du client avec le lien acquitté | vu |
| **Batterie entière** | **non jouée, sur votre consigne** |

Les trois rouges des suites base :

1. `test-boutons-pleins` : l'interrupteur devait être déclaré sous son nouveau
   nom. **Corrigé.**
2. `test-mode-emploi` : la fiche de l'assistant disait encore « seulement avant
   l'envoi ». **Corrigée** : elle explique maintenant le renvoi à l'assurance.
3. `test-prechauffage` : l'écran `/reglages/banque` n'est pas préchauffé.
   **Pas de ce lot** : il vient du lot banque, déjà sur `main`.

Une suite défendait l'ancienne règle « l'interrupteur seulement sur un
brouillon ». Elle a été adaptée, parce que cette règle est retirée à votre
demande.

## Ce qui reste

| Quoi | Qui |
|---|---|
| La batterie entière (paiements et migration 0141 : niveau 3) | une session, quand vous le direz |
| Puis la mise sur `main` | la même session, si la batterie est verte |
| Le bouton « Envoyer la facture acquittée » à l'écran | **pas vérifiable ICI** (le serveur d'ici refuse d'envoyer depuis une adresse locale) ; à regarder sur votre espace |

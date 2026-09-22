# Atlas — Fiche de chantier et retours, 22 septembre 2026 : **sur `main`**

**État :** fusionné sur `main` le 22 septembre 2026 (commit `52cc812d`), avec
deux lots voisins joués dans la même batterie : **Fonction recherche** (le champ
de recherche commun) et **Devis client disparu** (la fiche client gardée au
retour).

**Batterie :** 163/167 suites navigateur au premier passage, 410/411 suites base
(une non mesurable ici). Les 4 rouges ont été rejoués seuls : **4/4 verts**, et
le garde-fou a ouvert la fusion au niveau 3.

---

## 1. Ce qui a été fait, point par point

| Demande | Ce qui a été fait | Fichier |
|---|---|---|
| Retirer « Ceux-ci sont partis chez vos clients… » | phrase retirée, la ligne reste | `paysage/fiche/composer/ComposerMaFiche.tsx` |
| « Composer ma fiche » : liseré doré, intérieur blanc | `colors.or` et `colors.card`, lisibles sur les 7 chartes | `paysage/fiche/page.tsx` |
| Rapports envoyés : chercher un client, filtre jour, mois, année | le champ et le filtre des autres écrans, repris tels quels | `paysage/fiche/RapportsEnvoyes.tsx`, `lib/passage-entretien.ts` (`rapportsAMontrer`) |
| « + Ajouter un client » en gros, doré, centré ; jour en noir gras | phrase grise retirée | `paysage/fiche/[id]/FicheChantierClient.tsx` |
| Jour du passage écrit comme « Septembre 2026 », avec le jour | « Mardi 22 septembre 2026 », libellé « Jour du passage » retiré | `lib/jour.ts` (`jourEnTitre`), `components/atlas/FiltreDeDate.tsx` (`TitreAvecRoue`) |
| « Ouvrir une fiche » devient « Créer une fiche » | texte seul | `paysage/fiche/OuvrirFiche.tsx` |
| Nommer le client : toutes les lignes restent, le passé se recoche | le repli est **supprimé**, remplacé | `lib/passage-entretien.ts` (`cocherCommeLaDerniereFois`), `ARCHITECTURE.md` §408 |
| Phrase sous le client | « 3 prestations cochées, celles du dernier chantier. » | `FicheChantierClient.tsx` |
| Interrupteur « Visible » en vert | `plein`, l'exception du 3 septembre retirée du contrôle | `FicheChantierClient.tsx`, `scripts/test-boutons-pleins.ts` |
| Page du client : surtitre doré centré, phrase en noir, plus de date d'envoi | la date ne quitte plus le serveur ; elle s'affiche dans ta fiche | `app/entretien/[jeton]/page.tsx`, `repositories/passages-entretien.ts` |
| Fiche envoyée : se fermer au retour de Messages, avec une mention | « Fiche envoyée à M. Bernard. » sur « Fiche de chantier » | `lib/depart-messagerie.ts`, `lib/annonce-transmission.ts` |
| « En cours », « Rapports envoyés » en noir gras ; un rapport envoyé ouvre ce que le client a reçu | lien vers `/entretien/<jeton>` | `LignePassage.tsx`, `RapportsEnvoyes.tsx` |

---

## 2. Ce qui a été fait autrement, et pourquoi

- **La racine des Rapports envoyés.** L'écran ne chargeait que les 30 dernières
  fiches : un filtre posé dessus n'aurait jamais trouvé les plus anciennes. Le
  plafond est retiré (`listerPassages`).
- **Le passé qui se recoche est le DERNIER rapport envoyé, pas tout
  l'historique.** Tout l'historique cocherait à chaque passage une taille de haie
  faite une seule fois en octobre, et elle partirait sur des rapports où elle
  n'a pas été faite. À changer si tu préfères l'historique.
- **« chez »** remplace le point entre la date et le nom sur la page du client,
  pour en faire une phrase (règle du 22 septembre).
- **Rien de recopié.** Le titre avec sa roue, le champ de recherche, le retour
  de Messages : chacun existait déjà ailleurs et a été étendu, pas dupliqué.

## 3. Ce que j'ai dit de travers, corrigé

- J'ai d'abord retiré le nombre de la phrase « 2 prestations cochées… » alors
  que tu voulais le garder. Corrigé au message suivant.
- Un test navigateur réclamait encore l'ancien repli : je l'avais oublié en
  changeant la règle. La batterie l'a attrapé ; il vérifie désormais la règle
  nouvelle.

## 4. Ce qui reste ouvert

| | Qui tranche |
|---|---|
| Le rapport envoyé s'ouvre sur la page du client, sans flèche de retour : une version dans l'appli, avec sa flèche, est possible | toi |
| Le passage par Messages a été simulé ici (pas de téléphone) : le geste complet est à essayer chez toi | toi, sur ton téléphone |
| Trois suites (`creer-son-compte`, `pages-publiques`, `se-deconnecter`) ont dépassé leur délai au premier passage, puis sont passées au vert rejouées seules : à surveiller si elles recommencent | les sessions suivantes |

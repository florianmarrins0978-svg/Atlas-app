# Les devis expirés au planning

8 octobre 2026. Ses planches du 7 octobre, codées : `appli/devis-expires.html`
et `appli/relancer-un-devis-expire.html`.

## Le constat de départ

Sa question : un client qui n'accepte jamais le devis disparaît-il un jour de
« En attente du client » ? **Oui, au bout des 45 jours de son lien.** Mais il
tombait alors dans « Sans date », d'où son nom se posait **sans aucune
signature**. Vu en ouvrant le vrai planning, pas déduit du code.

## Ce qui est fait

| Point | Verdict | Où |
|---|---|---|
| Un devis expiré quitte « Sans date » | fait, à la racine : un état à lui, `devis_expire` | `src/lib/chantier-etat.ts` |
| « Devis expirés » dans la feuille du bas, avec sa phrase des 45 jours | fait | `PlanningClient.tsx`, `TiroirDuBas` |
| Supprimer : une question, puis la barre d'or de six secondes | fait, avec la question et la barre déjà au planning | `QuestionDeSuppression`, `TiroirDesRetires` |
| Une porte « Devis expiré » dans « Ajouter », jamais « Client en attente » | fait | `AjoutAuJour` |
| Relire le devis aux prix du jour | fait : nouvelle version, ses deux cadres du 26 septembre | `proposerLaGrilleDuJour`, `lignes-prix.ts` |
| « Continuer » ramène à ce jour, à la signature | fait | `src/lib/retour-au-planning.ts` |
| Le renvoyer tel quel, lien neuf sur ce seul jour | fait | `relancerLeDevisExpireAction` |
| Signé sur papier | fait, avec la case des 14 jours de rétractation | `CommentIlSigne`, repris tel quel |
| Le poser sans le renvoyer, sans « Pas encore signé » | fait, sa décision | `planifierChantierAction` |

## Ce qui a été fait autrement

- **Par son lien, l'envoi se fait sur l'écran du devis parti**, celui d'où part
  tout devis (« Ouvrir le SMS tout prêt »). La planche le montrait dans la
  carte du jour. Le refaire là aurait créé un deuxième chemin d'envoi.
- **Un client sans moyen de contact choisi reprend celui de son premier envoi**
  (SMS ou e-mail). Sans cela, l'envoi refusait, et rien sur le planning ne
  permettait de le choisir. Trouvé en jouant le parcours.

## Ce qui a été vérifié

- Le parcours joué en vrai dans un navigateur, sur une base d'essai : les
  quatre branches, et la suppression jusqu'à l'effacement après six secondes.
- `test-devis-expire-e2e` : 5 cas verts, et **5 rouges sur l'ancien code**.
- `test-etat-envoi` (rouge d'abord), `test-reprise-du-devis-db` (10/10),
  `test-retour-au-planning`, les garde-fous du dépôt (couches, code mort,
  pansements, tirets, flèches, chartes).
- Suites navigateur voisines rejouées au vert : planning (43 cas), poser à sa
  place, supprimer du planning, devis à la main, reprise du chantier.

**Sur `main` le 8 octobre**, dans une batterie commune avec « la facture
suit le devis » et la phrase de sous-traitance : 459/459 suites base,
183/183 navigateur, connexion derrière un proxy.

## Ce qui reste ouvert

| Point | Qui |
|---|---|
| L'écran du devis parti dit « Le client choisit sa date » même quand le lien ne montre que son jour à lui (déjà vrai pour « Poser à sa place ») | à trancher par lui, hors de ce lot |

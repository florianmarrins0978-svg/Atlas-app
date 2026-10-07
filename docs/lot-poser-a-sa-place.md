# Poser un client à sa place : compte rendu du lot

**Ta question du 7 octobre 2026 :** un client âgé reçoit le lien du devis et
n'arrive pas à choisir ses dates. Depuis le planning, peux-tu le reprendre avec
son devis pour le poser toi-même ?

**Avant ce lot : non.** Le planning le rangeait « en attente du client », sans
aucun bouton. Et « Ajouter », puis « Un client », aurait créé un second
chantier, sans le devis.

**Ton choix : B** (planche `appli/poser-a-sa-place.html`).

## Ce qui est fait

| Point | Ce que tu vois | Fichier |
|---|---|---|
| Le client se retrouve | « Ajouter », « Client en attente » : son nom, avec « devis envoyé » | `src/app/planning/PlanningClient.tsx` |
| Tu dis comment il signe | « Signe sur son lien » ou « Signé sur papier » | idem, `CommentIlSigne` |
| Signe sur son lien | Le chantier est posé ; sous son nom, « Pas encore signé » | `src/lib/chantier-etat.ts`, `poseSansAccord` |
| Ce qu'il voit sur son lien | Plus de dates à choisir : « Votre intervention », le jour posé, et « J'accepte ce devis » | `src/app/devis/[jeton]/formulaire.tsx` |
| Signé sur papier | Le devis passe accepté, marqué « papier » et à ton nom ; son lien est fermé | `src/server/repositories/pose-a-sa-place.ts` |
| Les 14 jours | Sur son lien : sa case, comme avant. Sur papier : ta case « Il a demandé par écrit de commencer avant la fin de ses 14 jours » | idem |
| L'aide de l'appli | « ma cliente âgée n'arrive pas à choisir ses dates » trouve la bonne fiche | `src/lib/fiches-mode-emploi/planning.ts` |

## Ce qui a été fait autrement que demandé, et pourquoi

**Poser ne vaut pas accord.** Tu l'avais proposé. Pour un particulier, un
accord que rien ne prouve ne vaut rien en cas de litige, et des travaux
commencés dans ses 14 jours sans demande écrite peuvent ne pas t'être dus. Tu as
retenu B en le sachant. Je ne suis pas juriste : c'est une lecture prudente du
Code de la consommation, à faire confirmer si un litige arrive.

## Ce qui protège tes données

- La place au planning et ce que dit le lien s'écrivent **ensemble** : jamais un
  chantier posé dont le lien proposerait encore d'autres dates.
- Sa réponse sur le lien **ne déplace jamais** ton chantier, même si la page est
  rejouée avec une autre date.
- Si tu déplaces le chantier ensuite, son lien montre la nouvelle date. Si tu le
  retires du planning, son lien redevient comme avant.
- Une autre entreprise ne peut rien poser chez toi (vérifié sous l'isolation).

## Les contrôles

| Contrôle | Résultat |
|---|---|
| `test-pose-a-sa-place-db.ts`, neuf cas en base | 9 sur 9, et vu rougir sur deux règles cassées exprès |
| `test-etat-envoi.ts` (« Pas encore signé ») | 24 sur 24 |
| `test-mode-emploi.ts` (l'aide) | 32 sur 32 |
| `test-poser-a-sa-place-e2e.ts`, ton geste puis la page de la cliente | voir la batterie |
| Batterie complète | à jouer avant la fusion (lot de niveau 3 : il touche le devis) |

## Ce qui reste ouvert

| Point | Qui tranche |
|---|---|
| Si le client **refuse** sur son lien, le chantier reste posé. La carte « Devis refusé » te le dit, et c'est toi qui le retires. | toi, si tu veux qu'il parte tout seul |
| Un lien **expiré puis renvoyé** repart avec des dates à choisir. | toi |
| La mise sur `main` | toi : elle se demande |

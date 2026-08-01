# Historique des changements qui comptent

Ce qui a changé, et **ce que ça évite**. Les corrections de forme et les
ajustements de test ne figurent pas ici : `git log` les porte déjà.

Format : le plus récent en tête.

---

## 2026-08-01

### Suivi du devis parti — `07fa28c`

Le parcours savait tout et ne montrait rien. Un devis envoyé restait « devis
envoyé » indéfiniment : le patron voyait la même chose que le client réfléchisse
depuis une heure, qu'il soit sans nouvelles depuis trois semaines, ou qu'on lui
ait dit non. Le refus vivait en base et nulle part ailleurs.

- Cinq états, déduits par **une seule fonction pure** (`src/lib/etat-envoi.ts`) :
  en attente, à relancer (7 jours), caduc (lien expiré), retourné, accepté.
- Le planning ne propose plus de planifier soi-même un chantier dont le client
  choisit sa date — c'était préparer deux engagements sur le même jour. Il
  apparaît sous « En attente du client » plutôt que de disparaître.
- L'accueil annonce les refus, avec le **nom du chantier**. « J'ai vu » est un
  appui : une notification qui s'efface au premier coup d'œil se manque en
  faisant défiler l'écran.
- « Reprendre le devis » ouvre une nouvelle version sans toucher à celle qui est
  partie. Sans ce chemin, un chantier retourné l'était définitivement.

**Trois défauts corrigés au passage**, dont deux invisibles à la relecture :
l'adresse du lien était composée depuis le navigateur, donc différente de ce que
le serveur avait rendu (React régénérait tout l'arbre) ; l'état « envoyé » était
figé à l'ouverture de l'écran et survivait à une reprise de devis ; et une pile
de notifications repoussait les chantiers hors de l'écran.

### Lanceur de tests de bout en bout — `d54740f`, `4f15735`

Un passage de CI avait produit cinq suites en échec accusant chacune un écran
différent, alors qu'aucune n'avait pu charger la page de connexion : le serveur
était mort six minutes plus tôt et le lanceur ne le remarquait pas.

Le lanceur conserve désormais la sortie du serveur, l'interroge avant chaque
suite, et s'arrête net s'il ne répond plus. Le premier jet de ce contrôle
n'accordait que dix secondes et a déclaré mort un serveur simplement occupé à
compiler, faisant échouer un passage entier — corrigé à six tentatives réparties
sur une minute.

### Fin de chantier, facture et relevé de TVA — `d311752`

- Onglet « Terminés » : les chantiers dont la date d'intervention est **passée**,
  rangés par date. Le critère est cette date et non `termine_at` — sinon un
  chantier n'apparaîtrait qu'une fois déclaré terminé, c'est-à-dire jamais,
  puisque c'est là qu'on le déclare.
- « Fin de chantier » bâtit la facture depuis le devis et **s'arrête là**
  (arrêt 3). Idempotent : deux factures pour un chantier doubleraient la TVA.
- Le relevé de TVA se **calcule** à partir des factures émises, jamais stocké.
  Une table tenue en parallèle finirait par diverger de ce qui a été facturé.
- Immuabilité d'une facture émise posée par **trigger**, pas par convention —
  c'est ce qui rend le relevé stable.
- Migration `drizzle/0018_factures.sql`.

### Envoi du devis au client — `4c683f8`

La page publique de réponse existait, testée, mais **aucun chemin réel n'y
menait** : rien dans l'application ne créait le lien qu'elle attend.

- Bouton « Envoyer au client » et unique arrêt du parcours : *une date, ou deux
  au choix du client ?* Les jours proposés sont les jours réellement libres,
  relus à chaque ouverture.
- La chaîne était coupée un maillon plus tôt : aucun écran n'enregistrait le
  canal convenu avec le client. La création du chantier le recueille désormais,
  et le déduit quand une seule coordonnée est renseignée.

### Conformité RGPD — `6b8a8d1`

- Purge de l'audio sept jours après une transcription réussie, via la file
  `audios_a_purger`. Un balayage direct de `notes_vocales` aurait purgé **zéro**
  ligne, silencieusement : le planificateur n'a le contexte d'aucune entreprise.
- Export complet des données d'un client.
- Effacement qui **trie** au lieu de supprimer : les devis acceptés et le nom qui
  les rend valables survivent au titre de la conservation légale, tout le reste
  part, et le lien public est détruit dans tous les cas.
- Migrations `drizzle/0016_retention_et_effacement.sql`,
  `drizzle/0017_file_purge_audio.sql`.

### Documents tenus pour le patron — `9a461f0` → `a33201f`

`docs/QUESTIONS.md` (journal des questions et de leurs réponses) et
`docs/A-FAIRE.md` (points bloquants, avec leur propriétaire). Pages consultables
générées par `scripts/md-en-page.mjs`, sommaires cliquables. Règles de tenue
inscrites dans `AGENTS.md` pour survivre au changement de conversation.

### Page de réponse du client et cycle d'envoi — `ea815f2`

Seule surface publique du produit : devis et choix de date sur le même écran,
sans session. Jeton de 256 bits, expiration à 45 jours, calendrier borné aux
jours libres du patron, contre-proposition possible, case de rétractation quand
la date est proche. Migration `drizzle/0015_envois_devis.sql`.

**Correction critique du même lot :** le middleware remplaçait les en-têtes de la
requête par un objet vide, effaçant les cookies de session. Aucune erreur — 
l'application se comportait simplement comme déconnectée. 3 suites sur 19
passaient ; 19 sur 19 après correction.

### Cadrage de l'agent et documents légaux — `9ff1b16`

`docs/AGENT.md` (le parcours et ses arrêts), `docs/RGPD.md` (registre,
sous-traitants, conservation), et le mécanisme d'acceptation des documents
légaux avec empreinte SHA-256 du texte exact accepté.

## 2026-07-31

### Vérification du site publié — `bcd0e57`

Le workflow Pages vérifie le site **à son adresse publique** après déploiement :
chaque écran répond, la racine mène à l'application, et la batterie de tests est
rejouée contre l'adresse en ligne. L'environnement de développement ne peut pas
joindre `github.io` ; la vérification a donc été déplacée là où elle est
possible, plutôt que contournée.

### Reprise de l'application Arborea — `45b6d97`

Écrans, Capacitor et tests repris depuis `arborea-`, **sans le site vitrine**.
Publiée sur GitHub Pages.

# Prochaines tâches

Par ordre de priorité. Une tâche terminée se **barre** avec sa date plutôt que
de disparaître : savoir qu'elle a été traitée évite de la rouvrir.

Ce fichier porte le travail de **développement**. Ce qui bloque et n'avancera
pas en codant est dans `docs/A-FAIRE.md` — tenu pour le patron, dans son
langage, et rien n'y entre sans son accord.

---

## Bloqué par une décision du patron

Rien à coder tant que ces points ne sont pas tranchés. Ne pas les redécouvrir :
ils sont écrits, avec leur coût et leur propriétaire, dans `docs/A-FAIRE.md`.

| | Ce qui débloque | Ce que je fais alors |
|---|---|---|
| 1 | Deux fournisseurs d'IA retenus | Verrouiller la configuration sur eux, tenir `docs/RGPD.md` §3 à jour |
| 2 | Contrat de sous-traitance rédigé | Remplacer les canevas sans valeur par les textes réels |
| 3 | Hébergement européen choisi | Déployer — **sans quoi personne ne peut se servir de l'application** |
| 4 | Société constituée, assurance souscrite | Rien côté code |
| 5 | Fournisseur SMS et e-mail | L'envoi, la trace, la relance automatique, le départ de la facture |

---

## Ce que je peux faire seul

### 1. Agenda Google — lecture des disponibilités

**Partiellement bloqué.** La connexion du compte demande des identifiants OAuth
que le patron doit créer ; le reste est codable.

Aujourd'hui, les jours libres se déduisent des seuls chantiers planifiés dans
Atlas (`src/server/disponibilites.ts`). Un patron qui tient son agenda ailleurs
verra donc proposer des jours où il est déjà pris — et c'est le client qui
choisira ce jour-là.

À faire une fois les identifiants disponibles : lecture des événements sur la
fenêtre de proposition, fusion avec les chantiers Atlas dans la **même** fonction
de disponibilité (jamais un second calcul), et écriture de l'intervention après
acceptation.

### 2. Code SMS en renfort de l'acceptation

L'acceptation conserve déjà l'empreinte du PDF, l'horodatage, l'adresse IP et le
canal (`docs/AGENT.md` §5, ligne « Acceptation tracée »). Ce qui manque est un
code à usage unique envoyé au client au moment où il accepte — ce qui **dépend du
point 5 ci-dessus**.

### 3. Relance automatique d'un devis sans réponse

L'état « à relancer » existe, s'affiche, et le lien reste proposé pour un renvoi
manuel. L'automatiser suppose là encore un fournisseur d'envoi.

Ce qui est codable dès maintenant sans lui : une **caducité effective** — passé
l'expiration, proposer au patron de reprendre le devis en une nouvelle version
plutôt que de le laisser dans un état mort. Aujourd'hui l'écran le signale mais
c'est au patron d'y penser.

### 4. Compteur de l'accueil

« N chantiers en cours » compte aujourd'hui **tous** les chantiers, y compris les
terminés et les facturés. Le libellé ment doucement. À reprendre avec la même
fonction d'état que le reste, jamais avec un second calcul.

### 5. Maquettes `/design/*` divergentes

Les pages de `src/app/design/` reproduisent une version antérieure de l'écran
devis (« Envoyer vers le système de devis », « Devis envoyé à »). Elles sont des
maquettes assumées, mais leur écart avec l'écran réel finira par tromper
quelqu'un. À trancher : les mettre à jour, ou les marquer explicitement comme
gelées.

---

## Terminé

- ~~Reprendre l'application Arborea sans le site vitrine, et la publier~~ — 2026-07-31
- ~~Vérifier le site publié à son adresse publique~~ — 2026-07-31
- ~~Cadrer l'agent (`docs/AGENT.md`) et la conformité (`docs/RGPD.md`)~~ — 2026-08-01
- ~~Acceptation des documents légaux avec empreinte~~ — 2026-08-01
- ~~Page publique de réponse du client, jeton, expiration, contre-proposition~~ — 2026-08-01
- ~~Purge de l'audio, export et effacement d'un client~~ — 2026-08-01
- ~~Envoi du devis au client, canal recueilli à la création~~ — 2026-08-01
- ~~Onglet « Terminés », fin de chantier, facture, relevé de TVA~~ — 2026-08-01
- ~~Suivi du devis parti : cinq états, notification, reprise~~ — 2026-08-01
- ~~Mémoire permanente du dépôt (ces fichiers)~~ — 2026-08-01

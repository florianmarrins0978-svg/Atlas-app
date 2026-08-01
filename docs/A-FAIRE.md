# À faire absolument

Ce qui doit être réglé avant qu'Atlas serve de vrais artisans avec de vrais
clients. Ce ne sont pas des idées d'amélioration : ce sont des points bloquants,
ou des risques qu'on ne peut pas laisser courir.

**Document modifiable.** Rayez ce qui est fait, ajoutez ce qui manque. Un point
terminé se barre plutôt qu'il ne se supprime : savoir qu'il a été traité, et
quand, évite de le rouvrir.

Chaque point indique **qui peut le faire** — c'est souvent là que ça bloque. Un
point marqué « le patron » n'avancera jamais tout seul.

**Comment ce document est tenu** (règle inscrite dans `AGENTS.md`, donc relue à
chaque session) : dès qu'un point bloquant apparaît dans une conversation, il
est signalé et son ajout **proposé**. Rien n'y entre sans accord explicite, et
les tâches de développement ordinaires n'y figurent pas — ce document sert ce
qui ne se résoudra pas en codant.

---

## Sommaire

1. [Choisir les fournisseurs d'IA définitifs](#1-choisir-les-fournisseurs-dia-définitifs)
2. [Faire rédiger le contrat de sous-traitance](#2-faire-rédiger-le-contrat-de-sous-traitance)
3. [Choisir un hébergement](#3-choisir-un-hébergement)
4. [Constituer une société et s'assurer](#4-constituer-une-société-et-sassurer)
5. [Brancher un fournisseur SMS et e-mail](#5-brancher-un-fournisseur-sms-et-e-mail)

---

## 1. Choisir les fournisseurs d'IA définitifs

**Qui : le patron.** Personne d'autre ne peut trancher — cela engage un contrat
et des données de tiers.

### Pourquoi c'est bloquant

L'audio de la note vocale et le texte dicté partent chez un prestataire. Ils
contiennent, par construction, **le nom et l'adresse du client de l'artisan** —
l'application est faite pour qu'on les dicte.

Ces prestataires sont donc des **sous-traitants ultérieurs** au sens du RGPD :
ils doivent être autorisés par l'artisan, nommés dans le contrat, et leurs
transferts hors d'Europe encadrés. Aujourd'hui, aucun ne figure nulle part.

On ne peut pas éviter de leur envoyer ces données : c'est le cœur du produit. On
peut seulement **choisir à qui**, et **combien de temps ça reste chez eux**.

### Ce qu'il faut décider

Le code accepte aujourd'hui **six fournisseurs interchangeables**. Il en faut
**deux** :

- un pour la **transcription** (l'audio → du texte) ;
- un pour le **raisonnement** (le texte → des informations structurées).

### Les trois points à vérifier chez chacun

| Point | Pourquoi |
|---|---|
| **Où sont leurs serveurs** | Hors d'Europe, il faut un encadrement contractuel supplémentaire. En Europe, la question ne se pose pas |
| **Combien de temps ils conservent** ce qu'on leur envoie | Certains gardent 30 jours « pour la sécurité ». C'est autant de temps où l'audio d'un client vit ailleurs que chez vous |
| **S'ils s'en servent pour entraîner leurs modèles** | Le point le plus important, et celui qu'on oublie. Cela se refuse contractuellement — mais il faut le demander explicitement |

### Ce que je peux faire une fois décidé

Verrouiller la configuration sur les deux fournisseurs retenus, pour qu'aucun
autre ne puisse être activé par inadvertance, et tenir la liste à jour dans
[`RGPD.md`](RGPD.md) §3.

---

## 2. Faire rédiger le contrat de sous-traitance

**Qui : un juriste.** Quelques centaines d'euros, et c'est l'investissement le
plus rentable du projet.

Le mécanisme d'acceptation est **déjà construit** : documents versionnés, cases
jamais pré-cochées, preuve conservée jusqu'à l'empreinte du texte exact accepté.
Ce sont les **textes** qui manquent — ceux livrés aujourd'hui sont des canevas
sans aucune valeur, et marqués comme tels.

Le juriste aura besoin de :

- la liste des sous-traitants ultérieurs (point 1) ;
- l'inventaire des données traitées — il est fait, dans [`RGPD.md`](RGPD.md) §2 ;
- les durées de conservation retenues.

Sans ce contrat, le manquement existe **avant même** tout incident.

---

## 3. Choisir un hébergement

**Qui : le patron**, pour la décision et le budget.

L'application Next.js — celle qui porte l'agent, la page du client et le
calendrier — n'est hébergée nulle part. **Personne ne peut s'en servir.**

Il faut un serveur, une base de données PostgreSQL et un Redis. Comptez quelques
dizaines d'euros par mois.

Deux exigences qui ne sont pas négociables :

- **en Union européenne** — base et stockage de fichiers compris ;
- **chiffrement au repos** de la base.

Tant que ce point n'est pas réglé, tout ce qui est construit reste inaccessible.

---

## 4. Constituer une société et s'assurer

**Qui : le patron.** Hors code, mais déterminant.

**Une société plutôt qu'une entreprise individuelle.** C'est ce qui sépare votre
patrimoine personnel de celui de l'activité. En cas de fuite de données, la
différence n'est pas théorique : les sanctions peuvent atteindre des montants
qu'un particulier n'absorbe pas.

**Une assurance cyber / responsabilité civile professionnelle.** Quelques
centaines d'euros par an, et elle absorbe l'essentiel du coût financier d'un
incident.

Ces deux points sont les moins chers et les plus efficaces de toute la liste.
Voir [`QUESTIONS.md`](QUESTIONS.md) question 4 pour le détail de ce qui est
encouru.

---

## 5. Brancher un fournisseur SMS et e-mail

**Qui : le patron**, pour le choix et l'abonnement. Le branchement lui-même est
du code, et je peux le faire en une fois.

### Pourquoi c'est bloquant

C'est le dernier mètre du parcours, et il n'existe pas. Tout le reste est
construit : le devis part avec une ou deux dates au choix, le client répond sur
son calendrier, le chantier se planifie, la facture se prépare. Mais **rien ne
quitte l'application**. Le lien du devis vous est remis à l'écran, à charge pour
vous de le recopier dans un SMS. La facture attend le même branchement.

Autrement dit : l'agent fait tout le travail, sauf l'envoyer. Sur dix chantiers
par semaine, c'est vingt gestes manuels — exactement ceux que l'application est
censée vous épargner.

### Ce qu'il faut choisir

Deux abonnements distincts, un par canal :

| Canal | Ce que ça coûte, en ordre de grandeur | Remarque |
|---|---|---|
| **SMS** | quelques centimes par message | Le canal que la plupart de vos clients liront. Un numéro d'expéditeur au nom de votre entreprise se demande à part |
| **E-mail** | quelques euros par mois jusqu'à plusieurs milliers d'envois | Suppose un nom de domaine à vous, et sa configuration anti-usurpation — sans quoi vos devis finissent en indésirables |

### Deux points à vérifier, du même ordre que pour l'IA

- **Où sont leurs serveurs.** Le message porte le nom du client et le lien vers
  son devis : c'est une donnée personnelle qui transite. Un prestataire européen
  évite tout encadrement supplémentaire.
- **Ce qu'ils conservent.** Les journaux d'envoi gardent souvent le destinataire
  plusieurs mois. À faire figurer dans [`RGPD.md`](RGPD.md) §3 comme les autres
  sous-traitants.

### Ce que je fais une fois décidé

L'envoi, la trace de ce qui est parti et quand, la relance d'un devis resté sans
réponse, et le départ automatique de la facture après votre confirmation. Le
canal de chaque client est **déjà enregistré** dans l'application, et l'écran
d'envoi refuse déjà de partir sans lui — il ne manque que le fournisseur au bout.

### En attendant

Rien n'est perdu ni bloqué : le lien affiché à l'écran est le même que celui qui
partirait par SMS, et la page du client fonctionne à l'identique. Seul le geste
d'envoi vous revient.

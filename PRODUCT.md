# Product

<!-- impeccable:product-schema 1 -->

<!-- Les intitulés de section sont en anglais parce qu'ils forment le contrat
     que l'outillage Impeccable relit ; le contenu, lui, suit la règle du dépôt
     (CLAUDE.md §3) et reste en français. Ce fichier ne porte que la vérité
     PRODUIT : l'identité visuelle vit dans `src/lib/design-tokens.ts` et
     `docs/DESIGN_SYSTEM.md`, et rien ici ne la remplace. -->

## Platform

web

## Users

**Le patron artisan paysagiste** — utilisateur principal, propriétaire de son
entreprise. Il dicte sa note debout sur le chantier, relit le soir, valide,
facture. Il n'est ni comptable ni informaticien ; il reste **l'unique expert du
chantier**.

Trois autres rôles, figés le 30 août 2026 (`src/lib/acces-roles.ts`,
`docs/modele-des-roles.md`) :

| Rôle | Ce qu'il atteint |
|---|---|
| **Patron** (`proprietaire`) | tout Atlas, l'administrateur de son entreprise |
| **Facturation** | clients, devis, factures, TVA · planning en lecture · aucune administration |
| **Commercial** | clients, devis, planning en écriture · **aucune facturation** |
| **Salarié** | planning en lecture seule, sa feuille sans un montant |

Plusieurs personnes peuvent porter le même rôle, chacune avec son compte : il
n'existe aucune session partagée.

**Le client final n'est pas un utilisateur.** Il ne crée aucun compte : il
reçoit un lien (SMS ou e-mail, canal convenu à l'avance) qui ouvre une page
publique par jeton — le devis et le choix de la date au même endroit, puis la
facture, puis la fiche d'entretien.

**Cible commerciale, confirmée le 2 septembre 2026 : les paysagistes d'abord.**
L'arrosage, le diagnostic végétal et les fiches d'entretien font partie du cœur,
pas d'un module optionnel. Un élargissement à d'autres métiers reste possible
plus tard ; il n'est pas engagé.

## Product Purpose

Prendre en charge le travail administratif autour du chantier : transcrire une
dictée, la structurer, chercher les tarifs, rédiger le devis, proposer une date
tirée de l'agenda, envoyer au client, puis préparer la facture et le relevé de
TVA.

**L'objectif se mesure en temps rendu** : les vingt minutes de bureau qui
suivent chaque visite doivent devenir **trente secondes de relecture**
(`docs/AGENT.md` §1).

Ce n'est pas un logiciel de comptabilité : c'est un assistant qui prépare le
travail comptable et le transmet aux outils qui font ce métier.

## Positioning

**L'IA prépare, elle ne décide jamais — et le parcours s'arrête deux fois.**
Aucune durée, aucun nombre d'hommes, aucun matériel, aucun prix n'est affirmé
sans validation humaine explicite. Deux arrêts seulement, et ils sont choisis :
**avant l'envoi du devis** et **avant le départ de la facture** — les deux seuls
moments où le patron engage sa parole et son argent. Un troisième arrêt a été
retiré parce qu'il ne pouvait mener qu'à « oui ».

Deuxième différence, qu'un concurrent généraliste ne peut pas copier de bonne
foi : **le métier est calculé, pas décoré**. Le plan d'arrosage dimensionne pour
de vrai — débits, pertes de charge, diamètres, tension des électrovannes,
comptage des raccords position par position — à partir d'un catalogue dont
chaque entrée porte sa source, relevée sur les devis du patron.

## Operating Context

Trois scènes d'usage, confirmées le 2 septembre 2026, et toutes les trois à
tenir :

| Où | Ce que cela impose |
|---|---|
| **Téléphone, sur le chantier** | debout, une main, en plein soleil : grandes cibles, fort contraste, le moins de mots possible |
| **Le soir, au calme** | relecture, validation, envoi — c'est là que se franchissent les arrêts |
| **Écran d'ordinateur** | facturation, TVA, réglages |

Le fonctionnement hors réseau **n'a pas été retenu** comme exigence : à ne pas
inventer, à redemander si la question se pose.

Ce qui sort de l'entreprise et arrive chez le client : un lien, une page de
devis avec choix de date, un PDF de devis puis de facture. Ces documents sont
gardés et signés — ils suivent l'identité de l'application mais **ne suivent pas
la charte de couleurs choisie** : un devis ne part pas en noir chez le client
parce que l'artisan a choisi « Nuit ».

Plusieurs entreprises cohabitent dans la même base, isolées par RLS : toute
lecture passe par `withEntreprise(...)`, et hors de ce cadre une requête ne
renvoie rien, silencieusement.

## Capabilities and Constraints

**Ce qui existe** (routes sous `src/app/`) : chantiers et leur fiche (note
vocale, transcription, prix, devis complet, facture, export), clients, planning,
chantiers terminés et TVA, catalogue, réglages (identité, tarifs, équipe,
documents, apparence, agenda, IA, données, abonnement), pages publiques par
jeton (devis, facture, entretien), et le pôle **Paysage** — plan d'arrosage,
diagnostic végétal, fiches d'entretien.

**Technique** : PWA Next.js 16 · React 19 · PostgreSQL + Drizzle avec RLS ·
Redis · S3 · next-auth et WebAuthn · PDF générés dans l'application.

**L'IA est branchée chez le patron** (Anthropic et OpenAI) : transcription de la
dictée, rédaction des lignes de devis, lecture d'image — ticket de caisse,
croquis d'arrosage, photo de végétal. Les postes de développement, eux, n'ont
aucune clé : ce qui en dépend se vérifie sur son espace, jamais ici.

**Contraintes durables :**

- **Français partout**, y compris les noms de tables, de fonctions et de
  variables.
- **Huit chartes de couleurs** au choix dans les réglages, dont **deux
  sombres** (Nuit, Sylve) où les pôles s'inversent. Aucune couleur ne s'écrit en
  clair dans un écran.
- **L'arrosage n'a pas droit à l'erreur** : sans métrés, sans point de piquage
  et sans emplacement définitif de la nourrice, aucun plan n'est proposé. Ce qui
  n'est pas calculé se dit à l'écran.
- **Rien n'est envoyé, validé ni facturé sans un geste du patron.**

**Explicitement non décidé, à ne pas inventer :** le prix et le contenu de
l'abonnement (l'écran `reglages/abonnement` le dit lui-même) ; le nom du produit
et sa marque (voir ci-dessous) ; le fonctionnement hors réseau.

## Brand Commitments

**Rien n'est arrêté, et c'est sa réponse du 2 septembre 2026 : « tout est
ouvert » — ni le nom, ni la marque.**

Ce qui existe aujourd'hui est donc de l'**existant**, pas un engagement :

- le nom **Atlas**, employé partout dans le dépôt ;
- la **feuille dessinée au trait** (`src/components/atlas/MarqueAtlas.tsx`) ;
- la charte reprise d'**Arborea** — son propre site —, relevée au navigateur et
  non approchée à l'œil : vert pin `#2f3b2f` en accent d'action, or `#B98B47`
  en accent de lecture, fond crème, polices du système.

Cette identité fait autorité **pour le code existant** et ne se touche pas sans
demande explicite ; elle n'a pas été confirmée ici comme définitive.

Une voix, en revanche, est acquise et confirmée par l'usage : **le moins de mots
possible à l'écran**, aucune phrase qui explique le bouton d'à côté, aucune
flèche décorative en fin de libellé (un contrôle les refuse).

## Evidence on Hand

- **Le produit tourne** : `docs/ESSAYER.md` l'ouvre depuis un navigateur, y
  compris sur téléphone.
- **Le catalogue d'arrosage** (`appli/arrosage-catalogue.js`) porte la source de
  chaque entrée : `patron` (relevée de ses photos et de ses devis Aqua Plus) ou
  `provisoire`. Une entrée provisoire ne se présente jamais comme acquise.
- **La palette** a été relevée par un navigateur sur le site publié d'Arborea
  (`.github/workflows/relever-palette.yml`).
- **Ses mesures à lui** : débit au seau de 1,80 m³/h sur compteur Ø25, écran de
  390 × 664, et une série d'arbitrages datés dans `docs/QUESTIONS.md`.
- **Les maquettes essayables** sont publiées sous `appli/` et listées par
  `appli/essais.html`.

**Ce qui n'existe pas et ne doit pas être fabriqué :** aucun client réel n'est
encore déployé (le modèle des rôles a été figé « avant le premier artisan
réel »), aucun témoignage, aucune référence, aucun chiffre d'usage, aucun prix
public.

## Product Principles

1. **L'IA prépare, le patron décide.** Deux arrêts, franchissables en quelques
   secondes quand tout est juste. Un arrêt long est un arrêt raté : l'agent
   n'avait pas assez préparé.
2. **Rien ne s'invente.** Un champ sans source fiable reste vide et le signale —
   un prix, une durée, un métré, une portée d'arroseur. « Plausible » n'est pas
   une source.
3. **Le moins de mots possible.** Un écran ne s'explique pas, il se montre.
4. **La réversibilité après, plutôt que la confirmation avant.** Le geste
   « Retirer » retire tout de suite et laisse un tiroir pour annuler ; rien n'est
   écrit tant qu'il est ouvert.
5. **Se tromper vers le sûr, et le dire.** Sur ce qui est ignoré, on retient
   l'hypothèse la moins coûteuse à réparer ; sur ce qui est connu, on calcule
   juste, sans marge ajoutée.

## Accessibility & Inclusion

Aucun standard formel n'a été posé par le patron. Deux exigences sont établies
par l'usage et par ses retours :

- **Le plein soleil et la main unique** commandent les tailles de cible et les
  contrastes.
- **Les huit chartes doivent rester lisibles**, y compris les deux sombres —
  faute payée le 22 août 2026 (« le mode nuit est illisible »). Le contrôle
  existe : `npx tsx scripts/test-chartes-lisibles.ts`.

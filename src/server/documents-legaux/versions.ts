import { createHash } from "node:crypto";

/**
 * Versions publiées des documents légaux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  CES TEXTES SONT DES CANEVAS. Ils ne sont pas rédigés par un juriste et
 *  n'ont aucune valeur en l'état. Ils décrivent la STRUCTURE attendue et
 *  rendent le mécanisme d'acceptation exerçable de bout en bout ; le contenu
 *  doit être remplacé avant toute utilisation avec de vrais artisans.
 *  Voir docs/RGPD.md §9.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Règle absolue : **une version publiée ne se modifie jamais.** Corriger un
 * texte, c'est ajouter une entrée avec une nouvelle `version`. Sans cette
 * règle, une acceptation déjà recueillie désignerait un texte qui n'existe
 * plus — c'est-à-dire rien.
 *
 * L'ordre du tableau est l'ordre d'affichage à l'utilisateur.
 */

export type TypeDocumentLegal = "cgu" | "sous_traitance" | "confidentialite";

export type VersionDocument = {
  type: TypeDocumentLegal;
  version: string;
  titre: string;
  /** Sous-titre affiché sous le titre, pour dire en une phrase de quoi il s'agit. */
  resume: string;
  acceptationRequise: boolean;
  contenu: string;
};

export const VERSIONS_DOCUMENTS: VersionDocument[] = [
  {
    type: "cgu",
    version: "canevas-1",
    titre: "Conditions générales d'utilisation",
    resume: "Ce que le service fait, ce qu'il ne fait pas, et les règles d'usage.",
    acceptationRequise: true,
    contenu: `# Conditions générales d'utilisation

> **Canevas non juridique.** À remplacer avant toute mise en service réelle.

## 1. Objet

Atlas est un outil d'aide à la préparation de devis pour les artisans. Il
transcrit une note dictée, en propose une structuration modifiable, et calcule
un prix **à partir de la grille tarifaire renseignée par l'utilisateur**.

## 2. Ce qu'Atlas ne fait pas

Atlas n'est pas un logiciel de comptabilité et **n'émet aucun document légal**.
La facturation conforme relève d'un outil comptable distinct.

Atlas ne décide jamais à la place de l'utilisateur : aucun prix, aucune durée,
aucune donnée client n'est affirmé sans validation humaine explicite.

## 3. Responsabilité de l'utilisateur

L'utilisateur reste seul responsable du contenu des devis et factures qu'il
émet, des prix qu'il pratique, et des engagements pris envers ses clients.

## 4. Disponibilité

À rédiger : engagement de disponibilité, maintenance, évolutions.

## 5. Durée, résiliation, restitution des données

À rédiger : conditions de résiliation, et modalités de récupération des
données par l'utilisateur à son départ.
`,
  },
  {
    type: "sous_traitance",
    version: "canevas-1",
    titre: "Contrat de sous-traitance (article 28 RGPD)",
    resume:
      "Comment nous traitons les données de vos clients pour votre compte, et ce que nous nous engageons à faire.",
    acceptationRequise: true,
    contenu: `# Contrat de sous-traitance — article 28 du RGPD

> **Canevas non juridique.** Ce document doit être rédigé ou relu par un
> juriste avant toute utilisation avec de vrais artisans. Les rubriques
> ci-dessous reprennent le contenu que l'article 28.3 rend obligatoire — elles
> indiquent ce qui doit y figurer, elles ne le rédigent pas.

## 1. Qui est qui

**Vous, l'artisan, êtes responsable de traitement** des données de vos clients.
Vous décidez pourquoi et comment elles sont traitées.

**Nous sommes sous-traitant.** Nous traitons ces données uniquement sur vos
instructions, pour vous permettre d'utiliser Atlas.

## 2. Objet, durée, nature et finalité

- **Objet** : préparation de devis, de plannings et de factures.
- **Durée** : celle de votre abonnement, plus les délais de conservation
  prévus au §6.
- **Nature** : collecte, structuration, conservation, transmission.
- **Finalité** : vous faire gagner le temps de saisie administrative.

## 3. Données et personnes concernées

- **Types de données** : identité et coordonnées de vos clients, adresses de
  chantier, contenu des notes vocales et leurs transcriptions, photos, devis,
  factures.
- **Personnes concernées** : vos clients, le plus souvent des particuliers.

## 4. Nos engagements

Reprendre ici les huit obligations de l'article 28.3 : instructions
documentées, confidentialité du personnel, sécurité (article 32),
sous-traitance ultérieure encadrée, assistance à l'exercice des droits,
assistance aux articles 32 à 36, sort des données en fin de contrat, mise à
disposition des éléments d'audit.

## 5. Sous-traitants ultérieurs

Nous faisons appel à des prestataires pour l'hébergement, la transcription
audio et l'assistance par intelligence artificielle. **La liste nominative et
leur localisation figurent en annexe.** Toute modification vous est notifiée à
l'avance et vous pouvez vous y opposer.

> **À compléter par l'annexe réelle** — voir docs/RGPD.md §3, qui tient
> l'inventaire à jour à partir du code.

## 6. Conservation et effacement

À rédiger : durées de conservation par catégorie de donnée, et modalités
d'effacement ou de restitution en fin de contrat.

## 7. Violation de données

Nous vous alertons **sans délai** en cas de violation de données, afin que vous
puissiez respecter votre propre délai de notification de 72 heures auprès de la
CNIL.
`,
  },
  {
    type: "confidentialite",
    version: "canevas-1",
    titre: "Politique de confidentialité",
    resume: "Ce que nous faisons de vos données à vous, en tant qu'abonné.",
    acceptationRequise: false,
    contenu: `# Politique de confidentialité

> **Canevas non juridique.** À remplacer avant toute mise en service réelle.

Ce document concerne **vos** données d'abonné — pas celles de vos clients, qui
relèvent du contrat de sous-traitance.

## Ce que nous conservons

Votre adresse e-mail, le nom de votre entreprise, et les éléments nécessaires à
la gestion de votre abonnement.

## Vos droits

Accès, rectification, effacement, portabilité, opposition. À rédiger : modalités
d'exercice et adresse de contact.

## Où vivent les données

À compléter une fois l'hébergement choisi : hébergeur, pays, et mesures de
sécurité appliquées.
`,
  },
];

/**
 * Empreinte SHA-256 d'un contenu, en hexadécimal minuscule.
 *
 * C'est elle qui donne sa valeur à une acceptation : elle atteste du texte
 * exact qui a été accepté, et non d'un titre de document qui aurait pu changer
 * sous le même nom.
 */
export function empreinteContenu(contenu: string): string {
  return createHash("sha256").update(contenu, "utf8").digest("hex");
}

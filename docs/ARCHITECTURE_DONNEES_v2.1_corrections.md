# Atlas — Architecture de la couche de données (v2.1, corrections)

Ce document ne reprend que les sections corrigées par rapport à la v2 (`docs/ARCHITECTURE_DONNEES.md`). Tout le reste de la v2 reste inchangé. Aucun code n'a été modifié.

## Correction 1 — Relations composites modélisées directement dans Prisma

Prisma sait en réalité exprimer nativement une relation composite dès lors que le parent expose une contrainte unique composite. Pas besoin de migration manuelle pour ce cas :

```prisma
model Chantier {
  id           String @id @default(uuid())
  entrepriseId String
  entreprise   Entreprise @relation(fields: [entrepriseId], references: [id])
  photos       Photo[]

  @@unique([id, entrepriseId])
}

model Photo {
  id           String @id @default(uuid())
  entrepriseId String
  chantierId   String
  chantier     Chantier @relation(fields: [chantierId, entrepriseId], references: [id, entrepriseId])
}
```

La migration SQL manuelle reste nécessaire uniquement pour ce que Prisma ne sait pas déclarer du tout : les **politiques RLS** (`CREATE POLICY`, `FORCE ROW LEVEL SECURITY`) et le **déclencheur d'immuabilité des devis envoyés** (correction 9, ci-dessous) — aucun DSL Prisma ne couvre ni les policies ni les triggers.

## Correction 2 — `withEntreprise()` via `set_config` paramétré

`SET LOCAL` ne peut pas recevoir de valeur paramétrée côté protocole Postgres — d'où le recours à la fonction `set_config()`, un appel de fonction normal qui accepte, lui, un paramètre lié :

```ts
async function withEntreprise<T>(entrepriseId: string, fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.entreprise_id', ${entrepriseId}, true)`;
    return fn(tx);
  });
}
```

Le troisième argument `true` de `set_config` signifie *is_local* : la valeur ne vit que pour la transaction courante, exactement l'équivalent sécurisé de `SET LOCAL`, mais paramétrable.

## Correction 3 — Politiques RLS : `USING` et `WITH CHECK`

```sql
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantiers FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON chantiers
  USING      (entreprise_id = current_setting('app.entreprise_id', true)::uuid)
  WITH CHECK (entreprise_id = current_setting('app.entreprise_id', true)::uuid);
```

`USING` filtre les lignes visibles pour lecture, mise à jour et suppression. `WITH CHECK` valide les valeurs pour une insertion, et la valeur *après* modification pour une mise à jour — sans lui, RLS ne bloquerait pas l'insertion d'une ligne avec un `entreprise_id` différent du contexte courant. Cette politique (les deux clauses) est répliquée à l'identique sur chaque table métier.

## Correction 4 — Représentation de la TVA

- `taux_tva Decimal(5,2)` — ex. `20.00` pour 20 %. Lisible directement, aucune conversion nécessaire à l'affichage, marge suffisante (jusqu'à 999,99 %).
- Ajout de `total_tva Decimal(10,2)` sur `devis`, explicite et stocké (pas recalculé implicitement) : `total_ttc = total_ht + total_tva`, vérifiable en base à tout moment.

## Correction 5 — Instantané immuable du devis, complété

Champs ajoutés à la table `devis` (copie figée au moment de la génération, jamais recalculée après envoi) :

```
entreprise_nom, entreprise_adresse, entreprise_siret, entreprise_email,
entreprise_telephone, entreprise_iban,
client_nom, client_adresse, client_telephone, client_email,
adresse_chantier,
numero_commercial, numero_version,          -- voir correction 6
date_emission date, date_validite date,
conditions_paiement text,
devise char(3) default 'EUR',
taux_tva Decimal(5,2), total_ht Decimal(10,2),
total_tva Decimal(10,2), total_ttc Decimal(10,2)
```

## Correction 6 — Numéro commercial distinct du numéro de version

- `numero_commercial` : identifiant visible du client (ex. `2026-0042`), attribué **une seule fois**, à la création du premier devis d'un chantier — réutilisé par toutes ses versions ultérieures (v2, v3...). Le client reconnaît une révision du même devis, pas un nouveau document.
- `numero_version` : incrémenté à chaque nouvelle révision du même `numero_commercial`.
- Contraintes : `UNIQUE (entreprise_id, numero_commercial, numero_version)` — la contrainte métier significative, scoping par entreprise. `UNIQUE (chantier_id, numero_version)` conservée en complément comme filet structurel.
- Génération sans collision (voir tests, correction 9) : table `entreprise_compteurs (entreprise_id PK, prochain_numero_devis int)`, incrémentée par `UPDATE ... SET prochain_numero_devis = prochain_numero_devis + 1 RETURNING prochain_numero_devis` **dans la même transaction** que la création du devis. Le verrou de ligne Postgres sur cet `UPDATE` sérialise naturellement les créations concurrentes — deux demandes simultanées ne peuvent pas obtenir le même numéro, sans verrou applicatif additionnel.

## Correction 7 — Remplacement d'une note vocale sans risque de perte

Séquence stricte :

1. Le nouveau fichier est déposé sous une **nouvelle** `storage_key` (jamais d'écriture par-dessus l'ancienne).
2. Une fois l'upload confirmé (checksum vérifié), une transaction unique : la ligne `notes_vocales` est mise à jour vers la nouvelle clé, et l'**ancienne** clé est insérée dans une table `fichiers_a_purger (storage_key, mis_en_file_le)`.
3. La suppression physique de l'ancien fichier est **différée** : un job périodique purge les entrées de `fichiers_a_purger` plus vieilles qu'un délai de grâce (ex. 24 h), et **idempotent** (supprimer une clé déjà absente du bucket n'est pas une erreur).
4. Si l'upload échoue ou que la transaction n'aboutit pas, l'ancienne clé n'a jamais été touchée — la dernière version valide reste donc toujours accessible, quoi qu'il arrive avant la validation complète.

## Correction 8 — Entreprise active pour un utilisateur multi-entreprises

- Un utilisateur n'appartenant qu'à une seule entreprise (cas normal du MVP) : sélection automatique, aucune action requise.
- Un utilisateur appartenant à plusieurs entreprises (évolution future) : écran de **sélection explicite** au départ ; l'`entrepriseId` choisi est stocké dans le **JWT signé côté serveur** (Auth.js), jamais dans une valeur modifiable côté client (pas de cookie/`localStorage` de confiance).
- **Aucune confiance accordée à un `entrepriseId` transmis par le client**, même signé : chaque appel de repository revalide, avant `withEntreprise()`, qu'une ligne `membres_entreprise (entreprise_id, utilisateur_id)` existe toujours pour la paire courante — utile si une adhésion a été révoquée après l'émission du jeton.
- Changer d'entreprise active = action serveur dédiée qui revalide l'adhésion puis réémet la session avec le nouvel `entrepriseId`.

## Correction 9 — Tests d'isolation et d'intégrité complétés

En plus des tests déjà prévus en v2 :

- Lecture interentreprises refusée.
- Insertion avec un `entreprise_id` ne correspondant pas au chantier/client parent → rejetée par la contrainte composite (correction 1) et par `WITH CHECK` (correction 3).
- Mise à jour tentant de transférer une ligne vers une autre entreprise → rejetée par les deux mêmes mécanismes.
- Appel d'un repository **sans contexte d'entreprise défini** (`app.entreprise_id` non défini dans la transaction) → RLS bloque par défaut (`current_setting(..., true)` renvoie `NULL`, la policy s'évalue à faux, zéro ligne visible/modifiable) : comportement *fail-closed* vérifié explicitement.
- Un devis dont `statut = 'envoye'` ne peut plus être modifié : appliqué par un **déclencheur SQL** (`BEFORE UPDATE ON devis, lignes_devis`) qui lève une exception si `OLD.statut = 'envoye'` — cas concret de logique nécessitant une migration SQL manuelle (cf. correction 1).
- Génération simultanée de deux devis pour la même entreprise → deux `numero_commercial` distincts garantis, aucun doublon (test de concurrence réelle, deux transactions lancées en parallèle).
- Échec simulé d'un remplacement de note vocale (upload interrompu ou transaction annulée) → l'ancien fichier reste intact et accessible.

---

Aucune implémentation n'a été commencée. J'attends votre validation finale avant d'écrire le moindre code.

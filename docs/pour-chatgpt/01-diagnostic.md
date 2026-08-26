# 01 — Diagnostic : second avis demandé sur la chaîne « dictée vocale → devis »

Tu n'as pas accès au dépôt. Tout ce qu'il te faut est dans ce document : le
symptôme, le code réellement exécuté (extraits verbatim), le diagnostic déjà
posé, et les questions auxquelles je veux que tu répondes. Ne suppose rien
au-delà de ce qui est écrit ici ; si une information te manque pour trancher,
dis-le explicitement plutôt que de combler.

---

## 1. Le contexte

Application métier pour un paysagiste-élagueur (Next.js + PostgreSQL + Drizzle,
multi-entreprises avec RLS). Le parcours principal :

L'artisan **dicte** son chantier depuis son téléphone → l'audio est **transcrit**
(OpenAI `whisper-1`, `language=fr`, aucun autre paramètre) → un **modèle de
langage** (Anthropic `claude-sonnet-4-6`, `temperature: 0`, `max_tokens: 1024`)
transforme la transcription en JSON structuré → ce JSON devient des lignes en
base → un moteur de prix propose un montant → un **devis** s'affiche.

Le tout se déclenche automatiquement : il dicte, ferme l'application, revient sur
le chantier, et le devis est écrit.

**Contrainte produit absolue, posée par le patron :** l'application ne doit
JAMAIS inventer un prix, une quantité ou une prestation. Sans donnée fiable, elle
refuse, laisse le champ vide, et dit pourquoi.

---

## 2. Le symptôme observé

Devis obtenu après une dictée normale depuis un iPhone (l'audio est bon, la
transcription n'est pas en cause) :

| Ligne affichée | Qté | Prix | Rappel affiché sous la ligne |
|---|---|---|---|
| « Tonte de la pelouse (1200 m²) »<br>« Érable — démontage en rétention »<br>*(les deux textes sur la MÊME ligne)* | **1** | **840 € HT** | « Abattage d'un érable lacinié en rétention » — **550 € HT** |
| « Haie (tout genre) (800 ml) » | **1** | **0 €** | « La dernière fois — Haie de laurier (50 ml) — 300 € HT (15 chantiers comparables) » |

---

## 3. Le code réellement exécuté (extraits verbatim)

### 3.1 — Le schéma de sortie demandé au modèle

```
{
  "prestations": { "libelle": string, "description": string|null,
                   "quantite": string|null, "unite": string|null,
                   "aConfirmer": boolean }[],
  "materiel":    [ idem ],
  "dureePrevue": string|null,
  "tailleEquipe": string|null,
  "gestionDechets": string|null,
  "contraintesAcces": string|null,
  "remarques": string|null,
  "ambiguites": string[],
  "informationsManquantes": string[]
}
```

La consigne système interdit d'inventer une quantité, une unité ou un prix, et
exige une prestation par verbe d'action. **Sur ce cas, le modèle a bien répondu**
`{ libelle: "Haie (tout genre)", quantite: "800", unite: "ml" }`.

### 3.2 — Le passage du brouillon aux données du chantier

```ts
// brouillon-service.ts
function libelleAvecQuantite(ligne: LigneExtraite): string {
  const base = ligne.libelle.trim();
  if (!base) return "";
  if (ligne.quantite && ligne.unite) return `${base} (${ligne.quantite} ${ligne.unite})`;
  return base;
}
// ... puis :
await ajouterPrestation(ctx, chantierId, libelleAvecQuantite(ligne));
```

Table cible :

```ts
export const prestations = pgTable("prestations", {
  id: uuid().primaryKey().defaultRandom(),
  entrepriseId: uuid().notNull(),
  chantierId: uuid().notNull(),
  libelle: text().notNull().default(""),   // <-- la SEULE colonne de contenu
  ordre: integer().notNull().default(0),
  // ni quantite, ni unite, ni espece, ni methode
});
```

### 3.3 — Le découpage en lignes de devis

```ts
const FENDAGE     = /\b(fend|fente)/i;
const HAIE        = /\bhaie/i;
const DESSOUCHAGE = /\b(dessouch|d[ée]souch|souche|rognage)/i;
const GRUMES      = /\bgrume/i;
// ...
for (const libelle of propres) {
  if (FENDAGE.test(libelle))     { fendage.push(libelle);     continue; }
  if (HAIE.test(libelle))        { haie.push(libelle);        continue; }
  if (DESSOUCHAGE.test(libelle)) { dessouchage.push(libelle); continue; }
  if (GRUMES.test(libelle))      { grumes.push(libelle);      continue; }
  principal.push(libelle);                 // <-- fourre-tout
}
// chaque groupe devient UNE ligne, ses membres joints par "\n"
```

Conçu à l'origine pour **détacher** ce qu'un client peut refuser seul (la fente,
la souche, les grumes), pas pour **distinguer** deux travaux sans rapport.

### 3.4 — Le prix

Arbre de décision, dans l'ordre :

1. un seul tarif dont l'intitulé s'inclut dans un libellé de prestation → ce tarif ;
2. plusieurs → refus explicite, le choix revient au patron ;
3. sinon, **un tarif reconnu à son UNITÉ** (`jour/homme`) :

```ts
const montant = prix.times(jours).times(hommes);   // tarif jour/homme × durée × équipe
// puis arrondirALaDizaine(montant)
```

4. sinon, calcul depuis les paramètres de l'entreprise :

```
sousTotal    = (jours × hommes × coûtJournalierOuvrier) + coûtChef + forfaitDéplacement
prixConseillé = sousTotal × (1 + margeCible%)   → arrondi à la dizaine
```

**Ce total, quel qu'il soit, est le prix du CHANTIER ENTIER.** Il est ensuite
réparti entre les lignes :

```ts
// chaque ligne détachable prend son prix de grille ; la principale garde le reste
if (part.greaterThanOrEqualTo(reste)) return null;   // <-- répartition refusée
```

Et quand `repartir` rend `null` :

```ts
const lignesBrutes = vendables.map((l, i) => ({
  libelle: l.libelle,
  montant: i === principaleIndex ? totalHt : "0",   // <-- toutes les détachables à 0
}));
```

L'explication (« cette ligne vaut autant que le chantier entier ») part dans un
tableau `donneesManquantes` **qui n'est affiché que sur un autre écran**, jamais
sur le devis.

### 3.5 — L'écriture de la ligne de devis

```ts
// lignes-prix.ts
await tx.insert(lignesPrix).values({
  libelle,
  quantite:     options?.quantite     ?? "1",       // <-- appelé sans options
  prixUnitaire: options?.prixUnitaire ?? montant,
  unite:        options?.unite,                     // <-- reste null
  montant,
});
```

La table `lignes_prix` possède pourtant bien `quantite`, `prix_unitaire` et
`unite`. L'écran affiche une colonne « Qté » qui lit fidèlement cette colonne.

### 3.6 — Le rapprochement historique (« la dernière fois… »)

```ts
const NATURES = [
  { cle: "abattage",    motif: /\b(abattage|abattre|abatt|démont|demont)/i },
  { cle: "haie",        motif: /\bhaie/i },
  { cle: "elagage",     motif: /\b(élagage|elagage|élaguer|taille\s+d[eu]\s+(?!haie))/i },
  { cle: "dessouchage", motif: /\bdessouch/i },
  { cle: "fendage",     motif: /\bfend/i },
  { cle: "broyage",     motif: /\bbroy/i },
];
const TECHNIQUES = [
  { cle: "retention",  motif: /rétention|retention/i },
  { cle: "demontage",  motif: /\bdémont|\bdemont/i },
  { cle: "au_pied",    motif: /\bau\s+pied\b/i },
];
const DIAMETRE_LU = /(?:⌀|Ø|diam[èe]tre)\s*(\d{1,3})/i;

export function signatureLecon(libelle: string): SignatureLecon | null {
  const nature = NATURES.find((n) => n.motif.test(libelle));
  if (!nature) return null;                       // pas de rapprochement fantaisiste
  const morceaux = [nature.cle];
  const technique = TECHNIQUES.find((t) => t.motif.test(libelle));
  if (technique) morceaux.push(technique.cle);
  const d = DIAMETRE_LU.exec(libelle);
  if (d) morceaux.push(`d${Math.round(Number(d[1]) / 10) * 10}`);   // tranche de 10 cm
  return { cle: morceaux.join("|"), ... };
}
```

Et la recherche des chantiers « comparables » :

```ts
.where(and(eq(leconsPrix.entrepriseId, ctx.entrepriseId),
           eq(leconsPrix.signature, signature.cle)))   // <-- égalité de chaîne EXACTE
```

Ces signatures sont **stockées en base** (`lecons_prix.signature`).

### 3.7 — L'apprentissage, déclenché quand l'artisan tape un prix

```ts
const nature = FENDAGE.test(ligne.libelle)     ? "fendage"
             : HAIE.test(ligne.libelle)        ? "haie"
             : DESSOUCHAGE.test(ligne.libelle) ? "dessouchage"
             : GRUMES.test(ligne.libelle)      ? "grumes"
             : ABATTAGE.test(ligne.libelle)    ? "abattage"
             : null;
if (!nature) return;
// ...
// haie : le montant est divisé par la longueur lue DANS LE LIBELLÉ
await poserPrixGrille(ctx, "haie", CELLULE_HAIE, (montant / longueur).toFixed(2), "devis");
// abattage : le montant ENTIER est écrit dans la case technique × diamètre
await poserPrixGrille(ctx, nature, cellule.cle, montant.toFixed(2), "devis");
```

En parallèle, le montant est aussi enregistré comme « leçon de prix » sous la
signature du §3.6.

---

## 4. Ce que j'ai vérifié (fonctions pures rejouées, sans modifier le code)

```
[principal] libelle = "Tonte de la pelouse (1200 m²)\nÉrable — démontage en rétention"
[haie]      libelle = "Haie (tout genre) (800 ml)"

signature([principal]) -> 'abattage|retention'
signature([haie])      -> 'haie'

"Haie (tout genre) (800 ml)"  vs  "Haie de laurier (50 ml)"   =>  COMPARABLES
repartir("840", [null, "2400"], 0)  =>  null   (la haie tombe à 0 €)

"La dernière fois — « Haie de laurier (50 ml) », le 15 août — vous aviez
 retenu 300 € HT (15 chantiers comparables)."
```

Les deux écrans du patron sont reproduits au caractère près.

---

## 5. Mon diagnostic (à contester)

**Trois racines, qui se cumulent :**

1. **Le libellé sert de modèle de données.** Le modèle extrait correctement
   `quantite`/`unite` ; ils sont recollés au nom (§3.2), la table `prestations`
   n'a aucune colonne où les poser, et la ligne de devis reçoit `quantite: "1"`
   en dur (§3.5). Le « QTÉ = 1 » n'est donc **pas** une décision de forfait :
   c'est une colonne jamais renseignée. Six informations sur neuf (prestation,
   espèce, quantité, unité, caractéristiques, méthode) vivent dans une chaîne de
   texte, relue ensuite par expression régulière à **quatre endroits
   indépendants** qui doivent rester d'accord entre eux.

2. **`principal` est un fourre-tout** (§3.3). Tonte, plantation, désherbage,
   clôture : tout ce qui n'a pas de grille atterrit sur la ligne de l'abattage.

3. **« Comparable » est une égalité de chaîne sur trois jetons** (§3.6). Ni
   espèce, ni quantité, ni unité, ni ordre de grandeur, ni score, ni seuil.
   50 ml et 800 ml de haie ont la même clé — d'où les « 15 chantiers
   comparables ».

**Sur les 840 € contre 550 € :** il n'existe **aucune formule** reliant les deux.
550 € est un souvenir attaché à la signature `abattage|retention` ; 840 € est le
prix du chantier ENTIER (tonte de 1 200 m² comprise) calculé au temps, affiché
sur une ligne dont le rappel ne parle que de l'érable. Rien ne compare les deux,
rien ne signale l'écart de +53 %.

**Sur la haie à 0 €** : soit aucun prix au mètre linéaire n'existe en grille,
soit il en existe un et 800 × ce prix dépasse forcément 840 €, ce qui fait
échouer la répartition et force toutes les lignes détachables à zéro (§3.4).

**Et un risque de corruption de données, déjà actif** (§3.7) : quand l'artisan
pose un prix sur la ligne qui porte DEUX prestations, le classement se fait au
premier mot reconnu — `abattage` répond — et le montant du lot entier (tonte
comprise) est écrit dans la case abattage × rétention × ⌀ de sa grille de prix.
Ce prix revient ensuite seul sur chaque démontage suivant, avec l'autorité de
« sa » grille, et rien ne le signale à l'écran.

---

## 6. Le plan que je propose (à critiquer)

| P | Correction | Migration |
|---|---|---|
| **P0** | Ne rien enseigner (ni grille, ni leçon de prix) depuis une ligne qui porte plus d'une prestation ou plus d'une nature | non |
| **P1** | Colonnes `quantite`/`unite` sur `prestations` ; arrêter de coller au libellé ; écrire quantité et prix unitaire sur la ligne de devis | additive |
| **P2** | Ajouter espèce + ordre de grandeur à la clé de rapprochement ; refuser le rappel au-delà d'un facteur d'écart | oui (recalcul des signatures stockées) |
| **P3** | Une nature par prestation, une ligne par nature — supprimer le fourre-tout | non |
| **P4** | Afficher **sur le devis** pourquoi une ligne est à 0 €, et signaler un prix très éloigné du seul comparable connu | non |
| **P5** | Relever `max_tokens` (1024 aujourd'hui) et journaliser la troncature : coupée, la réponse bascule **en silence** sur une lecture mot à mot indiscernable d'une panne de clé | non |
| **P6** | Envoyer le vocabulaire métier au transcripteur (aucun aujourd'hui) ; brancher ou supprimer une branche « catalogue » morte, jamais appelée depuis la dictée | non |

---

## 7. Contraintes non négociables

- **Ne jamais inventer** un prix, une quantité ou une prestation. Un refus
  explicite vaut mieux qu'un chiffre plausible.
- **Ne pas modifier les données historiques** pour obtenir un meilleur résultat.
- **Pas de correctif cosmétique** : masquer `(800 ml)` à l'affichage ou plafonner
  un prix « incohérent » est refusé. La donnée doit devenir juste à sa source.
- **Ne pas toucher** : audio/transcription, authentification, sessions, RLS,
  sécurité des fichiers, CSP, RGPD, sauvegardes, rôles, facturation,
  numérotation, migrations existantes.
- Les signatures de rapprochement sont **stockées** : changer leur format sans
  migration orpheline toute la mémoire de prix de l'artisan.
- Certains libellés (`⌀ 45 cm`, `12 m de haut`) sont **relus par la machine**
  pour retrouver une case de grille : les reformuler casse le chiffrage en
  silence.

---

## 8. Ce que je te demande

Réponds point par point, en disant clairement quand tu n'as pas assez
d'information pour trancher.

1. **Mon diagnostic est-il juste ?** Vois-tu une cause que j'ai manquée, ou un
   point où j'accuse le mauvais maillon ?
2. **L'ordre de priorité est-il le bon ?** P0 avant P1 se défend-il, sachant que
   P0 arrête une corruption en cours mais ne corrige rien de visible ?
3. **Sur la modélisation (P1)** : ajouter `quantite`/`unite` à `prestations`
   suffit-il, ou faut-il aller jusqu'à un modèle qui sépare explicitement
   prestation / espèce / quantité / unité / caractéristiques / méthode ? Quel est
   le coût réel de chacune des deux options, et laquelle recommandes-tu pour une
   application déjà en service chez un utilisateur ?
4. **Sur le rapprochement (P2)** : comment définirais-tu « comparable » pour des
   prestations de paysagisme, sachant qu'il ne faut **jamais** produire un
   rapprochement faux (un rappel manquant est acceptable, un rappel faux ne
   l'est pas) ? Faut-il un score et un seuil, ou une clé plus riche ? Comment
   traiter l'écart de quantité — facteur, ratio, tranches ?
5. **Sur le découpage (P3)** : quelle règle remplacerait le fourre-tout sans
   perdre la logique d'origine (regrouper ce qui ne se refuse pas séparément,
   détacher ce qui se refuse) ?
6. **Sur le prix** : un total « au temps » calculé pour le chantier entier puis
   réparti entre les lignes est-il une bonne architecture, ou faut-il chiffrer
   ligne par ligne dès l'origine ? Quels sont les pièges de chaque approche pour
   un devis que le client lit ligne par ligne et peut refuser par morceaux ?
7. **Quels tests écrirais-tu AVANT de corriger**, et lesquels de mes points
   seraient impossibles à tester sans clé d'API ?
8. **Que casserais-je sans m'en apercevoir** en appliquant ce plan ?

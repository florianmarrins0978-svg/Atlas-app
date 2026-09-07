# Le prompt `/impeccable` pour la transcription et les informations

À coller après `/impeccable` dans une session neuve. Il tient seul.

Écrit le 5 septembre 2026. Ce sont **les deux derniers écrans du trajet
`chantier → terminé`** qui n'ont jamais été repris. Ils vont ensemble : c'est un
seul moment pour le patron — *relire ce que la machine a compris de ma dictée,
avant de poser mes prix*. Les traiter séparément produirait deux dessins du même
geste.

**Ce qui tourne à côté :** une session refait l'écran des **prix**, qui est
exactement l'écran d'après. Ne touche pas à `chantiers/[id]/prix/`, et lis son
travail avant de dessiner la sortie de ces deux écrans-ci.

---

```
Rends impeccable LES DEUX ÉCRANS OÙ LE PATRON RELIT SA DICTÉE — la transcription
et les informations. C'est le même moment pour lui : ce que la machine a
entendu, puis ce qu'elle en a compris, avant qu'il pose ses prix.

LE PÉRIMÈTRE

  ce qu'elle a entendu   src/app/chantiers/[id]/transcription/
                         page.tsx (105 l.), TexteDicte.tsx (138), actions.ts (57)
  ce qu'elle a compris   src/app/chantiers/[id]/informations/
                         InformationsClient.tsx (344), BrouillonSection.tsx (600),
                         page.tsx (115), actions.ts (1 083 : c'est un signal)

CE QUI EST HORS PÉRIMÈTRE

  l'écran des prix       une session le refait en ce moment
  le devis, la facture   faits les 4 et 5 septembre
  la note vocale         c'est là que la dictée se LANCE et se relance ; la
                         transcription, elle, est en consultation seule, et ce
                         n'est pas un manque : deux endroits pour lancer la même
                         chose, c'est un de trop

Si tu trouves un défaut dans l'une de ces zones, DIS-LE et n'y touche pas.

CE QUE « IMPECCABLE » VEUT DIRE ICI, ET ÇA SE MESURE

1. C'est le moment où il vérifie qu'on l'a compris. Ce qui est SÛR et ce qui est
   SUPPOSÉ ne doivent pas se ressembler : une réserve tue vaut un mensonge, et
   un texte de remplacement n'est pas une transcription — l'afficher comme telle
   lui a déjà fait croire que sa dictée était comprise de travers alors qu'elle
   n'avait pas été écoutée.
2. Il relit debout, une main, en plein soleil — puis le soir au calme. Les deux
   scènes.
3. **Rien ne se tronque en silence.** La liste des réserves est plafonnée à cinq
   et annonce le reste (« + 2 autres ») : garde ce principe partout où tu coupes.
4. Huit chartes, dont deux sombres (Nuit, Sylve) où l'accent est CLAIR : aucune
   couleur écrite en clair, `surPlein` sur un aplat, `voile()` pour un voile.
   Attention : `test-chartes-lisibles.ts` lit les CHARTES, pas les classes d'un
   écran — un `bg-[rgba(0,0,0,0.03)]` lui échappe et disparaît sur Nuit. C'est
   la faute du 22 août, déjà revenue deux fois depuis.
5. Tout refus nomme sa raison ET le geste qui le débloque.
6. Le moins de mots possible. Aucune phrase qui explique le bouton d'à côté,
   aucune flèche décorative (scripts/test-aucune-fleche.ts).

DÉJÀ TRANCHÉ PAR LE PATRON — ne pas rouvrir, même si ça paraît mieux

- **Les cases s'écrivent APRÈS confirmation.** Elles passaient en lecture seule,
  et sur iPhone un champ en lecture seule n'ouvre même pas le clavier : on tape,
  rien ne se passe, on croit à une panne. « Déchets », « Contraintes d'accès » et
  « Remarques » n'ont aucune autre case dans l'application.
- **Ce qui a été RECOPIÉ dans le chantier disparaît de l'encart** — prestations,
  matériel, durée, équipe : les vraies cases sont juste en dessous, et corriger
  la copie ne toucherait à rien.
- **« Ou écrire le devis moi-même » RESTE.** Il a demandé son retrait *si*
  « Valider et calculer le prix » ouvrait le devis — ce n'est pas le cas, ce
  bouton ouvre l'écran des prix. Ce lien est la sortie de secours qu'il a
  demandée le 3 août 2026.
- Trois phrases grises ont été retirées le 25 août (sous « Ce chantier prend »,
  sous « Ou écrire le devis moi-même », et la flèche de « Valider et calculer le
  prix »). Ne les ramène pas.
- Les réserves du modèle sont des groupes nominaux de six mots, cinq au plus :
  c'est la consigne donnée au modèle, pas une troncature d'écran.
- **À une seule équipe, le mot « équipe » ne s'écrit nulle part.**

CE QUI EST DÉJÀ CONNU COMME BANCAL

- `informations/actions.ts` fait 1 083 lignes. Ce qui se découpe se découpe,
  mais aucun comportement ne change en passant.
- Le dépôt a déjà payé une fois « le brouillon se dé-confirme à chaque frappe » :
  regarde `brouillons-informations.ts` avant de toucher à l'enregistrement.

LES INVARIANTS

- Toute lecture passe par withEntreprise(utilisateurId, entrepriseId, fn). Hors
  de ce cadre, une requête ne renvoie rien, silencieusement.
- Français partout. Les règles métier vivent dans src/lib/, en fonctions pures.
  Jamais deux fois la même règle entre l'affichage et la vérification.

CE QUI S'ÉPROUVE ICI, ET CE QUI NE S'ÉPROUVE PAS

Les deux écrans se jouent entièrement sur ce poste : ils LISENT ce que la base
porte (une transcription, un brouillon), ils ne rappellent aucun modèle. Ne dis
pas « pas vérifiable ici » pour l'écran. Seul un appel RÉEL au transcripteur ou
au modèle d'extraction demande son espace — et cela ne concerne aucun de tes
fichiers.

LA MÉTHODE

1. Lis PRODUCT.md, CLAUDE.md, docs/AGENT.md, puis git log -20. Le code fait foi
   contre la documentation ; si les deux divergent, corrige la documentation.
2. Dis-moi ce que tu as trouvé AVANT d'écrire une ligne : les trois choses qui
   font le plus mal sur ces deux écrans, chacune avec le fichier qui la prouve,
   et ce que tu refuses de faire.
3. Toute apparence ou tout geste nouveau se DESSINE d'abord : une maquette HTML
   dans appli/, un lien dans appli/essais.html, et l'adresse ENTIÈRE une fois
   qu'elle répond 200 — jamais une capture de la maquette. **Une seule planche
   pour les deux écrans** : c'est un seul moment.
4. Regarde les écrans, en capture, à 390 × 664, Origine ET Nuit — y compris les
   états vides : aucune note, transcription en cours, transcription échouée,
   dictée non transcrite.

LA BATTERIE, SUR SON POSTE WINDOWS

- **Préviens-le AVANT de la lancer.** Toutes ses sessions travaillent dans le
  MÊME dossier : si une autre écrit dans `src/` pendant qu'elle tourne, le
  serveur tombe en route et les chiffres ne veulent rien dire.
- Sa base vit dans Docker : `docker start atlas-postgres atlas-redis`.
- Les adresses se surchargent depuis le 4 septembre au soir. Sur son poste :

  ```bash
  export ATLAS_BASE_SUPER="postgresql://postgres:postgres_dev_pw@localhost:5432/atlas_test"
  npm run verifier:avant-livraison
  ```

LE RENDU

Un document dans docs/, commité avec le code, plus sa page :
node scripts/md-en-page.mjs docs/<nom>.md
Il porte : un verdict par point, le fichier qui le fonde, ce qui a été fait
autrement et pourquoi, ce qui a été refusé et ce que ça aurait coûté, les
chiffres exacts de la batterie, et ce qui reste ouvert avec qui peut le
trancher.
```

---

## Après celui-ci, le trajet `chantier → terminé` est entièrement repris

| Écran | |
|---|---|
| Première page, fiche client, liste des clients, planning, Terminés, Ma TVA | faits avant le 4 septembre |
| Fiche de chantier | **retirée** le 4 septembre |
| Feuille du planning (la facture y a sa porte) | 4 septembre |
| Page du devis · Facture | 4 et 5 septembre |
| Prix | en cours |
| **Transcription · Informations** | **ce prompt** |

# Prompt pour une autre session : les dossiers du plan d'arrosage

*Écrit le 21 novembre 2026. À coller tel quel dans une session neuve.*

---

Lis d'abord `CLAUDE.md`, puis `.claude/rules/arrosage.md` **en entier**, et les
fichiers de reprise (`HANDOVER.md`, `PROJECT_STATE.md`, `TODO.md`).

## Ce que je veux

Dans **Paysage, Arrosage**, je veux pouvoir **créer un dossier** à un nom que je
choisis, par exemple « Plan d'arrosage de Madame Intel ». Une fois que l'outil
m'a sorti le plan et la liste des pièces, je veux :

1. **l'enregistrer** dans ce dossier ;
2. le **revoir** plus tard, tel qu'il était ;
3. le **télécharger** (le plan, la liste des pièces et les réserves affichées
   sous le plan), pour le garder ou l'envoyer.

## Pourquoi, et ce que ça doit protéger

Aujourd'hui rien n'est gardé : `ARCHITECTURE.md` le dit (« Rien n'est
enregistré, et les paramètres voyagent… Aucune persistance »), et aucune table
de plan n'existe dans `src/server/db/schema.ts`. Si un artisan me reproche un
réseau qui ne se lève pas, ni lui ni moi ne pouvons montrer ce que Cause lui a
rendu. **Cette décision est donc levée, par moi.**

Chaque plan enregistré doit être **figé**, avec ces quatre choses, que j'ai
validées :

1. **ce que l'artisan a saisi** : la photo du croquis, les cotes lues et
   corrigées, la pression, le débit, le piquage, la nourrice, ses choix (Ø25 ou
   Ø32, le nombre de lignes, le matériel…) ;
2. **le plan calculé et la liste des pièces**, exactement comme affichés ;
3. **les réserves affichées** sous le plan (ce qui n'est pas calculé, les
   portées réduites, les voies qui manquent…) ;
4. **la version du calcul et la date**.

Le modèle à suivre existe : la table `diagnostics` (son `resultat` figé, et
`moteur`, `modele`, `versionBase`, « trois colonnes qui ne servent jamais à
l'écran et qui sauvent une enquête »). Et `EnregistrerLaDemande.tsx` montre
comment une liste s'enregistre déjà chez le fournisseur.

## Les règles qui ne bougent pas

- **Revoir un plan ne le recalcule jamais.** On montre ce qui a été rendu ce
  jour-là, même si le calcul a changé depuis. Le recalcul se fait dans l'outil,
  et donne un nouvel enregistrement.
- **Un enregistrement ne s'écrase pas.** Modifier puis enregistrer de nouveau
  ajoute une version dans le dossier ; l'ancienne reste.
- **Les réserves partent dans le téléchargement**, au même titre que le plan
  (règle 3 de l'arrosage : « ce qui n'est pas calculé se dit »). Un PDF sans
  ses réserves serait un plan cru complet.
- L'outil reste utilisable **sans chantier ni dossier** (décision du §125) :
  enregistrer est un geste en plus, jamais une étape obligatoire.
- Réservé à ceux qui ont **les outils de paysage** (l'option à 6 €), comme le
  reste de la page.

## Ce que tu me poses AVANT de coder

**La maquette d'abord** (`CLAUDE.md` §3 bis), **posée sur le vrai écran de
l'arrosage** figé (§3 bis, 2 quinquies, `scripts/planche-figee/`). Chaque
bouton de la planche fait quelque chose (2 quater). La planche va dans `appli/`
et dans `essais.html`, et tu me donnes l'adresse entière seulement une fois
qu'elle répond.

Elle doit me montrer :

- où se trouvent les dossiers dans Arrosage, et comment on en crée un ;
- le bouton « Enregistrer dans un dossier » sous un plan calculé ;
- un dossier ouvert, avec ses plans enregistrés et leur date ;
- un plan revu, et le téléchargement.

Et tu me poses ces questions, avec ta recommandation pour chacune :

1. **Dossier libre ou relié au client ?** Le dossier peut-il se rattacher à une
   fiche client qui existe déjà, pour ne pas taper deux fois « Madame Intel » ?
2. **Supprimer un dossier** : si l'artisan le supprime, la trace disparaît aussi
   pour moi. Que proposes-tu, en restant dans le RGPD (je suis sous-traitant
   pour les clients de mes artisans) ?
3. **La photo du croquis** : on la garde ? C'est la principale donnée saisie,
   mais c'est du stockage, et l'hébergement n'est pas encore choisi.
4. **Le format du téléchargement** : un PDF, comme les devis ?

## Les contraintes du dépôt

- C'est un lot de **niveau 3** (nouvelle table, donc `drizzle/`). Table sous
  RLS, tout passe par `withEntreprise`, une suite base sous `atlas_app` prouve
  qu'une entreprise ne voit pas les dossiers d'une autre.
- Migration **en expansion seulement**. Numéro pris au-dessus de `main` **et**
  des branches actives.
- Tests rouges d'abord, puis le code.
- **Aucune batterie sans mon « oui »**, et pas de poussée sur `main` sans
  batterie verte.
- À la fin : le document de retour dans `docs/`, sa page, et tu me l'envoies.

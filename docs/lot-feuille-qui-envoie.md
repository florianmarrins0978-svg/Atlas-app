# La feuille « Envoyer à … » — ce que j'ai trouvé, et ce que je propose

**Demande du 4 septembre 2026.** Une passe complète sur la feuille qui monte du
bas quand on appuie sur « Choisir la date » : hiérarchie, densité, rythme
vertical, tailles de touche, contraste, lisibilité au soleil — **dans tous ses
états**, chartes sombres comprises.

**État à ce jour : rien n'est codé.** Ce document rend la lecture et le
diagnostic. La planche est en ligne, elle se touche :

> **https://florianmarrins0978-svg.github.io/Atlas-app/la-feuille-qui-envoie.html**

---

## Comment j'ai regardé

`scripts/voir-envoi-au-client.mts` photographie la feuille dans **onze états**, à
**390 × 664** — l'écran du patron, barre d'adresse déduite —, pour la charte
qu'on lui donne. Il pose son propre décor : une journée à demi prise, une
journée complète, un client sans coordonnée, un devis sans ligne.

```bash
npx tsx scripts/voir-envoi-au-client.mts /tmp/vues            # sa charte
npx tsx scripts/voir-envoi-au-client.mts /tmp/vues nuit       # la sombre
```

Deux choses valent d'être notées, parce qu'elles ne se déduisent d'aucun
document du dépôt et qu'elles ont coûté une demi-heure chacune :

- **le décor demande un rôle qui traverse la RLS.** `atlas_app` ET `atlas_owner`
  sont refusés — les tables portent `FORCE ROW LEVEL SECURITY`, et l'insertion
  d'un chantier voisin rend « new row violates row-level security policy », qui
  accuse la requête alors que seul le rôle est en cause ;
- **la charte est le goût de la PERSONNE, pas un réglage d'entreprise**
  (`schema.ts`, migration 0047) : elle se pose sur `users.charte`.

Les contrastes ne sont pas estimés à l'œil : ils sont recalculés depuis
`src/lib/chartes.ts` sur les huit chartes.

---

## Les sept trouvailles

### 1 — Sur Nuit et Sylve, on ne voit pas quel canal est choisi

**Verdict : défaut réel, et c'est le plus grave du lot.**

Quand le client n'a ni numéro ni e-mail, la feuille propose deux capsules « Par
SMS » / « Par e-mail ». Elles sont **redessinées à la main** dans
`EnvoiAuClient.tsx` (l. 383-402), alors que la maison a déjà `ChoixCanal`, qui
sert au nouveau chantier et à la facture.

La copie ne distingue l'actif que par la couleur du texte — `rust` contre `ink`.
Or **sur Nuit et Sylve, `rust` et `ink` valent exactement le même `#e9e8de`**, et
les deux fonds sont à **1,05** de contraste l'un de l'autre.

| | écart entre les deux fonds |
|---|---|
| Origine | 1,15 |
| Nuit | **1,05** — et le texte est identique |

Les deux capsules sont donc **indiscernables** : il ne peut pas savoir par où le
devis va partir. C'est la même famille que sa capture du 22 août — *« le mode
nuit est illisible »* — et elle a survécu ici précisément parce que la pièce
avait été recopiée au lieu d'être employée.

**Ce que je propose :** employer `ChoixCanal`. Sa marque d'actif est un **liseré
d'or**, qui ne dépend d'aucune clarté et tient donc sur les huit chartes.
Ce n'est pas qu'un correctif de contraste : c'est un doublon de moins
(`CLAUDE.md` §3).

### 2 — Le devis vide est un cul-de-sac

**Verdict : défaut réel, fonctionnel.**

Le garde-fou du 23 août fait son travail : un devis sans ligne ne part pas. Mais
l'écran dit *« Posez d'abord vos prix sur ce chantier »* et **n'offre aucune
porte** — bouton éteint, « Annuler ». Il faut refermer, sortir du devis,
retrouver l'écran des prix.

C'est **exactement** le cul-de-sac qu'il a fait fermer le 11 août pour la
coordonnée manquante. Le commentaire en tête du fichier traite le cas
`devis_absent` (*« il ne se produit pas depuis ce chemin »*) mais pas
`devis_vide` — et celui-là **se produit depuis le chemin ordinaire** : créer un
chantier, « Écrire le devis », « Choisir la date ». Trois gestes.

**Ce que je propose :** la phrase garde sa raison et gagne son geste — un bouton
qui mène aux prix de ce chantier.

### 3 — Le refus est écrit dans la couleur de l'action

**Verdict : défaut réel.**

Le correctif du 3 septembre marche : le bouton ne s'éteint plus faute de date, et
la phrase « Proposez au moins une date d'intervention » s'affiche enfin. Mais
elle est posée en `colors.rust` — **l'accent de ce qu'on FAIT**. Sur Nuit et
Sylve, cet accent *est* l'encre du texte courant : le refus devient un paragraphe
ordinaire.

Et dans la même feuille, quarante pixels plus haut, l'avertissement du jour
complet est en `bordeaux` (`JourneeRegardee.tsx`, l. 155-160). **Deux couleurs
pour « attention » dans le même écran.**

**Ce que je propose :** `colors.alert`. Ce n'est pas une lecture de commentaire,
c'est l'usage mesuré du dépôt — sur les blocs portant `role="alert"` dans
`src/` : **36 emploient `colors.alert`, 5 emploient `colors.rust`**, et cette
feuille est de la seconde catégorie. Le jeton porte déjà sa correction de clarté
sur les deux chartes sombres (`chartes.ts`, `detacher`).

### 4 — Le gris qui porte le sens passe sous le seuil

**Verdict : défaut réel, mais la cause est systémique — je ne la corrige pas
seul.**

`colors.muted` porte sur cette feuille : « Préparation… », « X jours ouvrés
d'affilée seront réservés », « Reste 1 équipe sur 2 », le sous-titre de
l'interrupteur, « Annuler ». Autrement dit **tout ce que l'écran lui apprend et
qu'il ne peut pas deviner**.

Mesuré sur le fond de page, les huit chartes :

| | `muted` sur `cream` |
|---|---|
| moka | **2,85** |
| pierre | 3,01 |
| beurre | 3,07 |
| origine | 3,32 |
| prune | 3,48 |
| brume | 3,59 |
| nuit | 5,19 |
| sylve | 5,80 |

Six chartes sur huit sous 4,5 — et il lit ça **debout, en plein soleil**.

**Ce que je propose, et ce que je REFUSE.** Changer `muted` toucherait trois
cents endroits : ce n'est pas une décision de ce lot, et la prendre au passage
serait exactement ce que `CLAUDE.md` interdit. Sur **cette feuille**, je fais
passer à `inkSoft` (6,6 à 10,4 partout) les phrases qui portent du sens, et je
laisse `muted` à ce qui n'est qu'un repère — la légende du calendrier, les noms
de jours. **Le sujet du jeton lui-même reste ouvert**, et il est noté.

### 5 — Au moment d'envoyer, le bouton rétrécit et s'éteint

**Verdict : défaut réel, mais la cause est dans `PrimaryButton` — partagé.**

« Envoyer le devis » fait **246 px** ; « Envoi… » en fait **118**. La capsule
tient à son texte, c'est tout son dessin. Au moment précis du geste
irréversible, le bouton **perd la moitié de sa largeur et devient gris** : cela
se lit « ça a raté », pas « ça part ».

**Ce que je propose :** la capsule garde la largeur qu'elle avait pendant
l'attente. Fait dans cet écran, sans toucher au composant partagé — un réglage
d'apparence ajouté à `PrimaryButton` rouvrirait « une seule forme d'action »,
qui est le sujet même de ce fichier.

### 6 — « Envoyer le devis » n'est jamais à l'écran

**Verdict : défaut réel, mesuré.**

| état | hauteur de la feuille | écran |
|---|---|---|
| préparation | 292 px | 584 px |
| une journée ordinaire | **882 px** | 584 px |
| une journée chargée | **1 407 px** | 584 px |

En arrivant il voit le titre, la durée, deux tiers du calendrier. Le bouton
d'envoi est **un écran et demi plus bas**. Et pendant « Préparation… » il est
visible — puis **descend de six cents pixels d'un coup** quand le planning
arrive : le doigt tombe sur le calendrier.

**Ce que je propose :** le pied de la feuille — « Envoyer le devis » et
« Annuler » — **reste en bas**, le contenu défile au-dessus. Un seul changement,
et il règle les deux : le bouton est toujours là, et il ne bouge plus sous le
pouce. Le calendrier, la fiche du jour et les règles ne sont pas touchés.

### 7 — Deux redites dans la fiche du jour

**Verdict : réel, et petit.**

- Une **pastille verte pleine contenant un tiret**, deux fois par chantier, dès
  qu'aucune équipe n'est posée — ce qui est le cas par défaut d'un chantier
  créé puis daté. Un aplat de 100 × 36 px qui ne dit rien.
- « Ce jour est proposé à votre client. » **collé au mot « proposé »** qui dit
  déjà exactement cela. La phrase et le mot ont chacun leur raison (25 août),
  mais ensemble ils se répètent.

**Ce que je propose :** le tiret cède la place à « équipe non posée » en texte,
et quand le jour est déjà retenu la ligne dit ce qu'elle sait — ce qui reste —
plutôt que de redire le badge. **Le dessin validé le 22 août ne bouge pas.**

---

## Ce que je ne touche pas

- **Le calendrier reste celui du planning** — même composant (`MoisCharge`),
  même calcul de charge (`useOccupation`). Aucun second calendrier.
- **Le serveur garde le dernier mot** : l'aller-retour de `verifierJourPropose`
  reste. Le retirer rendrait le geste plus joli et moins sûr.
- **Deux dates au maximum**, et l'interrupteur reste ouvert par défaut.
- **Les trois phrases retirées le 26 août ne reviennent pas.**
- **Les repères `data-atlas`** (`invite-dates`, `reste-equipes`,
  `journee-regardee`, `verdict-du-jour`, `jour-propose`) sont conservés : les
  suites visent le repère, jamais le mot.

## Ce que je refuse

**Sortir la durée de la feuille, ou la passer après le calendrier.** C'est elle
qui décide quels jours sont proposables : après, elle arriverait trop tard. La
seule chose qui se discute est de la **replier** quand elle n'a pas été touchée
— c'est le point 8 de la planche, et c'est la seule question que je lui pose.

## Ce qui reste ouvert, et qui peut le trancher

| | qui |
|---|---|
| **Le point 8** — durée dépliée (A) ou repliée (B) | **lui** |
| Le jeton `muted` sous 4,5 sur six chartes, dans toute l'application | **lui** — c'est un changement d'identité, pas un correctif d'écran |
| Le bouton principal **éteint** écrit en `muted` sur `line` : illisible partout, sur les dix-sept écrans qui l'emploient | **lui** — `PrimaryButton` est partagé |
| `docs/maquettes/index.html` porte un bloc `<span class="quoi">` **orphelin** après la planche 91, vestige d'une fusion : il s'affiche comme du texte nu dans la liste | à corriger, hors de ce lot |

---

## Ce qui a été joué

**Aucune ligne de `src/` n'est touchée à ce stade** — la règle de la maison est
la maquette d'abord (`CLAUDE.md` §3 bis). Ont été joués :

| | |
|---|---|
| `npx tsc --noEmit` | **vert** |
| `npm run lint` | **vert** — 0 erreur, 16 avertissements, tous antérieurs |
| `npm run verifier:memoire` | **vert** — 8 fichiers, 3 rappels armés |
| `scripts/verifier-maquette-feuille-qui-envoie.mts` | **vert**, et **vu rouge** deux fois |

**La batterie complète n'a pas été jouée, et c'est délibéré :** ce lot ne touche
ni `src/`, ni les suites, ni une migration. Elle sera jouée **avant que le code
parte**, comme le veut `CLAUDE.md` §5.

**Le contrôle de la planche sait échouer**, et il a servi : à sa première
exécution il a attrapé **une erreur réelle dans ma propre planche** — j'y
annonçais « 2,85 à 3,86 » alors que 3,86 est la mesure du gris sur la *plage*,
pas sur le *fond de page* ; la vraie fourchette est **2,85 à 3,59**. Corrigé.
Il recalcule aussi les couleurs de la planche depuis `chartes.ts` et refuse le
moindre écart, pour qu'un jeton retouché demain ne laisse pas la planche
affirmer une mesure périmée.

# Le détail sous la ligne du devis

Ta question du 3 novembre, devant ton devis du frêne : *« j'ai parlé de rétention, de suppression de bois mort, d'allègement, de rétention de grosses charpentières allant vers le voisin. Pourquoi tout ça n'a pas été écrit dans la ligne élagage d'un frêne ? »*

Ta planche : https://florianmarrins0978-svg.github.io/Atlas-app/soignee/devis-detail-ligne.html

## Pourquoi ça n'arrivait pas

La ligne du devis prend le nom de ton tarif. Ce que tu disais de la façon de faire, la dictée le lisait, puis l'oubliait à l'enregistrement : rien ne le gardait, et la ligne n'en recevait jamais rien.

## Ce qui est codé, point par point

| Ton choix | Fait | Où |
|---|---|---|
| Le détail sous la ligne | la dictée rend la façon de faire en une phrase, gardée sur le travail, et la ligne la reçoit sous son nom | `src/lib/detail-de-la-ligne.ts`, `src/server/chiffrage/appliquer-proposition.ts` |
| Tes mots, légèrement embellis | la consigne au modèle retire les « euh », les « mais » et les mots inutiles, et n'ajoute rien que tu n'as pas dit | `src/server/ai/services/extraction-service.ts` |
| Le nom et le détail, un seul texte | c'est le même champ, sur plusieurs lignes | le devis, `DevisCompletClient.tsx` |
| Effacer devant le détail le remonte, avec un espace | oui, au téléphone comme à l'ordinateur | `apresEffacement`, `ChampsDuDevis.tsx` |
| Entrée le renvoie dessous | oui | le même champ |
| Tout en noir, même taille, sur le PDF | oui, le PDF imprime le texte comme tu l'as écrit | `src/server/pdf/document-commun.ts` (déjà prêt) |
| Pas de mention « Repris de ta dictée » | aucune | |

## Fait autrement, et pourquoi

- **L'espace se remet en lisant le résultat, pas la touche.** Sur Android, la touche effacer du clavier arrive souvent sans nom : on ne peut pas la reconnaître avant qu'elle agisse. Atlas regarde donc ce qui vient de partir : si c'est un retour à la ligne entre deux mots, il remet l'espace.
- **Pas de seconde case pour le détail.** Tu voulais un seul texte ; le champ de la ligne savait déjà tenir plusieurs lignes, et le PDF les imprimer.

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Règle sans base (`test-detail-de-la-ligne.ts`) | vert, vue rouge d'abord |
| En base, de la dictée à la ligne (`test-detail-de-la-ligne-db.ts`) | 5 / 5, trois cas rouges sur l'ancien code |
| Navigateur, ton geste sur le vrai devis (`test-detail-sous-la-ligne-e2e.ts`) | 3 / 3 |
| Suites voisines (dictée, prix dicté, main d'œuvre, doublons, PDF du devis) | vertes |
| PDF regardé | le nom, puis le détail dessous, en noir |
| **Batterie entière** | jouée le 4 novembre avec les trois autres lots, rien de rouge venu de ce lot |

## Ce qui reste

| | Qui |
|---|---|
| ~~La batterie, puis `main`~~ | faite le 4 novembre, par la batterie commune des quatre lots (`docs/batterie-commune-4-novembre.md`) |
| Tes chantiers déjà dictés n'ont pas de détail : il ne s'est jamais gardé. Il s'écrit à la main dans la ligne, ou en redictant | rien à faire |
| La phrase rédigée par le modèle ne s'éprouve pas ici (pas de clé) : à regarder sur ton espace, à ta prochaine dictée | toi |

# Tes deux blocages de ce matin — c'est réparé

*31 août 2026*

---

## 1. « J'ai mis les prix, il ne veut quand même pas »

**Tu avais raison, et le problème était pire que ce que tu voyais : il n'y avait
aucune sortie.** Aucun geste, sur aucun écran, ne pouvait rouvrir cet envoi.

### Ce qui se passait

Quand une ligne arrive sans prix (dictée, ou tarif introuvable), elle porte une
marque « à chiffrer ». Cette marque devait s'effacer dès que tu posais un prix.

Elle s'effaçait **sur un seul des deux écrans** :

| Où tu tapes le prix | Avant | Maintenant |
|---|---|---|
| écran **Prix** | la marque partait | inchangé |
| écran **du devis** (celui de ta capture) | **la marque restait** | elle part |

Sur l'écran du devis tu tapes une quantité et un prix unitaire ; le montant est
calculé ensuite. Le contrôle regardait ce que tu tapais au lieu de regarder le
montant obtenu.

**Et rien ne te le montrait :** le total était juste (2 280,00 €), l'étiquette
« à chiffrer » avait disparu de l'écran, et seul l'envoi savait encore.

### Ce qui change pour toi

Tu poses un prix, où que ce soit, et le devis part. Rien d'autre à faire.

**Au passage**, la phrase du refus était mal accordée sur ta capture — « 2 lignes
attendent **son** prix », « Posez-**le** ». Elle était écrite à deux endroits
différents dans le code, et les deux versions avaient divergé. Il n'y en a plus
qu'une.

---

## 2. « Si l'utilisateur veut choisir le 1er septembre il doit pouvoir ! »

**Fait.** Tu peux proposer demain, et même aujourd'hui.

C'est exactement l'arbitrage que tu avais déjà rendu le 23 août pour les
journées pleines : *« si l'utilisateur juge qu'il peut rajouter un chantier, il
doit pouvoir le faire quand même ; nous on prévient juste »*.

### Ce qui reste, et pourquoi

| | |
|---|---|
| ce qu'**Atlas te propose** tout seul | toujours à partir d'après-demain — il ne te met pas demain sous le doigt sans que tu l'aies demandé |
| ce que **tu choisis** au calendrier | dès aujourd'hui, avec une remarque : *« c'est dans moins de deux jours — votre client aura peu de temps pour répondre »* |
| un jour **déjà passé** | refusé, et là il n'y a pas de choix : ton client lira ce devis demain au plus tôt |

La remarque s'ajoute aux autres au lieu de les remplacer : si demain est un
samedi, ou si ta journée est déjà pleine, il te dit les deux.

### Ce qu'on a trouvé en le faisant, et que tu n'aurais vu que trop tard

Te laisser choisir demain ne suffisait pas. **La page de ton client, elle,
n'acceptait pas les dates à moins de deux jours.** Il aurait reçu ton devis,
cliqué sur la date que tu venais de lui proposer, et lu « date indisponible ».

Ton écran aurait dit oui, sa page non, et le devis se serait perdu là — sans que
ni toi ni lui puissiez comprendre. C'est corrigé dans le même lot, et éprouvé de
bout en bout : envoi, ouverture du lien, acceptation, chantier posé au planning.

---

## Ce qui a été vérifié

- Les trois contrôles neufs ont été **essayés contre l'ancienne version** : ils
  rougissent dessus, en nommant le défaut. Un contrôle qui n'a jamais échoué ne
  prouve rien.
- Deux anciens contrôles exigeaient exactement ce que tu viens de faire changer
  (« demain ne doit pas partir chez le client »). Ils ont été retournés, pas
  contournés.
- Batterie complète avant livraison.

## Ce qui reste ouvert

- **Le délai de deux jours n'est réglable nulle part** — il est écrit dans le
  code. Si tu veux un jour pouvoir le changer depuis Réglages (par entreprise),
  c'est à toi de le dire : ce n'est pas fait, et ça ne bloque rien aujourd'hui.

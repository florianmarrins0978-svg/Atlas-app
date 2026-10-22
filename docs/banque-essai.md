# Relier votre banque : l'essai

*Votre demande du 22 octobre 2026 : « est-ce qu'on peut faire un test déjà
avec ma banque à moi pour que je voie comment ça fonctionne ? »*

## Ce que l'essai montre

L'écran **Réglages › Ma banque** de votre espace :

1. vous choisissez votre banque dans la liste ;
2. Atlas vous envoie sur le site du Crédit Mutuel, vous vous connectez comme
   d'habitude et vous validez dans l'appli de la banque ;
3. vous revenez dans Atlas, qui affiche vos virements reçus des 30 derniers
   jours, et pour chacun la facture en attente qu'il proposerait.

**Rien n'est noté au relevé de TVA.** L'essai lit, il n'écrit rien. La carte
sur l'accueil et le « Oui » viendront quand le prestataire sera choisi.

## Pourquoi il faut un compte Enable Banking, et seulement pour vous

Personne ne se branche directement à une banque : la loi oblige à passer par
un prestataire agréé. Enable Banking laisse **le propriétaire d'une
application** relier ses propres comptes, gratuitement, pour essayer.

| | |
|---|---|
| **vous, pour l'essai** | un compte Enable Banking, parce que vous êtes le propriétaire d'Atlas |
| **vos futurs clients** | **aucun compte**. Ils touchent « Relier ma banque », choisissent la leur, se connectent chez elle. C'est tout |

Pour ouvrir Atlas à vos clients, il faudra un contrat, avec Enable Banking ou
un autre (`docs/A-FAIRE.md` §13).

## Les trois gestes, depuis un ordinateur

Un ordinateur plutôt que le téléphone : Enable Banking vous fait télécharger un
fichier, qu'il faut ensuite déposer dans votre espace.

### 1. Créer l'application chez Enable Banking

- Allez sur **enablebanking.com**, « Sign in », tapez votre e-mail, ouvrez le
  lien reçu.
- « Applications », puis **« Add a new application »**.
- Environnement : **Production**.
- Nom : **Atlas**. C'est ce que votre banque affichera.
- Adresse de retour (« Redirect URL ») : celle qu'affiche l'écran
  **Réglages › Ma banque** de votre espace, à recopier telle quelle. Pour votre
  espace actuel :
  `https://reimagined-space-yodel-jr4j6wwg6vjg34rv-3000.app.github.dev/api/banque/retour`
- « Register ». Votre navigateur télécharge un fichier qui finit par **.pem**.
  **Ne l'envoyez à personne** : c'est la clé de l'application.

### 2. Relier votre compte chez Enable Banking

Dans la fiche de l'application, **« Activate by linking accounts »** :
choisissez **Crédit Mutuel**, connectez-vous, cochez votre compte pro.

**C'est ici qu'on saura si le Crédit Mutuel est couvert.** S'il n'est pas dans
la liste, on s'arrête : rien n'a été payé ni branché.

### 3. Déposer la clé dans votre espace

- Ouvrez votre espace dans le navigateur.
- Dans la colonne des fichiers, à la racine, créez un dossier
  **`cles-banque`**.
- Glissez-y le fichier **.pem** téléchargé à l'étape 1.

Il ne part jamais sur GitHub : ce type de fichier est exclu.

Puis ouvrez **Réglages › Ma banque** (l'adresse : `/reglages/banque`),
choisissez Crédit Mutuel, et touchez **« Relier ma banque »**.

Vous vous connectez donc **deux fois** au Crédit Mutuel pendant l'essai : une
fois chez Enable Banking (geste 2), une fois depuis Atlas. C'est leur règle.
Vos clients, eux, ne le feront qu'une fois.

## Si ça bloque

| Ce que l'écran dit | Ce que ça veut dire |
|---|---|
| « Aucun fichier .pem… » | le geste 3 n'est pas fait, ou le dossier n'a pas le bon nom |
| « Enable Banking a refusé (403). Application does not exist » | le fichier .pem n'est pas celui de l'application créée au geste 1 |
| « …redirect… » dans le refus | l'adresse de retour du geste 1 ne correspond pas à votre espace |
| « Annulé sur le site de la banque » | vous avez annulé chez la banque, rien n'est cassé |

## Ce qui a été vérifié, et ce qui ne l'a pas été

| | |
|---|---|
| la règle qui propose une facture | 9 contrôles, dont ceux qui doivent se taire (un acompte sans nom, une facture émise après le virement) ; ils rougissent quand on casse la règle |
| seul le patron atteint l'écran et le retour | contrôlé pour les quatre rôles |
| **l'échange avec Enable Banking et le Crédit Mutuel** | **pas vérifiable ici** : il faut votre clé et votre connexion à la banque. C'est l'essai lui-même qui le dira |

## Corrigé depuis le 14 août

On vous avait dit que la banque coupe l'accès **tous les 90 jours**. C'était
l'ancienne règle européenne : **c'est 180 jours depuis le 25 juillet 2023**.
L'essai demande 90 jours, la valeur que toutes les banques acceptent.

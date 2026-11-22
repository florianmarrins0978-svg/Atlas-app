# L'éclairage d'ambiance de la nourrice en 3D

`studio.exr` est une image à grande dynamique (HDRI) d'un studio photo, qui éclaire
`appli/arrosage-nourrice-3d.html` (`appli/nourrice-3d/scene.js`).

| | |
|---|---|
| D'où elle vient | le paquet npm `@pmndrs/assets`, version 1.7.0, fichier `hdri/studio.exr` : une sélection des HDRI de Poly Haven, ramenées à 512 x 256 et compressées en EXR (DWAB) |
| Sa licence | CC0 1.0, domaine public : aucune mention n'est exigée, elle est donnée ici pour qu'on sache d'où vient le fichier |
| Pourquoi par npm | le réseau du poste de développement refuse polyhaven.com ; le registre npm, lui, répond |
| Sa taille | 111 ko, tel que le paquet le livre, sans retouche |

Si elle ne se charge pas, la scène garde la pièce éclairée que three calcule
(`RoomEnvironment`) : la nourrice reste visible, les reflets sont seulement moins fins.

/* =======================================================================
   L'HORLOGE DU TOURNAGE : le serveur de l'appli croit qu'on est un autre
   jour (celui du récit), sans toucher à l'horloge du poste.

   Chargée avant tout le reste par NODE_OPTIONS=--require (serveur.sh le
   fait). ATLAS_TOURNAGE_ECART_MS dit de combien de millisecondes décaler
   « maintenant » ; sans elle, ce fichier ne fait rien.

   Le piège, payé le 19 novembre 2026 : une classe qui étend Date ne suffit
   pas. Next.js enveloppe Date et ne recopie que ses propriétés PROPRES :
   Date.parse et Date.UTC, héritées, disparaissaient (« Date.parse is not a
   function », deux écrans par terre). C'est donc une fonction, qui porte
   elle-même tout ce que Date porte.

   La base, elle, garde l'heure du poste : ce qu'elle horodate seule (now())
   est ramené du même écart par le script qui tourne (voir tourner-fiche.mjs).
   ======================================================================= */
const ecart = Number(process.env.ATLAS_TOURNAGE_ECART_MS || 0);
if (ecart) {
  const Vraie = Date;
  function DuTournage(...a) {
    if (!new.target) return new Vraie(Vraie.now() + ecart).toString();
    return Reflect.construct(Vraie, a.length === 0 ? [Vraie.now() + ecart] : a, new.target);
  }
  for (const k of Object.getOwnPropertyNames(Vraie)) {
    if (k !== 'length' && k !== 'name' && k !== 'prototype') Object.defineProperty(DuTournage, k, Object.getOwnPropertyDescriptor(Vraie, k));
  }
  DuTournage.prototype = Vraie.prototype;
  DuTournage.now = () => Vraie.now() + ecart;
  Vraie.prototype.constructor = DuTournage;
  globalThis.Date = DuTournage;
}

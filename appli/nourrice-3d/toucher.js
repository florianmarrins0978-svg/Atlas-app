// LE TOUCHER QUI ÉCLATE, commun à la nourrice (nourrice-3d/vue.js) et à la pile du robinet
// (robinet-3d/vue.js) : sorti de la nourrice le 23 novembre 2026, quand la pile est entrée dans l'appli,
// pour qu'il n'en existe qu'un (CLAUDE.md §3).
//
// Un doigt posé puis levé sans bouger (moins de 6 px, moins de 300 ms), sur une pièce (`S.touche`) :
// `basculer()` est appelé, qui éclate ou remonte. Tout le reste (glisser, pincer, appuyer longtemps)
// appartient à la vue. Au clavier, Entrée ou Espace sur la vue font le même geste.
//
// Rend la fonction qui le débranche.

export function brancherToucher(toile, S, basculer) {
  var doigt = null, doigts = 0;
  function poser(e) {
    doigts++;
    doigt = doigts === 1 && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() } : null;
  }
  function glisser(e) {
    if (doigt && e.pointerId === doigt.id && Math.hypot(e.clientX - doigt.x, e.clientY - doigt.y) >= 6) doigt = null;
  }
  function lever(e) {
    doigts = Math.max(0, doigts - 1);
    var d = doigt; if (!d || e.pointerId !== d.id) return;
    doigt = null;
    if (e.type !== "pointerup") return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && performance.now() - d.t < 300 && S.touche(e.clientX, e.clientY)) basculer();
  }
  function clavier(e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); basculer(); } }
  toile.addEventListener("pointerdown", poser);
  toile.addEventListener("pointermove", glisser);
  toile.addEventListener("pointerup", lever);
  toile.addEventListener("pointercancel", lever);
  toile.addEventListener("keydown", clavier);
  return function debrancher() {
    toile.removeEventListener("pointerdown", poser);
    toile.removeEventListener("pointermove", glisser);
    toile.removeEventListener("pointerup", lever);
    toile.removeEventListener("pointercancel", lever);
    toile.removeEventListener("keydown", clavier);
  };
}

/**
 * LA PAGE DU SITE PILOTE LE TÉLÉPHONE, SANS RIEN DESSINER DESSUS.
 *
 * Ses retours passés l'interdisent : ni doigt, ni pastille, ni anneau sur un
 * écran de l'appli. Les étapes du guide, à côté du téléphone, envoient donc
 * deux ordres seulement : amener une partie de l'écran sous les yeux, et la
 * toucher. C'est l'appli elle-même qui répond, comme sous un vrai doigt.
 *
 *   { aller: "<sélecteur>", rang?: n }    fait défiler jusqu'à l'élément
 *   { toucher: "<sélecteur>", rang?: n }  le fait défiler, puis le touche
 *   { basculer: "<sélecteur>" }           touche, dans le groupe, la case
 *                                         qui n'est pas choisie (25 ou 32)
 *
 * Une feuille ouverte par le geste d'avant se referme d'abord, par son propre
 * bouton (« Garder », « Fermer ») : on ne touche jamais l'écran à côté.
 *
 * La page apprend en retour que l'écran est prêt ({ pret: true }).
 */
type Ordre = { aller?: string; toucher?: string; basculer?: string; rang?: number; texte?: string };

function fermerLesFeuilles(): boolean {
  let ferme = false;
  for (let i = 0; i < 3; i++) {
    const feuilles = document.querySelectorAll('[role="dialog"]');
    const derniere = feuilles[feuilles.length - 1];
    if (!derniere) break;
    const bouton = Array.from(derniere.querySelectorAll("button")).find((b) => /^(Garder|Fermer)$/.test(b.textContent?.trim() ?? ""));
    if (!bouton) break;
    bouton.click();
    ferme = true;
  }
  return ferme;
}

function trouver(selecteur: string, rang = 0, texte?: string): HTMLElement | null {
  let liste = Array.from(document.querySelectorAll<HTMLElement>(selecteur));
  if (texte) liste = liste.filter((el) => el.textContent?.trim() === texte);
  return liste[rang] ?? null;
}

export function ecouterLaPage(pret: string) {
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    const o = e.data as Ordre;
    const cible = o.aller ?? o.toucher ?? o.basculer;
    if (!cible) return;
    const attente = fermerLesFeuilles() ? 380 : 0;
    setTimeout(() => {
      let el = trouver(cible, o.rang ?? 0, o.texte);
      if (el && o.basculer) el = el.querySelector<HTMLElement>('button[aria-pressed="false"]');
      if (!el) return;
      // Le défilement de l'écran du téléphone, et lui seul : scrollIntoView
      // fait aussi défiler la page du site qui le porte, et le téléphone
      // sortait de la vue au moment où l'appli répondait.
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, r.top + window.scrollY - (window.innerHeight - r.height) / 2), behavior: "smooth" });
      if (o.toucher || o.basculer) setTimeout(() => el!.click(), 650);
    }, attente);
  });
  const annoncer = () => {
    if (document.querySelector(pret)) window.parent.postMessage({ pret: true }, "*");
    else requestAnimationFrame(annoncer);
  };
  annoncer();
}

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
 *     (texte : l'élément dont c'est le texte exact ; contient : un morceau)
 *   { basculer: "<sélecteur>" }           touche, dans le groupe, la case
 *                                         qui n'est pas choisie (25 ou 32)
 *   { deposer: "<sélecteur>", fichier, nom }  pose une photo dans le champ
 *                                         de fichier, comme si on l'avait
 *                                         prise : l'écran fait la suite
 *   { revenir: "<chemin>", siAilleurs? }  rouvre un écran de l'outil (s'il
 *                                         n'est pas déjà ouvert, avec siAilleurs)
 *   { ouvrir: "<details>", aller? }       déplie un tiroir de l'écran, puis
 *                                         amène sous les yeux ce qu'on vise
 *
 * Une feuille ouverte par le geste d'avant se referme d'abord, par son propre
 * bouton (« Garder », « Fermer ») : on ne touche jamais l'écran à côté. Sauf
 * avec « garder », quand le geste se fait DANS cette feuille.
 *
 * La page apprend en retour que l'écran est prêt ({ pret: true }).
 */
import { cheminCourant, naviguer } from "./routeur";

type Ordre = { aller?: string; toucher?: string; basculer?: string; deposer?: string; fichier?: string; nom?: string; revenir?: string; siAilleurs?: boolean; ouvrir?: string; rang?: number; texte?: string; contient?: string; garder?: boolean };

async function deposer(champ: HTMLInputElement, url: string, nom: string) {
  const reponse = await fetch(url);
  if (!reponse.ok) return;
  const fichier = new File([await reponse.blob()], nom, { type: "image/jpeg" });
  const lot = new DataTransfer();
  lot.items.add(fichier);
  champ.files = lot.files;
  champ.dispatchEvent(new Event("change", { bubbles: true }));
}

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

// Le défilement de l'écran du téléphone, et lui seul : scrollIntoView fait
// aussi défiler la page du site qui le porte, et le téléphone sortait de la
// vue au moment où l'appli répondait. Un élément plus haut que l'écran se
// montre par son haut.
function viser(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const marge = r.height > window.innerHeight * 0.8 ? 90 : (window.innerHeight - r.height) / 2;
  window.scrollTo({ top: Math.max(0, r.top + window.scrollY - marge), behavior: "smooth" });
}

function trouver(selecteur: string, rang = 0, texte?: string, contient?: string): HTMLElement | null {
  let liste = Array.from(document.querySelectorAll<HTMLElement>(selecteur));
  if (texte) liste = liste.filter((el) => el.textContent?.trim() === texte);
  if (contient) liste = liste.filter((el) => el.textContent?.includes(contient));
  return liste[rang] ?? null;
}

export function ecouterLaPage(pret: string) {
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    const o = e.data as Ordre;
    if (o.revenir) {
      fermerLesFeuilles();
      if (!o.siAilleurs || cheminCourant() !== o.revenir) naviguer(o.revenir);
      return;
    }
    if (o.ouvrir) {
      const tiroir = document.querySelector<HTMLDetailsElement>(o.ouvrir);
      if (tiroir) tiroir.open = true;
      if (!o.aller) {
        if (tiroir) viser(tiroir);
        return;
      }
    }
    if (o.deposer && o.fichier) {
      const champ = document.querySelector<HTMLInputElement>(o.deposer);
      if (champ) void deposer(champ, o.fichier, o.nom ?? "photo.jpg");
      return;
    }
    const cible = o.aller ?? o.toucher ?? o.basculer;
    if (!cible) return;
    // « garder » : le geste vise la feuille que le geste d'avant a ouverte
    // (choisir un client dans « Pour qui ? »).
    const attente = !o.garder && fermerLesFeuilles() ? 380 : 0;
    setTimeout(() => {
      let el = trouver(cible, o.rang ?? 0, o.texte, o.contient);
      if (el && o.basculer) el = el.querySelector<HTMLElement>('button[aria-pressed="false"]');
      if (!el) return;
      viser(el);
      if (o.toucher || o.basculer) setTimeout(() => el!.click(), 650);
    }, attente);
  });
  const annoncer = () => {
    if (document.querySelector(pret)) window.parent.postMessage({ pret: true }, "*");
    else requestAnimationFrame(annoncer);
  };
  annoncer();
}

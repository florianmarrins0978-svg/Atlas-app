/**
 * LES ÉCRANS DE L'APPLI, ENCHAÎNÉS SANS SERVEUR.
 *
 * Un outil a parfois plusieurs écrans (la photo, puis le résultat du
 * diagnostic ; la liste des fiches, puis la fiche). Dans l'appli, Next.js
 * les sert un par un ; ici, ce petit routeur les montre au même endroit,
 * quand l'écran fait `router.push` ou qu'on touche un lien qu'il connaît.
 *
 * **Les écrans « serveur » sont rendus ici, pas réécrits.** Un écran de
 * l'appli peut être une fonction `async` qui lit la base (src/server/,
 * remplacé par bouchons/ dans la démonstration) : React ne sait pas les
 * dessiner dans un navigateur. On les appelle donc nous-mêmes, comme le
 * serveur le ferait, jusqu'à n'avoir plus que des composants ordinaires,
 * qui se dessinent tels quels.
 */
import { Fragment, cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";

type Route = { motif: RegExp; ecran: (m: RegExpMatchArray) => ReactNode };

let chemin = "/paysage/arrosage";
let connues: Route[] = [];
const ecouteurs = new Set<(c: string) => void>();

export const cheminCourant = () => chemin;
export const connait = (c: string) => connues.some((r) => r.motif.test(c));
export function naviguer(c: string) {
  chemin = c;
  ecouteurs.forEach((f) => f(c));
}

const FonctionAsync = Object.getPrototypeOf(async function () {}).constructor;

async function resoudre(n: ReactNode): Promise<ReactNode> {
  if (Array.isArray(n)) return Promise.all(n.map(resoudre));
  if (!isValidElement(n)) return n;
  const el = n as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function" && el.type instanceof FonctionAsync) {
    return resoudre(await (el.type as (p: unknown) => Promise<ReactNode>)(el.props));
  }
  if (el.props && el.props.children !== undefined) return cloneElement(el, { children: await resoudre(el.props.children) });
  return el;
}

export function Routeur({ routes, depart, cadre }: { routes: Route[]; depart: string; cadre: (vue: ReactNode) => ReactNode }) {
  const [vue, setVue] = useState<{ chemin: string; contenu: ReactNode } | null>(null);
  useEffect(() => {
    connues = routes;
    const montrer = async (c: string) => {
      const r = routes.find((x) => x.motif.test(c));
      if (!r) return;
      const contenu = await resoudre(r.ecran(c.match(r.motif)!));
      setVue((avant) => {
        if (avant?.chemin !== c) window.scrollTo(0, 0);
        return { chemin: c, contenu };
      });
    };
    ecouteurs.add(montrer);
    naviguer(depart);
    return () => {
      ecouteurs.delete(montrer);
    };
  }, [routes, depart]);
  // Une autre adresse, un autre écran : ses états repartent de zéro, comme
  // dans l'appli quand on change de page.
  return <>{cadre(vue ? <Fragment key={vue.chemin}>{vue.contenu}</Fragment> : null)}</>;
}

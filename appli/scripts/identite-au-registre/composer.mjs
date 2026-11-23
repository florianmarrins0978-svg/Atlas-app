// Compose la planche « L'identité attachée au SIRET » sur le VRAI écran Mon
// entreprise figé par figer.mjs. Seul ce qui est proposé s'y ajoute. Usage :
//   node appli/scripts/identite-au-registre/composer.mjs <dossier de figer.mjs> <sortie.html>
//
// Sa remarque du 23 novembre 2026 : « s'il utilise le SIRET d'un autre, après,
// dans ses réglages, il peut tout modifier, le nom de la boîte… ça le bloque
// sans le bloquer ». La réponse proposée (`TODO.md`) : le nom de l'entreprise et
// l'adresse du siège viennent du registre, avec le SIRET, et ne se modifient
// plus à part ; pour les changer, on change de SIRET, revérifié au registre, et
// la règle du SIREN joue. Un nom commercial, libre, s'imprime EN PLUS. Ainsi
// le SIRET d'un autre ne donne que des devis au nom de cet autre.
import { readFileSync } from "node:fs";
import { composer } from "../../../scripts/planche-figee/composer.mjs";
import { enHauteurStable } from "../_hauteur-stable.mjs";

const [S, SORTIE] = process.argv.slice(2);
const ecran = JSON.parse(readFileSync(`${S}/identite.json`, "utf8"));
const corps = { ...ecran, html: enHauteurStable(ecran.html) };

const etats = [
  { nom: "verrou", etape: "verrou", corps },
  { nom: "changer", etape: "changer", corps },
  { nom: "change", etape: "change", corps },
];
const ETAPES = [
  { va: "verrou", mot: "Attachés au SIRET" },
  { va: "changer", mot: "Changer de SIRET" },
  { va: "change", mot: "Après" },
];

// Les mots proposés, et eux seuls. L'entreprise d'arrivée est inventée, comme
// son numéro ; son numéro de TVA est celui que l'appli en tire
// (`numeroTvaFrancais`, `src/lib/autoliquidation.ts`).
const MOTS = {
  auRegistre: "Au registre, avec votre SIRET.",
  verrouDit: "Il vient du registre des entreprises, avec le SIRET. Pour le changer, changez de SIRET.",
  commercial: { libelle: "Nom commercial", placeholder: "Facultatif, imprimé en plus" },
  changer: "Changer de SIRET",
  avant: { nom: "Atelier Démo", adresse: "10 rue des Artisans, Nantes", siret: "123 456 789 00012", siren: "123 456 789", tva: "FR12123456789" },
  apres: { nom: "Paysages Durand", adresse: "5 avenue des Tilleuls, 44000 Nantes", siret: "987 654 321 00018", siren: "987 654 321", tva: "FR05987654321" },
  registreLibelle: "Au registre des entreprises",
  prendre: "Prendre ce SIRET",
  prendreDit: "Le nom, l'adresse et le numéro de TVA suivent le registre. Si ce SIREN a déjà eu son essai, l'essai s'arrête ici.",
  annuler: "Annuler",
};

const retouches = (etat, d) => {
  const texte = (n) => (n.textContent || "").replace(/\s+/g, " ").trim();
  const ligne = (el, libelle) =>
    [...el.querySelectorAll("div.relative.py-3\\.5")].find((r) => {
      const l = r.querySelector("label, span.block");
      return l && texte(l) === libelle;
    });
  const sousLigne = (contenu) => {
    const p = document.createElement("p");
    p.className = "mt-1 text-[13.5px] leading-[1.4] ir-registre";
    p.textContent = contenu;
    return p;
  };
  const verrouiller = (row) => {
    const champ = row.querySelector("input");
    champ.setAttribute("readonly", "");
    champ.removeAttribute("role");
    // Le style de l'appli est posé sur le champ lui-même : la teinte de second
    // plan s'y écrit aussi, plutôt qu'une règle qui devrait l'écraser.
    champ.style.color = "var(--atlas-inkSoft, #4a4a44)";
    row.dataset.dit = d.mots.verrouDit;
    row.classList.add("ir-verrou");
    row.appendChild(sousLigne(d.mots.auRegistre));
  };

  for (const nom of ["verrou", "changer", "change"]) {
    const el = etat(nom);
    const nomLigne = ligne(el, "Nom de l'entreprise");
    const adresse = ligne(el, "Adresse du siège");
    const siret = ligne(el, "SIRET");
    verrouiller(nomLigne);
    verrouiller(adresse);
    // Le nom commercial : une ligne de plus, sous le nom, et la seule libre des trois.
    const commercial = nomLigne.cloneNode(true);
    commercial.classList.remove("ir-verrou");
    delete commercial.dataset.dit;
    commercial.querySelector(".ir-registre").remove();
    commercial.querySelector("label").textContent = d.mots.commercial.libelle;
    const champ = commercial.querySelector("input");
    champ.removeAttribute("readonly");
    champ.setAttribute("value", "");
    champ.setAttribute("placeholder", d.mots.commercial.placeholder);
    champ.id = `${champ.id}-commercial-${nom}`;
    commercial.querySelector("label").setAttribute("for", champ.id);
    nomLigne.after(commercial);
    // Le SIRET : fixe, avec la porte pour en changer.
    const champSiret = siret.querySelector("input");
    if (nom !== "changer") {
      champSiret.setAttribute("readonly", "");
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "ir-changer";
      bouton.dataset.va = "changer";
      bouton.textContent = d.mots.changer;
      siret.appendChild(bouton);
    }
  }

  // Changer de SIRET : le nouveau numéro tapé, et ce qu'en dit le registre.
  {
    const el = etat("changer");
    const siret = ligne(el, "SIRET");
    siret.querySelector("input").setAttribute("value", d.mots.apres.siret);
    siret.querySelector("p").textContent = `SIREN ${d.mots.apres.siren}, les neuf premiers chiffres.`;
    const carte = document.createElement("div");
    carte.className = "ir-carte";
    carte.dataset.atlas = "siret-au-registre";
    carte.innerHTML =
      `<p class="ir-carte-libelle">${d.mots.registreLibelle}</p>` +
      `<p class="ir-carte-nom">${d.mots.apres.nom}</p>` +
      `<p class="ir-carte-adresse">${d.mots.apres.adresse}</p>` +
      `<div class="ir-gestes"><button type="button" class="atlas-plein ir-prendre" data-va="change" data-dit="${d.mots.prendreDit}">${d.mots.prendre}</button>` +
      `<button type="button" class="ir-annuler" data-va="verrou">${d.mots.annuler}</button></div>`;
    siret.appendChild(carte);
  }

  // Après : le nom, l'adresse, le SIRET et la TVA ont suivi le registre, sur
  // l'écran et sur l'aperçu du papier. Le titulaire du compte, lui, ne bouge
  // pas : c'est un champ à lui.
  {
    const el = etat("change");
    const { avant, apres } = d.mots;
    const remplacer = (racine) => {
      const marche = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
      const noeuds = [];
      while (marche.nextNode()) noeuds.push(marche.currentNode);
      for (const n of noeuds) {
        let t = n.nodeValue;
        for (const k of ["siret", "tva", "adresse", "nom", "siren"]) t = t.split(avant[k]).join(apres[k]);
        n.nodeValue = t;
      }
      racine.querySelectorAll("input").forEach((i) => {
        const v = i.getAttribute("value") || "";
        let t = v;
        for (const k of ["siret", "tva", "adresse", "nom", "siren"]) t = t.split(avant[k]).join(apres[k]);
        if (t !== v) i.setAttribute("value", t);
      });
    };
    const sections = [...el.querySelectorAll("section")];
    const titre = (s) => texte(s.querySelector("h2") || s).toLowerCase();
    for (const s of sections) {
      const t = titre(s);
      if (t.startsWith("qui vous") || t.startsWith("sur vos papiers") || t.startsWith("votre tva")) remplacer(s);
    }
    // La carte d'en-tête, au-dessus des sections : le nom et l'adresse.
    const entete = [...el.querySelectorAll("div, a")].find((n) => texte(n).startsWith(`A${avant.nom}`) || texte(n) === `${avant.nom} ${avant.adresse}`);
    if (entete) {
      remplacer(entete);
      // L'initiale du rond suit le nom.
      [...entete.querySelectorAll("*")].filter((n) => n.children.length === 0 && texte(n) === avant.nom[0]).forEach((n) => (n.textContent = apres.nom[0]));
    }
  }
};

// « Changer de SIRET » s'ouvre là où l'on change : sur la case, pas en haut de
// l'écran, où la planche remonte à chaque étape.
const scriptEnPlus = `
(() => {
  const changer = document.querySelector('[data-planche="changer"]');
  new MutationObserver(() => {
    if (changer.hidden) return;
    setTimeout(() => changer.querySelector('[data-atlas="siret-au-registre"]').scrollIntoView({ block: "center" }), 30);
  }).observe(changer, { attributes: true, attributeFilter: ["hidden"] });
})();
`;

const css = enHauteurStable(readFileSync(`${S}/css.txt`, "utf8")) + `
.ir-verrou{cursor:default}
.ir-registre{color:var(--atlas-muted,#8a8578)}
.ir-changer{display:inline-flex;align-items:center;min-height:44px;margin-top:2px;padding:0;border:0;background:none;font:inherit;font-size:15px;font-weight:600;color:var(--atlas-or,#B98B47);cursor:pointer}
.ir-carte{margin-top:12px;padding:14px 14px 10px;border-radius:6px;background-color:color-mix(in srgb,var(--atlas-or,#B98B47) 9%,transparent)}
.ir-carte p{margin:0}
.ir-carte-libelle{font-size:13px;font-weight:600;color:var(--atlas-muted,#8a8578)}
.ir-carte .ir-carte-nom{margin-top:4px;font-family:var(--font-display);font-size:18px;line-height:1.3;color:var(--atlas-ink,#1c1c1a)}
.ir-carte .ir-carte-adresse{margin-top:2px;font-size:15px;line-height:1.45;color:var(--atlas-inkSoft,#4a4a44)}
.ir-gestes{display:flex;align-items:center;gap:8px;margin-top:12px}
.ir-prendre{display:inline-flex;align-items:center;min-height:48px;padding:0 20px;border:0;border-radius:999px;background-color:var(--atlas-plein,#7d9a6d);color:var(--atlas-card,#faf9f5);font:inherit;font-size:16px;font-weight:600;cursor:pointer}
.ir-annuler{min-height:48px;padding:0 12px;border:0;background:none;font:inherit;font-size:16px;font-weight:600;color:var(--atlas-inkSoft,#4a4a44);cursor:pointer}
`;

const taille = await composer({
  css,
  etats,
  etapes: ETAPES,
  titre: "L'identité attachée au SIRET",
  surtitre: "Planche, les vrais écrans",
  retouches,
  donnees: { mots: MOTS },
  scriptEnPlus,
  sortie: SORTIE,
});
console.log("écrit", SORTIE, taille);

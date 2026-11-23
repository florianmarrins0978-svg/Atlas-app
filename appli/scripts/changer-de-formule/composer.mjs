// Compose la planche « Changer de formule » sur le VRAI écran Abonnement, figé
// par `figer.mjs` à côté. Seul ce qui est proposé s'y ajoute : la feuille qui
// dit le montant avant de valider (la vraie feuille de l'écran, celle
// d'« Avant de partir », vidée et remplie), le refus de la carte, et l'état
// d'une descente prévue. Usage :
//   node appli/scripts/changer-de-formule/composer.mjs <dossier de figer.mjs> <sortie.html>
//
// Ses décisions du 23 novembre 2026, après avoir payé pour de vrai avec une clé
// de test (`TODO.md`, « CHANGER DE FORMULE ») :
//   · MONTER : le prix ENTIER de la nouvelle formule est débité le jour du
//     changement, qui devient la nouvelle échéance ; les jours restants de
//     l'ancienne ne sont pas remboursés ;
//   · DESCENDRE : rien n'est débité, la formule moins chère commence à
//     l'échéance ; jusque-là il garde celle qu'il a payée.
//
// **Les dates suivent SA règle, pas son exemple.** Son exemple disait
// « Prochain paiement le 23 janvier » ; abonné Artisan avec un prochain
// paiement le 23 décembre, sa période a commencé le 23 novembre, et le jour du
// changement devient l'échéance : changé aujourd'hui, le prochain paiement est
// le 23 décembre. C'est aussi ce que dit son texte de la descente
// (« Artisan à partir du 23 décembre », depuis Entreprise) : les deux moitiés
// de la planche s'enchaînent alors sans rien inventer.
import { readFileSync } from "node:fs";
import { composer } from "../../../scripts/planche-figee/composer.mjs";
import { enHauteurStable } from "../_hauteur-stable.mjs";

const [S, SORTIE] = process.argv.slice(2);
const lire = (nom) => {
  const c = JSON.parse(readFileSync(`${S}/${nom}.json`, "utf8"));
  return { ...c, html: enHauteurStable(c.html) };
};

const etats = [
  { nom: "artisan", etape: "artisan", corps: lire("artisan") },
  { nom: "monter", etape: "feuille-monter", corps: lire("monter") },
  { nom: "feuille-monter", etape: "feuille-monter", corps: lire("monter") },
  { nom: "monter-illimite", etape: "feuille-monter", corps: lire("monter-illimite") },
  { nom: "feuille-illimite", etape: "feuille-monter", corps: lire("monter-illimite") },
  { nom: "illimite", corps: lire("illimite") },
  { nom: "refusee", etape: "refusee", corps: lire("monter") },
  { nom: "entreprise", etape: "entreprise", corps: lire("entreprise") },
  { nom: "descendre", etape: "feuille-descendre", corps: lire("descendre") },
  { nom: "feuille-descendre", etape: "feuille-descendre", corps: lire("descendre") },
  { nom: "prevue", etape: "prevue", corps: lire("entreprise") },
  // Les deux donneurs : la vraie feuille et la vraie plage rouge de l'écran.
  // Ils prêtent leur DOM, puis disparaissent.
  { nom: "d-feuille", corps: lire("feuille-reelle") },
  { nom: "d-refus", corps: lire("refus-reel") },
];
const ETAPES = [
  { va: "artisan", mot: "Artisan" },
  { va: "feuille-monter", mot: "Monter" },
  { va: "refusee", mot: "Carte refusée" },
  { va: "entreprise", mot: "Entreprise" },
  { va: "feuille-descendre", mot: "Descendre" },
  { va: "prevue", mot: "Descente prévue" },
];

// Les mots proposés, et eux seuls : tout le reste est l'écran de l'appli.
// L'espace insécable tient le montant et son « € » sur la même ligne.
const N = " ";
// Sa demande du soir : « hésite pas à me faire quelque chose de plus joli ».
// La feuille se lit comme un relevé, deux rangs : ce qui part aujourd'hui, en
// gros chiffres à droite, comme les prix des cartes ; et l'échéance, dans le
// carré doré que l'écran donne déjà aux dates (`EtatDeLAbonnement`). Le
// montant d'aujourd'hui est à la même place dans les deux sens : à la
// descente, il vaut 0 €.
const ECHEANCE = { jour: "23", mois: "déc." };
const monter = (nom, ht, ttc, ancienne) => ({
  titre: `Passer à ${nom}`,
  aujourdhui: { libelle: "Débité aujourd’hui", chiffre: `${ht}${N}€`, unite: "HT", sous: `${ttc}${N}€ TTC` },
  echeance: { ...ECHEANCE, libelle: "Prochain paiement", sous: `${ht}${N}€ HT par mois` },
  note: `Les jours restants d’${ancienne} ne sont pas remboursés.`,
});
const MOTS = {
  feuilleEntreprise: monter("Entreprise", "59", "70,80", "Artisan"),
  feuilleIllimite: monter("Illimité", "159", "190,80", "Artisan"),
  descendre: {
    titre: "Passer à Artisan",
    aujourdhui: { libelle: "Débité aujourd’hui", chiffre: `0${N}€`, unite: "", sous: "" },
    echeance: { ...ECHEANCE, libelle: "Artisan commence", sous: `39${N}€ HT par mois` },
    note: "Jusque-là, vous gardez Entreprise.",
  },
  // Sa demande : « la formule ne change pas, et une ligne le dit ». Dans la
  // feuille, là où l'œil attend la réponse à « Confirmer », à la place que
  // l'appli donne déjà à un refus (« Avant de partir »).
  refus: "Carte refusée. Vous restez sur Artisan, rien n’est débité.",
  prevue: {
    detail: `Jusqu’au 23 décembre 2026, puis Artisan à 39${N}€ HT par mois.`,
    marque: "À partir du 23 décembre",
    // Une descente prévue se retire, comme une résiliation demandée (« Ne pas
    // arrêter ») : sans ce bouton, changer d'avis voudrait dire attendre le
    // 23 décembre pour remonter, et payer le prix entier.
    garder: "Garder Entreprise",
  },
};

const DIT = {
  confirmerEntreprise: `70,80${N}€ TTC débités. L’écran passe à Entreprise.`,
  confirmerIllimite: `190,80${N}€ TTC débités. L’écran passe à Illimité.`,
  confirmerDescente: `Rien n’est débité. Artisan est prévu au 23${N}décembre.`,
  garder: `Entreprise continue. Rien ne change au 23${N}décembre.`,
  changerDeCarte: "Dans l’appli : ouvre la page du prestataire pour changer de carte. Au retour, Confirmer se retente.",
  dejaChoisie: "Déjà choisie.",
  laSienne: "Votre formule.",
  dejaPrevue: `Déjà prévue au 23${N}décembre.`,
  illimiteDepuisEntreprise: `Dans l’appli : la même feuille qu’à la montée, 159${N}€ HT débités aujourd’hui (190,80${N}€ TTC).`,
  descenteArtisan: `Dans l’appli : la feuille de la descente, Artisan à partir du 23${N}décembre, rien n’est débité aujourd’hui.`,
  descenteEntreprise: `Dans l’appli : la feuille de la descente, Entreprise à partir du 23${N}décembre, rien n’est débité aujourd’hui.`,
  annee: "Dans l’appli : les prix passent à l’année. Changer de formule à l’année reste à décider.",
  mois: "Déjà au mois.",
  guichet: "Dans l’appli : ouvre la page du prestataire, pour changer de carte et retrouver vos factures Cause.",
  resilier: "Dans l’appli : ouvre « Avant de partir ».",
  retour: "Dans l’appli : revient aux Réglages.",
};

const retouches = (etat, d) => {
  const { MOTS, DIT } = d;
  const mot = (b) => (b.textContent || "").replace(/\s+/g, " ").trim();
  const carte = (el, code) => el.querySelector(`[data-atlas="formule-${code}"]`);

  // Les donneurs, lus puis retirés.
  const gabarit = etat("d-feuille").querySelector('[data-atlas="avant-de-partir"]').closest(".fixed");
  const plageRouge = etat("d-refus").querySelector('[role="alert"]');
  const boutonPlein = etat("monter").querySelector('[data-atlas="choisir-entreprise"]');
  const actionBas = boutonPlein.parentElement;
  const espaceBas = actionBas.previousElementSibling;

  // Ce qui répond pareil dans tous les états : l'en-tête, le guichet, Résilier,
  // le rythme.
  for (const nom of ["artisan", "monter", "monter-illimite", "illimite", "entreprise", "descendre", "prevue", "feuille-monter", "feuille-illimite", "refusee", "feuille-descendre"]) {
    const el = etat(nom);
    el.querySelectorAll('a[aria-label="Retour"]').forEach((a) => (a.dataset.dit = DIT.retour));
    el.querySelector('[data-atlas="guichet-abonnement"]').dataset.dit = DIT.guichet;
    el.querySelector('[data-atlas="resilier"]').dataset.dit = DIT.resilier;
    el.querySelectorAll("button").forEach((b) => {
      if (mot(b).startsWith("Au mois")) b.dataset.dit = DIT.mois;
      if (mot(b).startsWith("À l’année")) b.dataset.dit = DIT.annee;
    });
  }

  // Les cartes : ce que chacune fait, état par état.
  const cartes = (nom, gestes) => {
    for (const [code, geste] of Object.entries(gestes)) {
      const c = carte(etat(nom), code);
      if (geste.va) c.dataset.va = geste.va;
      if (geste.dit) c.dataset.dit = geste.dit;
    }
  };
  cartes("artisan", { artisan: { dit: DIT.laSienne }, entreprise: { va: "monter" }, illimite: { va: "monter-illimite" } });
  cartes("monter", { artisan: { va: "artisan" }, entreprise: { dit: DIT.dejaChoisie }, illimite: { va: "monter-illimite" } });
  cartes("monter-illimite", { artisan: { va: "artisan" }, entreprise: { va: "monter" }, illimite: { dit: DIT.dejaChoisie } });
  cartes("illimite", {
    artisan: { dit: DIT.descenteArtisan },
    entreprise: { dit: DIT.descenteEntreprise },
    illimite: { dit: DIT.laSienne },
  });
  cartes("entreprise", { artisan: { va: "descendre" }, entreprise: { dit: DIT.laSienne }, illimite: { dit: DIT.illimiteDepuisEntreprise } });
  cartes("descendre", { artisan: { dit: DIT.dejaChoisie }, entreprise: { va: "entreprise" }, illimite: { dit: DIT.illimiteDepuisEntreprise } });
  cartes("prevue", { artisan: { dit: DIT.dejaPrevue }, entreprise: { dit: DIT.laSienne }, illimite: { dit: DIT.illimiteDepuisEntreprise } });

  // Le bouton du bas ouvre la feuille, au lieu de changer la formule d'un coup.
  etat("monter").querySelector('[data-atlas="choisir-entreprise"]').dataset.va = "feuille-monter";
  etat("monter-illimite").querySelector('[data-atlas="choisir-illimite"]').dataset.va = "feuille-illimite";
  etat("descendre").querySelector('[data-atlas="choisir-artisan"]').dataset.va = "feuille-descendre";

  // Le carré d'une date, tel que l'écran le dessine pour une échéance
  // (`SigneDeLEtat`, doré quand tout va) : mêmes classes, mêmes teintes.
  const carre = (jour, mois) =>
    `<span aria-hidden="true" class="w-[52px] flex-none rounded-[10px] pb-[7px] pt-2 text-center leading-none" style="background-color:color-mix(in srgb, var(--atlas-or, #B98B47) 14%, transparent)">` +
    `<span class="block text-[24px] leading-none" style="font-family:var(--font-display);font-variant-numeric:lining-nums">${jour}</span>` +
    `<span class="mt-1 block text-[13px] font-bold" style="color:var(--atlas-or, #B98B47)">${mois}</span></span>`;

  // LA FEUILLE : celle de l'écran, vidée sous son titre, et posée là où l'appli
  // la pose (juste après Résilier).
  const feuille = (nom, m, { confirmer, annuler, refus }) => {
    const el = etat(nom);
    const o = gabarit.cloneNode(true);
    const dlg = o.querySelector('[role="dialog"]');
    dlg.setAttribute("aria-label", m.titre);
    dlg.dataset.atlas = "changer-de-formule";
    const h2 = dlg.querySelector("h2");
    h2.textContent = m.titre;
    const gestes = dlg.querySelector('[data-atlas="resilier-quand-meme"]').parentElement;
    [...dlg.children].filter((c) => c !== h2 && c !== gestes).forEach((c) => c.remove());

    const a = m.aujourdhui;
    const e = m.echeance;
    const releve = document.createElement("div");
    releve.className = "cf-releve";
    releve.dataset.atlas = "releve-du-changement";
    releve.innerHTML =
      `<div class="cf-rang"><span class="cf-libelle">${a.libelle}</span>` +
      `<span class="cf-valeur"><span><span class="cf-chiffre">${a.chiffre}</span>${a.unite ? `<span class="cf-unite">${a.unite}</span>` : ""}</span>` +
      `${a.sous ? `<span class="cf-ttc">${a.sous}</span>` : ""}</span></div>` +
      `<div class="cf-rang">${carre(e.jour, e.mois)}` +
      `<span class="cf-quand"><span class="cf-quand-titre">${e.libelle}</span><span class="cf-quand-sous">${e.sous}</span></span></div>`;
    // Refusée, la somme d'aujourd'hui se barre : c'est le trait que l'écran
    // donne déjà à ce qu'on n'a pas (les lignes manquantes des cartes).
    if (refus) releve.firstElementChild.classList.add("cf-refuse");
    h2.after(releve);
    const note = document.createElement("p");
    note.className = "cf-note";
    note.textContent = m.note;
    releve.after(note);
    const dernier = note;
    if (refus) {
      const r = plageRouge.cloneNode(true);
      r.className = "mt-4";
      r.firstElementChild.textContent = refus;
      dernier.after(r);
    }

    // « Confirmer » est le vrai bouton plein de l'écran ; « Annuler » celui
    // de la feuille.
    const vieux = gestes.querySelector('[data-atlas="resilier-quand-meme"]');
    const plein = boutonPlein.cloneNode(true);
    plein.dataset.atlas = refus ? "changer-de-carte" : "confirmer";
    plein.textContent = refus ? "Changer de carte" : "Confirmer";
    delete plein.dataset.va;
    if (confirmer.va) plein.dataset.va = confirmer.va;
    if (confirmer.dit) plein.dataset.dit = confirmer.dit;
    vieux.replaceWith(plein);
    const non = [...gestes.querySelectorAll("button")].find((b) => mot(b) === "Annuler");
    non.dataset.va = annuler;
    o.querySelector('button[aria-label="Refermer"]').dataset.va = annuler;

    el.querySelector('[data-atlas="resilier"]').parentElement.parentElement.after(o);
  };
  feuille("feuille-monter", MOTS.feuilleEntreprise, {
    confirmer: { va: "entreprise", dit: DIT.confirmerEntreprise },
    annuler: "monter",
  });
  feuille("feuille-illimite", MOTS.feuilleIllimite, {
    confirmer: { va: "illimite", dit: DIT.confirmerIllimite },
    annuler: "monter-illimite",
  });
  feuille("refusee", MOTS.feuilleEntreprise, {
    confirmer: { dit: DIT.changerDeCarte },
    annuler: "monter",
    refus: MOTS.refus,
  });
  feuille("feuille-descendre", MOTS.descendre, {
    confirmer: { va: "prevue", dit: DIT.confirmerDescente },
    annuler: "descendre",
  });

  // LA DESCENTE PRÉVUE : l'état dit les deux formules, la carte d'Artisan sa
  // date, et le bouton du bas la retire. Mêmes places que l'appli : la ligne
  // sous le titre, la marque là où vit « Votre formule », le bouton du bas.
  {
    const el = etat("prevue");
    const detail = el.querySelector('[data-atlas="etat-abonnement"] .min-w-0 > span:nth-child(2)');
    detail.textContent = MOTS.prevue.detail;
    // Le signe devient le carré de la date du changement, comme pour une
    // résiliation demandée, mais doré : rien ne demande un geste.
    const signe = el.querySelector('[data-atlas="etat-abonnement"] > span[aria-hidden]');
    signe.outerHTML = carre("23", "déc.");
    const votre = [...carte(el, "entreprise").querySelectorAll("p")].find((p) => mot(p) === "Votre formule");
    const marque = votre.cloneNode(true);
    const pastille = marque.firstElementChild;
    pastille.lastChild.textContent = MOTS.prevue.marque;
    pastille.classList.add("cf-prevue");
    pastille.removeAttribute("style");
    carte(el, "artisan").querySelector(".flex.items-center").after(marque);
    // Artisan n'est plus « la sienne » sur l'écran d'Entreprise : la marque
    // dorée ne prend pas le vert de « Votre formule ».
    const section = carte(el, "artisan").closest("section");
    const espace = espaceBas.cloneNode(true);
    const bas = actionBas.cloneNode(true);
    const garder = bas.querySelector("button");
    garder.dataset.atlas = "garder-entreprise";
    garder.textContent = MOTS.prevue.garder;
    // Cerné, comme « Ne pas arrêter » : retirer un changement prévu n'est pas
    // le geste qu'on attend de lui, c'est celui qui le rattrape.
    garder.classList.remove("atlas-plein");
    garder.setAttribute("style", "color:var(--atlas-ink, #1c1c1a);background-color:var(--atlas-cream, #f5f3ee);box-shadow:inset 0 0 0 1.5px var(--atlas-line, rgba(28,28,26,0.12))");
    garder.dataset.va = "entreprise";
    garder.dataset.dit = DIT.garder;
    section.after(espace, bas);
  }

  etat("d-feuille").remove();
  etat("d-refus").remove();
};

// L'en-tête de la planche passe AU-DESSUS du voile de la feuille : sans quoi,
// une feuille ouverte, les étapes ne se touchent plus (vu au parcours).
const css =
  enHauteurStable(readFileSync(`${S}/css.txt`, "utf8")) +
  `
.planche-tete{position:relative;z-index:50}
.cf-releve{padding:0 18px;border-radius:6px;background-color:var(--atlas-card,#faf9f5)}
.cf-rang{display:flex;align-items:center;gap:14px;padding:17px 0}
.cf-rang+.cf-rang{border-top:1px solid var(--atlas-lineSoft,rgba(28,28,26,0.08))}
.cf-libelle{flex:1;min-width:0;font-size:16px;line-height:1.35;color:var(--atlas-ink,#1c1c1a)}
.cf-valeur{display:inline-grid;justify-items:end;row-gap:5px;white-space:nowrap}
.cf-chiffre{font-family:var(--font-display);font-size:36px;line-height:1;letter-spacing:-0.01em;color:var(--atlas-ink,#1c1c1a);font-variant-numeric:tabular-nums lining-nums}
.cf-unite{margin-left:5px;font-size:14px;color:var(--atlas-inkSoft,#4a4a44)}
.cf-ttc{font-size:14.5px;line-height:1.2;color:var(--atlas-inkSoft,#4a4a44);font-variant-numeric:tabular-nums lining-nums}
.cf-refuse .cf-chiffre,.cf-refuse .cf-unite,.cf-refuse .cf-ttc{text-decoration:line-through;text-decoration-thickness:1.5px;color:var(--atlas-inkSoft,#4a4a44)}
.cf-quand{flex:1;min-width:0}
.cf-quand-titre{display:block;font-family:var(--font-display);font-size:19px;line-height:1.25;color:var(--atlas-ink,#1c1c1a)}
.cf-quand-sous{display:block;margin-top:3px;font-size:14.5px;line-height:1.4;color:var(--atlas-inkSoft,#4a4a44)}
.cf-note{margin:14px 2px 0;font-size:15.5px;line-height:1.45;color:var(--atlas-ink,#1c1c1a)}
.cf-prevue{color:var(--atlas-or,#B98B47);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--atlas-or,#B98B47) 60%,transparent)}
`;

const taille = await composer({
  css,
  etats,
  etapes: ETAPES,
  titre: "Changer de formule",
  surtitre: "Planche, le vrai écran Abonnement",
  retouches,
  donnees: { MOTS, DIT },
  sortie: SORTIE,
});
console.log("écrit", SORTIE, taille);

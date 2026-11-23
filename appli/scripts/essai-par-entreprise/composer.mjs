// Compose la planche « Un essai par entreprise » sur les écrans VRAIS figés par
// `appli/scripts/parcours-inscription/figer.mjs` : la question du SIRET de la
// création du compte, et l'accueil. Seul ce qui est proposé s'y ajoute. Usage :
//   node appli/scripts/essai-par-entreprise/composer.mjs <dossier de figer.mjs> <sortie.html>
//
// Sa question du 23 novembre 2026 : « quelqu'un crée un compte pour les
// 15 jours, quitte, et en recrée un avec une autre adresse : est-ce qu'on ne
// ferait pas un truc avec le SIRET ? », puis « fais la planche ». La règle
// proposée (`TODO.md`, « UN ESSAI PAR ENTREPRISE ») :
//   · l'appli garde le SIREN (les 9 premiers chiffres) de chaque entreprise qui
//     a fait son essai ;
//   · un SIREN déjà essayé : le compte se crée quand même, SANS essai gratuit.
//     On ne bloque jamais le compte : un SIRET est public, et bloquer laisserait
//     n'importe qui priver un concurrent de son essai ;
//   · « Passer » reste : aucun devis ni aucune facture ne part sans SIRET, donc
//     l'essai s'arrête dès que le SIRET est tapé.
import { readFileSync, readdirSync } from "node:fs";
import { composer } from "../../../scripts/planche-figee/composer.mjs";
import { enHauteurStable } from "../_hauteur-stable.mjs";

const [S, SORTIE] = process.argv.slice(2);
// Un écran figé, retrouvé par ce qu'il porte : la question du SIRET a le champ
// `siret`, l'accueil le ruban de l'essai. Un numéro d'ordre changerait au
// premier écran ajouté à la création du compte.
const lire = (porte) => {
  for (const f of readdirSync(S).filter((n) => /^\d\d-.+\.json$/.test(n)).sort()) {
    const corps = JSON.parse(readFileSync(`${S}/${f}`, "utf8"));
    if (corps.html.includes(porte)) return { ...corps, html: enHauteurStable(corps.html) };
  }
  throw new Error(`aucun écran figé ne porte ${porte} dans ${S}`);
};
const siret = lire('name="siret"');
const accueil = lire('data-atlas="ruban-essai"');

const etats = [
  { nom: "siret", etape: "siret", corps: siret },
  { nom: "deja", etape: "deja", corps: siret },
  { nom: "compte", etape: "compte", corps: siret },
  { nom: "accueil", etape: "accueil", corps: accueil },
];
const ETAPES = [
  { va: "siret", mot: "Le SIRET" },
  { va: "deja", mot: "Essai déjà fait" },
  { va: "compte", mot: "Compte existant" },
  { va: "accueil", mot: "L'accueil" },
];

// Les mots proposés, et eux seuls : tout le reste est l'écran de l'appli.
const MOTS = {
  siret: "123 456 789 00012",
  passer: "Sans SIRET, l'essai démarre. Il s'arrête dès que le SIRET est tapé : aucun devis ni aucune facture ne part sans lui.",
  deja: {
    titre: "Votre entreprise a déjà eu ses 15 jours d'essai.",
    texte: "Votre compte se crée, et vous choisissez votre formule pour commencer.",
  },
  compte: {
    titre: "Un compte Cause existe déjà pour votre entreprise.",
    texte: "Demandez à y être invité, ou continuez avec un compte à vous, sans essai gratuit.",
  },
  pasMoi: "Ce n'est pas votre entreprise ? Écrivez-nous.",
  pasMoiDit: "Dans l'appli : ouvre un message à Cause. Le SIRET est public. On vérifie, et l'essai est rendu.",
  ruban: "Essai déjà utilisé par votre entreprise",
  lectureSeule: "Votre entreprise a déjà eu son essai. Choisissez une formule pour créer.",
  sabonner: "Dans l'appli : ouvre l'abonnement, pour choisir sa formule.",
};

const retouches = (etat, d) => {
  const mot = (b) => (b.textContent || "").replace(/\s+/g, " ").trim();
  // Le SIRET tapé, dans les trois états de la question.
  for (const nom of ["siret", "deja", "compte"]) {
    const el = etat(nom);
    const champ = el.querySelector('input[name="siret"]');
    champ.setAttribute("value", d.mots.siret);
    el.querySelectorAll("button, a").forEach((b) => {
      const m = mot(b);
      if (m === "Retour") b.dataset.dit = "Dans l'appli : revient à la question d'avant.";
      if (m === "Passer") b.dataset.dit = d.mots.passer;
      if (m === "Continuer") {
        if (nom === "siret") b.dataset.va = "deja";
        else { b.dataset.va = "accueil"; b.dataset.dit = "Les autres questions suivent, puis l'accueil."; }
      }
    });
  }
  // La note, posée sous la case, à la place qu'occupe déjà un refus : c'est là
  // que l'œil va après « Continuer ». En or, comme « Il manque… » sur « C'est
  // fait » : une information, pas une erreur.
  const note = (nom, cas) => {
    const el = etat(nom);
    const refus = el.querySelector('p[role="alert"]');
    const bloc = document.createElement("div");
    bloc.dataset.atlas = "essai-deja-fait";
    bloc.className = "essai-deja";
    bloc.innerHTML =
      `<p class="ed-titre">${cas.titre}</p>` +
      `<p class="ed-texte">${cas.texte}</p>` +
      `<button type="button" class="ed-lien" data-va="siret">Corriger le SIRET</button>` +
      `<button type="button" class="ed-lien" data-dit="${d.mots.pasMoiDit}">${d.mots.pasMoi}</button>`;
    refus.replaceWith(bloc);
  };
  note("deja", d.mots.deja);
  note("compte", d.mots.compte);

  // L'accueil : l'essai n'est pas ouvert. Le ruban et la phrase sous « Créer un
  // devis » sont ceux d'un essai terminé (`RubanEssai`, `phraseLectureSeule`),
  // avec leurs mots à eux.
  const a = etat("accueil");
  const ruban = a.querySelector('[data-atlas="ruban-essai"]');
  ruban.dataset.etat = "deja";
  ruban.dataset.ton = "alerte";
  ruban.style.backgroundColor = "color-mix(in srgb, var(--atlas-alerte, #9C3B2E) 10%, transparent)";
  ruban.style.color = "var(--atlas-alerte, #9C3B2E)";
  ruban.querySelector("span").textContent = d.mots.ruban;
  const sabonner = ruban.querySelector('[data-atlas="ruban-essai-sabonner"]');
  sabonner.style.color = "var(--atlas-alerte, #9C3B2E)";
  sabonner.dataset.dit = d.mots.sabonner;
  const porte = a.querySelector('[data-atlas="nouveau-chantier"]');
  porte.setAttribute("aria-disabled", "true");
  porte.style.opacity = "0.4";
  porte.dataset.dit = d.mots.lectureSeule;
  const phrase = document.createElement("p");
  phrase.dataset.atlas = "lecture-seule";
  phrase.className = "lecture-seule";
  phrase.textContent = d.mots.lectureSeule;
  porte.parentElement.appendChild(phrase);
};

const css = enHauteurStable(readFileSync(`${S}/css.txt`, "utf8")) + `
.essai-deja{margin-top:12px}
.ed-titre{margin:0;font-size:15.5px;font-weight:600;line-height:1.45;color:var(--atlas-carteAmbreTexte,#806031)}
.ed-texte{margin:4px 0 0;font-size:15px;line-height:1.45;color:var(--atlas-inkSoft,#4a4a44)}
.ed-lien{display:block;min-height:44px;margin-top:4px;padding:0;border:0;background:none;font:inherit;font-size:15px;font-weight:600;color:var(--atlas-ink,#1c1c1a);text-decoration:underline;text-underline-offset:4px;cursor:pointer;text-align:left}
.lecture-seule{margin:8px 0 0;text-align:center;font-size:13px;line-height:1.5;color:var(--atlas-muted,#8a8578)}
`;

const taille = await composer({
  css,
  etats,
  etapes: ETAPES,
  titre: "Un essai par entreprise",
  surtitre: "Planche, les vrais écrans",
  retouches,
  donnees: { mots: MOTS },
  sortie: SORTIE,
});
console.log("écrit", SORTIE, taille);

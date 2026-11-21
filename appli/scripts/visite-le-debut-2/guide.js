(() => {
  "use strict";

  // LES QUATRE PREMIÈRES ÉTAPES, et rien après : la proposition s'arrête au
  // client, avant le devis (sa demande du 21 novembre 2026).
  //
  // Une étape dit UNE chose, et le guide la montre : `cible` est ce qu'on
  // touche (l'anneau), `regard` ce qu'on lit sans le toucher (le surligneur).
  // La phrase parle toujours de l'un des deux. Dans la visite d'avant, l'étape
  // des factures décrivait des factures restées sous l'écran.
  const ETAPES = [
    {
      ecran: "01-accueil",
      dit: "Vos chantiers en cours, et ce qui attend votre réponse.",
      geste: "Touchez Vos clients.",
      cible: (e) => e.querySelector('a[href="/clients"]'),
    },
    {
      ecran: "02-clients",
      dit: "Tous vos clients, et ce qu’ils vous doivent.",
      // La liste écrit « Costa » : on fait toucher le mot qui est à l'écran.
      geste: "Touchez Costa.",
      cible: (e) =>
        [...e.querySelectorAll('a[href^="/clients/"]')].find(
          (a) => a.querySelector('[data-atlas="nom-client"]')?.textContent.trim() === "Costa"
        ),
    },
    {
      ecran: "02b-client-devis",
      dit: "Sa fiche : ses coordonnées, ses devis, ses factures.",
      geste: "Touchez Factures.",
      cible: (e) => e.querySelector("#onglet-factures"),
      // La liste sous les onglets tient à l'écran dès maintenant : la page ne
      // bougera pas quand l'onglet changera.
      avec: (e) => e.querySelector("#registre-devis"),
    },
    {
      ecran: "02c-client-factures",
      // Un onglet ne change pas de page : on reste où l'on est, comme dans l'appli.
      memePage: true,
      dit: "Vous voyez si le client a ouvert sa facture.",
      regard: (e) => e.querySelector('#registre-factures [data-atlas="piece-reception"]'),
    },
  ];

  const ecrans = new Map([...document.querySelectorAll(".visite-ecran")].map((e) => [e.dataset.ecran, e]));
  const racine = document.documentElement;
  const pose = document.querySelector(".g-pose");
  const bulle = pose.querySelector(".g-bulle");
  const dit = bulle.querySelector(".g-dit");
  const geste = bulle.querySelector(".g-geste");
  const retour = bulle.querySelector(".g-retour");
  const suite = bulle.querySelector(".g-suite");
  const pas = bulle.querySelector(".g-pas");
  const anneau = document.querySelector(".g-anneau");
  const main = document.querySelector(".g-main");
  const surligne = document.querySelector(".g-regard");
  const ouverture = document.querySelector('[data-feuille="ouverture"]');
  const fin = document.querySelector('[data-feuille="fin"]');
  const calme = matchMedia("(prefers-reduced-motion: reduce)");

  let rang = 0;
  let enCours = false;
  let enTransit = false;
  let courant = ecrans.get(ETAPES[0].ecran);
  let cible = null;
  let regard = null;
  let avec = null;
  let glisse = 0;
  let dernierY = -1;
  let stableDepuis = 0;
  let mainVue = false;
  let rappelA = Infinity;
  let verrou = 0;
  let poseA = 0;

  // Un écran figé ne se parcourt pas au clavier : seuls les boutons du guide répondent.
  ecrans.forEach((e) => { e.inert = true; });
  pas.innerHTML = ETAPES.map(() => "<i></i>").join("");

  // La bulle se pose juste au-dessus de la barre du bas, que l'on doit continuer
  // de voir. Une barre est couchée au bas de l'écran ; sur ordinateur le même
  // élément est une colonne debout à gauche, et la bulle n'a rien à lui laisser.
  const mesurerBarre = () => {
    const r = courant.querySelector(".atlas-nav-basse")?.getBoundingClientRect();
    const couchee = r && r.width > r.height * 2 && r.top > innerHeight / 2;
    racine.style.setProperty("--g-barre", (couchee ? Math.round(r.height) : 0) + "px");
  };
  // Le trait d'or sous l'onglet ouvert a été figé à 390 points de large : sur
  // tout autre écran il tombait à côté du mot. On le replace par la règle de
  // l'appli elle-même (`RegistresDuDossier.tsx` : 64 % de l'onglet, centré).
  const recalerLesOnglets = () => {
    courant.querySelectorAll('[role="tablist"]').forEach((liste) => {
      const ouvert = liste.querySelector('[role="tab"][aria-selected="true"]');
      const trait = liste.querySelector(':scope > span[aria-hidden="true"]');
      if (!ouvert || !trait) return;
      trait.style.transition = "none";
      trait.style.width = Math.round(ouvert.offsetWidth * 0.64) + "px";
      trait.style.transform = `translateX(${Math.round(ouvert.offsetLeft + ouvert.offsetWidth * 0.18)}px)`;
    });
  };
  const montrer = (nom) => {
    ecrans.forEach((e, n) => { e.hidden = n !== nom; });
    courant = ecrans.get(nom);
    mesurerBarre();
    recalerLesOnglets();
  };

  // Ce qui reste d'écran pour ce qu'on montre : tout, sauf là où la bulle le
  // recouvrirait. La géométrie décide, pas la largeur de l'écran : à 1024 points
  // la bulle rangée à gauche mord encore sur la colonne de l'appli.
  const zone = (r) => {
    const b = bulle.getBoundingClientRect();
    const sousLaBulle = r.left < b.right + 8 && r.right > b.left - 8;
    return { haut: 10, bas: (sousLaBulle ? b.top : innerHeight) - 16 };
  };
  // Le surligneur suit le TEXTE, pas la boîte qui le porte : elle fait toute la largeur.
  const rectDe = (el, texteSeul) => {
    if (!texteSeul) return el.getBoundingClientRect();
    const p = document.createRange();
    p.selectNodeContents(el);
    return p.getBoundingClientRect();
  };
  // Où poser la page pour que ce qu'on montre tienne dans la zone, en bougeant le moins possible.
  const defilementVoulu = () => {
    const montres = [cible && rectDe(cible), regard && rectDe(regard, true), avec && rectDe(avec)].filter(Boolean);
    if (!montres.length) return scrollY;
    const haut = Math.min(...montres.map((r) => r.top));
    const bas = Math.max(...montres.map((r) => r.bottom));
    const z = zone({ left: Math.min(...montres.map((r) => r.left)), right: Math.max(...montres.map((r) => r.right)) });
    let y = scrollY;
    if (bas > z.bas) y += bas - z.bas;
    const hautApres = haut - (y - scrollY);
    if (hautApres < z.haut) y -= z.haut - hautApres;
    return Math.max(0, Math.round(y));
  };
  const glisserVers = (y, delai) => {
    if (Math.abs(y - scrollY) < 2) return;
    if (calme.matches) { scrollTo(0, y); return; }
    glisse = setTimeout(() => scrollTo({ top: y, behavior: "smooth" }), delai);
  };

  const rejouer = (el, classe) => { el.classList.remove(classe); void el.offsetWidth; el.classList.add(classe); };
  const montrerLeGeste = () => { rejouer(main, "joue"); rejouer(anneau, "joue"); };
  const effacer = () => {
    anneau.classList.remove("visible", "joue", "appuie");
    main.classList.remove("joue");
    surligne.classList.remove("visible");
    mainVue = false;
    rappelA = Infinity;
  };

  const ecrire = () => {
    const e = ETAPES[rang];
    dit.textContent = e.dit;
    geste.hidden = !e.geste;
    geste.querySelector("span").textContent = e.geste || "";
    retour.disabled = rang === 0;
    suite.textContent = e.cible ? "Passer" : "Suivant";
    suite.classList.toggle("pleine", !e.cible);
    [...pas.children].forEach((i, k) => i.classList.toggle("fait", k <= rang));
    pas.setAttribute("aria-label", `Étape ${rang + 1} sur ${ETAPES.length}`);
  };

  // Absente, la bulle ne répond ni au doigt ni au clavier.
  const presenter = (oui) => { pose.classList.toggle("absente", !oui); bulle.inert = !oui; };
  const finir = () => {
    enCours = false;
    effacer();
    presenter(false);
    fin.classList.remove("part");
    fin.hidden = false;
    fin.firstElementChild.focus({ preventScroll: true });
  };

  const aller = (n, sens = 1, fondu = true) => {
    if (n < 0 || enTransit) return;
    clearTimeout(glisse);
    if (n >= ETAPES.length) { finir(); return; }
    const memePage = sens > 0 ? ETAPES[n].memePage : ETAPES[rang].memePage;
    const changer = () => {
      const y = scrollY;
      rang = n;
      const e = ETAPES[rang];
      effacer();
      ecrire();
      montrer(e.ecran);
      cible = e.cible ? e.cible(courant) : null;
      regard = e.regard ? e.regard(courant) : null;
      avec = e.avec ? e.avec(courant) : null;
      if (cible) anneau.style.borderRadius = Math.min(999, Math.max(12, parseFloat(getComputedStyle(cible).borderRadius) || 12)) + "px";
      if (memePage) {
        scrollTo(0, y);
        glisserVers(defilementVoulu(), 280);
      } else if (sens < 0) {
        // En arrière, on retrouve l'écran là où on l'avait laissé.
        scrollTo(0, 0);
        scrollTo(0, defilementVoulu());
      } else {
        // On arrive en haut de la page, comme dans l'appli : le visiteur voit où
        // il est. Puis la page glisse jusqu'au geste, au lieu d'y sauter.
        scrollTo(0, 0);
        glisserVers(defilementVoulu(), 620);
      }
      enTransit = false;
      // Un double appui, fréquent chez qui hésite, ne traverse pas l'écran qui
      // vient de s'ouvrir : sa cible peut tomber sous le même doigt.
      verrou = performance.now() + 500;
      // Les repères attendent que l'écran soit posé : dessinés pendant le fondu,
      // le surligneur et la main passeraient inaperçus.
      poseA = performance.now() + 420;
    };
    if (fondu && document.startViewTransition && !calme.matches) {
      enTransit = true;
      document.startViewTransition(changer);
    } else changer();
  };

  // Le bon geste répond tout de suite : l'anneau s'enfonce, puis l'écran s'ouvre.
  const reussir = () => {
    anneau.classList.add("appuie");
    const n = rang + 1;
    // Un second appui pendant ce court instant ne fait pas sauter deux étapes.
    enTransit = true;
    setTimeout(() => { enTransit = false; aller(n); }, calme.matches ? 0 : 130);
  };
  // À côté : on ne punit pas. La page revient sur la cible et la main remontre le geste.
  const rappeler = () => {
    clearTimeout(glisse);
    if (!ETAPES[rang].cible) { rejouer(suite, "appelle"); return; }
    glisserVers(defilementVoulu(), 0);
    rejouer(geste, "appelle");
    mainVue = false;
  };
  const surLaCible = (x, y) => {
    if (!cible) return false;
    const r = cible.getBoundingClientRect();
    // De la marge autour : on vise mal avec un doigt épais.
    const m = 10;
    return r.width > 0 && x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
  };
  const horsDuGuide = (ev) => !(ev.target instanceof Element && ev.target.closest(".g-bulle, .g-feuille"));

  // ON LIT LE DOIGT, PAS LE CLIC. Sur un iPhone, Safari n'envoie aucun clic pour
  // un appui sur ce qui n'est ni un lien ni un bouton, et tout l'écran figé en
  // est : la visite y serait restée muette. Le doigt posé puis levé au même
  // endroit, lui, se lit partout.
  let appui = null;
  const lacher = () => { appui = null; if (!enTransit) anneau.classList.remove("appuie"); };
  document.addEventListener("pointerdown", (ev) => {
    appui = null;
    if (!enCours || !ev.isPrimary || !horsDuGuide(ev)) return;
    appui = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
    if (surLaCible(ev.clientX, ev.clientY)) anneau.classList.add("appuie");
  }, true);
  document.addEventListener("pointerup", (ev) => {
    const a = appui;
    lacher();
    if (!a || a.id !== ev.pointerId) return;
    // Un doigt qui a glissé faisait défiler la page, un doigt resté posé hésitait : ni l'un ni l'autre n'est un appui.
    if (Math.hypot(ev.clientX - a.x, ev.clientY - a.y) > 12 || ev.timeStamp - a.t > 800) return;
    if (enTransit || performance.now() < verrou) return;
    if (surLaCible(ev.clientX, ev.clientY)) reussir(); else rappeler();
  }, true);
  // Le navigateur reprend le doigt pour faire défiler : l'appui est abandonné.
  document.addEventListener("pointercancel", lacher, true);
  // Un écran figé ne mène nulle part : aucun lien ne quitte la visite.
  document.addEventListener("click", (ev) => { if (horsDuGuide(ev)) ev.preventDefault(); }, true);
  document.addEventListener("submit", (ev) => ev.preventDefault(), true);
  addEventListener("mousemove", (ev) => racine.classList.toggle("g-sur-cible", enCours && horsDuGuide(ev) && surLaCible(ev.clientX, ev.clientY)));
  addEventListener("resize", () => { mesurerBarre(); recalerLesOnglets(); });

  suite.addEventListener("click", () => aller(rang + 1));
  retour.addEventListener("click", () => aller(rang - 1, -1));
  // Une sortie à chaque étape, pas seulement à la fin : la visite n'est jamais un cul-de-sac.
  bulle.querySelector(".g-quitter").addEventListener("click", () => {
    const r = document.referrer;
    location.href = r && new URL(r).origin === location.origin && !r.includes("visite-guidee") ? r : "vente/index.html";
  });
  const fermer = (feuille) => { feuille.classList.add("part"); setTimeout(() => { feuille.hidden = true; }, 300); };
  const lancer = (feuille, fondu) => {
    fermer(feuille);
    enCours = true;
    presenter(true);
    aller(0, 1, fondu);
  };
  ouverture.querySelector('[data-va="commencer"]').addEventListener("click", () => lancer(ouverture, false));
  fin.querySelector('[data-va="recommencer"]').addEventListener("click", () => lancer(fin, true));

  // Les repères suivent leur cible à chaque image : la page glisse, on la fait défiler, on tourne l'écran.
  const poser = (el, r, marge) => {
    el.style.left = r.left - marge.x + "px";
    el.style.top = r.top - marge.y + "px";
    el.style.width = r.width + 2 * marge.x + "px";
    el.style.height = r.height + 2 * marge.y + "px";
  };
  const suivre = (t) => {
    if (enCours) {
      if (scrollY !== dernierY) { dernierY = scrollY; stableDepuis = t; }
      const immobile = t - stableDepuis > 220 && t > poseA;
      const dedans = (r) => {
        const z = zone(r);
        const milieu = r.top + r.height / 2;
        return r.width > 0 && milieu >= z.haut && milieu <= z.bas;
      };
      if (cible) {
        const r = rectDe(cible);
        const vu = dedans(r);
        anneau.classList.toggle("visible", vu);
        if (vu) {
          const gauche = Math.max(3, r.left - 4);
          const droite = Math.min(racine.clientWidth - 3, r.right + 4);
          const l = droite - gauche;
          const h = r.height + 8;
          anneau.style.left = gauche + "px";
          anneau.style.top = r.top - 4 + "px";
          anneau.style.width = l + "px";
          anneau.style.height = h + "px";
          // L'onde grandit de treize points de chaque côté, quelle que soit la taille de la cible.
          anneau.style.setProperty("--g-gx", String((l + 26) / l));
          anneau.style.setProperty("--g-gy", String((h + 26) / h));
          // Le bout de l'index se pose un peu à droite du milieu, la main en dessous.
          main.style.left = r.left + Math.min(r.width * 0.62, r.width - 14) - 18 + "px";
          main.style.top = r.top + r.height * 0.56 - 5 + "px";
          if (immobile && !mainVue) { montrerLeGeste(); mainVue = true; rappelA = t + 8000; }
          else if (immobile && t > rappelA) { montrerLeGeste(); rappelA = t + 10000; }
        }
      }
      if (regard) {
        const r = rectDe(regard, true);
        const vu = dedans(r);
        if (vu && immobile) surligne.classList.add("visible");
        if (!vu) surligne.classList.remove("visible");
        poser(surligne, r, { x: 5, y: 1 });
      }
    }
    requestAnimationFrame(suivre);
  };
  requestAnimationFrame(suivre);

  mesurerBarre();
  presenter(false);
  // Un lecteur d'écran arrive sur la feuille d'ouverture, pas au milieu d'un écran figé.
  ouverture.firstElementChild.focus({ preventScroll: true });
  // Lu par le parcours de vérification.
  window.visite = { etapes: ETAPES.length, etape: () => rang, enCours: () => enCours };
})();

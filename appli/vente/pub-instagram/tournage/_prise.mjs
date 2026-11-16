// LA PRISE : filmer la vraie appli à trente images par seconde, sans une
// saccade, quelle que soit la vitesse de la machine.
//
// Le principe est celui des films du site de vente (6 novembre 2026) :
// l'horloge de la page est figée, puis avancée d'une image à la fois. Les
// minuteurs et les animations pilotées par script suivent l'horloge de
// Playwright ; les animations et transitions CSS, elles, tournent sur
// l'horloge du compositeur : on les met en pause et on avance leur temps à la
// main. Chaque image est photographiée, puis le tout est monté en un film.
/* global document, window, getComputedStyle */
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const IPS = 30;

export class Prise {
  constructor(page, nom, sortie) {
    this.page = page;
    this.nom = nom;
    this.sortie = sortie;
    this.dossier = path.join(sortie, "images", nom);
    rmSync(this.dossier, { recursive: true, force: true });
    mkdirSync(this.dossier, { recursive: true });
    this.vues = []; // { fichier, tenues }
    this.total = 0; // images de film
    this.reperes = {};
    this.temps = 0; // millisecondes de page écoulées
  }

  /** Nommer l'instant : le montage cale ses titres dessus. */
  repere(nom) {
    this.reperes[nom] = Number((this.total / IPS).toFixed(3));
  }

  /** Photographier l'état courant et le tenir `tenues` images. */
  async image(tenues = 1) {
    const fichier = path.join(this.dossier, `vue-${String(this.vues.length).padStart(5, "0")}.png`);
    await this.page.screenshot({ path: fichier });
    this.vues.push({ fichier, tenues });
    this.total += tenues;
  }

  /** Adopter les animations déjà en cours, puis photographier le premier état. */
  async depart(secondes = 0) {
    await this.avancer(0);
    await this.image(1);
    if (secondes > 0) this.tenir(secondes);
  }

  /** Tenir la dernière image plus longtemps, sans la reprendre. */
  tenir(secondes) {
    const n = Math.round(secondes * IPS);
    this.vues[this.vues.length - 1].tenues += n;
    this.total += n;
  }

  /** Avancer la page d'une durée, sans rien photographier. */
  async avancer(ms) {
    const avant = Math.round(this.temps);
    this.temps += ms;
    const pas = Math.round(this.temps) - avant;
    if (pas > 0) await this.page.clock.runFor(pas);
    await this.page.evaluate((dt) => {
      for (const a of document.getAnimations()) {
        if (!a.__prise) {
          a.__prise = true;
          // Déjà posée (une entrée d'écran finie) : on n'y touche pas, la
          // remettre à zéro ferait sauter l'élément à son point de départ.
          if (a.playState === "finished") continue;
          const age = Number(a.currentTime ?? 0);
          a.pause();
          // Née pendant la prise, il y a quelques millisecondes de vraie
          // horloge : elle repart de zéro, à notre rythme. Plus ancienne (une
          // boucle qui tournait déjà), elle continue d'où elle en est.
          a.currentTime = age < 400 ? 0 : age;
          continue;
        }
        const fin = a.effect?.getComputedTiming?.().endTime;
        const t = Number(a.currentTime ?? 0) + dt;
        // Une animation en pause ne finit jamais d'elle-même : sans `finish`,
        // l'appli n'apprendrait pas que sa transition est terminée.
        if (Number.isFinite(fin) && t >= fin) a.finish();
        else a.currentTime = t;
      }
    }, ms);
  }

  /** Filmer `secondes` de la page, image par image. */
  async filmer(secondes) {
    const n = Math.round(secondes * IPS);
    for (let i = 0; i < n; i++) {
      await this.avancer(1000 / IPS);
      await this.image(1);
    }
  }

  /**
   * Laisser l'appli finir ce qu'elle attend du serveur, hors caméra : le temps
   * de la page avance, rien n'est photographié.
   */
  async attendre(condition, { delai = 15000 } = {}) {
    const debut = Date.now();
    for (;;) {
      if (await condition()) return;
      if (Date.now() - debut > delai) throw new Error(`prise « ${this.nom} » : l'attente n'aboutit pas`);
      await this.avancer(50);
      await this.page.waitForTimeout(40);
    }
  }

  /**
   * Faire défiler un conteneur, image par image, d'une position à une autre.
   * Le défilement est celui de la page elle-même : ce qui est collant ou fixe
   * réagit comme sous un doigt.
   */
  async defiler(selecteur, vers, secondes) {
    const depart = await this.page.evaluate((s) => {
      const e = s ? document.querySelector(s) : document.scrollingElement;
      return e.scrollTop;
    }, selecteur);
    const n = Math.max(1, Math.round(secondes * IPS));
    for (let i = 1; i <= n; i++) {
      // Accélère puis freine (cubique des deux côtés), comme un pouce.
      const p = i / n;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const y = depart + (vers - depart) * e;
      await this.page.evaluate(
        ([s, top]) => {
          const el = s ? document.querySelector(s) : document.scrollingElement;
          el.scrollTo({ top, behavior: "instant" });
        },
        [selecteur, y]
      );
      await this.avancer(1000 / IPS);
      await this.image(1);
    }
  }

  /** Appuyer au centre d'un élément, comme un doigt. */
  async appuyer(cible) {
    const boite = await cible.boundingBox();
    if (!boite) throw new Error(`prise « ${this.nom} » : rien à toucher`);
    await this.page.touchscreen.tap(boite.x + boite.width / 2, boite.y + boite.height / 2);
  }

  /** Monter les images en un film, et écrire ses repères à côté. */
  monter() {
    const liens = path.join(this.dossier, "film");
    mkdirSync(liens, { recursive: true });
    let n = 0;
    for (const vue of this.vues) {
      for (let i = 0; i < vue.tenues; i++) {
        symlinkSync(vue.fichier, path.join(liens, `i-${String(n++).padStart(6, "0")}.png`));
      }
    }
    const film = path.join(this.sortie, `${this.nom}.mp4`);
    execFileSync(
      "ffmpeg",
      [
        "-loglevel", "error", "-y",
        "-framerate", String(IPS),
        "-i", path.join(liens, "i-%06d.png"),
        "-c:v", "libx264", "-preset", "slow", "-crf", "12",
        "-pix_fmt", "yuv420p", "-g", "15", "-movflags", "+faststart",
        film,
      ],
      { stdio: "inherit" }
    );
    const fiche = { film: `${this.nom}.mp4`, images: this.total, secondes: Number((this.total / IPS).toFixed(3)), reperes: this.reperes };
    writeFileSync(path.join(this.sortie, `${this.nom}.json`), JSON.stringify(fiche, null, 2));
    console.log(`🎬 ${this.nom} : ${fiche.secondes} s, ${this.vues.length} vues, repères ${JSON.stringify(this.reperes)}`);
    return fiche;
  }
}

/** Le conteneur qui défile autour d'un élément : marqué pour qu'on le retrouve. */
export async function marquerLeDefilant(cible, nom) {
  return cible.evaluate((el, n) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) {
        p.setAttribute("data-prise", n);
        return { trouve: true, haut: p.scrollTop, hauteur: p.clientHeight, contenu: p.scrollHeight };
      }
      p = p.parentElement;
    }
    const d = document.scrollingElement;
    return { trouve: false, haut: d.scrollTop, hauteur: window.innerHeight, contenu: d.scrollHeight };
  }, nom);
}

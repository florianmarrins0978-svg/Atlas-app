#!/usr/bin/env node
/**
 * RENDRE UN FILM IMAGE PAR IMAGE, DEPUIS SA PAGE.
 *
 * Les films de promotion (`appli/video-promo/film/film-*.html`) n'ont qu'une
 * horloge : `window.rendre(t)` pose chaque élément pour l'instant t. Ce script
 * ouvre la page dans Chromium, demande chaque instant l'un après l'autre, et
 * pousse les images dans ffmpeg. Pas une saccade, et le même MP4 à chaque
 * fois : c'est ce qu'une capture d'écran en temps réel ne garantit jamais.
 *
 * POURQUOI IL EST DANS LE DÉPÔT. La session du 26 septembre 2026 a rendu les
 * versions A et B avec un script resté dans son dossier temporaire ; pour
 * changer trois secondes du film, il fallait tout réécrire (`TODO.md`). Ce
 * qui produit un livrable vit avec lui.
 *
 *   node scripts/rendre-film.mjs appli/video-promo/film/film-C.html \
 *        --sortie appli/video-promo/atlas-C.mp4 [--son bande.wav] [--sons sons.json]
 *   node scripts/rendre-film.mjs …film-C.html --planche planche.png [--pas 0.5]
 *
 * `--sons` écrit les instants sonores que la page déclare (`window.SONS`) ;
 * `scripts/musique-film.py` en fait la bande son, et `--son` la pose sur le
 * film. `--planche` rend une image toutes les `--pas` secondes, en mosaïque :
 * c'est ce qu'on REGARDE avant de rendre quarante secondes (CLAUDE.md §5).
 * `--de` et `--a` bornent le rendu pour revoir un passage ; `--instants 3.5,17.9`
 * avec `--dossier` écrit ces images-là en pleine taille, pour les regarder.
 *
 * `--grain 10` pose un grain de pellicule, à graine fixe, en sortie.
 * `--obturateur 3` rend le FLOU DE MOUVEMENT (films D, 4 octobre 2026) : trois
 * sous-images par image, prises sur la première moitié de l'intervalle (un
 * obturateur à 180°, comme une caméra), moyennées par ffmpeg. Sans lui, un
 * titre qui traverse l'écran en dix images est net sur chacune, et l'œil le
 * voit SAUTER : c'est ce qui sépare un film d'une diapositive animée.
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const page = args.find((a) => !a.startsWith("--"));
const option = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : defaut;
};
if (!page) {
  console.error("Il manque la page du film. Voir l'en-tête du script.");
  process.exit(2);
}

const IPS = Number(option("ips", 30));
const LARGEUR = Number(option("largeur", 1080));
const HAUTEUR = Number(option("hauteur", 1920));
const sortie = option("sortie");
const son = option("son");
const fichierSons = option("sons");
const planche = option("planche");
const pas = Number(option("pas", 0.5));
const instants = option("instants");
const dossier = option("dossier", ".");
const OBTURATEUR = Math.max(1, Number(option("obturateur", 1)));
// `--grain 10` : un grain de pellicule posé par ffmpeg, à graine fixe (donc le
// même film à chaque rendu). Il vivait dans la page en `mix-blend-mode` et y
// coûtait 450 ms par image capturée : ici, il ne coûte rien.
const GRAIN = Math.max(0, Number(option("grain", 0)));

/** Chromium : celui de Playwright, sinon celui posé dans /opt/pw-browsers. */
function chromiumExecutable() {
  const attendu = chromium.executablePath();
  if (existsSync(attendu)) return attendu;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (existsSync(racine)) {
    for (const d of readdirSync(racine)) {
      const candidat = path.join(racine, d, "chrome-linux", "chrome");
      if (d.startsWith("chromium-") && existsSync(candidat)) return candidat;
    }
  }
  throw new Error(`Aucun Chromium trouvé (attendu : ${attendu}).`);
}

/** ffmpeg : celui du PATH, sinon celui qu'imageio-ffmpeg installe avec pip. */
function ffmpegExecutable() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  const pip = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
  if (pip.status === 0 && existsSync(pip.stdout.trim())) return pip.stdout.trim();
  throw new Error("Aucun ffmpeg : `pip3 install imageio-ffmpeg` en donne un.");
}

const navigateur = await chromium.launch({ executablePath: chromiumExecutable() });
const onglet = await navigateur.newPage({ viewport: { width: LARGEUR, height: HAUTEUR }, deviceScaleFactor: 1 });
onglet.on("pageerror", (e) => { console.error(`La page a levé : ${e.message}`); process.exitCode = 1; });
await onglet.goto(`${pathToFileURL(path.resolve(page)).href}?image=1`);
await onglet.evaluate(() => window.pret);
const DUREE = await onglet.evaluate(() => window.DUREE);
const de = Number(option("de", 0));
const a = Number(option("a", DUREE));
console.log(`${page} : ${DUREE} s, ${LARGEUR}×${HAUTEUR}, ${IPS} images/s`);

if (fichierSons) {
  const sons = await onglet.evaluate(() => window.SONS || []);
  // La carte musicale (tempo, tonalité, sections) vient de la page aussi :
  // la bande son suit le film, jamais une seconde horloge (films D).
  const musique = await onglet.evaluate(() => window.MUSIQUE || null);
  writeFileSync(fichierSons, JSON.stringify({ duree: DUREE, sons, musique }, null, 1));
  console.log(`${sons.length} instants sonores écrits dans ${fichierSons}${musique ? ", avec la carte musicale" : ""}`);
}

// Poser l'instant, puis laisser passer deux images de composition avant de
// capturer : sans cela, la PREMIÈRE capture après un changement de calques
// (le flou du téléphone, la feuille qui apparaît) sortait à moitié peinte,
// et le même instant redemandé juste après était juste. Vu le 26 septembre
// 2026 sur deux images sur deux ; l'échauffement ci-dessous vise le même mal.
const instant = async (t) => {
  await onglet.evaluate((t) => new Promise((fin) => {
    window.rendre(t);
    requestAnimationFrame(() => requestAnimationFrame(fin));
  }), t);
};
await instant(0);
await onglet.screenshot({ type: "jpeg", quality: 50 });

if (instants) {
  for (const t of instants.split(",").map(Number)) {
    await instant(t);
    const chemin = path.join(dossier, `${path.basename(page, ".html")}-${t.toFixed(2).replace(".", "_")}.png`);
    await onglet.screenshot({ type: "png", path: chemin });
    console.log(`  ${t} s dans ${chemin}`);
  }
} else if (planche) {
  const dossier = mkdtempSync(path.join(tmpdir(), "planche-"));
  const temps = [];
  for (let t = de; t < a; t += pas) temps.push(t);
  for (const [k, t] of temps.entries()) {
    await instant(t);
    await onglet.screenshot({ type: "jpeg", quality: 88, path: path.join(dossier, `i-${String(k).padStart(4, "0")}.jpg`) });
  }
  const colonnes = 8, lignes = Math.ceil(temps.length / colonnes);
  const r = spawnSync(ffmpegExecutable(), [
    "-y", "-loglevel", "error", "-pattern_type", "glob", "-i", path.join(dossier, "i-*.jpg"),
    "-vf", `scale=270:-1,tile=${colonnes}x${lignes}:padding=4:color=white`, "-frames:v", "1", planche,
  ], { stdio: "inherit" });
  rmSync(dossier, { recursive: true, force: true });
  if (r.status !== 0) { console.error("La mosaïque n'a pas pu être écrite."); process.exit(1); }
  console.log(`${temps.length} instants (toutes les ${pas} s) dans ${planche}`);
} else {
  if (!sortie) { console.error("Il manque --sortie <fichier.mp4> (ou --planche <image.png>)."); process.exit(2); }
  const argsFfmpeg = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(IPS * OBTURATEUR), "-i", "-"];
  if (son) argsFfmpeg.push("-i", son);
  const filtres = [];
  if (OBTURATEUR > 1) {
    // `tmix` moyenne les N dernières sous-images ; on ne garde que la dernière
    // de chaque groupe, et ses instants repartent de zéro, espacés de 1/IPS :
    // les sous-images d'un même groupe sont déjà à N images d'intervalle.
    filtres.push(`tmix=frames=${OBTURATEUR}`, `select='eq(mod(n+1\\,${OBTURATEUR})\\,0)'`, "setpts=PTS-STARTPTS");
  }
  // Le grain après le flou de mouvement : un grain moyenné n'est plus un grain.
  if (GRAIN > 0) filtres.push(`noise=c0s=${GRAIN}:c0f=t+u:all_seed=19`);
  if (filtres.length) argsFfmpeg.push("-vf", filtres.join(","), "-fps_mode", "passthrough");
  argsFfmpeg.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-preset", "medium", "-movflags", "+faststart");
  if (son) argsFfmpeg.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  argsFfmpeg.push(sortie);
  const ffmpeg = spawn(ffmpegExecutable(), argsFfmpeg, { stdio: ["pipe", "inherit", "inherit"] });
  const fini = new Promise((resoudre, rejeter) => {
    ffmpeg.on("close", (code) => (code === 0 ? resoudre() : rejeter(new Error(`ffmpeg a rendu ${code}`))));
  });
  const ecrire = (tampon) => new Promise((resoudre) => {
    if (ffmpeg.stdin.write(tampon)) resoudre(); else ffmpeg.stdin.once("drain", resoudre);
  });
  const total = Math.round((a - de) * IPS);
  const debut = Date.now();
  for (let k = 0; k < total; k++) {
    // L'obturateur : N sous-images sur la première moitié de l'intervalle.
    for (let s = 0; s < OBTURATEUR; s++) {
      await instant(de + k / IPS + (OBTURATEUR > 1 ? (s * 0.5) / (IPS * OBTURATEUR) : 0));
      await ecrire(await onglet.screenshot({ type: "png" }));
    }
    if (k % 150 === 0 && k > 0) {
      const parImage = (Date.now() - debut) / k;
      console.log(`  image ${k}/${total}, reste ~${Math.round(((total - k) * parImage) / 1000)} s`);
    }
  }
  ffmpeg.stdin.end();
  await fini;
  console.log(`${total} images rendues dans ${sortie} en ${Math.round((Date.now() - debut) / 1000)} s`);
}
await navigateur.close();

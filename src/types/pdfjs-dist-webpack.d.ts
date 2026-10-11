// `pdfjs-dist/webpack.mjs` est l'entrée qui BRANCHE le fil de travail de
// pdf.js (`new URL("./build/pdf.worker.mjs", import.meta.url)`) — celle que
// Next.js sait empaqueter sans qu'on copie le fichier à la main dans `public/`,
// où sa version finirait par ne plus être celle de la bibliothèque. Le paquet
// ne livre pas de déclaration pour cette entrée ; elle rend exactement ce que
// rend l'entrée principale.
declare module "pdfjs-dist/webpack.mjs" {
  export * from "pdfjs-dist";
}

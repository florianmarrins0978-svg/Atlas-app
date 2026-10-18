import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
const S = 'C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/8911e515-932a-4d10-a7dd-bb3a00691c2a/scratchpad';
const CIBLES = [
  ['nourrice','electrovanne-100dv','Électrovanne Rain Bird 100 DV 1" MM 9V'],
  ['nourrice','electrovanne-100dv-ff','Électrovanne Rain Bird 100 DV 1" FF 9V'],
  ['nourrice','clarinette-2v','DURA Collecteur M x F x 2 sorties 1", pour une nourrice de 3 réseaux','ODU3010102'],
  ['nourrice','clarinette-3v','DURA Collecteur M x F x 3 sorties 1", pour une nourrice de 4 réseaux','ODU3010103'],
  ['nourrice','clarinette-4v','DURA Collecteur M x F x 4 sorties 1", pour une nourrice de 5 ou 6 réseaux','ODU3010104'],
  ['nourrice','union','Union Dura droite taraudée MM 1"'],
  ['nourrice','raccord-male25','Raccord mâle Plasson 25 1"'],
  ['nourrice','coude-mm','Coude Dura 90° taraudé MM 1"'],
  ['nourrice','coude-mf','Coude Dura 90° taraudé/fileté MF 1"'],
  ['nourrice','te-mmf','Té Dura taraudé/fileté 1" MMF'],
  ['nourrice','mamelon','Mamelon Dura réduit fileté MM 1"-3/4"'],
  ['nourrice','mamelon-droit-1','Mamelon Dura fileté MM 1"'],
  ['nourrice','vanne-purge','Vanne avec vis de purge 3/4"'],
  ['nourrice','regulateur-ff34','Régulateur de pression FF 3/4"'],
  ['nourrice','regard-rect12','Regard rectangle 12"'],
  ['nourrice','regard-rg17106','Regard jumbo RG17106'],
  ['nourrice','prog-1','Programmateur Solem BL-IP 1 station 9V'],
  ['nourrice','prog-4','Programmateur Solem BL-IP 4 stations 9V'],
  ['nourrice','pile-9v','Pile alcaline 9V'],
  ['nourrice','connexion','Connexion étanche'],
  ['reseau','te-taraude-25-34-25','Té Plasson 90° taraudé 25×3/4"×25'],
  ['reseau','coude-taraude-25-34','Coude Plasson 90° taraudé 25×3/4"'],
  ['reseau','te-25-25-25','Té Plasson 90° 25×25×25'],
  ['reseau','pehd','PEHD Ø25 et Ø32'],
  ['nourrice','OPL70302520','Raccord femelle Plasson 25 x 3/4"'],
  ['reseau','pebd16','PEBD rigide Ø16'],
  ['reseau','OD501','Coude SBE 050, 16 x 1/2"'],
  ['reseau','OD502','Coude SBE 075, 16 x 3/4"'],
  ['arroseur','RA3504','Turbine Rain Bird 3504'],
  ['arroseur','RA2181','Turbine Rain Bird 5004 Plus'],
  ['arroseur','RA5006PC','Turbine Rain Bird 5006 Plus'],
  ['arroseur','RA5012PCSAM','Turbine Rain Bird 5012 Plus SAM'],
  ['arroseur','RT1802','Tuyère Rain Bird 1802'],
  ['arroseur','RT1804','Tuyère Rain Bird 1804'],
  ['arroseur','RT1806','Tuyère Rain Bird 1806'],
  ['arroseur','RT1812','Tuyère Rain Bird 1812'],
  ['arroseur','VAN','Buse Rain Bird 12-VAN'],
  ['nourrice','regard-jumbo5','Regard jumbo 5 voies'],
  ['nourrice','regard-jumbo6','Regard jumbo 6 voies'],
  ['nourrice','prog-2','Programmateur Solem BL-IP 2 stations 9V'],
  ['nourrice','prog-6','Programmateur Solem BL-IP 6 stations 9V'],
  ['arroseur','RT1824','Tuyère Rain Bird 1800 SAM, 1804'],
  ['arroseur','RT1826','Tuyère Rain Bird 1800 SAM, 1806'],
  ['arroseur','RT1822','Tuyère Rain Bird 1812-SAM'],
  ['arroseur','RT1834','Tuyère Rain Bird 1800 SAM-PRS, 1804'],
  ['arroseur','RT1836','Tuyère Rain Bird 1800 SAM-PRS, 1806'],
  ['arroseur','RT1832','Tuyère Rain Bird 1812-SAM-PRS'],
  ['arroseur','HT1541','Tuyère Hunter Pro-Spray-02'],
  ['arroseur','HT1543','Tuyère Hunter Pro-Spray-04'],
  ['arroseur','HT1544','Tuyère Hunter Pro-Spray-06'],
  ['arroseur','HT1546','Tuyère Hunter Pro-Spray-12'],
  ['arroseur','HT1521','Tuyère Hunter I-Spray-04'],
  ['arroseur','HT1522','Tuyère Hunter I-Spray-06'],
  ['arroseur','HT1523','Tuyère Hunter I-Spray-12, à régulateur'],
  ['arroseur','HA2211','Turbine Hunter PGP-ADJ'],
  ['arroseur','HA2210','Turbine Hunter PGP Ultra'],
  ['arroseur','HA2222','Turbine Hunter I 20-04 Ultra'],
  ['arroseur','HA2225','Turbine Hunter I 20-04 Ultra SS Inox'],
  ['arroseur','HA2264','Turbine Hunter SRM-04'],
  ['arroseur','HA2274','Turbine Hunter PGJ-04'],
  ['arroseur','HA2272','Turbine Hunter PGJ-12'],
  ['arroseur','RA5004FC','Turbine Rain Bird 5004 Plus FC'],
  ['arroseur','RA2180','Turbine Rain Bird 5004 Plus SS'],
  ['arroseur','RA3504SAM','Turbine Rain Bird 3504 SAM'],
  ['arroseur','TAMINI8-4P','Turbine Toro Mini 8'],
  ['buse','RBT640','Buse Rain Bird 4-VAN'],
  ['buse','RBT639','Buse Rain Bird 6-VAN'],
  ['buse','RBT638','Buse Rain Bird 8-VAN'],
  ['buse','RBT637','Buse Rain Bird 10-VAN'],
  ['buse','RBT636','Buse Rain Bird 12-VAN'],
  ['buse','RBT601','Buse Rain Bird 15-VAN'],
  ['buse','RBT648','Buse Rain Bird 18-VAN'],
  ['buse','RBT1418','Buse Rain Bird 14 R-VAN réglable'],
  ['buse','RBT1419','Buse Rain Bird 14 R-VAN 360°'],
  ['buse','RBT1428','Buse Rain Bird 18 R-VAN réglable'],
  ['buse','RBT1429','Buse Rain Bird 18 R-VAN 360°'],
  ['buse','RBT1438','Buse Rain Bird 24 R-VAN réglable'],
  ['buse','RBT1439','Buse Rain Bird 24 R-VAN 360°'],
  ['goutte','UGGCBL23050','Tube Toro Ø16mm 2l/h esp.33cm autorégulé'],
  ['option','RP403','Sonde de pluie Rain Bird RSD-BEx'],
];
const dossier = S + '/photos';
const fichiers = readdirSync(dossier).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const manifeste = existsSync(dossier + '/manifeste.json') ? JSON.parse(readFileSync(dossier + '/manifeste.json', 'utf8')) : [];
mkdirSync(S + '/valider/photos', { recursive: true });
const photos = [];
for (const [groupe, ref, nom, refAquaPlus] of CIBLES) {
  const siens = fichiers.filter((f) => f.replace(/-\d+\.\w+$/, '') === ref).sort();
  if (!siens.length) { photos.push({ cle: ref, groupe, ref, nom, fichier: null }); continue; }
  siens.forEach((f, i) => {
    const m = manifeste.find((x) => x.fichier === f || (x.fichier || '').endsWith('/' + f)) || {};
    copyFileSync(dossier + '/' + f, S + '/valider/photos/' + f);
    // Ce qu'une photo précise sur le nom de la pièce : sa remarque du 17 octobre
    // 2026, « l'une c'est mâle-mâle, l'autre femelle-femelle ».
    const PRECISION = { 'vanne-purge-1': ', femelle-femelle', 'vanne-purge-2': ', mâle-mâle' };
    const cle = f.replace(/\.\w+$/, '');
    photos.push({ cle, groupe, ref: refAquaPlus || ref, nom: nom + (PRECISION[cle] || ''), rang: i + 1, fichier: 'photos/' + f,
                  site: m.site || '', doute: (m.doute || '').replace(/\s*·\s*/g, '. ').replace(/\s+—\s+/g, ', ') });
  });
}
const t = readFileSync(S + '/valider/modele.html', 'utf8').replace('/*PHOTOS*/[]', JSON.stringify(photos));
writeFileSync(S + '/valider/photos-des-pieces.html', t);
const fichiersPublies = {};
photos.filter((p) => p.fichier).forEach((p) => { fichiersPublies[p.fichier] = S + '/valider/' + p.fichier; });
writeFileSync(S + '/valider/fichiers.json', JSON.stringify(fichiersPublies));
console.log(photos.filter((p) => p.fichier).length, 'photos,', photos.filter((p) => !p.fichier).length, 'à trouver');

// Le moteur des trois planches de la facture impayée : l'avoir, « Il ne me
// paiera pas » et la mise en demeure. Un seul jeu d'écrans pour les trois,
// sinon trois copies du même écran finiraient par se contredire. Chaque page
// déclare son PARCOURS (ses écrans, son premier écran, ses récits propres).
//
// Sa demande du 24 septembre : « trois planches séparées », après une seule
// planche qui montrait tout. RIEN N'EST CODÉ : `src/` n'est pas touché.
//
// Le pourquoi de chaque écran (ses phrases, la loi lue au BOFiP, ses choix) vit
// dans TODO.md, entrée « L'AVOIR » : un commentaire HTML dans cette chaîne serait
// du texte, pas un commentaire.
document.getElementById("tel").innerHTML = `
  <section class="ecran" data-e="termines">
    <div class="haut"><div class="titre" style="padding:0"><h1>Terminés</h1></div><span class="bulle"></span></div>
    <div class="tva">
      <div><div class="caps or">Ma TVA à déclarer</div><div class="mois">Octobre 2026</div></div>
      <div class="m">0,00 €</div>
    </div>
    <div class="deux"><span class="capsule">Retours d'intervention</span><span class="capsule or">Créer une facture</span></div>
    <div class="moisnav"><span class="ch">‹</span>Octobre 2026<span class="ch eteint">›</span></div>
    <div class="compte">1 facturé</div>
    <button type="button" class="fact cible" data-va="choix">
      <span class="l1"><span>Taille de haie</span><span>1 440,00 €</span></span>
      <span class="l2">Facturé le 9 octobre, Facture n° 12</span>
    </button>
    <div class="voile" id="voile" hidden>
      <div class="feuille-choix">
        <p class="caps" style="text-align:center;margin:0 0 6px">Taille de haie, M. Martin</p>
        <button type="button" data-va="facture">La facture</button>
        <button type="button" data-va="combien">Je fais un avoir</button>
        <button type="button" data-va="perdue">Il ne me paiera pas</button>
        <button type="button" class="annuler" data-va="termines">Annuler</button>
      </div>
    </div>
  </section>

  <section class="ecran" data-e="facture">
    <div class="haut"><button type="button" class="fleche" data-va="termines">‹</button><span class="bulle"></span></div>
    <div class="titre"><h1>Facture</h1><p class="sur">Taille de haie</p></div>
    <div data-corps-facture></div>
    <div class="carte">
      <div class="caps">Règlements reçus</div>
      <div class="net"><b>Net à payer</b><span class="m">1 440,00 €</span></div>
    </div>
    <div class="carte">
      <p class="arretee" style="margin:0">Facture F2026-000012 arrêtée.</p>
      <button type="button" class="lien cible" data-va="question">Mon client ne me paie pas</button>
    </div>
  </section>

  <section class="ecran" data-e="question">
    <div class="haut"><button type="button" class="fleche" data-va="facture">‹</button><span></span></div>
    <div class="titre"><h1>Que voulez-vous faire&nbsp;?</h1><p class="sur">M. Martin doit 1 440,00 €</p></div>
    <div class="question">
      <button type="button" class="reponse cible" data-va="combien">
        <span class="n">Je fais un avoir</span>
      </button>
      <button type="button" class="reponse cible" data-va="perdue">
        <span class="n">Il ne me paiera pas</span>
      </button>
    </div>
  </section>

  <section class="ecran" data-e="combien">
    <div class="haut"><button type="button" class="fleche" data-va="question">‹</button><span></span></div>
    <div class="titre"><h1>Vous lui enlevez combien&nbsp;?</h1><p class="sur">M. Martin</p></div>
    <div class="carte">
      <div class="calc">
        <div class="ligne"><span>Facture TTC</span><span class="v">1 440,00 €</span></div>
        <button type="button" class="ligne deroulant" id="portee" aria-expanded="false">
          <span>Sur</span>
          <span class="choisi"><span class="v" data-montre="porteeChoisie">Toute la facture</span>
            <svg class="chevron" viewBox="0 0 16 10" width="16" height="10" aria-hidden="true"><path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
        <div class="bandeau" id="portees" hidden></div>
        <label class="ligne" for="montant"><span>Avoir TTC</span>
          <span class="saisie"><input id="montant" inputmode="decimal" autocomplete="off" placeholder="0,00" value="300"><span class="serif" style="font-size:19px">€</span></span></label>
      </div>
      <div class="net"><b>Nouveau montant TTC</b><span class="m" data-montre="reste">1 140,00 €</span></div>
      <p class="refus" data-montre="refus" hidden></p>
      <label class="motif" for="motif"><span class="caps">Motif</span>
        <input id="motif" autocomplete="off" value="Geste commercial" placeholder="Geste commercial"></label>
    </div>
    <button type="button" class="vert cible" data-va="fait" id="cestbon">C'est bon</button>
  </section>

  <section class="ecran fin" data-e="fait">
    <div class="coche">✓</div>
    <h2>C'est fait</h2>
    <p data-montre="phrase">M. Martin ne doit plus que 1 140,00 €.</p>
    <div class="papier" id="papier"><div class="a4" id="a4">
      <div class="p-haut">
        <div><div class="p-nom">Atelier Démo</div>
          <div class="p-coord">10 rue des Artisans, Nantes<br>02 40 00 00 00<br>contact@atelier-demo.fr<br>SIRET 123 456 789 00012</div></div>
        <table class="p-ref">
          <tr><th>Date</th><td>27/10/2026</td></tr>
          <tr><th>Facture</th><td>F2026-000012</td></tr>
          <tr><th>du</th><td>09/10/2026</td></tr>
        </table>
      </div>
      <div class="p-filet"></div>
      <div class="p-titre"><span>AVOIR</span><span class="p-num">n° A2026-000001</span></div>
      <div class="p-parties">
        <div><div class="p-lab">Client</div>M. Martin<br>5 rue des Lilas, Nantes<br>06 79 98 45 14</div>
        <div><div class="p-lab">Lieu des travaux</div>5 rue des Lilas, Nantes</div>
      </div>
      <div class="p-rectifie"><div class="p-lab">Rectifie la facture</div>n° F2026-000012 du 09/10/2026, prestation de services.
        <span data-montre="motifLigne">Motif : Geste commercial.</span></div>
      <table class="p-lignes">
        <thead><tr><th class="g">Désignation</th><th>Qté</th><th class="c">Unité</th><th>P.U. HT</th><th>Total HT</th><th class="c">TVA %</th><th>Total TTC</th></tr></thead>
        <tbody id="lignesAvoir"></tbody>
      </table>
      <div class="p-bas">
        <table class="p-tva">
          <tr><th class="g">Base HT</th><th class="c">Taux</th><th>TVA</th></tr>
          <tr><td class="g" data-montre="baseHT">- 250,00 €</td><td class="c">20 %</td><td data-montre="baseTVA">- 50,00 €</td></tr>
        </table>
        <div class="p-totaux">
          <div class="t"><b>Total HT</b><b data-montre="totHT">- 250,00 €</b></div>
          <div class="t"><span>TVA 20 %</span><span data-montre="totTVA">- 50,00 €</span></div>
          <div class="p-ttc"><span>Total avoir TTC</span><span data-montre="totTTC">- 300,00 €</span></div>
        </div>
      </div>
      <table class="p-apres">
        <tr><th class="g">Rectification</th><th>HT</th><th>TVA</th><th>TTC</th></tr>
        <tr><td class="g">Facture F2026-000012</td><td>1 200,00 €</td><td>240,00 €</td><td>1 440,00 €</td></tr>
        <tr><td class="g">Avoir</td><td data-montre="apAvHT">- 250,00 €</td><td data-montre="apAvTVA">- 50,00 €</td><td data-montre="apAvTTC">- 300,00 €</td></tr>
        <tr class="du"><td class="g">Reste dû</td><td data-montre="duHT">950,00 €</td><td data-montre="duTVA">190,00 €</td><td data-montre="duTTC">1 140,00 €</td></tr>
      </table>
      <div class="p-page">Page 1 / 1</div>
    </div></div>
    <div class="envoi"><span class="caps">Envoi</span><span class="onglets"><span class="la">SMS</span><span>E-mail</span></span></div>
    <div class="au">Au 06 79 98 45 14</div>
    <button type="button" class="vert cible" data-va="factureA">Envoyer l'avoir</button>
  </section>

  <section class="ecran" data-e="factureA">
    <div class="haut"><button type="button" class="fleche" data-va="termines">‹</button><span class="bulle"></span></div>
    <div class="titre"><h1>Facture</h1><p class="sur">Taille de haie</p></div>
    <div data-corps-facture></div>
    <div class="carte">
      <div class="caps">Règlements reçus</div>
      <div class="regl"><span>Avoir A2026-000001<small>27 octobre, envoyé par SMS</small></span><span data-montre="moins">- 300,00 €</span></div>
      <div class="net"><b>Net à payer</b><span class="m" data-montre="reste2">1 140,00 €</span></div>
    </div>
    <div class="carte"><p class="arretee" style="margin:0">Facture F2026-000012 arrêtée.</p></div>
  </section>

  <section class="ecran" data-e="ficheA">
    <div class="haut"><button type="button" class="fleche rond" data-va="factureA">‹</button><span class="bulle"></span></div>
    <div class="titre"><p class="sur" style="margin:0 0 10px">Client</p><h1 style="font-size:46px">M. Martin</h1></div>
    <p class="doux" style="margin:12px 22px 0">06 79 98 45 14</p>
    <p class="caps or" style="margin:26px 22px 0">Modifier ses coordonnées</p>
    <p class="caps" style="margin:30px 22px 0;letter-spacing:.2em">Dernière prestation le 9 oct. 2026</p>
    <div class="deux" style="margin-top:16px">
      <span class="vert" style="margin:0;width:auto;flex:1;min-height:50px;font-size:18px">Dernier devis</span>
      <span class="contour" style="margin:0;width:auto;flex:1;min-height:50px">Autre chantier</span>
    </div>
    <div class="onglets-fiche">
      <button type="button" data-o="devis">Devis</button>
      <button type="button" data-o="factures">Factures</button>
      <button type="button" data-o="fiches">Fiches</button>
      <button type="button" data-o="avoirs" class="neuf" aria-pressed="true">Avoirs</button>
    </div>
    <div class="liste" data-l="devis" hidden><span class="serif">n° 2026-000002</span><span class="doux">9 oct. 2026 ›</span></div>
    <div class="liste" data-l="factures" hidden><span class="serif">n° F2026-000012</span><span class="doux">9 oct. 2026 ›</span></div>
    <div class="liste" data-l="fiches" hidden><span class="doux">Aucune fiche</span><span></span></div>
    <button type="button" class="liste cible" data-l="avoirs" data-va="avoirVu"><span class="serif">n° A2026-000001</span><span class="doux">27 oct. 2026 ›</span></button>
    <p class="caps" style="margin:34px 22px 0;color:var(--alerte)">Supprimer ce client</p>
  </section>

  <section class="ecran" data-e="avoirVu">
    <div class="haut"><button type="button" class="fleche" data-va="ficheA">‹</button><span class="bulle"></span></div>
    <div class="titre"><h1>Avoir</h1><p class="sur">A2026-000001, M. Martin</p></div>
    <div id="papierFiche"></div>
    <div class="liens-pdf" style="margin-top:18px"><span>Voir l'avoir en PDF</span><span>Télécharger (A2026-000001.pdf)</span></div>
  </section>

  <section class="ecran" data-e="perdue">
    <div class="haut"><button type="button" class="fleche" data-va="question">‹</button><span></span></div>
    <div class="titre"><h1>Il ne vous paiera pas</h1><p class="sur">F2026-000012, M. Martin</p></div>
    <div class="carte">
      <div class="ligne"><span>Il vous doit toujours</span><span class="v serif" style="font-size:20px">1 440,00 €</span></div>
      <p class="doux" style="margin:12px 0 0;font-size:14px">Rien ne part chez lui. Atlas arrête de vous le rappeler.</p>
    </div>
    <button type="button" class="vert cible" data-va="termB">C'est noté</button>
  </section>

  <section class="ecran" data-e="termB">
    <div class="haut"><div class="titre" style="padding:0"><h1>Terminés</h1></div><span class="bulle"></span></div>
    <div class="tva">
      <div><div class="caps or">Ma TVA à déclarer</div><div class="mois">Octobre 2026</div></div>
      <div class="m">0,00 €</div>
    </div>
    <div class="deux"><span class="capsule">Retours d'intervention</span><span class="capsule or">Créer une facture</span></div>
    <button type="button" class="nonpayees cible" data-va="nonPayees">
      <span>Non payées</span><span class="nb">1</span>
    </button>
    <div class="moisnav"><span class="ch">‹</span>Octobre 2026<span class="ch eteint">›</span></div>
    <div class="compte">1 facturé</div>
    <div class="fact" style="cursor:default">
      <span class="l1"><span>Taille de haie</span><span>1 440,00 €</span></span>
      <span class="l2">Facturé le 9 octobre, Facture n° 12</span>
    </div>
  </section>

  <section class="ecran" data-e="nonPayees">
    <div class="haut"><button type="button" class="fleche" data-va="termB">‹</button><span class="bulle"></span></div>
    <div class="titre"><h1>Non payées</h1></div>
    <button type="button" class="fact cible" data-va="factureB" style="margin-top:26px">
      <span class="l1"><span>Taille de haie</span><span>1 440,00 €</span></span>
      <span class="l2">M. Martin, Facture n° 12, depuis le 27 octobre</span>
    </button>
  </section>

  <section class="ecran" data-e="factureB">
    <div class="haut"><button type="button" class="fleche" data-va="termines">‹</button><span class="bulle"></span></div>
    <div class="titre"><h1>Facture</h1><p class="sur">Taille de haie</p></div>
    <div data-corps-facture></div>
    <div class="carte">
      <div class="caps">Règlements reçus</div>
      <div class="net"><b>Net à payer</b><span class="m">1 440,00 €</span></div>
      <div class="encadre"><p>Non payée<small>Depuis le 27 octobre.</small></p></div>
      <button type="button" class="vert cible" data-va="paye" style="width:100%;font-size:20px">J'ai reçu le paiement</button>
      <button type="button" class="contour cible" data-va="mise" style="width:100%">Mise en demeure</button>
    </div>
    <div class="carte"><p class="arretee" style="margin:0">Facture F2026-000012 arrêtée.</p></div>
  </section>

  <section class="ecran" data-e="mise">
    <div class="haut"><button type="button" class="fleche" data-va="factureB">‹</button><span></span></div>
    <div class="titre"><h1>Mise en demeure</h1><p class="sur">F2026-000012, M. Martin</p></div>
    <div class="papier"><div class="a4 lettre">
      <div class="p-haut">
        <div><div class="p-nom">Atelier Démo</div>
          <div class="p-coord">10 rue des Artisans, Nantes<br>02 40 00 00 00<br>contact@atelier-demo.fr<br>SIRET 123 456 789 00012</div></div>
        <div class="dest">M. Martin<br>5 rue des Lilas<br>Nantes</div>
      </div>
      <div class="p-filet"></div>
      <div class="lieu">Nantes, le 27 octobre 2026<br><b>Lettre recommandée avec accusé de réception</b></div>
      <div class="p-titre"><span>MISE EN DEMEURE</span><span class="p-num">Facture n° F2026-000012</span></div>
      <p>Monsieur Martin,</p>
      <p>Par facture n° F2026-000012 du 9 octobre 2026, je vous ai facturé les travaux réalisés au 5 rue des Lilas, à Nantes, pour un montant de <b>1 440,00 € TTC</b>, payable avant le 24 octobre 2026.</p>
      <p>À ce jour, cette somme reste impayée.</p>
      <p>Je vous mets en demeure de me régler la somme de <b>1 440,00 €</b> dans un délai de <b>huit jours</b> à compter de la réception de ce courrier.</p>
      <p>Sans paiement dans ce délai, je saisirai le tribunal compétent par une procédure d'injonction de payer, sans autre avis. Les intérêts au taux légal courent à compter de la présente lettre.</p>
      <p>Je vous prie d'agréer, Monsieur, mes salutations distinguées.</p>
      <p class="signe">Atelier Démo</p>
      <div class="p-page">Page 1 / 1</div>
    </div></div>
    <button type="button" class="vert cible">Télécharger la lettre</button>
    <p class="au">À envoyer en recommandé avec accusé de réception.</p>
  </section>

  <section class="ecran" data-e="paye">
    <div class="haut"><button type="button" class="fleche" data-va="factureB">‹</button><span></span></div>
    <div class="titre"><h1>Il vous a payé</h1><p class="sur">F2026-000012, M. Martin</p></div>
    <div class="carte">
      <div class="calc">
        <button type="button" class="ligne deroulant" id="moyen" aria-expanded="false">
          <span>Moyen</span>
          <span class="choisi"><span class="v" data-montre="moyenChoisi">Chèque</span>
            <svg class="chevron" viewBox="0 0 16 10" width="16" height="10" aria-hidden="true"><path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
        <div class="bandeau" id="moyens" hidden>
          <button type="button" aria-pressed="true">Chèque</button>
          <button type="button" aria-pressed="false">Virement</button>
          <button type="button" aria-pressed="false">Espèces</button>
          <button type="button" aria-pressed="false">Carte</button>
        </div>
        <label class="ligne" for="numeroCheque" id="ligneCheque"><span>N° de chèque</span>
          <span class="saisie"><input id="numeroCheque" inputmode="numeric" autocomplete="off" placeholder="1234567" value="5800755"></span></label>
        <div class="ligne"><span>Le</span><span class="v">12 novembre</span></div>
        <div class="ligne"><span>Montant</span><span class="v">1 440,00 €</span></div>
      </div>
    </div>
    <button type="button" class="vert cible" data-va="factureB2">C'est noté</button>
  </section>

  <section class="ecran" data-e="factureB2">
    <div class="haut"><button type="button" class="fleche" data-va="paye">‹</button><span class="bulle"></span></div>
    <div class="titre"><h1>Facture</h1><p class="sur">Taille de haie</p></div>
    <div data-corps-facture></div>
    <div class="carte">
      <div class="caps">Règlements reçus</div>
      <div class="regl"><span>Paiement<small>12/11/2026</small></span><span class="centre"><span data-montre="moyen">chèque</span><small data-montre="numero">n° 5800755</small></span><span>1 440,00 €</span></div>
      <div class="net"><b>Net à payer</b><span class="m">0,00 €</span></div>
      <div class="encadre"><p>Facture acquittée</p></div>
    </div>
    <button type="button" class="contour cible" data-va="tvaB">Voir Ma TVA</button>
  </section>

  <section class="ecran" data-e="tvaB">
    <div class="haut"><div class="titre" style="padding:0"><h1>Terminés</h1></div><span class="bulle"></span></div>
    <div class="tva cible-tva">
      <div><div class="caps or">Ma TVA à déclarer</div><div class="mois">Novembre 2026</div></div>
      <div class="m">240,00 €</div>
    </div>
    <div class="deux"><span class="capsule">Retours d'intervention</span><span class="capsule or">Créer une facture</span></div>
    <div class="coupe" style="margin-top:22px">(la liste des chantiers, comme aujourd'hui)</div>
  </section>

  <nav class="barre"><button type="button" id="versClients">CHANTIERS</button><span>PLANNING</span><span class="la" id="ongletTermines">TERMINÉS</span><span>PAYSAGE</span><span>RÉGLAGES</span></nav>
`;
  // Le récit de chaque écran : ce qui se passe, et où poser le doigt.
  const RECIT = {
    termines: ["Vous êtes ici", "Nous sommes le <b>27 octobre</b>. M. Martin devait payer avant le 24 octobre, et Atlas vous l'a déjà signalé par une notification «&nbsp;Facture impayée&nbsp;». Vous ouvrez <b>Terminés</b>. <b>Touchez la ligne Taille de haie.</b>"],
    choix:    ["Le volet", "Toucher la ligne ouvre un volet à trois choix : <b>la facture</b>, <b>un avoir</b>, ou <b>il ne paiera pas</b>. <b>Essayez «&nbsp;Je fais un avoir&nbsp;»</b>, puis revenez avec «&nbsp;Recommencer&nbsp;» pour les deux autres."],
    facture:  ["Sa facture", "«&nbsp;La facture&nbsp;» ouvre <b>la facture définitive</b>, en entier, comme aujourd'hui. <b>Descendez</b> : le lien doré du bas mène aux mêmes réponses que le volet. <b>Touchez «&nbsp;Mon client ne me paie pas&nbsp;».</b>"],
    question: ["La question", "Deux réponses, qui font l'inverse l'une de l'autre. <b>Essayez la première</b>, puis revenez avec «&nbsp;Recommencer&nbsp;» pour essayer la seconde."],
    combien:  ["Première réponse : vous faites un avoir", "Vous faites un geste commercial, ou vous réglez un désaccord. Choisissez <b>sur quelle ligne</b> porte l'avoir (ou toute la facture), puis <b>écrivez le montant</b> que vous lui retirez : Atlas vous donne tout de suite le nouveau montant de la facture. Le <b>motif</b> est écrit sur l'avoir, la loi le demande. Puis <b>«&nbsp;C'est bon&nbsp;»</b>."],
    fait:     ["L'avoir est prêt", "Atlas a fait le document, avec son propre numéro et <b>tout ce que la loi demande</b> : la facture corrigée et sa date, vos deux adresses, le motif, et le HT, la TVA et le TTC, de l'avoir et de ce qui reste dû. Il part <b>comme la facture</b>, par SMS ou par e-mail. <b>Touchez «&nbsp;Envoyer l'avoir&nbsp;».</b>"],
    factureA: ["La facture, après", "L'avoir apparaît dans les règlements, et le <b>Net à payer</b> descend. Plus de notification pour la somme enlevée. <b>Et pour le retrouver plus tard ?</b> Touchez <b>CHANTIERS</b> en bas, puis «&nbsp;Vos clients&nbsp;», puis M. Martin (ici, on saute la liste)."],
    ficheA:   ["Sa fiche client", "Un onglet <b>Avoirs</b> est apparu, à côté de Devis, Factures et Fiches. <b>Il n'existe que chez les clients à qui vous avez envoyé un avoir</b> : chez tous les autres, rien ne change. <b>Touchez l'avoir.</b>"],
    avoirVu:  ["L'avoir, retrouvé", "Le document tel qu'il est parti chez M. Martin, avec son PDF à ouvrir ou à télécharger, comme une facture. Fin de la première branche."],
    perdue:   ["Seconde réponse : il ne vous paiera pas", "Le client refuse ou a disparu. Vous gardez votre droit : <b>rien n'est annulé</b>. <b>Touchez «&nbsp;C'est noté&nbsp;».</b>"],
    termB:    ["Terminés, avec une catégorie de plus", "Une petite catégorie <b>Non payées</b> est apparue sous les deux boutons. <b>Elle n'existe que tant qu'une facture y est rangée</b> : sans facture non payée, vous ne la voyez jamais. <b>Touchez-la.</b>"],
    nonPayees:["Les factures non payées", "Toutes vos factures non payées, rangées ici. <b>Touchez celle de M. Martin.</b>"],
    factureB: ["La facture, après", "La facture reste entière, marquée <b>Non payée</b>. Atlas ne vous la rappelle plus. Deux gestes restent : la <b>mise en demeure</b>, et «&nbsp;J'ai reçu le paiement&nbsp;» s'il paie un jour. <b>Touchez «&nbsp;Mise en demeure&nbsp;».</b>"],
    mise:     ["La mise en demeure", "La lettre officielle qui lui donne <b>huit jours pour payer</b>, avant le tribunal. Atlas la remplit seule : le client, la facture, le montant, les dates. Vous la téléchargez et l'envoyez en recommandé. Puis revenez à la facture («&nbsp;Retour&nbsp;») : <b>s'il paie</b>, touchez «&nbsp;J'ai reçu le paiement&nbsp;»."],
    paye:     ["Il a finalement payé", "Vous notez le paiement comme n'importe quel règlement. <b>Touchez «&nbsp;Moyen&nbsp;»</b> pour choisir chèque, virement, espèces ou carte. Pour un chèque, <b>son numéro</b> s'écrit dessous. Puis <b>«&nbsp;C'est noté&nbsp;»</b>."],
    factureB2:["La facture, payée", "Le «&nbsp;Non payée&nbsp;» disparaît : la facture est <b>acquittée</b>, le Net à payer tombe à zéro. <b>Touchez «&nbsp;Voir Ma TVA&nbsp;».</b>"],
    tvaB:     ["Elle entre au relevé de TVA", "Les <b>240,00 €</b> de TVA de cette facture entrent au relevé de <b>novembre</b>, le mois où il a payé, pas celui de la facture. C'est la règle de l'encaissement, et c'est déjà ce que fait votre relevé aujourd'hui. Et la catégorie <b>Non payées</b> a disparu : elle était vide. Fin de la seconde branche."],
  };
  Object.assign(RECIT, PARCOURS.recit || {});
  // Le détour commun : « La facture », puis la question du bas de facture.
  const DETOUR = ["termines","choix","facture","question"];
  // Ce qui n'est pas dans CETTE planche s'ouvre dans la planche qui le montre.
  const AILLEURS = { combien: "avoir.html", perdue: "il-ne-paiera-pas.html", mise: "mise-en-demeure.html", paye: "il-ne-paiera-pas.html" };
  let chemin = [PARCOURS.debut];

  const ecrans = [...document.querySelectorAll(".ecran")];
  const $ = (s) => document.querySelector(s);

  function montrer(cle){
    // Le volet s'ouvre PAR-DESSUS Terminés : l'écran reste, le volet monte.
    const ecran = cle === "choix" ? "termines" : cle;
    ecrans.forEach((e) => e.classList.toggle("ouvert", e.dataset.e === ecran));
    $("#voile").hidden = cle !== "choix";
    const branche = PARCOURS.ordre.includes(cle) ? PARCOURS.ordre : DETOUR;
    const rang = branche.indexOf(cle);
    $("#etape").textContent = "Étape " + (rang + 1) + " sur " + branche.length + ". " + RECIT[cle][0];
    $("#texte").innerHTML = RECIT[cle][1];
    $("#points").innerHTML = branche.map((_, i) => '<i class="' + (i === rang ? "la" : "") + '"></i>').join("");
    $("#avant").disabled = chemin.length < 2;
    const versClients = $("#versClients");
    versClients.classList.toggle("cible", cle === "factureA");
    versClients.classList.toggle("la", cle === "ficheA");
    $("#ongletTermines").classList.toggle("la", cle !== "ficheA");
    if (cle === "avoirVu") {
      // Le papier de l'avoir envoyé, recopié tel quel : c'est le même document.
      const copie = $("#papier").cloneNode(true);
      copie.id = "papierCopie"; copie.querySelector("#a4").id = "a4Copie";
      $("#papierFiche").replaceChildren(copie);
    }
    if (cle === "fait" || cle === "avoirVu" || cle === "mise") ajusterPapier();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function aller(cle){ chemin.push(cle); montrer(cle); }

  document.querySelectorAll("[data-va]").forEach((b) =>
    b.addEventListener("click", () => {
      const cle = b.dataset.va;
      // « ‹ » revient d'un écran ; tout le reste avance.
      if (b.classList.contains("fleche")) { chemin.pop(); if (!chemin.length) chemin = [PARCOURS.debut]; montrer(chemin[chemin.length - 1]); return; }
      if (!PARCOURS.ordre.includes(cle) && !DETOUR.includes(cle) && AILLEURS[cle]) { location.href = AILLEURS[cle]; return; }
      if (cle === PARCOURS.debut) { chemin = [cle]; montrer(cle); return; }
      aller(cle);
    }));
  $("#avant").addEventListener("click", () => { if (chemin.length > 1) { chemin.pop(); montrer(chemin[chemin.length - 1]); } });
  $("#recommencer").addEventListener("click", () => { chemin = [PARCOURS.debut]; montrer(PARCOURS.debut); });

  // Le montant : les chiffres sortent d'un seul calcul, affichés partout.
  const TOTAL = 1440;
  const euros = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ") + " €";
  // En centimes : 1 440,00 moins 0,10 ne doit jamais rendre 1 439,8999.
  function lire(texte){
    const t = String(texte).replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    return Math.round(Number(t) * 100);
  }
  const TOTAL_C = TOTAL * 100;
  function poser(){
    const c = lire($("#montant").value);
    const refus = $('[data-montre="refus"]');
    let dire = "";
    if ($("#montant").value.trim() === "") dire = "Écrivez le montant de l'avoir.";
    else if (c === null) dire = "Ce montant ne se lit pas. Exemple : 300 ou 250,50.";
    else if (c === 0) dire = "Un avoir de 0 € ne change rien.";
    else if (c > plafond()) dire = portee < 0 ? "C'est plus que la facture : " + euros(TOTAL) + " au plus." : "C'est plus que cette ligne : " + euros(plafond() / 100) + " au plus.";
    else if ($("#motif").value.trim() === "") dire = "Écrivez le motif : la loi le demande sur l'avoir.";
    refus.hidden = !dire; refus.textContent = dire;
    $("#cestbon").disabled = !!dire;
    const m = dire ? 0 : c / 100;
    const reste = (TOTAL_C - (dire ? 0 : c)) / 100;
    $('[data-montre="reste"]').textContent = euros(reste);
    $('[data-montre="reste2"]').textContent = euros(reste);
    const avTTC = dire ? 0 : c;
    // Le HT se déduit du TTC saisi ; la TVA est la différence, pour que
    // HT + TVA retombe TOUJOURS sur le TTC écrit, au centime.
    const avHT = Math.round(avTTC / 1.2);
    remplirPapier(avTTC, avHT, avTTC - avHT);
    $('[data-montre="moins"]').textContent = "- " + euros(m);
    $('[data-montre="phrase"]').textContent = reste === 0 ? "M. Martin ne doit plus rien." : "M. Martin ne doit plus que " + euros(reste) + ".";
  }
  // La facture définitive, la même sur chaque écran qui la montre : une seule
  // écriture, sinon deux copies finiraient par se contredire.
  const CORPS_FACTURE = () => `
    <div class="carte">
      <div class="caps">Facture</div>
      <div style="margin-top:8px">F2026-000012, M. Martin</div>
      <div class="doux" style="font-size:14px;margin-top:4px">À régler avant le vendredi 24 octobre</div>
    </div>
    <div class="carte">
      <div class="caps">Reprise du devis 2026-000002 V1</div>
      <div style="margin-top:10px">${LIGNES.map(([lib, q, , pu]) => `<div class="fl"><span>${lib}</span><span class="v">${fmt(pu * Number(q))}</span></div>`).join("")}</div>
    </div>
    <div class="carte">
      <div class="fl"><span class="doux">Total HT</span><span>1 200,00 €</span></div>
      <div class="fl"><span class="doux">TVA 20 %</span><span>240,00 €</span></div>
      <div class="ttc"><div class="caps">Total TTC</div><div class="ttc-grand">1 440,00 €</div>
        <div class="liens-pdf"><span>Voir la facture en PDF</span><span>Télécharger (F2026-000012.pdf)</span></div></div>
    </div>`;

  // Les lignes de la facture de M. Martin : 1 200,00 € HT, TVA 20 %.
  const LIGNES = [
    ["Taille de haie de thuyas, trois faces", "38", "ml", 1200],
    ["Taille de haie de lauriers, deux faces", "22", "ml", 1500],
    ["Désherbage manuel des massifs", "4", "h", 4500],
    ["Évacuation des déchets verts en déchetterie", "1", "forfait", 16400],
    ["Déplacement", "2", "u", 3500],
  ];
  const fmt = (c) => euros(Math.abs(c) / 100);
  const signe = (c) => (c > 0 ? "- " : "") + fmt(c);
  // Un avoir TOTAL reprend chaque ligne de la facture, en négatif ; un avoir
  // PARTIEL tient en une ligne, son motif. Dans les deux cas, les totaux se
  // lisent comme sur la facture.
  // -1 : toute la facture ; sinon le rang de la ligne choisie.
  let portee = -1;
  const ttcLigne = (i) => Math.round(LIGNES[i][3] * Number(LIGNES[i][1]) * 1.2);
  const plafond = () => (portee < 0 ? TOTAL_C : ttcLigne(portee));
  function remplirPapier(ttc, ht, tva){
    const total = ttc === TOTAL_C;
    const motif = $("#motif").value.trim();
    const cellules = (lib, q, u, pu, htL) => "<tr><td class=\"g\">" + lib + "</td><td>" + q + "</td><td class=\"c\">" + u
      + "</td><td>" + signe(pu) + "</td><td>" + signe(htL) + "</td><td class=\"c\">20</td><td>" + signe(Math.round(htL * 1.2)) + "</td></tr>";
    $("#lignesAvoir").innerHTML = total
      ? LIGNES.map(([lib, q, u, pu]) => cellules(lib, q, u, pu, pu * Number(q))).join("")
      : cellules((motif ? motif + ", sur " : "Sur ") + (portee < 0 ? "la facture F2026-000012" : LIGNES[portee][0].charAt(0).toLowerCase() + LIGNES[portee][0].slice(1)), "1", "u", ht, ht);
    $('[data-montre="motifLigne"]').textContent = motif ? "Motif : " + motif + "." : "";
    for (const [cle, v] of [["baseHT", ht], ["baseTVA", tva], ["totHT", ht], ["totTVA", tva], ["totTTC", ttc], ["apAvHT", ht], ["apAvTVA", tva], ["apAvTTC", ttc]])
      $('[data-montre="' + cle + '"]').textContent = signe(v);
    $('[data-montre="duHT"]').textContent = fmt(120000 - ht);
    $('[data-montre="duTVA"]').textContent = fmt(24000 - tva);
    $('[data-montre="duTTC"]').textContent = fmt(TOTAL_C - ttc);
  }
  // La page A4 garde ses proportions : on la réduit à la largeur disponible.
  function ajusterPapier(){
    document.querySelectorAll(".papier").forEach((cadre) => {
      const page = cadre.querySelector(".a4");
      if (!cadre.clientWidth) return;
      const r = cadre.clientWidth / 595;
      page.style.transform = "scale(" + r + ")";
      cadre.style.height = page.offsetHeight * r + "px";
    });
  }
  window.addEventListener("resize", ajusterPapier);
  document.querySelectorAll("[data-corps-facture]").forEach((e) => { e.innerHTML = CORPS_FACTURE(); });

  $("#montant").addEventListener("input", poser);
  $("#motif").addEventListener("input", poser);
  $("#portees").innerHTML = ['<button type="button" data-i="-1" aria-pressed="true">Toute la facture</button>']
    .concat(LIGNES.map(([lib], i) => '<button type="button" data-i="' + i + '" aria-pressed="false">' + lib + "</button>")).join("");
  $("#portee").addEventListener("click", () => {
    const ouvert = $("#portee").getAttribute("aria-expanded") === "true";
    $("#portee").setAttribute("aria-expanded", String(!ouvert));
    $("#portees").hidden = ouvert;
  });
  document.querySelectorAll("#portees button").forEach((b) => b.addEventListener("click", () => {
    portee = Number(b.dataset.i);
    document.querySelectorAll("#portees button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $('[data-montre="porteeChoisie"]').textContent = portee < 0 ? "Toute la facture" : LIGNES[portee][0];
    $("#portee").setAttribute("aria-expanded", "false");
    $("#portees").hidden = true;
    poser();
  }));
  $("#versClients").addEventListener("click", () => { if ($("#versClients").classList.contains("cible")) aller("ficheA"); });
  document.querySelectorAll(".onglets-fiche button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".onglets-fiche button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.querySelectorAll(".liste").forEach((l) => { l.hidden = l.dataset.l !== b.dataset.o; });
  }));
  function cheque(){
    const estCheque = $('[data-montre="moyenChoisi"]').textContent === "Chèque";
    const n = $("#numeroCheque").value.trim();
    $("#ligneCheque").hidden = !estCheque;
    $('[data-montre="numero"]').textContent = estCheque && n ? "n° " + n : "";
  }
  $("#numeroCheque").addEventListener("input", cheque);
  $("#moyen").addEventListener("click", () => {
    const ouvert = $("#moyen").getAttribute("aria-expanded") === "true";
    $("#moyen").setAttribute("aria-expanded", String(!ouvert));
    $("#moyens").hidden = ouvert;
  });
  document.querySelectorAll("#moyens button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#moyens button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $('[data-montre="moyenChoisi"]').textContent = b.textContent;
    $('[data-montre="moyen"]').textContent = b.textContent.toLowerCase();
    $("#moyen").setAttribute("aria-expanded", "false");
    $("#moyens").hidden = true;
    cheque();
  }));

  poser();
  montrer(PARCOURS.debut);

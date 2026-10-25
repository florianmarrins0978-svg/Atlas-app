/*
  L'APPLI SOIGNÉE : ce que chaque planche partage, 25 octobre 2026.

  Trois choses, et rien d'autre :
    les huit chartes, CALCULÉES par src/lib/chartes.ts (variablesCharte) et
      recopiées ici telles quelles : une planche ne réinvente pas une couleur ;
    les icônes, dessinées une fois, au même trait (1,75 sur une grille de 24) ;
    les gestes de la planche : Proposé ou Aujourd'hui, la charte essayée, les
      états d'un écran, la feuille qui monte, la barre du bas et son trait d'or.

  Aucune donnée ne part nulle part. La charte choisie est retenue par ce
  navigateur seulement, et la planche s'ouvre très bien sans.
*/
(function () {
  "use strict";

  var CHARTES = [
    {"nom":"origine","libelle":"Origine","sombre":false,"vars":{"--atlas-cream":"#f5f3ee","--atlas-card":"#faf9f5","--atlas-ink":"#1c1c1a","--atlas-inkSoft":"#4a4a44","--atlas-muted":"#8a8578","--atlas-rust":"#2f3b2f","--atlas-rustDeep":"#4f5f4c","--atlas-rustTint":"#ece9e1","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#8b6835","--atlas-orSurEncre":"#b98b47","--atlas-line":"rgba(28,28,26,0.12)","--atlas-lineSoft":"rgba(28,28,26,0.07)","--atlas-chevron":"rgba(28,28,26,0.28)","--atlas-alerte":"#9C3B2E","--atlas-bordeaux":"#6E2433","--atlas-vertPale":"#b9c6b4","--atlas-carteVertFond":"#e1e8da","--atlas-carteVertTexte":"#506f44","--atlas-carteAmbreFond":"#ede3d2","--atlas-carteAmbreTexte":"#806031","--atlas-carteBleuFond":"#cdd8e1","--atlas-carteBleuTexte":"#35608d","--atlas-carteRougeFond":"#edded9","--atlas-carteRougeTexte":"#9c3b2e","--atlas-catCarburant":"#3d6e9e","--atlas-catRepas":"#477c36","--atlas-catMateriel":"#9c6123","--atlas-catHotel":"#7a5aa6","--atlas-catTransport":"#277a7a","--atlas-catAutre":"#736f64","--atlas-catVirement":"#a3506b","--atlas-catRecu":"#2f3b2f","--atlas-montantEntree":"#1f7a45","--atlas-montantSortie":"#b3392b","--atlas-plein":"#7d9a6d"}},
    {"nom":"brume","libelle":"Brume moderne","sombre":false,"vars":{"--atlas-cream":"#f4f7fb","--atlas-card":"#ffffff","--atlas-ink":"#111823","--atlas-inkSoft":"#3a434e","--atlas-muted":"#78838f","--atlas-rust":"#22456d","--atlas-rustDeep":"#5d7795","--atlas-rustTint":"#e4e7ec","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#8f6b36","--atlas-orSurEncre":"#b98b47","--atlas-line":"rgba(17,24,35,0.12)","--atlas-lineSoft":"rgba(17,24,35,0.07)","--atlas-chevron":"rgba(17,24,35,0.28)","--atlas-alerte":"#9c3b2e","--atlas-carteVertFond":"#e7eee4","--atlas-carteVertTexte":"#527246","--atlas-carteAmbreFond":"#f2e9dc","--atlas-carteAmbreTexte":"#846332","--atlas-carteBleuFond":"#d2deea","--atlas-carteBleuTexte":"#376492","--atlas-carteRougeFond":"#f1e4e2","--atlas-carteRougeTexte":"#9c3b2e","--atlas-catCarburant":"#3d6e9e","--atlas-catRepas":"#487e37","--atlas-catMateriel":"#a06324","--atlas-catHotel":"#7a5aa6","--atlas-catTransport":"#297d7e","--atlas-catAutre":"#767166","--atlas-catVirement":"#a3506b","--atlas-catRecu":"#2f3b2f","--atlas-montantEntree":"#1f7a45","--atlas-montantSortie":"#b3392b","--atlas-bordeaux":"#6E2433","--atlas-vertPale":"#b9c6b4","--atlas-plein":"#22456d","--atlas-police-titres":"ui-sans-serif, -apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", sans-serif","--atlas-onglet-haut":"10px","--atlas-onglet-hauteur":"100%","--atlas-onglet-rayon":"11px","--atlas-onglet-fond":"color-mix(in srgb, #B98B47 11%, transparent)"}},
    {"nom":"pierre","libelle":"Pierre","sombre":false,"vars":{"--atlas-cream":"#e8e8e3","--atlas-card":"#f4f4f0","--atlas-ink":"#1b1d19","--atlas-inkSoft":"#454741","--atlas-muted":"#83867c","--atlas-rust":"#1b1d19","--atlas-rustDeep":"#545652","--atlas-rustTint":"#dadad5","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#826231","--atlas-orSurEncre":"#b98b47","--atlas-line":"rgba(27,29,25,0.12)","--atlas-lineSoft":"rgba(27,29,25,0.07)","--atlas-chevron":"rgba(27,29,25,0.28)","--atlas-alerte":"#9c3b2e","--atlas-carteVertFond":"#dce4d6","--atlas-carteVertTexte":"#4e6c42","--atlas-carteAmbreFond":"#e8dfce","--atlas-carteAmbreTexte":"#7c5d2f","--atlas-carteBleuFond":"#c8d4de","--atlas-carteBleuTexte":"#335d89","--atlas-carteRougeFond":"#e8dad5","--atlas-carteRougeTexte":"#9c3b2e","--atlas-catCarburant":"#3c6b9a","--atlas-catRepas":"#427332","--atlas-catMateriel":"#925a21","--atlas-catHotel":"#7959a5","--atlas-catTransport":"#257273","--atlas-catAutre":"#6c685e","--atlas-catVirement":"#a04e69","--atlas-catRecu":"#2f3b2f","--atlas-montantEntree":"#1e7643","--atlas-montantSortie":"#b3392b","--atlas-bordeaux":"#6E2433","--atlas-vertPale":"#b9c6b4","--atlas-plein":"#1b1d19"}},
    {"nom":"beurre","libelle":"Beurre","sombre":false,"vars":{"--atlas-cream":"#efe7cf","--atlas-card":"#f8f3e4","--atlas-ink":"#26221a","--atlas-inkSoft":"#4e4939","--atlas-muted":"#8b8368","--atlas-rust":"#26221a","--atlas-rustDeep":"#5e594d","--atlas-rustTint":"#e1d9c2","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#826231","--atlas-orSurEncre":"#b98b47","--atlas-line":"rgba(38,34,26,0.12)","--atlas-lineSoft":"rgba(38,34,26,0.07)","--atlas-chevron":"rgba(38,34,26,0.28)","--atlas-alerte":"#9c3b2e","--atlas-carteVertFond":"#dfe3cc","--atlas-carteVertTexte":"#4e6c42","--atlas-carteAmbreFond":"#ebdec5","--atlas-carteAmbreTexte":"#7c5d2f","--atlas-carteBleuFond":"#cbd3d4","--atlas-carteBleuTexte":"#335d89","--atlas-carteRougeFond":"#ebd9cb","--atlas-carteRougeTexte":"#9c3b2e","--atlas-catCarburant":"#3c6b9a","--atlas-catRepas":"#427332","--atlas-catMateriel":"#925a21","--atlas-catHotel":"#7858a3","--atlas-catTransport":"#257273","--atlas-catAutre":"#6b675d","--atlas-catVirement":"#9e4d68","--atlas-catRecu":"#2f3b2f","--atlas-montantEntree":"#1e7643","--atlas-montantSortie":"#b3392b","--atlas-bordeaux":"#6E2433","--atlas-vertPale":"#b9c6b4","--atlas-plein":"#26221a"}},
    {"nom":"moka","libelle":"Moka","sombre":false,"vars":{"--atlas-cream":"#e6ded5","--atlas-card":"#f2ece5","--atlas-ink":"#2b241e","--atlas-inkSoft":"#524941","--atlas-muted":"#8d8175","--atlas-rust":"#2b241e","--atlas-rustDeep":"#5f5851","--atlas-rustTint":"#d9d1c8","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#7c5d2f","--atlas-orSurEncre":"#b98b47","--atlas-line":"rgba(43,36,30,0.12)","--atlas-lineSoft":"rgba(43,36,30,0.07)","--atlas-chevron":"rgba(43,36,30,0.28)","--atlas-alerte":"#9c3b2e","--atlas-carteVertFond":"#daddcd","--atlas-carteVertTexte":"#4a673f","--atlas-carteAmbreFond":"#e7d9c5","--atlas-carteAmbreTexte":"#795b2e","--atlas-carteBleuFond":"#c7ced5","--atlas-carteBleuTexte":"#315a83","--atlas-carteRougeFond":"#e6d3cb","--atlas-carteRougeTexte":"#9c3b2e","--atlas-catCarburant":"#396693","--atlas-catRepas":"#3f6e30","--atlas-catMateriel":"#8b5720","--atlas-catHotel":"#73549c","--atlas-catTransport":"#236c6d","--atlas-catAutre":"#656258","--atlas-catVirement":"#974a63","--atlas-catRecu":"#2f3b2f","--atlas-montantEntree":"#1c703f","--atlas-montantSortie":"#b1382b","--atlas-bordeaux":"#6E2433","--atlas-vertPale":"#b9c6b4","--atlas-plein":"#2b241e"}},
    {"nom":"prune","libelle":"Prune","sombre":false,"vars":{"--atlas-cream":"#efe6ea","--atlas-card":"#f9f2f5","--atlas-ink":"#23131c","--atlas-inkSoft":"#4d3a44","--atlas-muted":"#8c7481","--atlas-rust":"#3d1730","--atlas-rustDeep":"#6f5164","--atlas-rustTint":"#e1d7dc","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#846332","--atlas-orSurEncre":"#b98b47","--atlas-line":"rgba(35,19,28,0.12)","--atlas-lineSoft":"rgba(35,19,28,0.07)","--atlas-chevron":"rgba(35,19,28,0.28)","--atlas-alerte":"#9c3b2e","--atlas-carteVertFond":"#e0e2da","--atlas-carteVertTexte":"#4e6c42","--atlas-carteAmbreFond":"#ecddd2","--atlas-carteAmbreTexte":"#7c5d2f","--atlas-carteBleuFond":"#ccd3e1","--atlas-carteBleuTexte":"#335d89","--atlas-carteRougeFond":"#ecd8d9","--atlas-carteRougeTexte":"#9c3b2e","--atlas-catCarburant":"#3c6b9a","--atlas-catRepas":"#427332","--atlas-catMateriel":"#945c22","--atlas-catHotel":"#7959a5","--atlas-catTransport":"#257273","--atlas-catAutre":"#6c685e","--atlas-catVirement":"#a04e69","--atlas-catRecu":"#2f3b2f","--atlas-montantEntree":"#1e7643","--atlas-montantSortie":"#b3392b","--atlas-bordeaux":"#6E2433","--atlas-vertPale":"#b9c6b4","--atlas-plein":"#3d1730"}},
    {"nom":"sylve","libelle":"Sylve","sombre":true,"vars":{"--atlas-cream":"#16241c","--atlas-card":"#1e3026","--atlas-ink":"#e6e6da","--atlas-inkSoft":"#c2caba","--atlas-muted":"#8ba189","--atlas-rust":"#e6e6da","--atlas-rustDeep":"#acb0a5","--atlas-rustTint":"#253229","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#b98b47","--atlas-orSurEncre":"#806031","--atlas-line":"rgba(230,230,218,0.12)","--atlas-lineSoft":"rgba(230,230,218,0.07)","--atlas-chevron":"rgba(230,230,218,0.28)","--atlas-alerte":"#e1a299","--atlas-carteVertFond":"#273c2c","--atlas-carteVertTexte":"#83aa74","--atlas-carteAmbreFond":"#323c2a","--atlas-carteAmbreTexte":"#c39b61","--atlas-carteBleuFond":"#253f44","--atlas-carteBleuTexte":"#82a9d0","--atlas-carteRougeFond":"#303227","--atlas-carteRougeTexte":"#d68176","--atlas-catCarburant":"#6897c5","--atlas-catRepas":"#5da347","--atlas-catMateriel":"#d0812f","--atlas-catHotel":"#a18ac0","--atlas-catTransport":"#34a2a3","--atlas-catAutre":"#979387","--atlas-catVirement":"#c18196","--atlas-catRecu":"#809a80","--atlas-montantEntree":"#2aa75e","--atlas-montantSortie":"#db776b","--atlas-bordeaux":"#c44b63","--atlas-vertPale":"#728a69","--atlas-plein":"#e6e6da"}},
    {"nom":"nuit","libelle":"Nuit","sombre":true,"vars":{"--atlas-cream":"#101210","--atlas-card":"#1a1d19","--atlas-ink":"#e9e8de","--atlas-inkSoft":"#c1c2b6","--atlas-muted":"#84887b","--atlas-rust":"#e9e8de","--atlas-rustDeep":"#acaca4","--atlas-rustTint":"#1f211e","--atlas-or":"#B98B47","--atlas-orClair":"#C9A15E","--atlas-orTexte":"#b98b47","--atlas-orSurEncre":"#826231","--atlas-line":"rgba(233,232,222,0.12)","--atlas-lineSoft":"rgba(233,232,222,0.07)","--atlas-chevron":"rgba(233,232,222,0.28)","--atlas-alerte":"#da8c81","--atlas-carteVertFond":"#242c21","--atlas-carteVertTexte":"#709c5f","--atlas-carteAmbreFond":"#2f2b1f","--atlas-carteAmbreTexte":"#b98b47","--atlas-carteBleuFond":"#22313a","--atlas-carteBleuTexte":"#6e9ac9","--atlas-carteRougeFond":"#2c211c","--atlas-carteRougeTexte":"#d06d60","--atlas-catCarburant":"#5288bc","--atlas-catRepas":"#549340","--atlas-catMateriel":"#bb742a","--atlas-catHotel":"#9278b6","--atlas-catTransport":"#2f9294","--atlas-catAutre":"#8a8578","--atlas-catVirement":"#b86e86","--atlas-catRecu":"#6f8c6f","--atlas-montantEntree":"#269655","--atlas-montantSortie":"#d66052","--atlas-bordeaux":"#b53b54","--atlas-vertPale":"#738b6a","--atlas-plein":"#e9e8de"}}
  ];

  var ICONES = {
    "retour": '<path d="M15 5l-7 7 7 7"/>',
    "suivant": '<path d="M9 5l7 7-7 7"/>',
    "bas": '<path d="M5.5 9l6.5 6.5L18.5 9"/>',
    "haut": '<path d="M5.5 15L12 8.5l6.5 6.5"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "moins": '<path d="M5 12h14"/>',
    "croix": '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    "coche": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    "micro": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    "assistant": '<path d="M12 4c4.7 0 8.5 3.4 8.5 7.6S16.7 19.2 12 19.2c-1 0-2-.1-2.9-.4L5 20.5l1.2-3.6C4.5 15.5 3.5 13.6 3.5 11.6 3.5 7.4 7.3 4 12 4z"/>',
    "recherche": '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    "calendrier": '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    "horloge": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "lieu": '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    "telephone": '<path d="M6.6 3.5h2.9l1.5 4.4-2 1.3a11 11 0 0 0 5.8 5.8l1.3-2 4.4 1.5v2.9a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
    "email": '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    "document": '<path d="M6.5 3.5H14l4 4v13H6.5z"/><path d="M14 3.5v4h4M9.5 12.5h5M9.5 16h5"/>',
    "facture": '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>',
    "euro": '<path d="M16.5 7.2A6 6 0 1 0 16.5 16.8M5.5 10.5h8M5.5 13.5h8"/>',
    "equipe": '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0M15.8 5.8a3 3 0 0 1 0 5.4M17.5 19.5a5.6 5.6 0 0 0-2.4-4.6"/>',
    "personne": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    "vehicule": '<path d="M3 6.5h11v9.5H3zM14 10h3.8l3.2 3.2V16H14"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.2" cy="17.5" r="1.8"/>',
    "feuille": '<path d="M5 19C5 11 10 5 19 5c0 9-6 14-14 14zM5 19l7.5-7.5"/>',
    "goutte": '<path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/>',
    "diagnostic": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3l5 5M8 12.5c.2-2.8 1.7-4.4 4.6-4.6-.2 2.8-1.7 4.4-4.6 4.6z"/>',
    "bouclier": '<path d="M12 3.5l7 2.8v5.2c0 4.6-3 7.9-7 9-4-1.1-7-4.4-7-9V6.3z"/>',
    "bouclier-coche": '<path d="M12 3.5l7 2.8v5.2c0 4.6-3 7.9-7 9-4-1.1-7-4.4-7-9V6.3z"/><path d="M8.8 12l2.3 2.3 4.2-4.6"/>',
    "cadenas": '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    "cloche": '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    "crayon": '<path d="M4.5 19.5l1-4.3L15.6 5.1a2.1 2.1 0 0 1 3 3L8.5 18.5z"/><path d="M13.5 7.2l3 3"/>',
    "photo": '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M8.5 6.5L10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.5"/>',
    "envoyer": '<path d="M20.5 3.5l-17 7 7 3 3 7z"/><path d="M10.5 13.5l10-10"/>',
    "telecharger": '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    "importer": '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
    "banque": '<path d="M3.5 9.5L12 4.5l8.5 5M5.5 9.5v8M9.8 9.5v8M14.2 9.5v8M18.5 9.5v8M3.5 19.5h17"/>',
    "carte": '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h3"/>',
    "reglages": '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    "entreprise": '<path d="M5 20.5V4.5h9v16M14 9.5h5v11M3.5 20.5h17M8 8h3M8 11.5h3M8 15h3"/>',
    "etiquette": '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="8.5" r="1.5"/>',
    "etincelle": '<path d="M11 4l1.7 4.6L17.5 10l-4.8 1.6L11 16.5l-1.7-4.9L4.5 10l4.8-1.4z"/><path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    "couronne": '<path d="M4 8l4 4 4-6 4 6 4-4-1.5 10.5h-13z"/>',
    "organigramme": '<rect x="9" y="3.5" width="6" height="4.5" rx="1"/><rect x="3" y="16" width="6" height="4.5" rx="1"/><rect x="15" y="16" width="6" height="4.5" rx="1"/><path d="M12 8v4M6 16v-2.5h12V16"/>',
    "apparence": '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 6.5a5.5 5.5 0 0 1 0 11" opacity=".5"/>',
    "info": '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
    "alerte": '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.4"/>',
    "filtre": '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    "liste": '<path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20M4 6.5h.6M4 12h.6M4 17.5h.6"/>',
    "lecture": '<path d="M8 5.5v13l10.5-6.5z"/>',
    "pause": '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    "annuler": '<path d="M9 6.5L4.5 11 9 15.5"/><path d="M4.5 11H15a5 5 0 0 1 0 10h-2.5"/>',
    "cle": '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l2.5 2.5M13.8 9.2l2 2"/>',
    "deconnexion": '<path d="M14.5 4.5h4v15h-4M10 8l-4 4 4 4M6 12h9.5"/>',
    "copier": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    "contrat": '<path d="M6.5 3.5H14l4 4v13H6.5z"/><path d="M14 3.5v4h4M9.5 10.5h5M9 17c1.4-1.8 2.2.9 3.6-.8s1.9.8 3.4-.2"/>',
    "note": '<path d="M5 5.5h14M5 10h14M5 14.5h9"/>',
    "arbre": '<path d="M12 21v-6.5M12 14.5A5.5 5.5 0 0 1 6.5 9c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5zM12 17.5l-2.5-2"/>',
    "ciseaux": '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.6 8.4L20 16M8.6 15.6L20 8"/>',
    "chantier": '<path d="M3.5 20.5h17M5.5 20.5V10L12 5l6.5 5v10.5M10 20.5v-5h4v5"/>',
    "client": '<circle cx="12" cy="9" r="3.5"/><path d="M5.5 19.5c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="12" cy="12" r="9" opacity=".35"/>',
    "imprimer": '<path d="M7 8.5V3.5h10v5M7 16.5H4.5v-8h15v8H17"/><rect x="7" y="13.5" width="10" height="7" rx="1"/>',
    "partager": '<path d="M12 15V4M8 7.5L12 3.5l4 4M6 11.5H5v9h14v-9h-1"/>',
    "oeil": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    "soleil": '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
    "lune": '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    "horloge-sable": '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5"/>',
    "carton": '<path d="M12 3.5l8 4.2v8.6l-8 4.2-8-4.2V7.7z"/><path d="M4 7.7l8 4.3 8-4.3M12 12v8.5"/>',
    "oeil-barre": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4.5 19.5l15-15"/>',
    "scanner": '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7 12h10"/>',
    "points": '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'
  };

  function creerSprite() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    var dedans = "";
    for (var nom in ICONES) {
      dedans += '<symbol id="i-' + nom + '" viewBox="0 0 24 24">' + ICONES[nom] + "</symbol>";
    }
    svg.innerHTML = dedans;
    document.body.insertBefore(svg, document.body.firstChild);
  }

  /* ─── Les chartes ─────────────────────────────────────────────────────── */
  var CLE_CHARTE = "atlas-soignee-charte";
  var CLE_VERT = "atlas-soignee-vert";
  var VERT_PLUS_LISIBLE = "#587a4c";

  function lire(cle) { try { return window.localStorage.getItem(cle); } catch (e) { return null; } }
  function ecrire(cle, v) { try { window.localStorage.setItem(cle, v); } catch (e) { /* navigation privée : la planche marche sans */ } }

  function toutesLesCles() {
    var cles = {};
    CHARTES.forEach(function (c) { for (var k in c.vars) cles[k] = true; });
    return Object.keys(cles);
  }

  function charteNommee(nom) {
    for (var i = 0; i < CHARTES.length; i++) if (CHARTES[i].nom === nom) return CHARTES[i];
    return CHARTES[0];
  }

  function poserCharte(nom) {
    var c = charteNommee(nom);
    var cles = toutesLesCles();
    var vert = lire(CLE_VERT) === "plus-lisible";
    document.querySelectorAll(".ecran").forEach(function (e) {
      /* Ce que le CLIENT reçoit ne suit pas la charte de l'artisan : un devis
         ne part pas en noir parce qu'il a choisi Nuit (PRODUCT.md). */
      var ici = e.hasAttribute("data-sans-charte") ? CHARTES[0] : c;
      cles.forEach(function (k) { e.style.removeProperty(k); });
      for (var k in ici.vars) e.style.setProperty(k, ici.vars[k]);
      if (vert && ici.nom === "origine") e.style.setProperty("--atlas-plein", VERT_PLUS_LISIBLE);
      e.setAttribute("data-charte", ici.nom);
      e.toggleAttribute("data-sombre", !!ici.sombre);
      e.querySelectorAll(".barre").forEach(function (b) {
        b.toggleAttribute("data-pastille", !!ici.vars["--atlas-onglet-fond"]);
      });
    });
    document.querySelectorAll("[data-charte-choix]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-charte-choix") === c.nom ? "true" : "false");
    });
    document.querySelectorAll(".pl-charte-nom").forEach(function (s) { s.textContent = c.libelle; });
    document.querySelectorAll(".pl-charte-bouton .pastille-charte").forEach(function (p) { peindrePastille(p, c); });
    ecrire(CLE_CHARTE, c.nom);
  }

  function peindrePastille(el, c) {
    el.style.background = "linear-gradient(135deg," + c.vars["--atlas-cream"] + " 0 50%," + c.vars["--atlas-plein"] + " 50% 100%)";
  }

  /* ─── La barre de la planche : Proposé ou Aujourd'hui, et la charte ───── */
  var NOMS_VUES = { "propose": "Proposé", "aujourdhui": "Aujourd'hui", "plus-loin": "Plus loin" };

  function construireBarre() {
    var panneaux = document.querySelectorAll("[data-vue-panneau]");
    /* Une page sans écran à comparer (le sommaire, ce qui change partout)
       garde quand même le choix de la charte. */
    if (!panneaux.length && !document.querySelector(".ecran")) return;
    var barre = document.createElement("div");
    barre.className = "pl-barre";
    var dedans = document.createElement("div");
    dedans.className = "pl-barre-dedans";
    var onglets = document.createElement("div");
    onglets.className = "pl-onglets";
    onglets.setAttribute("role", "tablist");
    var vues = [];
    panneaux.forEach(function (p) {
      var v = p.getAttribute("data-vue-panneau");
      if (vues.indexOf(v) < 0) vues.push(v);
    });
    /* Une adresse peut ouvrir la planche sur une vue (« …html#plus-loin ») :
       l'adresse qu'on lui donne mène à ce qu'on veut qu'il regarde, sans
       qu'il ait à trouver l'onglet. */
    var demandee = (window.location.hash || "").slice(1);
    var depart = vues.indexOf(demandee) >= 0 ? demandee : vues[0];
    vues.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("data-vue", v);
      b.setAttribute("aria-selected", v === depart ? "true" : "false");
      b.textContent = NOMS_VUES[v] || v;
      b.addEventListener("click", function () { montrerVue(v); });
      onglets.appendChild(b);
    });
    dedans.appendChild(onglets);

    var bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "pl-charte-bouton";
    bouton.setAttribute("aria-expanded", "false");
    bouton.innerHTML = '<span class="pastille-charte"></span><span class="pl-charte-nom">Origine</span>';
    dedans.appendChild(bouton);
    barre.appendChild(dedans);

    var liste = document.createElement("div");
    liste.className = "pl-chartes";
    CHARTES.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-charte-choix", c.nom);
      b.innerHTML = '<span class="pastille-charte"></span>' + c.libelle;
      peindrePastille(b.querySelector(".pastille-charte"), c);
      b.addEventListener("click", function () { poserCharte(c.nom); });
      liste.appendChild(b);
    });
    barre.appendChild(liste);
    bouton.addEventListener("click", function () {
      var ouvert = liste.classList.toggle("ouvertes");
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });

    var tete = document.querySelector(".pl-tete");
    if (tete && tete.nextSibling) tete.parentNode.insertBefore(barre, tete.nextSibling);
    else document.body.insertBefore(barre, document.body.firstChild);
    if (!vues.length) onglets.remove();
    else montrerVue(depart);
  }

  function montrerVue(v) {
    document.querySelectorAll("[data-vue-panneau]").forEach(function (p) {
      p.hidden = p.getAttribute("data-vue-panneau") !== v;
    });
    document.querySelectorAll(".pl-onglets [data-vue]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-vue") === v ? "true" : "false");
    });
  }

  /* ─── Les états d'un écran : vide, rempli, refus… ─────────────────────── */
  function brancherEtats() {
    document.querySelectorAll(".pl-etats").forEach(function (groupe) {
      var cible = groupe.getAttribute("data-ecran");
      var ecrans = cible ? document.querySelectorAll(cible) : document.querySelectorAll("[data-vue-panneau='propose'] .ecran");
      var boutons = groupe.querySelectorAll("button[data-etat]");
      function choisir(etat) {
        boutons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-etat") === etat ? "true" : "false"); });
        ecrans.forEach(function (e) { appliquerEtat(e, etat); });
      }
      boutons.forEach(function (b) { b.addEventListener("click", function () { choisir(b.getAttribute("data-etat")); }); });
      /* Seuls les boutons d'état comptent : un autre choix posé dans la même rangée
         (les couleurs d'une planche) ne doit pas vider l'écran. */
      if (!boutons.length) return;
      var premier = groupe.querySelector("button[data-etat][aria-pressed='true']") || boutons[0];
      if (premier) choisir(premier.getAttribute("data-etat"));
    });
  }

  function appliquerEtat(ecran, etat) {
    ecran.setAttribute("data-etat", etat);
    ecran.querySelectorAll("[data-si-etat]").forEach(function (el) {
      var etats = el.getAttribute("data-si-etat").split(/\s+/);
      el.hidden = etats.indexOf(etat) < 0;
    });
  }

  /* ─── La feuille qui monte, et son voile ───────────────────────────────── */
  function ouvrirFeuille(id, depuis) {
    var feuille = document.getElementById(id);
    if (!feuille) return;
    var ecran = feuille.closest(".ecran");
    if (!ecran.querySelector(":scope > .voile")) {
      var voile = document.createElement("div");
      voile.className = "voile";
      voile.addEventListener("click", function () { fermerFeuilles(ecran); });
      ecran.appendChild(voile);
    }
    ecran.setAttribute("data-feuille", id);
    feuille.classList.add("ouverte");
    feuille.setAttribute("aria-hidden", "false");
    feuille._depuis = depuis || null;
    var premier = feuille.querySelector("button, a, input, textarea, select");
    if (premier) setTimeout(function () { premier.focus({ preventScroll: true }); }, 380);
  }

  function fermerFeuilles(ecran) {
    ecran.querySelectorAll(".feuille.ouverte").forEach(function (f) {
      f.classList.remove("ouverte");
      f.setAttribute("aria-hidden", "true");
      if (f._depuis) f._depuis.focus({ preventScroll: true });
    });
    ecran.removeAttribute("data-feuille");
  }

  /* ─── Les planches pas encore dessinées ─────────────────────────────────
     Elles arrivent une par une : un lien vers l'une d'elles ne mène pas à une
     page d'erreur, il le dit. La liste grandit à chaque planche publiée. */
  var PRETES = ["index", "fondations", "reglages", "termines", "termines-tva", "tva-bouton-paiement", "termines-comptable", "comptable-dossier", "comptable-verification", "clients", "client", "planning", "accueil"];

  function planchePrete(href) {
    if (!href || /^(https?:|#|mailto:|tel:|\.\.\/)/.test(href)) return true;
    var m = href.match(/^([a-z0-9-]+)\.html(#.*)?$/i);
    return !m || PRETES.indexOf(m[1]) >= 0;
  }

  function pasEncore(depuis, texte) {
    var ecran = depuis.closest(".ecran");
    var t = document.createElement("div");
    t.className = "tiroir tiroir-flottant";
    t.setAttribute("role", "status");
    t.textContent = texte || "Cette planche arrive bientôt.";
    if (ecran) {
      var ancien = ecran.querySelector(".tiroir-flottant");
      if (ancien) ancien.remove();
      t.style.cssText = "position:absolute;left:var(--gouttiere);right:var(--gouttiere);z-index:8;bottom:" + (ecran.querySelector(".barre") ? "78px" : "16px");
      ecran.appendChild(t);
    } else {
      t.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:40;max-width:420px;margin:0 auto;background:#1c1c1a;color:#f5f3ee";
      document.body.appendChild(t);
    }
    setTimeout(function () { if (t.isConnected) t.remove(); }, 2600);
  }

  /* ─── Le tiroir : « Retiré à l'instant. Annuler » ─────────────────────── */
  function tiroir(ecran, texte, annuler) {
    var ancien = ecran.querySelector(".tiroir-flottant");
    if (ancien) ancien.remove();
    var t = document.createElement("div");
    t.className = "tiroir tiroir-flottant";
    t.setAttribute("role", "status");
    t.innerHTML = '<span></span><button type="button" class="bouton-texte">Annuler</button>';
    t.querySelector("span").textContent = texte;
    t.style.cssText = "position:absolute;left:var(--gouttiere);right:var(--gouttiere);z-index:8;bottom:" + (ecran.querySelector(".barre") ? "78px" : "16px");
    t.querySelector("button").addEventListener("click", function () { if (annuler) annuler(); t.remove(); });
    ecran.appendChild(t);
    setTimeout(function () { if (t.isConnected) t.remove(); }, 6000);
  }

  /* Le geste Retirer (10 août 2026) : le texte glisse, « Retirer » se
     découvre, la ligne tombe, le tiroir rend la main. */
  function brancherRetraits(racine) {
    racine.querySelectorAll("[data-retirable]").forEach(function (ligne) {
      if (ligne._branche) return;
      ligne._branche = true;
      var x0 = null, dx = 0;
      var corps = ligne.querySelector(".ligne-glisse") || ligne;
      var fond = document.createElement("button");
      fond.type = "button";
      fond.className = "ligne-retirer";
      fond.textContent = "Retirer";
      fond.style.cssText = "position:absolute;right:0;top:0;bottom:0;padding:0 18px;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--atlas-carteAmbreTexte);opacity:0;transition:opacity 200ms";
      ligne.style.position = "relative";
      ligne.appendChild(fond);
      ligne.addEventListener("pointerdown", function (e) { x0 = e.clientX; dx = 0; corps.style.transition = "none"; });
      ligne.addEventListener("pointermove", function (e) {
        if (x0 === null) return;
        dx = Math.min(0, e.clientX - x0);
        if (dx < -6) { corps.style.transform = "translateX(" + Math.max(dx, -120) + "px)"; fond.style.opacity = Math.min(1, -dx / 80); }
      });
      function relacher() {
        if (x0 === null) return;
        x0 = null;
        corps.style.transition = "transform 260ms cubic-bezier(.22,.61,.36,1)";
        if (dx < -70) { corps.style.transform = "translateX(-104px)"; fond.style.opacity = 1; }
        else { corps.style.transform = ""; fond.style.opacity = 0; }
      }
      ligne.addEventListener("pointerup", relacher);
      ligne.addEventListener("pointercancel", relacher);
      ligne.addEventListener("click", function (e) { if (Math.abs(dx) > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
      fond.addEventListener("click", function (e) {
        e.stopPropagation();
        var hauteur = ligne.offsetHeight;
        ligne.style.transition = "height 300ms cubic-bezier(.22,.61,.36,1), opacity 220ms";
        ligne.style.height = hauteur + "px";
        ligne.style.overflow = "hidden";
        requestAnimationFrame(function () { ligne.style.height = "0px"; ligne.style.opacity = "0"; });
        tiroir(ligne.closest(".ecran"), "Retiré à l'instant.", function () {
          ligne.style.height = hauteur + "px"; ligne.style.opacity = "1";
          corps.style.transform = ""; fond.style.opacity = 0;
          setTimeout(function () { ligne.style.height = ""; ligne.style.overflow = ""; }, 320);
        });
      });
    });
  }

  /* ─── La barre du bas : le trait d'or va au mot touché ─────────────────── */
  function brancherBarres(racine) {
    racine.querySelectorAll(".barre").forEach(function (barre) {
      var onglets = barre.querySelectorAll(".barre-onglet");
      var trait = barre.querySelector(".barre-trait");
      barre.style.setProperty("--onglets", onglets.length);
      var rang = 0;
      onglets.forEach(function (o, i) { if (o.getAttribute("aria-current") === "page") rang = i; });
      if (trait) trait.style.setProperty("--rang", rang);
      onglets.forEach(function (o, i) {
        o.addEventListener("click", function (e) {
          var href = o.getAttribute("href");
          onglets.forEach(function (x) { x.removeAttribute("aria-current"); });
          o.setAttribute("aria-current", "page");
          if (trait) trait.style.setProperty("--rang", i);
          if (href && !planchePrete(href)) { e.preventDefault(); pasEncore(o); return; }
          if (href && href !== "#" && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setTimeout(function () { window.location.href = href; }, 300);
          } else if (!href || href === "#") e.preventDefault();
        });
      });
    });
  }

  /* ─── Les petits gestes : choix, interrupteurs, feuilles ───────────────── */
  function brancherGestes() {
    document.addEventListener("click", function (e) {
      var lien = e.target.closest("a[href]");
      if (lien && !lien.closest(".barre") && !planchePrete(lien.getAttribute("href"))) { e.preventDefault(); pasEncore(lien); return; }
      var ouvre = e.target.closest("[data-ouvre]");
      if (ouvre) { e.preventDefault(); ouvrirFeuille(ouvre.getAttribute("data-ouvre"), ouvre); return; }
      var ferme = e.target.closest("[data-ferme]");
      if (ferme) { e.preventDefault(); fermerFeuilles(ferme.closest(".ecran")); return; }
      var choix = e.target.closest(".choix button");
      if (choix) {
        var groupe = choix.closest(".choix");
        groupe.querySelectorAll("button").forEach(function (b) {
          var oui = b === choix;
          b.setAttribute("aria-pressed", oui ? "true" : "false");
          var montre = b.getAttribute("data-montre");
          if (montre) { var cible = document.getElementById(montre); if (cible) cible.hidden = !oui; }
        });
        return;
      }
      var bascule = e.target.closest(".bascule");
      if (bascule) {
        var oui = bascule.getAttribute("aria-checked") !== "true";
        bascule.setAttribute("aria-checked", oui ? "true" : "false");
        var lib = bascule.getAttribute("aria-describedby");
        if (lib) {
          var el = document.getElementById(lib);
          if (el) el.textContent = oui ? (bascule.getAttribute("data-oui") || "Oui") : (bascule.getAttribute("data-non") || "Non");
        }
        return;
      }
      var etat = e.target.closest("[data-va-etat]");
      if (etat) {
        e.preventDefault();
        var ecran = etat.closest(".ecran");
        appliquerEtat(ecran, etat.getAttribute("data-va-etat"));
        fermerFeuilles(ecran);
        var groupeEtats = document.querySelector(".pl-etats");
        if (groupeEtats) groupeEtats.querySelectorAll("button[data-etat]").forEach(function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-etat") === etat.getAttribute("data-va-etat") ? "true" : "false");
        });
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".ecran[data-feuille]").forEach(fermerFeuilles);
    });
  }

  /* ─── Le vert des boutons : le sien, ou un cran plus sombre ────────────── */
  function brancherVert() {
    document.querySelectorAll("[data-vert-choix]").forEach(function (b) {
      var v = b.getAttribute("data-vert-choix");
      b.setAttribute("aria-pressed", (lire(CLE_VERT) || "le-sien") === v ? "true" : "false");
      b.addEventListener("click", function () {
        ecrire(CLE_VERT, v);
        document.querySelectorAll("[data-vert-choix]").forEach(function (x) {
          x.setAttribute("aria-pressed", x.getAttribute("data-vert-choix") === v ? "true" : "false");
        });
        poserCharte(lire(CLE_CHARTE) || "origine");
      });
    });
  }

  window.Kit = {
    chartes: function () { return CHARTES.slice(); },
    poserCharte: poserCharte,
    ouvrirFeuille: ouvrirFeuille,
    fermerFeuilles: fermerFeuilles,
    tiroir: tiroir,
    note: function (ecran, texte) { pasEncore(ecran, texte); },
    appliquerEtat: appliquerEtat,
    brancher: function (racine) { brancherRetraits(racine || document); brancherBarres(racine || document); }
  };


  function demarrer() {
    creerSprite();
    construireBarre();
    brancherEtats();
    brancherGestes();
    brancherVert();
    brancherRetraits(document);
    brancherBarres(document);
    poserCharte(lire(CLE_CHARTE) || "origine");
  }


  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
})();

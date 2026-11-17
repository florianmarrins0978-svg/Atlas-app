#!/usr/bin/env python3
"""Le film de l'équipe du site de vente, sans à-coups.

Sa remarque du 17 novembre 2026, devant la maquette du site en mouvement :
« le moment de choisir les salariés pour les affilier à une journée, c'est pas
fluide ».

D'où ça vient. Le film d'origine (vente/images/nov-film-equipe.mp4) est fidèle
à l'appli, et à cet endroit l'appli change d'état d'un seul coup : ouvrir la
liste, choisir Lucas, puis Julien, refermer. Filmée image par image, elle donne
neuf états immobiles séparés par huit coupes d'une image, et la carte saute de
quarante à soixante pixels à chaque coupe. Sur le site, cela se lit comme un
diaporama.

Ce que fait ce script. Il reprend les neuf états du film d'origine, tels
quels, et calcule les images qui manquent entre deux : chaque élément (un
libellé, un prénom, la rangée des actions) est suivi d'un état au suivant par
le centre de son encre, et glisse de sa place à la suivante, posé au dixième
de pixel. Ce qui apparaît se fond, ce qui disparaît aussi, un trait de
sélection se tire de gauche à droite. Rien n'est redessiné : chaque pixel
d'encre vient du film de la vraie appli. Chaque passage part exactement de son
état et arrive exactement au suivant, et le script refuse de produire un film
si ce n'est pas le cas.

Tout se calcule sur les plans du film (luminance et couleur), sans passer par
des couleurs d'écran : converties puis reconverties, elles sortaient un cran
plus sombres, et le film se serait vu changer de teinte à l'instant où il cède
la place à sa dernière image.

Le film de cause.html et de chapitres-6.html n'est pas touché : celui-ci porte
un autre nom, et seule cause-2.html le joue.

    python3 appli/scripts/film-equipe-fluide.py appli/vente/images
    python3 appli/scripts/film-equipe-fluide.py appli/vente/images --planches /tmp/pellicules --sans-film

Il faut ffmpeg (libx264 et libvpx-vp9), numpy et Pillow.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

L, H = 692, 600
IPS = 60          # le film d'origine est à 30 : à 60, un glissement de 56 px ne saccade pas
SORTIE = 'nov-film-equipe-fluide'
# La dernière image de chacun des neuf états du film d'origine (la mieux
# définie : l'encodeur affine une image immobile au fil des suivantes).
IMAGES = [24, 48, 69, 90, 114, 135, 153, 174, 198]
COULEUR = ['-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']


# ── Lire et écrire les plans du film, sans conversion ───────────────────────

def lire_etats(film):
    choix = '+'.join('eq(n\\,%d)' % n for n in IMAGES)
    brut = subprocess.run(['ffmpeg', '-v', 'error', '-i', film, '-vf', "select='%s'" % choix, '-vsync', '0',
                           '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], check=True, stdout=subprocess.PIPE).stdout
    une = L * H * 3 // 2
    assert len(brut) == une * len(IMAGES), "le film d'origine n'a pas la forme attendue (%d octets)" % len(brut)
    etats = []
    for i in range(len(IMAGES)):
        b = np.frombuffer(brut[i * une:(i + 1) * une], np.uint8)
        y = b[:L * H].reshape(H, L)
        u = b[L * H:L * H + L * H // 4].reshape(H // 2, L // 2)
        v = b[L * H + L * H // 4:].reshape(H // 2, L // 2)
        # La couleur est stockée un pixel sur deux : on la répète telle quelle
        # (et en_plans la moyenne en retour), pour qu'un pixel resté en place
        # ressorte du film exactement comme il y est entré.
        etats.append(np.dstack([y, u.repeat(2, 0).repeat(2, 1), v.repeat(2, 0).repeat(2, 1)]).astype(np.float64))
    return etats


def en_plans(im):
    y = np.clip(np.rint(im[:, :, 0]), 0, 255).astype(np.uint8)
    c = [np.clip(np.rint(im[:, :, k].reshape(H // 2, 2, L // 2, 2).mean(axis=(1, 3))), 0, 255).astype(np.uint8) for k in (1, 2)]
    return y.tobytes() + c[0].tobytes() + c[1].tobytes()


def en_rvb(im):
    """Les couleurs d'écran d'une image du film (BT.709, plage vidéo)."""
    y = (im[:, :, 0] - 16) * 255 / 219
    cb = (im[:, :, 1] - 128) * 255 / 224
    cr = (im[:, :, 2] - 128) * 255 / 224
    return np.dstack([y + 1.5748 * cr, y - 0.18732 * cb - 0.46812 * cr, y + 1.8556 * cb])


# ── Les éléments, et où les chercher dans chaque état ───────────────────────
# nom : (x0, x1, demi-hauteur, {état : hauteur approchée de son centre})

def sur(etats, v):
    return {s: v for s in etats}


def joint(*ds):
    r = {}
    for d in ds:
        r.update(d)
    return r


ELEMENTS = {
    'journee':        (28, 214, 19, joint(sur((0, 1, 2), 101), sur(range(3, 9), 99))),
    'adresse_a':      (232, 396, 19, sur((0, 1, 2), 100)),
    'adresse_b':      (32, 194, 19, sur(range(3, 9), 140)),
    'droite_plus':    (480, 621, 18, sur((0, 1), 72)),
    'droite_lucas':   (528, 621, 18, sur((2,), 74)),
    'chevron':        (637, 657, 14, joint(sur((0, 1, 2), 74), sur(range(3, 9), 92))),
    # Le carré et son libellé se suivent séparément : dans le film d'origine
    # ils ne tombent pas toujours sur le même pixel l'un par rapport à l'autre
    # (« Après-midi » descend de 40 px quand son carré descend de 38).
    'm_carre':        (58, 94, 20, joint(sur((0,), 256.5), sur((1, 2), 228.5), sur((3,), 266.5), sur(range(4, 9), 294.5))),
    'm_texte':        (96, 186, 20, joint(sur((0,), 254), sur((1, 2), 226), sur((3,), 264), sur(range(4, 9), 292))),
    'm_plus':         (298, 441, 20, sur((0,), 256)),
    'm_noms':         (298, 629, 20, sur(range(4, 9), 293)),
    'm_lucas':        (150, 242, 19, joint(sur((1, 2), 311), sur((3,), 349))),
    'm_julien':       (262, 356, 19, joint(sur((1, 2), 311), sur((3,), 349))),
    'm_fermer':       (530, 633, 19, joint(sur((1, 2), 311), sur((3,), 349))),
    'm_lucas_trait':  (150, 242, 4, joint(sur((2,), 334.5), sur((3,), 372.5))),
    'm_julien_trait': (262, 356, 4, sur((3,), 372.5)),
    'a_carre':        (58, 94, 20, joint(sur((0,), 360.5), sur((1, 2), 416.5), sur((3,), 454.5), sur((4, 8), 398.5), sur((5, 6, 7), 370.5))),
    'a_texte':        (96, 264, 20, joint(sur((0,), 359), sur((1, 2), 415), sur((3,), 455), sur((4, 8), 397), sur((5, 6, 7), 369))),
    'a_plus':         (298, 443, 20, joint(sur((0,), 358), sur((1, 2), 416), sur((3,), 453), sur((4,), 397))),
    'a_noms':         (298, 629, 20, sur((8,), 397)),
    'a_lucas':        (150, 242, 19, sur((5, 6, 7), 452)),
    'a_julien':       (262, 356, 19, sur((5, 6, 7), 452)),
    'a_fermer':       (530, 633, 19, sur((5, 6, 7), 452)),
    'a_lucas_trait':  (150, 242, 4, sur((6, 7), 476.5)),
    'a_julien_trait': (262, 356, 4, sur((7,), 476.5)),
    'actions':        (254, 635, 21, joint(sur((0,), 465), sur((1, 2), 521), sur((3, 5, 6, 7), 561), sur((4, 8), 503))),
}
# Le haut du bouton « Fiche d'intervention », là où il se voit. Ailleurs il
# est sous le bas de l'image, et il suit la rangée des actions.
BOUTON_X = (54, 639)
BOUTON_HAUT = {0: 528, 1: 584, 2: 584, 4: 568, 8: 568}
# La carte : son bord haut (ombre, coins, encoche) tient entre ces lignes dans
# les trois premiers états, et 38 lignes plus bas ensuite (l'adresse du client
# passe à la ligne quand l'en-tête reçoit « Lucas et Julien »).
CARTE = (146, 190)
CARTE_BAS = 38
SEUIL = 60        # en deçà, c'est le halo de la compression, pas de l'encre


class Lutin:
    """Un élément dans un état : sa découpe, et le centre de son encre."""

    def __init__(self, im, rvb, fond, x0, x1, hh, vers, nom, etat):
        y_a, y_b = int(round(vers - hh)), int(round(vers + hh))
        # Le centre se prend sur la FORME de l'encre, pas sur sa noirceur : un
        # carré qui fonce ou un prénom qui noircit ne doit pas le déplacer.
        e = (np.abs(rvb[y_a:y_b, x0:x1] - fond).sum(axis=2) > SEUIL).astype(np.float64)
        assert e.sum() > 0, "rien à l'endroit attendu : %s, état %d" % (nom, etat)
        lignes = np.where(e.any(axis=1))[0]
        colonnes = np.where(e.any(axis=0))[0]
        assert lignes[0] > 0 and lignes[-1] < e.shape[0] - 1, 'la fenêtre rogne %s, état %d' % (nom, etat)
        self.cy = float((e * np.arange(y_a, y_b)[:, None]).sum() / e.sum())
        self.cx = float((e * np.arange(x0, x1)[None, :]).sum() / e.sum())
        self.y0 = int(round(self.cy)) - hh
        self.x0 = x0
        self.im = im[self.y0:self.y0 + 2 * hh, x0:x1].copy()
        self.encre = (int(colonnes[0]), int(colonnes[-1]) + 1)   # dans la découpe


def decaler(decoupe, fx, fy):
    """La découpe posée à une fraction de pixel (0 <= fx, fy < 1), bords répétés."""
    if fx < 1e-6 and fy < 1e-6:
        return decoupe
    p = np.pad(decoupe, ((1, 1), (1, 1), (0, 0)), mode='edge')
    h, w = decoupe.shape[:2]
    return ((1 - fy) * (1 - fx) * p[1:h + 2, 1:w + 2] + fy * (1 - fx) * p[0:h + 1, 1:w + 2]
            + (1 - fy) * fx * p[1:h + 2, 0:w + 1] + fy * fx * p[0:h + 1, 0:w + 1])


def poser(image, decoupe, x, y, alpha=1.0, masque=None):
    """Pose la découpe en (x, y), au dixième de pixel, rognée aux bords de l'image."""
    if alpha <= 0:
        return
    ix, iy = math.floor(x + 1e-9), math.floor(y + 1e-9)
    s = decaler(decoupe, x - ix, y - iy)
    m = None if masque is None else decaler(masque[:, :, None], x - ix, y - iy)[:, :, 0]
    h, w = s.shape[:2]
    a0, a1 = max(0, iy), min(H, iy + h)
    b0, b1 = max(0, ix), min(L, ix + w)
    if a0 >= a1 or b0 >= b1:
        return
    s = s[a0 - iy:a1 - iy, b0 - ix:b1 - ix]
    a = alpha if m is None else (alpha * m[a0 - iy:a1 - iy, b0 - ix:b1 - ix])[:, :, None]
    image[a0:a1, b0:b1] = image[a0:a1, b0:b1] * (1 - a) + s * a


def courbe(x1, y1, x2, y2):
    """Une courbe de Bézier d'animation, comme en CSS."""
    def f(p):
        if p <= 0:
            return 0.0
        if p >= 1:
            return 1.0
        a, b = 0.0, 1.0
        for _ in range(48):
            m = (a + b) / 2
            if 3 * (1 - m) ** 2 * m * x1 + 3 * (1 - m) * m * m * x2 + m ** 3 < p:
                a = m
            else:
                b = m
        m = (a + b) / 2
        return 3 * (1 - m) ** 2 * m * y1 + 3 * (1 - m) * m * m * y2 + m ** 3
    return f


# Elle part doucement, file, et se pose longuement : un glissement qu'on a le
# temps de VOIR (un tiers de seconde de trajet visible). La courbe des feuilles
# d'un iPhone (.32, .72, 0, 1) a été essayée d'abord : neuf dixièmes du chemin
# en deux dixièmes de seconde, soit presque le saut qu'on corrige.
GLISSE = courbe(.3, 0, .1, 1)


def fenetre(p, a, b):
    return min(1.0, max(0.0, (p - a) / (b - a)))


def doux(t):
    return t * t * (3 - 2 * t)


class Montage:
    def __init__(self, etats):
        self.E = etats
        rvb = [en_rvb(e) for e in etats]
        # Le fond de la page et de la carte, tel que le film le porte.
        self.fond_plans = etats[0][140, 300].copy()
        fond = rvb[0][140, 300].copy()
        assert np.abs(rvb[0][185:232, 40:650] - fond).max() < 1.5, "le fond de la carte n'est pas uni"
        self.lutins = {}
        for nom, (x0, x1, hh, ou) in ELEMENTS.items():
            for s, vers in ou.items():
                self.lutins[nom, s] = Lutin(etats[s], rvb[s], fond, x0, x1, hh, vers, nom, s)
        # « Lucas », seul dans l'en-tête, puis premier mot de « Lucas et
        # Julien » : c'est le même mot, il se pousse pour faire de la place.
        e3 = np.abs(rvb[3][72:109, 397:621] - fond).sum(axis=2) > SEUIL
        colonnes = np.where(e3.any(axis=0))[0] + 397
        trous = [(colonnes[i], colonnes[i + 1]) for i in range(len(colonnes) - 1) if colonnes[i + 1] - colonnes[i] > 5]
        assert len(trous) == 2, 'on attendait trois mots dans « Lucas et Julien », trous : %r' % (trous,)
        coupe = int(trous[0][0] + trous[0][1] + 1) // 2
        for s in range(3, 9):
            self.lutins['droite_lucas', s] = Lutin(etats[s], rvb[s], fond, 397, coupe, 18, 90.5, 'droite_lucas', s)
            self.lutins['droite_reste', s] = Lutin(etats[s], rvb[s], fond, coupe, 621, 18, 90.5, 'droite_reste', s)
        # Le fond sans encre : le haut de la page, le nom du client (il ne
        # bouge jamais), la carte, et rien dedans.
        e0 = etats[0]
        self.haut = e0[0:26].copy()
        self.nom = e0[28:68, 28:228].copy()
        self.bord = e0[CARTE[0]:CARTE[1]].copy()
        self.corps = np.median(e0[[196, 200, 204, 208, 212, 216]], axis=0)
        self.bouton = {s: etats[s][h - 4:H, BOUTON_X[0]:BOUTON_X[1]].copy() for s, h in BOUTON_HAUT.items()}

    def fond(self, d):
        im = np.empty((H, L, 3))
        im[:] = self.fond_plans
        im[0:26] = self.haut
        poser(im, self.nom, 28, 28)
        im[math.ceil(CARTE[1] + d) - 1:] = self.corps
        poser(im, self.bord, 0, CARTE[0] + d)
        return im

    @staticmethod
    def carte(s):
        return 0.0 if s < 3 else float(CARTE_BAS)

    def haut_bouton(self, s):
        """Le haut du bouton dans un état, même sous le bas de l'image."""
        if s in BOUTON_HAUT:
            return float(BOUTON_HAUT[s])
        ref = min(BOUTON_HAUT, key=lambda r: abs(r - s))
        return BOUTON_HAUT[ref] + self.lutins['actions', s].cy - self.lutins['actions', ref].cy

    def passage(self, A, B, p, regles):
        """L'image entre l'état A et l'état B, à l'avancement p (0 à 1)."""
        g = GLISSE(p)
        im = self.fond(self.carte(A) + (self.carte(B) - self.carte(A)) * g)
        # Le bouton d'abord : il passe sous le bas de l'image.
        ha, hb = self.haut_bouton(A), self.haut_bouton(B)
        h = ha + (hb - ha) * g
        if A in self.bouton:
            poser(im, self.bouton[A], BOUTON_X[0], h - 4)
        if B in self.bouton:
            poser(im, self.bouton[B], BOUTON_X[0], h - 4, 1.0 if A not in self.bouton else doux(p))
        noms = []
        for (nom, s) in self.lutins:
            if s in (A, B) and nom not in noms:
                noms.append(nom)
        for nom in noms:
            r = regles.get(nom, {})
            la, lb = self.lutins.get((nom, A)), self.lutins.get((nom, B))
            if la and lb:
                # Il reste : il glisse du centre de son encre au suivant, et
                # passe de l'image d'avant à celle d'après en chemin. De côté,
                # rien ne bouge, sauf ce qui le dit ('en_x').
                cy = la.cy + (lb.cy - la.cy) * g
                xa = la.x0 + (lb.cx - la.cx) * g if r.get('en_x') else la.x0
                xb = lb.x0 + (la.cx - lb.cx) * (1 - g) if r.get('en_x') else lb.x0
                w = doux(fenetre(p, *r.get('fondu', (0, 1))))
                if w < 1:
                    poser(im, la.im, xa, la.y0 + (cy - la.cy))
                if w > 0:
                    poser(im, lb.im, xb, lb.y0 + (cy - lb.cy), w)
            elif la:
                # Il part : il se fond, en suivant au besoin son voisin.
                t = doux(fenetre(p, *r.get('quand', (0, .34))))
                dx, dy = self.suite(r, A, B, g, t, False)
                poser(im, la.im, la.x0 + dx, la.y0 + dy, 1 - t)
            else:
                # Il arrive : il se fond à sa place, après un court trajet.
                q = fenetre(p, *r.get('quand', (.3, .9)))
                dx, dy = self.suite(r, A, B, g, doux(q), True)
                if r.get('tire'):
                    # Un trait de sélection se tire de gauche à droite.
                    bord = 10.0
                    col = np.arange(lb.im.shape[1])[None, :] - lb.encre[0]
                    m = np.clip((GLISSE(q) * (lb.encre[1] - lb.encre[0] + bord) - col) / bord, 0, 1) * np.ones((lb.im.shape[0], 1))
                    poser(im, lb.im, lb.x0 + dx, lb.y0 + dy, 1.0, m)
                else:
                    poser(im, lb.im, lb.x0 + dx, lb.y0 + dy, doux(q))
        return im

    def suite(self, r, A, B, g, t, arrive):
        dx = dy = 0.0
        if 'suit' in r:
            # Il se déplace comme l'élément nommé (même rangée, même carte).
            ra, rb = self.lutins[r['suit'], A], self.lutins[r['suit'], B]
            dy += (rb.cy - ra.cy) * (g - 1 if arrive else g)
        if 'trajet' in r:
            tx, ty = r['trajet']
            k = (1 - GLISSE(t)) if arrive else GLISSE(t)
            dx += tx * k
            dy += ty * k
        return dx, dy


# ── Le déroulé ──────────────────────────────────────────────────────────────
# (état de départ, état d'arrivée, durée en secondes, règles propres au passage)
# 'quand' : la fenêtre du fondu de ce qui part ou arrive, en part du passage.
# 'fondu' : celle du passage d'une image à l'autre pour ce qui reste.
# 'suit'  : il se déplace avec cet élément. 'trajet' : son court chemin propre.

OUVRIR = .56
CHOISIR = .30
FERMER = .46      # on referme plus vite qu'on n'ouvre : il n'y a plus rien à lire


def replier(r):
    """La liste s'efface en remontant un peu, les noms prennent la rangée."""
    regles = {'%s_%s' % (r, n): {'quand': (0, .34), 'trajet': (0, -6)} for n in ('lucas', 'julien', 'fermer', 'lucas_trait', 'julien_trait')}
    regles['%s_noms' % r] = {'quand': (.2, .8), 'suit': '%s_texte' % r}
    return regles


def deplier(r):
    """« + Salarié » s'efface avec son libellé, les prénoms montent l'un après l'autre."""
    return {'%s_plus' % r: {'quand': (0, .3), 'suit': '%s_texte' % r},
            '%s_lucas' % r: {'quand': (.24, .8), 'trajet': (0, 10)},
            '%s_julien' % r: {'quand': (.28, .84), 'trajet': (0, 10)},
            '%s_fermer' % r: {'quand': (.32, .9), 'trajet': (0, 10)}}


PASSAGES = [
    (0, 1, OUVRIR, deplier('m')),
    # Lucas : son prénom noircit, son trait se tire, l'en-tête le prend.
    (1, 2, CHOISIR, {'m_lucas': {'fondu': (0, .6)}, 'm_lucas_trait': {'quand': (.1, 1), 'tire': True},
                     'droite_plus': {'quand': (0, .55), 'trajet': (0, -5)}, 'droite_lucas': {'quand': (.2, .9), 'trajet': (0, 5)}}),
    # Julien : l'en-tête s'élargit, l'adresse passe à la ligne, la carte descend.
    (2, 3, .54, {'m_julien': {'fondu': (0, .4)}, 'm_julien_trait': {'quand': (.06, .6), 'tire': True, 'suit': 'm_julien'},
                 'm_carre': {'fondu': (0, .45)}, 'droite_lucas': {'en_x': True},
                 # « et Julien » attend que « Lucas » lui ait laissé la place :
                 # plus tôt, les deux mots se chevauchaient en chemin.
                 'droite_reste': {'quand': (.55, 1), 'trajet': (10, 0)},
                 # L'adresse est le seul élément qui s'efface puis revient
                 # (elle change de ligne) : le vide entre les deux tient en un
                 # dixième de seconde. Plus tôt, elle reviendrait sur le bord
                 # de la carte, qui n'a pas encore fini de descendre.
                 'adresse_a': {'quand': (0, .28)}, 'adresse_b': {'quand': (.30, .80), 'trajet': (0, -6)}}),
    (3, 4, FERMER, replier('m')),
    # L'après-midi, pareil. L'en-tête dit déjà « Lucas et Julien ».
    (4, 5, OUVRIR, deplier('a')),
    (5, 6, CHOISIR, {'a_lucas': {'fondu': (0, .6)}, 'a_lucas_trait': {'quand': (.1, 1), 'tire': True}}),
    (6, 7, CHOISIR, {'a_julien': {'fondu': (0, .6)}, 'a_julien_trait': {'quand': (.1, 1), 'tire': True}, 'a_carre': {'fondu': (0, .7)}}),
    (7, 8, FERMER, replier('a')),
]
# Le repos avant chaque passage, puis le dernier, sur l'état final.
REPOS = [.40, .30, .30, .40, .44, .26, .28, .40, .50]


def images(montage):
    """Toutes les images du film, dans l'ordre."""
    for i, (A, B, duree, regles) in enumerate(PASSAGES):
        for _ in range(round(REPOS[i] * IPS)):
            yield montage.E[A]
        n = round(duree * IPS)
        # La dernière image du passage est l'état d'arrivée lui-même : c'est
        # le repos suivant qui la donne.
        for k in range(1, n):
            yield montage.passage(A, B, k / n, regles)
    for _ in range(round(REPOS[-1] * IPS)):
        yield montage.E[8]


def verifier(montage):
    """Chaque passage part de son état et arrive au suivant, au pixel près."""
    pire = 0
    for (A, B, _, regles) in PASSAGES:
        for p, s in ((0.0, A), (1.0, B)):
            ecart = np.abs(montage.passage(A, B, p, regles) - montage.E[s])
            lourd = int((ecart.sum(axis=2) > 24).sum())
            pire = max(pire, lourd)
            print('  E%d vers E%d, à p=%d : écart moyen %.4f, maximum %d, pixels nettement différents %d' % (A, B, p, ecart.mean(), ecart.max(), lourd))
    return pire


def encoder(montage, dossier):
    base = os.path.join(dossier, SORTIE)
    entree = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', '%dx%d' % (L, H), '-r', str(IPS)] + COULEUR + ['-i', '-']
    sorties = [
        # Les réglages des autres films du site (H.264 High 3.1), qu'il a vus
        # jouer sur son iPhone ; seul le nombre d'images par seconde change.
        (base + '.mp4', ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', '20', '-profile:v', 'high', '-level', '3.1',
                         '-pix_fmt', 'yuv420p', '-g', str(IPS * 2), '-movflags', '+faststart']),
        (base + '.webm', ['-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-deadline', 'good', '-cpu-used', '1', '-row-mt', '1',
                          '-pix_fmt', 'yuv420p', '-g', str(IPS * 2)]),
    ]
    toutes = [en_plans(im) for im in images(montage)]
    for chemin, reglages in sorties:
        p = subprocess.Popen(entree + reglages + COULEUR + ['-an', chemin], stdin=subprocess.PIPE)
        for im in toutes:
            p.stdin.write(im)
        p.stdin.close()
        assert p.wait() == 0, "l'encodage a échoué : " + chemin
    # La première et la dernière image, que la page montre avant et après le
    # film : converties ici en couleurs d'écran, pour qu'un JPEG et le film
    # qu'il encadre aient la même teinte.
    for suffixe, s in (('-debut.jpg', 0), ('-fin.jpg', 8)):
        rvb = np.clip(np.rint(en_rvb(montage.E[s])), 0, 255).astype(np.uint8)
        Image.fromarray(rvb).save(base + suffixe, quality=90, optimize=True)
    return len(toutes)


def planches(montage, dossier):
    """Une pellicule par passage, pour regarder le mouvement image par image."""
    os.makedirs(dossier, exist_ok=True)
    for i, (A, B, duree, regles) in enumerate(PASSAGES):
        n = round(duree * IPS)
        pas = [k / n for k in range(0, n + 1, max(1, n // 9))][:10]
        vues = [np.clip(np.rint(en_rvb(montage.passage(A, B, p, regles))), 0, 255).astype(np.uint8) for p in pas]
        vues = (vues + [vues[-1]] * 10)[:10]
        bande = np.concatenate([np.concatenate(vues[:5], axis=1), np.concatenate(vues[5:], axis=1)], axis=0)
        Image.fromarray(bande).save(os.path.join(dossier, 'passage-%d.png' % (i + 1)))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    dossier = sys.argv[1]
    montage = Montage(lire_etats(os.path.join(dossier, 'nov-film-equipe.mp4')))
    print("Chaque passage, à son départ et à son arrivée, contre les états du film d'origine :")
    pire = verifier(montage)
    assert pire == 0, "un passage ne retombe pas sur son état : %d pixels" % pire
    if '--planches' in sys.argv:
        planches(montage, sys.argv[sys.argv.index('--planches') + 1])
    if '--sans-film' not in sys.argv:
        n = encoder(montage, dossier)
        print('%d images à %d par seconde, soit %.2f s' % (n, IPS, n / IPS))

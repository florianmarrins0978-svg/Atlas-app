#!/usr/bin/env python3
"""
LA BANDE SON DU FILM DE PROMOTION, FABRIQUÉE ICI.

Le film (appli/video-promo/film/film-C.html) déclare ses instants sonores dans
`window.SONS` : un appui, une poussée d'écran, le total du devis qui s'encadre.
`scripts/rendre-film.mjs --sons` les écrit dans un JSON ; ce script en fait un
WAV que `--son` pose sur le film. Une seule horloge, donc : les sons ne se
désynchronisent pas quand le montage bouge de trois images.

POURQUOI SYNTHÉTISER PLUTÔT QUE POSER UN MORCEAU. Rien ici ne peut être
écouté avant d'être livré : cet environnement n'a pas de haut-parleur, et une
musique prise sur l'étagère pose une question de droits qu'on ne tranche pas à
sa place. Un lit sonore construit note à note, dans une seule tonalité, sans
dissonance possible, est ce qu'on peut livrer les yeux fermés : le pire cas est
« discret », jamais « faux ». La mesure qu'on sait faire, on la fait : le
script imprime la crête et le niveau moyen de chaque couche.

    python3 scripts/musique-film.py --sons sons.json --sortie bande.wav [--sans-musique]

Ré majeur, 100 à la noire, une mesure de 2,4 s : les changements d'accord
tombent sur les changements de scène (4,8 s, 14,4 s, 26,4 s, 38,4 s). C'est
la carte du film C, gardée telle quelle quand la page n'en déclare pas.

DEPUIS LES FILMS D (4 octobre 2026), LA CARTE VIENT DE LA PAGE. `window.MUSIQUE`
dit le tempo, la tonalité et les sections : à quel instant quel accord, avec
quelles couches (nappe, arpège, rythme, pulsation, charley, silence, finale),
et, depuis le film D, le tempo propre à chaque section. `rendre-film.mjs
--sons` l'écrit à côté des instants ; ici, elle remplace les constantes
ci-dessous. Une seule horloge, donc : un film au tempo nerveux et un film
lent n'ont pas deux scripts, ils ont deux cartes.
"""
import argparse
import json
import math
import wave

import numpy as np

FE = 48_000
BPM = 100
NOIRE = 60 / BPM
MESURE = 4 * NOIRE

# Si mineur, Sol, Ré, La : la question de l'accroche est posée en mineur, et le
# téléphone arrive sur le Ré majeur (mesure 2, à 4,8 s).
PROGRESSION = ["Bm", "G", "D", "A"]
ACCORDS = {  # notes MIDI : la nappe, la basse, l'arpège (grave vers aigu)
    "D":  dict(nappe=[62, 66, 69, 74], basse=38, arpege=[62, 66, 69, 74, 78]),
    "A":  dict(nappe=[61, 64, 69, 73], basse=45, arpege=[57, 61, 64, 69, 73]),
    "Bm": dict(nappe=[59, 62, 66, 71], basse=47, arpege=[59, 62, 66, 71, 74]),
    "G":  dict(nappe=[59, 62, 67, 71], basse=43, arpege=[55, 59, 62, 67, 71]),
}
T_ARPEGE = 4.8     # le téléphone entre : l'arpège commence
T_RYTHME = 14.4    # le devis est prêt : basse et grosse caisse
T_CHARLEY = 26.4   # « vous êtes prévenu » : le tissu se densifie
T_FINAL = 38.4     # la fin : un seul accord tenu, qui scintille


def frequence(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


class Piste:
    def __init__(self, duree):
        self.n = int(duree * FE)
        self.g = np.zeros(self.n)
        self.d = np.zeros(self.n)

    def ajouter(self, t0, signal, pan=0.0, gain=1.0):
        """pan de −1 (gauche) à 1 (droite), à puissance constante."""
        i0 = int(round(t0 * FE))
        if i0 >= self.n:
            return
        s = signal[: self.n - i0] * gain
        ag = math.cos((pan + 1) * math.pi / 4)
        ad = math.sin((pan + 1) * math.pi / 4)
        self.g[i0:i0 + len(s)] += s * ag
        self.d[i0:i0 + len(s)] += s * ad

    def stats(self, nom):
        m = np.maximum(np.abs(self.g), np.abs(self.d))
        eff = math.sqrt(float(np.mean((self.g ** 2 + self.d ** 2) / 2)) + 1e-12)
        db = lambda x: 20 * math.log10(max(x, 1e-9))
        print(f"  {nom:<10} crête {db(float(m.max())):6.1f} dBFS   moyen {db(eff):6.1f} dBFS")


def temps(duree):
    return np.arange(int(duree * FE)) / FE


def enveloppe(t, attaque, relache, duree=None):
    """Montée douce, tenue, descente : ce qu'une nappe fait."""
    e = np.minimum(1.0, t / max(attaque, 1e-4))
    if duree is not None:
        e = e * np.clip((duree - t) / max(relache, 1e-4), 0, 1)
    return e


def passe_bas(x, coupure):
    """Un pôle : ce qu'il faut pour adoucir, rien de plus."""
    a = math.exp(-2 * math.pi * coupure / FE)
    y = np.empty_like(x)
    acc = 0.0
    b = 1 - a
    for i in range(len(x)):
        acc = a * acc + b * x[i]
        y[i] = acc
    return y


def passe_bas_rapide(x, coupure):
    """Le même filtre, vectorisé par blocs : assez pour des signaux longs."""
    from numpy.lib.stride_tricks import sliding_window_view  # noqa: F401  (documente l'intention)
    a = math.exp(-2 * math.pi * coupure / FE)
    # récurrence y[n] = a·y[n-1] + (1-a)·x[n], résolue par blocs de 4096
    y = np.empty_like(x)
    acc = 0.0
    taille = 4096
    puissances = a ** np.arange(1, taille + 1)
    for debut in range(0, len(x), taille):
        bloc = x[debut:debut + taille] * (1 - a)
        m = len(bloc)
        # contribution de l'état précédent, puis convolution tronquée
        sortie = np.convolve(bloc, a ** np.arange(m))[:m] + acc * puissances[:m]
        y[debut:debut + m] = sortie
        acc = sortie[-1]
    return y


# ─── les timbres ─────────────────────────────────────────────────────────────

def nappe(midi, duree, detune=0.0025):
    """Trois voix légèrement désaccordées, harmoniques impairs adoucis."""
    t = temps(duree + 1.2)
    f = frequence(midi)
    s = np.zeros_like(t)
    for k, ratio in enumerate((1 - detune, 1.0, 1 + detune)):
        ph = k * 1.7
        for n, amp in ((1, 1.0), (3, 0.22), (5, 0.08), (7, 0.03)):
            s += amp * np.sin(2 * math.pi * f * ratio * n * t + ph)
    s *= enveloppe(t, 0.9, 1.1, duree + 1.2) * (1 + 0.08 * np.sin(2 * math.pi * 0.17 * t))
    return s / 3.2


def pince(midi, duree=0.9, force=1.0):
    """Une corde pincée, feutrée : sinus, deux harmoniques, décroissance vive."""
    t = temps(duree)
    f = frequence(midi)
    s = (np.sin(2 * math.pi * f * t) + 0.38 * np.sin(4 * math.pi * f * t) + 0.12 * np.sin(6 * math.pi * f * t)
         + 0.04 * np.sin(8 * math.pi * f * t))
    s *= (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.33) * force
    return s


def cloche(midi, duree=1.6, force=1.0):
    """Une lame frappée : partiels inharmoniques discrets, longue traîne."""
    t = temps(duree)
    f = frequence(midi)
    s = (np.sin(2 * math.pi * f * t) + 0.25 * np.sin(2 * math.pi * f * 2.0 * t) * np.exp(-t / 0.4)
         + 0.12 * np.sin(2 * math.pi * f * 2.76 * t) * np.exp(-t / 0.25))
    s *= (1 - np.exp(-t / 0.002)) * np.exp(-t / (duree / 3.2)) * force
    return s


def basse(midi, duree=0.55):
    t = temps(duree)
    f = frequence(midi)
    s = np.sin(2 * math.pi * f * t) + 0.25 * np.sin(4 * math.pi * f * t)
    s *= (1 - np.exp(-t / 0.008)) * np.clip((duree - t) / 0.12, 0, 1) * (0.55 + 0.45 * np.exp(-t / 0.18))
    return s


def grosse_caisse(force=1.0):
    t = temps(0.4)
    f = 48 + 90 * np.exp(-t / 0.045)
    phase = 2 * math.pi * np.cumsum(f) / FE
    s = np.sin(phase) * np.exp(-t / 0.15)
    s[: int(0.003 * FE)] += np.random.default_rng(1).normal(0, 0.25, int(0.003 * FE))
    return s * force


def souffle(duree, graine, coupure_debut=6000, coupure_fin=1200):
    """Un bruit filtré dont la couleur bouge : la matière des glissés."""
    rng = np.random.default_rng(graine)
    x = rng.normal(0, 1, int(duree * FE))
    morceaux = 12
    taille = len(x) // morceaux + 1
    y = np.empty_like(x)
    for k in range(morceaux):
        coupure = coupure_debut + (coupure_fin - coupure_debut) * k / (morceaux - 1)
        fen = max(1, int(FE / (2 * math.pi * coupure)))
        bloc = x[k * taille:(k + 1) * taille]
        y[k * taille:k * taille + len(bloc)] = np.convolve(bloc, np.ones(fen) / fen, mode="same")
    return y


def charley(force=1.0, duree=0.05, graine=3):
    rng = np.random.default_rng(graine)
    t = temps(duree)
    x = rng.normal(0, 1, len(t))
    x = x - np.convolve(x, np.ones(6) / 6, mode="same")   # on retire le grave : il ne reste que le souffle
    return x * np.exp(-t / (duree / 3.5)) * force * 0.5


def clic(hauteur=1400, duree=0.035, force=1.0, graine=5):
    """Un appui : une pointe de bruit, puis une note très courte."""
    rng = np.random.default_rng(graine)
    t = temps(duree)
    s = np.sin(2 * math.pi * hauteur * t) * np.exp(-t / (duree / 4))
    s[: int(0.0015 * FE)] += rng.normal(0, 0.6, int(0.0015 * FE))
    return s * force


def somme(*signaux):
    """Additionne des signaux de longueurs différentes, le plus court complété de silence."""
    n = max(len(s) for s in signaux)
    total = np.zeros(n)
    for s in signaux:
        total[: len(s)] += s
    return total


def glissando(f0, f1, duree, force=1.0):
    t = temps(duree)
    f = f0 * (f1 / f0) ** (t / duree)
    phase = 2 * math.pi * np.cumsum(f) / FE
    return np.sin(phase) * np.exp(-t / (duree / 2.5)) * (1 - np.exp(-t / 0.004)) * force


# ─── la musique ───────────────────────────────────────────────────────────────

def accord_de_la_mesure(m):
    return PROGRESSION[m % len(PROGRESSION)]


def carte_du_film_c(duree):
    """La carte de la version C, écrite comme une page la déclarerait."""
    sections = []
    mesures = int(math.ceil(duree / MESURE))
    for m in range(mesures):
        t0 = m * MESURE
        if t0 >= duree:
            break
        if t0 >= T_FINAL - 1e-6:
            sections.append(dict(de=t0, accord="D", couches=["nappe", "finale"]))
            continue
        couches = ["nappe"]
        if t0 >= T_ARPEGE:
            couches.append("arpege")
        if t0 >= T_RYTHME:
            couches.append("rythme")
        if t0 >= T_CHARLEY:
            couches.append("charley")
        sections.append(dict(de=t0, accord=accord_de_la_mesure(m), couches=couches))
    return dict(bpm=BPM, sections=sections)


def musique(duree, carte=None):
    """La musique, mesure par mesure, d'après une carte : tempo et sections.

    Une section dit à partir de quel instant quel accord sonne, et quelles
    couches jouent. Les mesures partent du début de chaque section et suivent
    SON tempo (`bpm` de la section, sinon celui de la carte) : le film D passe
    de 128 à la noire (le stress) à 92 (le calme) sans qu'une mesure ne
    chevauche la bascule. Rien d'une section ne sonne après la suivante : un
    battement qui déborderait dans un silence n'est pas joué.
    """
    carte = carte or carte_du_film_c(duree)
    sections = sorted(carte["sections"], key=lambda s: s["de"])
    p_nappe, p_arpege, p_rythme = Piste(duree + 2), Piste(duree + 2), Piste(duree + 2)
    rng = np.random.default_rng(7)

    for i, s in enumerate(sections):
        fin = sections[i + 1]["de"] if i + 1 < len(sections) else duree
        fin = min(fin, duree)
        if "silence" in s["couches"] or s["de"] >= fin:
            continue
        noire = 60 / float(s.get("bpm", carte.get("bpm", BPM)))
        mesure = 4 * noire
        acc = ACCORDS[s["accord"]]
        couches = s["couches"]
        finale = "finale" in couches
        dans = lambda te: te < fin - 1e-6
        t0 = float(s["de"])
        while t0 < fin - 1e-6:
            tenue = (duree - t0) if finale else min(mesure, fin - t0 + 0.4)
            if "nappe" in couches:
                gain = 0.19 if "arpege" in couches else 0.16
                for k, midi in enumerate(acc["nappe"]):
                    p_nappe.ajouter(t0, nappe(midi, tenue), pan=(-0.5 + k / 3), gain=gain)
            if finale:
                for k, midi in enumerate(acc["nappe"][1:]):
                    p_nappe.ajouter(t0 + 0.6 + 0.25 * k, nappe(midi + 12, tenue - 0.6), pan=(0.4 - 0.4 * k), gain=0.05)
                break
            if "arpege" in couches:
                motif = [0, 2, 3, 4, 3, 2, 1, 2]
                for c in range(8):
                    tc = t0 + c * noire / 2
                    if not dans(tc):
                        continue
                    force = (0.9 if c % 2 == 0 else 0.62) * rng.uniform(0.9, 1.05)
                    p_arpege.ajouter(tc, pince(acc["arpege"][motif[c]], force=force), pan=rng.uniform(-0.35, 0.35), gain=0.20)
            if "rythme" in couches:
                for temps_fort in (0, 2):
                    tb = t0 + temps_fort * noire
                    if not dans(tb):
                        continue
                    p_rythme.ajouter(tb, basse(acc["basse"]), gain=0.30)
                    p_rythme.ajouter(tb, grosse_caisse(), gain=0.32)
            if "pulsation" in couches:
                # Un battement à chaque temps, et une basse tenue : le rythme
                # du stress, où les coupes tombent sur les temps.
                for temps in range(4):
                    tb = t0 + temps * noire
                    if not dans(tb):
                        continue
                    p_rythme.ajouter(tb, grosse_caisse(force=1.0 if temps % 2 == 0 else 0.7), gain=0.34)
                    p_rythme.ajouter(tb, basse(acc["basse"], duree=noire * 0.9), gain=0.26)
            if "charley" in couches:
                for c in range(8):
                    tc = t0 + c * noire / 2
                    if dans(tc):
                        p_rythme.ajouter(tc, charley(force=0.55 if c % 2 else 0.35, graine=int(tc * 100)), pan=0.3, gain=0.09)
                for temps_faible in (1, 3):
                    tb = t0 + temps_faible * noire
                    if dans(tb):
                        p_rythme.ajouter(tb, charley(force=1.0, duree=0.02, graine=int(t0 * 10) + temps_faible), pan=-0.25, gain=0.14)
            t0 += mesure
    # le grave de la nappe s'adoucit ; on filtre une fois, pas par note
    p_nappe.g = passe_bas_rapide(p_nappe.g, 1900)
    p_nappe.d = passe_bas_rapide(p_nappe.d, 1900)
    return p_nappe, p_arpege, p_rythme


# ─── les bruitages, un par instant que le film déclare ────────────────────────

def bruitages(duree, sons):
    p = Piste(duree + 2)
    compteur = 0
    for t, genre in sons:
        compteur += 1
        g = compteur  # une graine par son : deux glissés ne sont jamais le même bruit
        if genre == "mot":
            p.ajouter(t, somme(glissando(110, 70, 0.3, 0.5), 0.25 * souffle(0.18, g, 3000, 600) * np.exp(-temps(0.18) / 0.05)), gain=0.35)
        elif genre == "barre":
            p.ajouter(t, souffle(0.42, g, 500, 5000) * np.sin(np.pi * temps(0.42) / 0.42) ** 0.7, gain=0.22)
        elif genre == "reponse":
            for k, midi in enumerate((74, 81)):
                p.ajouter(t + 0.03 * k, cloche(midi, 1.4), gain=0.22)
            p.ajouter(t, glissando(120, 60, 0.35, 0.6), gain=0.3)
        elif genre in ("telephone-entre", "feuille-entre"):
            p.ajouter(t, souffle(0.55, g, 800, 4500) * np.sin(np.pi * temps(0.55) / 0.55) ** 1.2, gain=0.17)
        elif genre in ("telephone-sort", "feuille-sort"):
            p.ajouter(t, souffle(0.5, g, 4500, 700) * np.sin(np.pi * temps(0.5) / 0.5) ** 1.2, gain=0.15)
        elif genre == "glisse":
            p.ajouter(t, souffle(0.3, g, 5000, 1500) * np.sin(np.pi * temps(0.3) / 0.3) ** 1.5, gain=0.10)
        elif genre == "envoi":
            p.ajouter(t, souffle(0.35, g, 1200, 7000) * np.sin(np.pi * temps(0.35) / 0.35) ** 1.2, gain=0.16)
            p.ajouter(t + 0.05, glissando(520, 1180, 0.28, 0.7), gain=0.16)
        elif genre == "appui":
            p.ajouter(t, clic(1400, 0.035, graine=g), gain=0.30)
        elif genre == "touche":
            p.ajouter(t, clic(2300, 0.018, graine=g), gain=0.17)
        elif genre == "reconnu":
            p.ajouter(t, glissando(660, 880, 0.14, 0.8), gain=0.16)
        elif genre == "micro":
            for k, midi in enumerate((81, 86)):
                p.ajouter(t + 0.09 * k, pince(midi, 0.5, 0.9), gain=0.22)
        elif genre == "partie":
            p.ajouter(t, clic(320, 0.06, graine=g), gain=0.16)
            p.ajouter(t, souffle(0.05, g + 500, 6000, 3000) * np.exp(-temps(0.05) / 0.012), gain=0.10)
        elif genre == "total":
            for k, midi in enumerate((74, 78, 81, 86)):
                p.ajouter(t + 0.04 * k, cloche(midi, 2.0), gain=0.20)
        elif genre == "accepte":
            for k, midi in enumerate((78, 86)):
                p.ajouter(t + 0.16 * k, cloche(midi, 1.4), gain=0.24)
        elif genre == "notification":
            p.ajouter(t, glissando(880, 620, 0.09, 0.9), gain=0.22)
            p.ajouter(t + 0.1, glissando(990, 700, 0.09, 0.7), gain=0.16)
        elif genre == "repere":
            p.ajouter(t, clic(1250, 0.03, graine=g), gain=0.12)
        elif genre == "final":
            for k, midi in enumerate((74, 81, 86, 90)):
                p.ajouter(t + 0.07 * k, cloche(midi, 3.0), gain=0.19)
        elif genre == "pastille":
            p.ajouter(t, glissando(760, 640, 0.07, 0.9), gain=0.16)
        elif genre == "coup":
            # Un impact sourd : le mot qui frappe (direction nerveuse).
            p.ajouter(t, grosse_caisse(force=1.3), gain=0.42)
            p.ajouter(t, souffle(0.12, g, 3000, 300) * np.exp(-temps(0.12) / 0.03), gain=0.25)
        elif genre == "nappe-monte":
            # Une montée de souffle qui prépare un coup.
            p.ajouter(t, souffle(1.2, g, 300, 6000) * (temps(1.2) / 1.2) ** 2, gain=0.2)
        elif genre == "tic":
            # Le tic d'une horloge (direction récit).
            p.ajouter(t, clic(900, 0.02, graine=g), gain=0.14)
        else:
            print(f"  (instant {t} : genre inconnu « {genre} », ignoré)")
    return p


def reverberation(g, d, melange=0.22):
    """Deux retards croisés, assourdis à chaque tour : une pièce, pas une cathédrale."""
    def ligne(x, retard, retour, coupure=3200):
        n = int(retard * FE)
        y = x.copy()
        a = math.exp(-2 * math.pi * coupure / FE)
        # bloc par bloc : chaque tour lit ce que le tour précédent a écrit
        for debut in range(n, len(y), n):
            fin = min(debut + n, len(y))
            retourne = y[debut - n:fin - n] * retour
            # adouci : un lissage court tient lieu de passe-bas à l'intérieur de la boucle
            retourne = np.convolve(retourne, np.ones(3) / 3, mode="same") * (1 - a) + retourne * a * 0.6
            y[debut:fin] += retourne
        return y
    wg = ligne(g, 0.211, 0.34) * 0.5 + ligne(d, 0.337, 0.30) * 0.5
    wd = ligne(d, 0.211, 0.34) * 0.5 + ligne(g, 0.337, 0.30) * 0.5
    return g * (1 - melange) + wg * melange, d * (1 - melange) + wd * melange


def ecrire_wav(chemin, g, d):
    pile = np.stack([g, d], axis=1)
    pile = np.clip(pile, -1, 1)
    donnees = (pile * 32767).astype("<i2").tobytes()
    with wave.open(chemin, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(FE)
        w.writeframes(donnees)


def principal():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sons", required=True, help="le JSON écrit par rendre-film.mjs --sons")
    ap.add_argument("--sortie", required=True)
    ap.add_argument("--sans-musique", action="store_true", help="les bruitages seuls")
    args = ap.parse_args()
    with open(args.sons, encoding="utf8") as f:
        charge = json.load(f)
    duree = float(charge["duree"])
    sons = charge["sons"]
    carte = charge.get("musique") or None
    print(f"{duree} s, {len(sons)} instants sonores" + (f", carte musicale de la page ({carte.get('bpm')} à la noire)" if carte else ", carte de la version C"))

    total_g = np.zeros(int((duree + 2) * FE))
    total_d = np.zeros_like(total_g)
    if not args.sans_musique:
        p_nappe, p_arpege, p_rythme = musique(duree, carte)
        for nom, piste in (("nappe", p_nappe), ("arpège", p_arpege), ("rythme", p_rythme)):
            piste.stats(nom)
            total_g += piste.g
            total_d += piste.d
    p_bruits = bruitages(duree, sons)
    p_bruits.stats("bruitages")
    total_g += p_bruits.g
    total_d += p_bruits.d

    total_g, total_d = reverberation(total_g, total_d)
    # la fin : tout s'éteint sur la dernière seconde et demie, rien ne se coupe net
    n = int(duree * FE)
    total_g, total_d = total_g[:n], total_d[:n]
    fondu = np.ones(n)
    nf = int(1.5 * FE)
    fondu[-nf:] = np.linspace(1, 0, nf) ** 1.5
    total_g *= fondu
    total_d *= fondu
    # un genou doux, puis la crête à −1 dBFS
    total_g, total_d = np.tanh(total_g * 1.15), np.tanh(total_d * 1.15)
    crete = max(float(np.abs(total_g).max()), float(np.abs(total_d).max()), 1e-9)
    total_g *= 0.89 / crete
    total_d *= 0.89 / crete
    ecrire_wav(args.sortie, total_g, total_d)
    eff = math.sqrt(float(np.mean((total_g ** 2 + total_d ** 2) / 2)))
    print(f"mixage : crête −1,0 dBFS, moyen {20 * math.log10(eff):.1f} dBFS, écrit dans {args.sortie}")


if __name__ == "__main__":
    principal()

"use client";

import { useRef, useState } from "react";

// Hook stabilisé (voir docs/DESIGN_SYSTEM.md) : à réutiliser pour toute liste de
// données métier facilement recréables (prestations, matériel, lignes de prix...).
// Ne jamais dupliquer cette logique dans un nouvel écran — l'importer ici.

export type WithId = { id: number };

export function useRemovableList<T extends WithId>(initial: T[], idStart = 1000) {
  const nextId = useRef(idStart);
  const [items, setItems] = useState<T[]>(initial);
  const [leavingIds, setLeavingIds] = useState<Set<number>>(new Set());
  const [lastRemoved, setLastRemoved] = useState<{ item: T; index: number } | null>(null);

  function add(makeItem: (id: number) => T) {
    setItems((cur) => [...cur, makeItem(nextId.current++)]);
  }

  function updateAt(id: number, updater: (item: T) => T) {
    setItems((cur) => cur.map((i) => (i.id === id ? updater(i) : i)));
  }

  function remove(id: number) {
    setLeavingIds((s) => new Set(s).add(id));
    setTimeout(() => {
      setItems((cur) => {
        const index = cur.findIndex((i) => i.id === id);
        if (index === -1) return cur;
        setLastRemoved({ item: cur[index], index });
        return cur.filter((i) => i.id !== id);
      });
      setLeavingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 180); // durée de la transition de sortie (voir AnimatedRow)
  }

  function undoLastRemoved() {
    if (!lastRemoved) return;
    setItems((cur) => {
      const next = [...cur];
      next.splice(lastRemoved.index, 0, lastRemoved.item);
      return next;
    });
    setLastRemoved(null);
  }

  function clearLastRemoved() {
    setLastRemoved(null);
  }

  return { items, leavingIds, add, updateAt, remove, lastRemoved, undoLastRemoved, clearLastRemoved };
}

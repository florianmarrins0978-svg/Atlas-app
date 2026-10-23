import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:430,height:1300} });
const pannes=[]; p.on("pageerror", e=>pannes.push(e.message)); p.on("response", r=>{ if (r.status()>=500) pannes.push(r.status()+" "+r.url()); });
for (let i=0;i<3;i++){ await p.goto("http://localhost:3007/login"); if (await p.locator('input[type="email"]').count()) break; }
await p.fill('input[type="email"]', "demo@atlas.local"); await p.fill('input[type="password"]', "demo1234");
await p.click('button[type="submit"]'); await p.waitForURL(u => !u.toString().includes("/login"), {timeout:90000});
for (let i=0;i<3 && /documents-legaux|bienvenue/.test(p.url()); i++) { const c=p.locator('input[type="checkbox"]'); for (let k=0;k<await c.count();k++) await c.nth(k).check().catch(()=>{}); const bt=p.locator('button[type="submit"]'); if (await bt.count()) await bt.first().click().catch(()=>{}); await p.waitForTimeout(1500); }
await p.goto("http://localhost:3007/"); await p.waitForLoadState("networkidle");
const plus = p.getByRole("button", { name: /autres? devis à regarder/ }); if (await plus.count()) await plus.click();
await p.waitForTimeout(700);
console.log("ACCUEIL", (await p.locator('[data-atlas-ton]').evaluateAll(n => n.map(x => x.getAttribute("data-atlas-ton")+" | "+x.innerText.split("\n").slice(0,3).join(" / ")))).join("\n"));
await p.screenshot({ path: "C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/a314f795-538e-4b11-aafd-08ff4c894c2b/scratchpad/l2-accueil.png" });
await p.goto("http://localhost:3007/termines/tva"); await p.waitForLoadState("networkidle"); await p.waitForTimeout(500);
const z = p.locator('[data-atlas="virement-sur-la-facture"]').first(); if (await z.count()) await z.scrollIntoViewIfNeeded();
await p.screenshot({ path: "C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/a314f795-538e-4b11-aafd-08ff4c894c2b/scratchpad/l2-tva.png" });
console.log("TVA questions:", await p.locator('[data-atlas="virement-sur-la-facture"]').count());
await p.goto("http://localhost:3007/reglages/banque"); await p.waitForLoadState("networkidle");
await p.screenshot({ path: "C:/Users/Flori/AppData/Local/Temp/claude/c--Users-Flori-Desktop-atlas-real-app-atlas-app/a314f795-538e-4b11-aafd-08ff4c894c2b/scratchpad/l2-banque.png", fullPage:true });
console.log("pannes", pannes);
await b.close();

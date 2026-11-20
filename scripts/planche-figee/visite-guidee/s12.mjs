import { session } from "./fige.mjs";
const { page, va, fige, fin } = await session();
try { await va("/reglages/banque"); await fige("45-ma-banque"); await fige("r-banque"); } catch (e) { console.log("ÉCHEC", e.message); }
await fin();

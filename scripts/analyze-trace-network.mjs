import fs from 'fs';
const file = process.argv[2] || 'C:/Users/Flori/AppData/Local/Temp/trace-tva-e2e/trace.network';
if (!fs.existsSync(file)) {
  console.error('Trace file not found:', file);
  process.exit(2);
}
const content = fs.readFileSync(file,'utf8');
const lines = content.split(/\r?\n/);
const payload = content;
const patterns = ['facture','factures','paiement','paiements','paiements_facture','/facture','/factures','/paiement','/paiements'];
let found = [];
for (const p of patterns) {
  if (payload.includes(p)) found.push(p);
}
console.log('Patterns found in file:', found);
// extract UUID-like strings
const uuids = Array.from(payload.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)).map(m=>m[0]);
console.log('UUIDs found (unique):', [...new Set(uuids)].slice(0,200));
// extract POST/PUT request lines
const requests = [];
const regex = /"method":"(POST|PUT)"[\s\S]{0,200}?"url":"([^"]+)"/g;
let m;
while ((m = regex.exec(payload)) !== null) {
  requests.push({method:m[1], url:m[2]});
}
console.log('POST/PUT requests found:', requests.length);
for (const r of requests) console.log(r.method, r.url);
process.exit(0);

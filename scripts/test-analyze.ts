import { analyze } from "../lib/refs";
import { db } from "../db";
const rows = db.query("SELECT id,title,url FROM refs WHERE status='new' ORDER BY views DESC LIMIT 3").all() as any[];
for (const r of rows) {
  const ok = await analyze(r.id);
  console.log(r.id, ok ? "ok" : "falhou", r.title.slice(0, 50));
}

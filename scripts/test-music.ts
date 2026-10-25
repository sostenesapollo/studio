import { pickMusic } from "../lib/pipeline";
import { db } from "../db";
for (let i = 0; i < 10; i++) {
  const t = pickMusic(i % 2 ? "tradubook" : "giftsqr", i * 997);
  console.log(i, t?.split("/").pop());
  if (t) db.query("INSERT INTO music_use (path) VALUES (?)").run(t);
}

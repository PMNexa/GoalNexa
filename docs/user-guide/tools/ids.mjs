// Write ids.json: the demo account's record ids by name, read from the API
// ("goal:<title>", "metric:<name>", "org:<name>", "cycles:<name>",
// "teams:<name>", "goal-templates:<name>"). The first of a name wins.
import fs from "node:fs";
import { listAll } from "./video-lib.mjs";

const ids = {};
for (const [res, key, field] of [["orgs", "org", "name"], ["goals", "goal", "title"], ["metrics", "metric", "name"], ["cycles", "cycles", "name"], ["teams", "teams", "name"], ["goal-templates", "goal-templates", "name"]]) {
  for (const row of await listAll(res)) ids[`${key}:${row[field] ?? row.title}`] ??= row.id;
}
fs.writeFileSync(new URL("./ids.json", import.meta.url), JSON.stringify(ids, null, 1) + "\n");
console.log(Object.keys(ids).length, "ids");

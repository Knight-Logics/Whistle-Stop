import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const runtime = JSON.parse(await readFile(join(root, "data", "campaign-runtime.json"), "utf8"));
const store = await readFile(join(root, "js", "campaign-store.js"), "utf8");
const sw = await readFile(join(root, "sw.js"), "utf8");

assert.deepEqual(runtime.signups, [], "Public campaign runtime must not contain signup PII");
assert.deepEqual(runtime.outreachLeads, [], "Public campaign runtime must not contain lead PII");
assert.deepEqual(runtime.emailLog, [], "Public campaign runtime must not contain delivery logs");
assert.match(store, /nothing was submitted/i, "Offline signup must report that it was not submitted");
assert.match(store, /no email was sent/i, "Offline outreach must report that it was not sent");
assert.doesNotMatch(store, /status:\s*["']sent["'][\s\S]{0,160}local-demo/, "Local demo must never be recorded as sent");
assert.ok(sw.includes('/\\/admin(?:\\.html)?$/i'), "Service worker must explicitly exclude admin from caching");
assert.ok(sw.includes('/\\/data\\//i'), "Service worker must explicitly exclude data from caching");

console.log("PASS: campaign privacy and delivery safety smoke test");

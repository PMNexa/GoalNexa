// Narrated screen recordings for the video manual: Playwright records the
// page, an injected overlay draws a cursor, captions and title cards, macOS
// `say` reads each caption, and ffmpeg lays the narration over the video.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

export const B = process.env.GOALNEXA_URL || "http://localhost:55607";
export const EMAIL = process.env.GOALNEXA_EMAIL || "alex@northwind.example";
export const PASSWORD = process.env.GOALNEXA_PASSWORD || "CorrectHorse!Battery9";
// The REST API as the demo account (a session of its own, apart from the
// browser's): lists every page, and fails loudly on an error response.
let token;
export async function api(p, init = {}) {
  if (!token) {
    const r = await fetch(`${B}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    if (!r.ok) throw new Error(`login: ${r.status}`);
    token = (await r.json()).access_token;
  }
  const r = await fetch(`${B}/api/v1/${p}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers } });
  if (!r.ok) throw new Error(`${init.method || "GET"} ${p}: ${r.status}`);
  return r.status === 204 ? null : r.json();
}
export async function listAll(res, params = {}) {
  const items = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ ...params, page_size: "100", page: String(page) });
    const body = await api(`${res}?${q}`);
    items.push(...body.items);
    if (!body.total || items.length >= body.total || !body.items.length) return items;
  }
}
// Remove what a take creates, by name - whether or not the take got as far
// as removing it on camera: goals by title, pending invitations by email,
// share links by title (or by id).
export async function tidy({ goals = [], invites = [], shares = [] } = {}) {
  for (const title of goals)
    for (const g of await listAll("goals", { "filter{title}": title })) await api(`goals/${g.id}`, { method: "DELETE" });
  for (const email of invites)
    for (const i of await listAll("org-invitations", { "filter{email}": email, "filter{status}": "pending" })) await api(`org-invitations/${i.id}`, { method: "DELETE" });
  if (shares.length)
    for (const sh of (await api("dashboard-shares")).items)
      if (shares.includes(sh.title) || shares.includes(sh.id)) await api(`dashboard-shares/${sh.id}`, { method: "DELETE" });
}

const VOICE = process.env.GOALNEXA_VOICE || "Samantha";
const AUDIO = path.join(os.tmpdir(), "goalnexa-video-audio");
const SIZE = { width: 1440, height: 900 };

// Runs in every page: cursor, caption bar, title card.
const OVERLAY = () => {
  const css = `
    #gnv-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transition:transform .05s linear}
    #gnv-ring{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #f08c2e;opacity:0;z-index:2147483646;pointer-events:none}
    #gnv-ring.on{animation:gnvring .55s ease-out}
    @keyframes gnvring{from{opacity:1;transform:scale(.4)}to{opacity:0;transform:scale(1.4)}}
    #gnv-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1120px;padding:14px 26px;border-radius:14px;
      background:rgba(20,33,61,.93);color:#fff;font:500 22px/1.4 -apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;
      z-index:2147483645;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.3)}
    #gnv-cap:empty{display:none}
    #gnv-title{position:fixed;inset:0;z-index:2147483644;display:flex;flex-direction:column;justify-content:center;padding:0 140px;
      background:linear-gradient(135deg,#14213d,#1f3a7a);color:#f7f8fb;font-family:-apple-system,"Segoe UI",Roboto,sans-serif}
    #gnv-title small{font-size:22px;letter-spacing:3px;text-transform:uppercase;color:#8fb3ff;font-weight:600}
    #gnv-title h1{font-size:76px;margin:18px 0;font-weight:800;line-height:1.1;color:#f7f8fb !important}
    body:has(#gnv-title) #gnv-cursor,body:has(#gnv-title) #gnv-cap{display:none}
    #gnv-title p{font-size:30px;color:#d5deee;margin:0}
    .gnv-hl{outline:3px solid #f08c2e !important;outline-offset:3px !important;border-radius:6px}`;
  const install = () => {
    if (document.getElementById("gnv-cap")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const cur = document.createElement("div"); cur.id = "gnv-cursor";
    cur.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2l18 10-8 2-4 8z" fill="#14213d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const ring = document.createElement("div"); ring.id = "gnv-ring";
    const cap = document.createElement("div"); cap.id = "gnv-cap";
    document.body.append(cur, ring, cap);
    const pos = JSON.parse(sessionStorage.getItem("gnv-pos") || "[720,450]");
    const place = (x, y) => { cur.style.transform = `translate(${x - 3}px,${y - 2}px)`; ring.style.left = x + "px"; ring.style.top = y + "px"; };
    place(...pos);
    addEventListener("mousemove", (e) => { place(e.clientX, e.clientY); sessionStorage.setItem("gnv-pos", JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener("mousedown", () => { ring.classList.remove("on"); void ring.offsetWidth; ring.classList.add("on"); }, true);
    cap.textContent = sessionStorage.getItem("gnv-cap") || "";
  };
  window.__gnvCaption = (t) => { sessionStorage.setItem("gnv-cap", t || ""); const c = document.getElementById("gnv-cap"); if (c) c.textContent = t || ""; };
  window.__gnvTitle = (kicker, title, sub) => {
    document.getElementById("gnv-title")?.remove();
    if (!title) return;
    const d = document.createElement("div"); d.id = "gnv-title";
    d.innerHTML = `<small></small><h1></h1><p></p>`;
    d.querySelector("small").textContent = kicker; d.querySelector("h1").textContent = title; d.querySelector("p").textContent = sub || "";
    document.body.appendChild(d);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
};

// Narration: MiniMax text-to-speech when a key is set (MINIMAX_API_KEY, or
// the file ~/.minimax_api_key), else macOS `say`. Clips are cached by
// voice + text, so a re-take only calls the API for changed lines.
const keyFile = path.join(os.homedir(), ".minimax_api_key");
const MINIMAX_KEY = process.env.MINIMAX_API_KEY || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, "utf8").trim() : "");
const MINIMAX = {
  url: process.env.MINIMAX_API_URL || "https://api.minimax.io/v1/t2a_v2",
  model: process.env.MINIMAX_MODEL || "speech-2.8-hd",
  voice: process.env.MINIMAX_VOICE || "English_expressive_narrator",
  speed: Number(process.env.MINIMAX_SPEED || 1),
};
export const TTS = MINIMAX_KEY ? `minimax ${MINIMAX.model} ${MINIMAX.voice}` : `say ${VOICE}`;
const clipPath = (text) => path.join(AUDIO, crypto.createHash("sha1").update(TTS + MINIMAX.speed + text).digest("hex") + (MINIMAX_KEY ? ".mp3" : ".aiff"));

async function minimax(text, file) {
  const res = await fetch(MINIMAX.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${MINIMAX_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MINIMAX.model, text, stream: false, language_boost: "English",
      voice_setting: { voice_id: MINIMAX.voice, speed: MINIMAX.speed, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.base_resp?.status_code !== 0 || !body.data?.audio)
    throw new Error(`MiniMax TTS ${res.status}: ${body.base_resp?.status_msg || "no audio"}`);
  fs.writeFileSync(file, Buffer.from(body.data.audio, "hex"));
}

// Make (or reuse) the clip for one line; returns its file and length.
export async function speech(text) {
  fs.mkdirSync(AUDIO, { recursive: true });
  const f = clipPath(text);
  if (!fs.existsSync(f)) {
    if (MINIMAX_KEY) await minimax(text, f);
    else execFileSync("say", ["-v", VOICE, "-r", "178", "-o", f, text]);
  }
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
  return { file: f, dur };
}

const sessions = {};
const srtTime = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };

// Record one episode: fn gets a toolkit (page, say, click, type, ...).
export async function film({ out, name, kicker, title, sub, start, setup, cleanup, signIn = true, email = EMAIL, password = PASSWORD }, fn) {
  // Leftovers of an earlier, failed take would get in this one's way.
  if (cleanup) await tidy(cleanup);
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const raw = fs.mkdtempSync(path.join(os.tmpdir(), "gnv-"));
  // Sign in first, outside the recording - once per account: the refresh
  // cookie rotates, so each episode hands its latest one to the next.
  let storageState = signIn ? sessions[email] : undefined;
  if (signIn && !storageState) {
    const c = await browser.newContext({ viewport: SIZE }); const p = await c.newPage();
    await p.goto(B + "/auth/login"); await p.waitForTimeout(1500);
    await p.fill("input[type=email]", email); await p.fill("input[type=password]", password); await p.keyboard.press("Enter");
    await p.waitForURL(/dashboard/, { timeout: 20000 }); await p.waitForTimeout(1500);
    storageState = await c.storageState(); await c.close();
  }
  const ctx = await browser.newContext({ viewport: SIZE, storageState, recordVideo: { dir: raw, size: SIZE } });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const segs = []; let busyUntil = 0;
  const wait = (ms) => page.waitForTimeout(ms);
  const idle = async () => { const left = busyUntil - Date.now(); if (left > 0) await wait(left); };
  const k = {
    page, wait, idle,
    // Show a caption and speak it; actions after it run while it plays.
    async say(text) {
      await idle();
      const s = await speech(text);
      await page.evaluate((t) => window.__gnvCaption?.(t), text).catch(() => {});
      segs.push({ t: (Date.now() - t0) / 1000, text, ...s });
      busyUntil = Date.now() + s.dur * 1000 + 350;
    },
    async sayAll(text) { await k.say(text); await idle(); },
    async titleCard(kick, t, s, ms = 0) { await page.evaluate(([a, b, c]) => window.__gnvTitle(a, b, c), [kick, t, s]); if (ms) await wait(ms); },
    async hideTitle() { await page.evaluate(() => window.__gnvTitle(null)); },
    async go(p, ms = 2500) { await page.goto(B + p); await wait(ms); },
    async point(loc, ms = 500) {
      const el = loc.first(); if (!(await el.count())) return; // a missing target isn't worth failing a take
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const b = await el.boundingBox(); if (!b) return;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 }); await wait(ms);
    },
    async hl(loc, ms = 1400) {
      await k.point(loc, 100);
      await loc.first().evaluate((el) => el.classList.add("gnv-hl")).catch(() => {});
      await wait(ms);
      await loc.first().evaluate((el) => el.classList.remove("gnv-hl")).catch(() => {});
    },
    async click(loc, ms = 900) { await k.point(loc, 250); await loc.first().click(); await wait(ms); },
    async type(loc, text, ms = 400) { await k.click(loc, 150); await loc.first().fill(""); await loc.first().pressSequentially(text, { delay: 45 }); await wait(ms); },
    async select(loc, label, ms = 1500) { await k.point(loc, 300); await loc.first().selectOption({ label }); await wait(ms); },
    async scrollTo(loc, ms = 700) { await loc.first().evaluate((el) => el.scrollIntoView({ block: "start", behavior: "smooth" })).catch(() => {}); await wait(ms); },
    dialog: () => page.locator(".modal.show, [role=dialog]").last(),
  };
  // The title card covers the page while setup (if any) gets it ready.
  await page.goto(B + (start || (signIn ? "/dashboard" : "/auth/login"))); await wait(800);
  await k.titleCard(kicker, title, sub);
  if (setup) await setup(k);
  await wait(1500); // let the page settle under the card
  await k.sayAll(`${title}. ${sub}`);
  await wait(400); await k.hideTitle();
  let err;
  try { await fn(k); } catch (e) { err = e; fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: path.join(out, `_fail-${name}.png`) }).catch(() => {}); }
  await idle(); await page.evaluate(() => window.__gnvCaption?.("")).catch(() => {}); await wait(800);
  if (signIn) sessions[email] = await ctx.storageState();
  const video = page.video(); await ctx.close(); await browser.close();
  const webm = await video.path();
  if (cleanup) await tidy(cleanup).catch((e) => console.log("cleanup", name, e.message));
  if (err) { console.log("FAIL", name, err.message.split("\n")[0]); return false; }
  // Lay the narration over the video, and write matching subtitles.
  fs.mkdirSync(out, { recursive: true });
  const mp4 = path.join(out, `${name}.mp4`);
  const args = ["-y", "-loglevel", "error", "-i", webm];
  segs.forEach((s) => args.push("-i", s.file));
  const delays = segs.map((s, i) => `[${i + 1}]adelay=${Math.round(s.t * 1000)}:all=1[a${i}]`).join(";");
  const mix = segs.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${segs.length}:normalize=0[a]`;
  args.push("-filter_complex", `${delays};${mix}`, "-map", "0:v", "-map", "[a]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", "25",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", mp4);
  execFileSync("ffmpeg", args);
  fs.writeFileSync(path.join(out, `${name}.srt`), segs.map((s, i) =>
    `${i + 1}\n${srtTime(s.t)} --> ${srtTime(Math.min(s.t + s.dur + 0.3, segs[i + 1]?.t ?? Infinity))}\n${s.text}\n`).join("\n"));
  fs.rmSync(raw, { recursive: true, force: true });
  console.log("ok", name, segs.length, "captions");
  return true;
}

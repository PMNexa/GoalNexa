# GoalNexa user guide

Product documentation for people who use GoalNexa (not for developers -
see `AGENTS.md` and the other `docs/` pages for that).

| Document | What it is |
|---|---|
| [01-use-cases.md](01-use-cases.md) | Actors and the use cases GoalNexa supports (UC-01..UC-19) |
| [02-user-journeys.md](02-user-journeys.md) | End-to-end journeys: solo user, team lead, org admin, chat-first user, link viewer, administrator |
| [03-functions-by-screen.md](03-functions-by-screen.md) | Every screen and its functions (F-S0..F-S17), with the labels the app shows |
| [manual/GoalNexa-User-Manual.md](manual/GoalNexa-User-Manual.md) | The user manual: step-by-step guidance with screenshots |
| [manual/GoalNexa-User-Manual.pdf](manual/GoalNexa-User-Manual.pdf) | The same manual as a PDF |
| [Slide deck](https://claude.ai/artifact/4rZvc9hrSgnNhnGAbp51kT) | The manual as a 23-slide presentation with speaker notes (a claude.ai artifact; Share › Export downloads PPTX or PDF) |
| [videos/](videos/README.md) | The video manual: 11 narrated screen recordings (MP4 + SRT subtitles), about 11 minutes |

The order is deliberate: use cases → journeys → functions per screen →
manual → deck and videos. When a feature changes, update them in that
order.

## Rebuilding

**PDF** (needs `pandoc` and Google Chrome or Chromium; `CHROME=/path`
to pick one):

```sh
docs/user-guide/tools/build-pdf.sh
```

**Screenshots** (`manual/images/`) are taken from a running instance
with the demo data (`scripts/seed_demo.py`, plus a goal template with
teams and a cycle in a second organization) by Playwright:

```sh
cd docs/user-guide/tools
npm i --no-save playwright && npx playwright install chromium
# ids.json maps names to the demo records' ids (see screenshots.mjs)
GOALNEXA_URL=http://localhost:55607 node screenshots.mjs ../manual/images [step,...]
```

`node ids.mjs` writes `ids.json` from the API (record ids by name), so
run it first whenever the demo data was re-seeded.

Steps: `auth`, `onboarding` (signs in as a user with no goals,
`GOALNEXA_NEW_EMAIL`), `dashboard`, `newgoal`, `addmetric`, `checkin`,
`drawer`, `share`, `table`, `reminders`, `board`, `lists`, `orgs`,
`mcp`, `account`, `usermenu`, `system` (needs an administrator). The
script creates a share link and an invitation (and removes them through
the API afterwards, even when a step fails), so run it against demo
data, never a real account. The video episodes clean up the same way:
an episode's `cleanup` (goals by title, invitations by email, share links
by title) runs before and after each take. After a run, the manual's images were
quantized (`magick f.png -dither None -colors 256 PNG8:f.png`) and the
onboarding/list shots cropped to their content.

**Videos** (`videos/`) need `ffmpeg`, the same Playwright setup, and a
voice. The narration is MiniMax text-to-speech when a key is in
`MINIMAX_API_KEY` or `~/.minimax_api_key` (never in the repo):
`MINIMAX_MODEL` (default `speech-2.8-hd`), `MINIMAX_VOICE` (default
`English_expressive_narrator`), `MINIMAX_SPEED`, and `MINIMAX_API_URL`
(`https://api.minimaxi.com/v1/t2a_v2` for a mainland-China key). Without
a key it falls back to macOS `say` (`GOALNEXA_VOICE`, default Samantha).
Every line is generated before recording and cached in the temp
directory, so a re-take only pays for lines that changed.

```sh
cd docs/user-guide/tools
node ids.mjs
node videos.mjs ../videos [01,03,...]   # all episodes, or some
```

Each episode signs in as the demo user (`GOALNEXA_EMAIL`/`_PASSWORD`;
episode 1 also as `GOALNEXA_NEW_EMAIL`, a user with no goals), works in
the organization `GOALNEXA_ORG` (default Northwind) and writes
`<episode>.mp4` + `.srt`. Episodes 3, 6 and 9 create a demo goal, an
invitation and a share link and delete them again on camera; the others
change nothing. A failed take leaves `_fail-<episode>.png`.

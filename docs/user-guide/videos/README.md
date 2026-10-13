# GoalNexa video manual

Eleven short, narrated screen recordings that follow the
[user manual](../manual/GoalNexa-User-Manual.md). Each video has captions
burned into the picture, and a matching `.srt` subtitle file next to it.

| # | Video | Length | Manual chapters |
|---|---|---|---|
| 1 | [Getting started](01-getting-started.mp4) - sign up, sign in, the onboarding wizard | 1:38 | 1 |
| 2 | [The dashboard](02-dashboard.mp4) - progress, predictions and health | 1:08 | 2, 3 |
| 3 | [Goals, metrics and check-ins](03-goals-metrics-checkins.mp4) - create, measure, record progress | 1:30 | 4, 5 |
| 4 | [The check-in table](04-check-in-table.mp4) - many check-ins at once | 0:33 | 5.4 |
| 5 | [Reminders and the goals digest](05-reminders.mp4) | 0:53 | 6 |
| 6 | [Working with a team](06-working-with-a-team.mp4) - organizations, invitations, private goals, comments | 1:07 | 7 |
| 7 | [Cycles](07-cycles.mp4) - plan by quarter, close and score | 0:51 | 8 |
| 8 | [Teams and the team board](08-teams-and-team-board.mp4) - one goal system across many teams | 1:24 | 9 |
| 9 | [Sharing a dashboard](09-sharing-a-dashboard.mp4) - a live, read-only link | 0:42 | 10 |
| 10 | [AI assistants and automatic check-ins](10-ai-and-automation.mp4) | 1:02 | 11, 12 |
| 11 | [Your account and administration](11-account-and-administration.mp4) | 1:00 | 13, 14 |

Total: about 11½ minutes. Narration: MiniMax text-to-speech
(`speech-2.8-hd`, voice `English_expressive_narrator`).

## Re-recording

The videos are recorded from a running instance with the demo data by
`../tools/videos.mjs` (Playwright for the screen, MiniMax text-to-speech
for the narration - macOS `say` without a key - and ffmpeg to put them
together; see the user guide's README).
The narration is the caption text in the script, so to change what a
video says, edit its `say(...)` lines and record that episode again.

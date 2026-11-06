# Translations (P-16)

The web app in English and Vietnamese, picked per user. Design and rules
for every module; the glossary at the end keeps Vietnamese terms the same
everywhere.

## How the language is chosen

1. A signed-in user's saved language - platform-auth's `User.language`
   (`PATCH /api/v1/auth/me {"language": "vi"}`), applied when the session
   loads (`setSession` -> `applyUserLocale`). A new account starts in the
   language its signup page was shown in.
2. Else this browser's pick: the `gn_lang` cookie (a year).
3. Else the browser's languages (`navigator.languages` / `Accept-Language`).
4. Else English.

Where to pick: the user menu (last section, "Language"), "My account",
and the sign-in pages (`AuthCard`). Every picker goes through
platform-auth's `setUserLanguage(code)`: switches at once, saves on the
account when signed in (never while viewing as someone).

The cookie is the single source both sides read:
- **Server render**: main's `root.tsx` loader (`localeFromRequest`) ->
  `<html lang>` and `LocaleProvider`, so the first HTML is already in the
  right language and hydration matches.
- **API**: Django's `LocaleMiddleware` with `LANGUAGE_COOKIE_NAME =
  "gn_lang"` (main's settings, `LANGUAGES = en, vi`) - validation errors
  and translated labels come back in the same language, no header to send.
  Agents, ingest and tests send no cookie: English.

## Frontend: writing a translated component

The kernel is platform-core's `src/i18n/` (exported from `"."`), no
dependency. A module keeps its catalogs next to the code, one per screen
or feature, named `<Component>.messages.ts` (or `messages.ts` in a
feature folder):

```ts
// FooScreen.messages.ts
import { defineMessages } from "platform-core";

export default defineMessages({
  en: {
    title: "Goals",
    saved: "Saved {name}.",
    count: (v: { n: number }) => (v.n === 1 ? "1 goal" : `${v.n} goals`),
  },
  vi: {
    title: "Mục tiêu",
    saved: "Đã lưu {name}.",
    count: (v: { n: number }) => `${v.n} mục tiêu`,
  },
});
```

```tsx
import { useT } from "platform-core";
import messages from "./FooScreen.messages";

const t = useT(messages);
<h2>{t("title")}</h2>  {t("saved", { name })}  {t("count", { n: goals.length })}
```

Rules:
- **English is the source.** `vi` must have every key - a missing one is
  a type error. Never leave an English string in `vi` unless it's a
  product name or a term the glossary keeps in English.
- **Whole sentences, not fragments.** `"Saved {name}."`, never
  `"Saved " + name + "."` - word order differs. Plurals and conditions
  are message functions (Vietnamese has no plural forms: one variant).
- **JSX inside a sentence** (a link, `<strong>`): a message function
  returning JSX, read with `t.rich("key", vars)`.
- **Outside a component** (nav builders, `document.title`, `confirm()`):
  `translate(messages, "key")` in the current language. A nav builder is
  called during render on the client (the shells rebuild their nav each
  render and re-render on a switch), and `NavEntry.label` is a string.
  Where a ReactNode is accepted, `<Msg catalog={messages} k="key" />`
  also renders right on the server. Route builders run in Node - they
  never translate.
- **Numbers and dates**: `formatNumber`, `formatDate`, `formatDateTime`,
  `formatTime`, `formatRelative` from platform-core, with
  `useLocale()`'s value - never `toLocaleString()` with no locale.
- **Not translated**: what users typed (titles, names, notes), what the
  API sends back as data, enum values sent to the API (translate only
  the label shown), URLs, code, units the user entered, log/console
  text, `aria-*` that a test selects by - translate visible `aria-label`s
  too, but update the test.
- Stories and tests keep working in English (the default); a story may
  add a Vietnamese variant with `setLocale("vi")` in a decorator.
- Catalogs are plain TS, no import-time side effects, browser-safe -
  the same rules as the rest of a module's `"."` entry.

## Backend

- Server messages a user sees (`ApiError` messages, validation errors,
  model `verbose_name`/`help_text`/choices labels that the schema API
  sends to generic forms): `gettext_lazy` / `gettext`, with
  `<app>/locale/vi/LC_MESSAGES/django.po` + its compiled `.mo` committed
  (the slim image has no gettext tools). Django's and DRF's own messages
  already ship Vietnamese.
- Emails: in the recipient's `User.language` (P-47, later).
- MCP tool text and agent skills stay English - the agent answers in the
  user's language (P-23).

## Glossary (Vietnamese)

| English | Tiếng Việt | Note |
|---|---|---|
| Goal | Mục tiêu | |
| Sub-goal | Mục tiêu con | |
| Metric | Chỉ số | |
| Sub-metric | Chỉ số con | |
| Check-in (noun/verb) | Check-in / Check-in | kept, common in VN OKR tools |
| Target | Chỉ tiêu | target value; "Target date" = Hạn chót |
| Base / start value | Giá trị ban đầu | |
| Current value | Giá trị hiện tại | |
| Progress | Tiến độ | |
| Projected / projection | Dự kiến / Dự báo | |
| On track / At risk / Off track / Achieved | Đúng tiến độ / Có rủi ro / Chậm tiến độ / Đã đạt | |
| Tracking (tracked only) | Chỉ theo dõi | |
| Organization | Tổ chức | |
| Team | Nhóm | |
| Member / Lead | Thành viên / Trưởng nhóm | |
| Owner / Admin | Chủ sở hữu / Quản trị viên | |
| Placeholder (person) | Người chưa có tài khoản | |
| Cycle | Chu kỳ | |
| Template | Mẫu | |
| Total (rollup) | Tổng | |
| Team board | Bảng nhóm | |
| Dashboard | Bảng điều khiển | |
| Check-in table | Bảng check-in | |
| Period / Day / Week / Month / Quarter / Year | Kỳ / Ngày / Tuần / Tháng / Quý / Năm | |
| Quota (per period) | Định mức | |
| Hit rate / Streak | Tỷ lệ đạt / Chuỗi liên tiếp | |
| Reminder | Nhắc nhở | |
| Digest | Bản tóm tắt | |
| Activity / Comment | Hoạt động / Bình luận | |
| Share / Shared link | Chia sẻ / Liên kết chia sẻ | |
| Settings | Cài đặt | |
| System console | Bảng quản trị hệ thống | |
| Sign in / Sign up / Log out | Đăng nhập / Đăng ký / Đăng xuất | |
| Account / Password | Tài khoản / Mật khẩu | |
| Invitation | Lời mời | |
| Role / Permission | Vai trò / Quyền | |
| Save / Cancel / Delete / Edit / Create / Close | Lưu / Hủy / Xóa / Sửa / Tạo / Đóng | |
| Archived | Đã lưu trữ | |
| Token | Token | kept |
| MCP / AI agent | MCP / Trợ lý AI | |

Tone: polite, short, "bạn" for the user. Sentence case. Keep
punctuation the English uses (a " - " stays " - ").

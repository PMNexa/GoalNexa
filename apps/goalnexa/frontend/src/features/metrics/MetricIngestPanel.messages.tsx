import { defineMessages } from "platform-core";

const messages = defineMessages({
  en: {
    title: "Automatic check-ins",
    introSum:
      "Send amounts to add from a script, a cron job, Home Assistant, n8n or any webhook - no login. The token can only add check-ins to this metric.",
    introReading:
      "Send readings from a script, a cron job, Home Assistant, n8n or any webhook - no login. The token can only add check-ins to this metric.",
    loading: "Loading…",
    copyNow: "Copy the token now - it won't be shown again.",
    optional: () => (
      <>
        Optional fields: <code>note</code>, <code>checked_in_at</code> (ISO 8601). A sender that can't set headers may add{" "}
        <code>?token=…</code> to the URL instead.
      </>
    ),
    active: (v: { hint: string; url: string }) => (
      <>
        Active token ending in <code>…{v.hint}</code>, posting to <code>{v.url}</code>
      </>
    ),
    noToken: "No token yet.",
    rotate: "Rotate token",
    create: "Create token",
    revoke: "Revoke",
    curlNote: "from a script",
  },
  vi: {
    title: "Check-in tự động",
    introSum:
      "Gửi lượng cần cộng thêm từ một script, cron job, Home Assistant, n8n hoặc bất kỳ webhook nào - không cần đăng nhập. Token chỉ có thể thêm check-in cho chỉ số này.",
    introReading:
      "Gửi số đo từ một script, cron job, Home Assistant, n8n hoặc bất kỳ webhook nào - không cần đăng nhập. Token chỉ có thể thêm check-in cho chỉ số này.",
    loading: "Đang tải…",
    copyNow: "Hãy sao chép token ngay - nó sẽ không hiện lại.",
    optional: () => (
      <>
        Trường không bắt buộc: <code>note</code>, <code>checked_in_at</code> (ISO 8601). Nơi gửi không đặt được header có
        thể thêm <code>?token=…</code> vào URL.
      </>
    ),
    active: (v: { hint: string; url: string }) => (
      <>
        Token đang hoạt động, kết thúc bằng <code>…{v.hint}</code>, gửi tới <code>{v.url}</code>
      </>
    ),
    noToken: "Chưa có token.",
    rotate: "Đổi token",
    create: "Tạo token",
    revoke: "Thu hồi",
    curlNote: "từ một script",
  },
});

export default messages;

import type { ReactNode } from "react";
import { defineMessages } from "platform-core";

const messages = defineMessages({
  en: {
    title: "Check-in reminders",
    intro: () => (
      <>
        Give a metric a schedule (its <strong>Check in every</strong> field) and, once a check-in is overdue, its goal's owner
        gets a reminder listing everything that's due - one message, once per due date.
      </>
    ),
    loading: "Loading…",
    enabled: "Send me reminders",
    email: "Email them to my account address",
    push: "Send them to the GoalNexa app",
    pushNone: "Sign in to the Android app and turn on notifications there.",
    pushOn: (v: { n: number }) => `On ${v.n} phone${v.n === 1 ? "" : "s"}.`,
    alsoSendTo: "Also send to",
    sendTo: "Send to",
    urlsHint: (v: { link: (text: string) => ReactNode }) => (
      <>One {v.link("Apprise URL")} per line; lines starting with # are ignored.</>
    ),
    accepts: "This server accepts: {schemes}.",
    digest: "Goals digest",
    weekly: "Weekly",
    daily: "Daily",
    off: "Off",
    digestDay: "Digest day",
    digestHour: "Digest hour",
    onDay0: "on Monday",
    onDay1: "on Tuesday",
    onDay2: "on Wednesday",
    onDay3: "on Thursday",
    onDay4: "on Friday",
    onDay5: "on Saturday",
    onDay6: "on Sunday",
    atHour: "at {time}",
    digestHint:
      "What moved, what's at risk or off track, what's achieved and which check-ins are due - across your goals and your organizations' shared ones. Your time zone: {zone}",
    zoneChanged: " (saved as {zone} - save to update)",
    saved: "Saved.",
    save: "Save",
    saveFirst: "Save first",
    testSent: "Test message sent.",
    sendTest: "Send a test",
    dueNow: "Due now",
    nothingDue: "Nothing's due. Metrics without a schedule never are.",
    metric: "Metric",
    dueSince: "Due since",
    more: "And {n} more.",
    examples: "URL examples",
    webhook: "Webhook (JSON POST)",
  },
  vi: {
    title: "Nhắc nhở check-in",
    intro: () => (
      <>
        Đặt lịch cho một chỉ số (trường <strong>Check-in mỗi</strong> của nó) và khi một check-in quá hạn, chủ sở hữu mục tiêu
        sẽ nhận được nhắc nhở liệt kê mọi thứ đến hạn - một tin nhắn, một lần cho mỗi hạn.
      </>
    ),
    loading: "Đang tải…",
    enabled: "Gửi nhắc nhở cho tôi",
    email: "Gửi qua email đến địa chỉ tài khoản của tôi",
    push: "Gửi đến ứng dụng GoalNexa",
    pushNone: "Đăng nhập ứng dụng Android và bật thông báo ở đó.",
    pushOn: (v: { n: number }) => `Trên ${v.n} điện thoại.`,
    alsoSendTo: "Gửi thêm đến",
    sendTo: "Gửi đến",
    urlsHint: (v: { link: (text: string) => ReactNode }) => (
      <>Mỗi dòng một {v.link("URL Apprise")}; dòng bắt đầu bằng # sẽ bị bỏ qua.</>
    ),
    accepts: "Máy chủ này chấp nhận: {schemes}.",
    digest: "Bản tóm tắt mục tiêu",
    weekly: "Hằng tuần",
    daily: "Hằng ngày",
    off: "Tắt",
    digestDay: "Ngày gửi bản tóm tắt",
    digestHour: "Giờ gửi bản tóm tắt",
    onDay0: "vào thứ Hai",
    onDay1: "vào thứ Ba",
    onDay2: "vào thứ Tư",
    onDay3: "vào thứ Năm",
    onDay4: "vào thứ Sáu",
    onDay5: "vào thứ Bảy",
    onDay6: "vào Chủ nhật",
    atHour: "lúc {time}",
    digestHint:
      "Những gì đã thay đổi, có rủi ro hay chậm tiến độ, đã đạt và check-in nào đến hạn - trên các mục tiêu của bạn và mục tiêu chung của các tổ chức bạn tham gia. Múi giờ của bạn: {zone}",
    zoneChanged: " (đang lưu là {zone} - lưu để cập nhật)",
    saved: "Đã lưu.",
    save: "Lưu",
    saveFirst: "Hãy lưu trước",
    testSent: "Đã gửi tin nhắn thử.",
    sendTest: "Gửi thử",
    dueNow: "Đến hạn",
    nothingDue: "Không có gì đến hạn. Chỉ số không có lịch thì không bao giờ đến hạn.",
    metric: "Chỉ số",
    dueSince: "Đến hạn từ",
    more: "Và {n} chỉ số khác.",
    examples: "Ví dụ URL",
    webhook: "Webhook (JSON POST)",
  },
});

export default messages;

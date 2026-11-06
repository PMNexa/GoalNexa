import { defineMessages } from "platform-core";

export default defineMessages({
  en: {
    ariaLabel: "Current progress by goal",
    noTargetMetrics: "No metrics with a target",
    metrics: (v: { n: number; count: string }) => (v.n === 1 ? "1 metric" : `${v.count} metrics`),
    noCheckIns: "no check-ins",
    lastCheckIn: "last check-in {date}",
  },
  vi: {
    ariaLabel: "Tiến độ hiện tại theo mục tiêu",
    noTargetMetrics: "Không có chỉ số nào có chỉ tiêu",
    metrics: (v: { n: number; count: string }) => `${v.count} chỉ số`,
    noCheckIns: "chưa có check-in",
    lastCheckIn: "check-in gần nhất {date}",
  },
});

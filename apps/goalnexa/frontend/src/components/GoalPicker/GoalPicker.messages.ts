import { defineMessages } from "platform-core";

export default defineMessages({
  en: {
    allGoals: "All goals",
    nGoals: (v: { n: string }) => `${v.n} goals`,
    goalsToShow: "Goals to show",
    nOfTotal: "{n} of {total}",
    showingAll: "Showing all",
    showAll: "Show all",
    noGoals: "No goals yet.",
  },
  vi: {
    allGoals: "Tất cả mục tiêu",
    nGoals: (v: { n: string }) => `${v.n} mục tiêu`,
    goalsToShow: "Mục tiêu cần hiện",
    nOfTotal: "{n} / {total}",
    showingAll: "Đang hiện tất cả",
    showAll: "Hiện tất cả",
    noGoals: "Chưa có mục tiêu.",
  },
});

import { defineMessages } from "platform-core";

/** Period names and labels (`lib/periods.ts`). */
export default defineMessages({
  en: {
    snap_day: "Day",
    snap_week: "Week",
    snap_month: "Month",
    snap_quarter: "Quarter",
    snap_year: "Year",
    weekOf: "Week of {date}",
    quarter: "Q{q} {year}",
  },
  vi: {
    snap_day: "Ngày",
    snap_week: "Tuần",
    snap_month: "Tháng",
    snap_quarter: "Quý",
    snap_year: "Năm",
    weekOf: "Tuần từ {date}",
    quarter: "Quý {q}/{year}",
  },
});

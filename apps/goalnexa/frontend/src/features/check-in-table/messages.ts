import { defineMessages } from "platform-core";

/** The check-in table: toolbar, rows, the new check-in column, the chart view. */
export default defineMessages({
  en: {
    pageTitle: "Check-in table",

    // CheckInTableScreen
    newGoal: "New goal",
    newSubGoal: "New sub-goal of {title}",
    newMetric: "New metric for {title}",
    newSubMetric: "New sub-metric of {title}",
    orderSaveFailed: "Couldn't save the new order: {error}",
    loading: "Loading…",
    noGoals: "No goals yet.",
    goalMetric: "Goal / metric",
    target: "Target",
    addMetric: "Add metric",
    addSubGoal: "Add sub-goal",
    checkIn: "Check in",
    addSubMetric: "Add sub-metric",
    amountPlaceholder: "+ amount",

    // CheckInTableRow
    dragToReorder: "{label}\nDrag to reorder",
    addTo: "Add to {label}",
    newCheckInFor: "New check-in for {label}",

    // DraftColumnHeader
    newCheckInHour: "New check-in hour",
    newCheckInDay: "New check-in day",
    newCheckInWeek: "New check-in week",
    newCheckInMonth: "New check-in month",
    weekPickerHint: "The week it counts for (starts on the day chosen above)",
    saving: "Saving…",
    saveN: "Save {n}",
    save: "Save",
    saveFailed: "Couldn't save: {names}",

    // TableToolbar
    goals: "Goals",
    view: "View",
    viewTable: "Table",
    viewChart: "Chart",
    snapTo: "Snap to",
    snap_hour: "Hour",
    snap_day: "Day",
    snap_week: "Week",
    snap_month: "Month",
    weekStartsOn: "Week starts on",

    // TableCharts / chartCards
    noCheckInsToChart: "No check-ins to chart.",
    overTime: "{name} over time",
    goalLine: "Goal",

    // buildTable / tableColumns
    weekOf: "Week of {date}",
    hourOf: "{date}, {time}",
    tracked: "tracked",
    trackedTitle: "Tracked only: no target, so it has no % and doesn't count toward the goal's progress.",
    trackedUnit: "Tracked only: no target, so it has no % and doesn't count toward the goal's progress. Unit: {unit}.",
    rangeTitle: "Starts at {base}, target {target}. Progress is how far the value has moved from the start toward the target.",
    rangeTitleUnit:
      "Starts at {base}, target {target} ({unit}). Progress is how far the value has moved from the start toward the target.",
    sumHint: "Each check-in is an amount added to the running total.",
    latestHint: "Each check-in is the new reading.",
  },
  vi: {
    pageTitle: "Bảng check-in",

    newGoal: "Mục tiêu mới",
    newSubGoal: "Mục tiêu con mới của {title}",
    newMetric: "Chỉ số mới cho {title}",
    newSubMetric: "Chỉ số con mới của {title}",
    orderSaveFailed: "Không lưu được thứ tự mới: {error}",
    loading: "Đang tải…",
    noGoals: "Chưa có mục tiêu nào.",
    goalMetric: "Mục tiêu / chỉ số",
    target: "Chỉ tiêu",
    addMetric: "Thêm chỉ số",
    addSubGoal: "Thêm mục tiêu con",
    checkIn: "Check-in",
    addSubMetric: "Thêm chỉ số con",
    amountPlaceholder: "+ lượng",

    dragToReorder: "{label}\nKéo để sắp xếp lại",
    addTo: "Thêm vào {label}",
    newCheckInFor: "Check-in mới cho {label}",

    newCheckInHour: "Giờ của check-in mới",
    newCheckInDay: "Ngày của check-in mới",
    newCheckInWeek: "Tuần của check-in mới",
    newCheckInMonth: "Tháng của check-in mới",
    weekPickerHint: "Tuần được tính (bắt đầu từ ngày đã chọn ở trên)",
    saving: "Đang lưu…",
    saveN: "Lưu {n}",
    save: "Lưu",
    saveFailed: "Không lưu được: {names}",

    goals: "Mục tiêu",
    view: "Chế độ xem",
    viewTable: "Bảng",
    viewChart: "Biểu đồ",
    snapTo: "Gộp theo",
    snap_hour: "Giờ",
    snap_day: "Ngày",
    snap_week: "Tuần",
    snap_month: "Tháng",
    weekStartsOn: "Tuần bắt đầu vào",

    noCheckInsToChart: "Chưa có check-in nào để vẽ biểu đồ.",
    overTime: "{name} theo thời gian",
    goalLine: "Mục tiêu",

    weekOf: "Tuần từ {date}",
    hourOf: "{date}, {time}",
    tracked: "chỉ theo dõi",
    trackedTitle: "Chỉ theo dõi: không có chỉ tiêu, nên không có % và không tính vào tiến độ của mục tiêu.",
    trackedUnit: "Chỉ theo dõi: không có chỉ tiêu, nên không có % và không tính vào tiến độ của mục tiêu. Đơn vị: {unit}.",
    rangeTitle: "Bắt đầu từ {base}, chỉ tiêu {target}. Tiến độ là mức giá trị đã đi được từ giá trị ban đầu tới chỉ tiêu.",
    rangeTitleUnit:
      "Bắt đầu từ {base}, chỉ tiêu {target} ({unit}). Tiến độ là mức giá trị đã đi được từ giá trị ban đầu tới chỉ tiêu.",
    sumHint: "Mỗi check-in là một lượng cộng vào tổng dồn.",
    latestHint: "Mỗi check-in là giá trị đo mới.",
  },
});

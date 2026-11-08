import { defineMessages } from "platform-core";

interface ReviewMetricVars {
  name: string;
  unit: string;
  base: string;
  target: string;
  /** "each day" etc., already lowercased; "" = the whole goal. */
  per: string;
  weekdays: boolean;
  hitRate: boolean;
  /** The frequency in effect, already lowercased; "" = any time. */
  snap: string;
  sum: boolean;
  /** The totals rule, already lowercased. */
  rollup: string;
}

/** The template wizard, its metric row and the rules its steps check. */
const messages = defineMessages({
  en: {
    step_Template: "Template",
    step_Goals: "Goals",
    step_Metrics: "Metrics",
    step_Teams: "Teams",
    step_Review: "Review",
    back: "Back",
    stepOf: "Step {n} of {total}",
    skipTeams: "Skip - add to teams later",
    creating: "Creating…",
    setItUp: "Set it up",
    createTemplate: "Create the template",
    next: "Next",
    setUpTitle: 'Set up "{title}"',
    newTitle: "New goal template",
    templateIntro:
      "One goal system several teams run: the same goals and metrics, each team with its own targets and check-ins, and totals for every department and the whole organization.",
    name: "Name",
    namePlaceholder: "Sales targets",
    description: "Description",
    descriptionPlaceholder: "Optional - what it's for",
    goalsIntro:
      "What every team works toward, as outcomes - one goal or several. Break a goal down into sub-goals if it helps - each gets its own metrics next.",
    mainGoal: "Goal",
    goalAria: "Goal {n}",
    removeGoalAria: "Remove goal {n}",
    addGoal: "+ Add a goal",
    mainGoalPlaceholder: "Grow revenue",
    subGoals: "Sub-goals",
    subGoalAria: "Sub-goal {n}",
    subGoalPlaceholder: "Hire the team",
    removeSubGoalAria: "Remove sub-goal {n}",
    remove: "Remove",
    addSubGoal: "+ Add a sub-goal",
    metricsIntro:
      "The numbers every team tracks. Leave the target empty to let each team set its own (until then it doesn't count toward the totals).",
    addMetric: "+ Add a metric",
    teamsIntro:
      "Who runs it? A ticked team gets its own copy to set targets and check in on (a department too, next to its teams'). Tick people to give them their own copy - with or without their team's; the team's total adds them up.",
    reviewPeople: "People",
    noTeams:
      "This organization has no teams yet - create them under Organizations → Teams, then add the template to them from the team board (Targets).",
    cycle: "Cycle",
    noCycle: "No cycle",
    reviewTemplate: "Template",
    reviewTeams: "Teams",
    noneYet: "None yet - add it to teams later from the board.",
    reviewMetric: (v: ReviewMetricVars) =>
      `${v.name}${v.unit ? ` (${v.unit})` : ""}: from ${v.base}` +
      (v.target ? ` to ${v.target}` : ", each team sets its target") +
      (v.per ? ` ${v.per}${v.weekdays ? " (weekdays)" : ""}${v.hitRate ? ", counted by how often it's hit" : ""}` : "") +
      (v.snap ? ` · frequency: ${v.snap}` : "") +
      ` · ${v.sum ? "amounts add up" : "readings"} · totals: ${v.rollup}`,
    changeLater: "You can change any of it later on the template's page.",

    // Labels (templateWizardModel)
    snap_any: "Any time",
    snap_goal: "Same as goal",
    snap_parent: "Same as parent goal",
    errFrequencyTooLong: "A metric's frequency (its own or its goal's) can't be longer than its target period - pick a shorter one.",
    goalFrequency: "Frequency",
    snap_day: "Daily",
    snap_week: "Weekly",
    snap_month: "Monthly",
    snap_quarter: "Quarterly",
    snap_year: "Yearly",
    targetPer_whole: "The whole goal",
    targetPer_day: "Each day",
    targetPer_week: "Each week",
    targetPer_month: "Each month",
    targetPer_quarter: "Each quarter",
    targetPer_year: "Each year",
    rollup_sum: "Add up",
    rollup_avg: "Average",
    rollup_min: "Lowest team",
    rollup_none: "No total",

    // stepProblem
    errTemplateName: "Give the template a name.",
    errMainGoal: "Name every goal, or remove the empty one.",
    errSubGoals: "Name every sub-goal, or remove the empty one.",
    errNoMetrics: "Add at least one metric.",
    errMetricNames: "Name every metric, or remove the empty one.",
    errStart: "Every start needs a number (0 is fine).",
    errTarget: "A target needs a number - or leave it empty.",
    errTargetEqualsStart: "A target equal to its start means no target - leave it empty instead.",

    // WizardMetricRow
    checkInPeriod: "Frequency",
    metric: "Metric",
    metricPlaceholder: "Revenue",
    unit: "Unit",
    eachCheckInIs: "Each check-in is",
    theNewValue: "The new value",
    anAmountToAdd: "An amount to add",
    totals: "Totals",
    targetIsFor: "Target is for",
    counts: "Counts",
    everyDay: "Every day",
    weekdaysOnly: "Weekdays only",
    progressIs: "Progress is",
    theTotal: "The total",
    howOftenHit: "How often it's hit",
    start: "Start",
    defaultTarget: "Default target",
    defaultTargetPer_day: "Default target / day",
    defaultTargetPer_week: "Default target / week",
    defaultTargetPer_month: "Default target / month",
    defaultTargetPer_quarter: "Default target / quarter",
    defaultTargetPer_year: "Default target / year",
    eachTeamsOwn: "Each team's own",
    removeMetricAria: "Remove metric {n} of {goal}",
  },
  vi: {
    step_Template: "Mẫu",
    step_Goals: "Mục tiêu",
    step_Metrics: "Chỉ số",
    step_Teams: "Nhóm",
    step_Review: "Xem lại",
    back: "Quay lại",
    stepOf: "Bước {n}/{total}",
    skipTeams: "Bỏ qua - thêm cho nhóm sau",
    creating: "Đang tạo…",
    setItUp: "Thiết lập",
    createTemplate: "Tạo mẫu",
    next: "Tiếp",
    setUpTitle: 'Thiết lập "{title}"',
    newTitle: "Mẫu mục tiêu mới",
    templateIntro:
      "Một hệ thống mục tiêu cho nhiều nhóm cùng dùng: cùng mục tiêu và chỉ số, mỗi nhóm có chỉ tiêu và check-in riêng, kèm tổng cho từng phòng ban và toàn tổ chức.",
    name: "Tên",
    namePlaceholder: "Chỉ tiêu bán hàng",
    description: "Mô tả",
    descriptionPlaceholder: "Không bắt buộc - mẫu dùng để làm gì",
    goalsIntro:
      "Điều mọi nhóm cùng hướng tới, dưới dạng kết quả - một hoặc nhiều mục tiêu. Chia nhỏ mục tiêu thành mục tiêu con nếu cần - mỗi mục tiêu con sẽ có chỉ số riêng ở bước sau.",
    mainGoal: "Mục tiêu",
    goalAria: "Mục tiêu {n}",
    removeGoalAria: "Xóa mục tiêu {n}",
    addGoal: "+ Thêm mục tiêu",
    mainGoalPlaceholder: "Tăng doanh thu",
    subGoals: "Mục tiêu con",
    subGoalAria: "Mục tiêu con {n}",
    subGoalPlaceholder: "Tuyển đủ đội ngũ",
    removeSubGoalAria: "Xóa mục tiêu con {n}",
    remove: "Xóa",
    addSubGoal: "+ Thêm mục tiêu con",
    metricsIntro:
      "Những con số mọi nhóm theo dõi. Để trống chỉ tiêu để mỗi nhóm tự đặt (khi chưa đặt, chỉ số chưa được tính vào tổng).",
    addMetric: "+ Thêm chỉ số",
    teamsIntro:
      "Ai dùng mẫu này? Nhóm được đánh dấu có bản sao riêng để đặt chỉ tiêu và check-in (phòng ban cũng vậy, bên cạnh bản của các nhóm trực thuộc). Đánh dấu từng người để họ có bản sao riêng - dù nhóm của họ có bản sao hay không; tổng của nhóm cộng dồn họ.",
    reviewPeople: "Thành viên",
    noTeams:
      "Tổ chức này chưa có nhóm nào - hãy tạo nhóm trong Tổ chức → Nhóm, rồi thêm mẫu cho các nhóm từ bảng nhóm (Chỉ tiêu).",
    cycle: "Chu kỳ",
    noCycle: "Không có chu kỳ",
    reviewTemplate: "Mẫu",
    reviewTeams: "Nhóm",
    noneYet: "Chưa có - thêm cho nhóm sau từ bảng nhóm.",
    reviewMetric: (v: ReviewMetricVars) =>
      `${v.name}${v.unit ? ` (${v.unit})` : ""}: từ ${v.base}` +
      (v.target ? ` đến ${v.target}` : ", mỗi nhóm tự đặt chỉ tiêu") +
      (v.per ? ` ${v.per}${v.weekdays ? " (ngày làm việc)" : ""}${v.hitRate ? ", tính theo tần suất đạt" : ""}` : "") +
      (v.snap ? ` · tần suất: ${v.snap}` : "") +
      ` · ${v.sum ? "cộng dồn các lượng" : "giá trị mới"} · tổng: ${v.rollup}`,
    changeLater: "Bạn có thể thay đổi mọi thứ sau trên trang của mẫu.",

    snap_any: "Bất kỳ lúc nào",
    snap_goal: "Theo mục tiêu",
    snap_parent: "Theo mục tiêu cha",
    errFrequencyTooLong: "Tần suất của chỉ số (của riêng nó hoặc theo mục tiêu) không được dài hơn kỳ chỉ tiêu - hãy chọn tần suất ngắn hơn.",
    goalFrequency: "Tần suất",
    snap_day: "Hằng ngày",
    snap_week: "Hằng tuần",
    snap_month: "Hằng tháng",
    snap_quarter: "Hằng quý",
    snap_year: "Hằng năm",
    targetPer_whole: "Cả mục tiêu",
    targetPer_day: "Mỗi ngày",
    targetPer_week: "Mỗi tuần",
    targetPer_month: "Mỗi tháng",
    targetPer_quarter: "Mỗi quý",
    targetPer_year: "Mỗi năm",
    rollup_sum: "Cộng dồn",
    rollup_avg: "Trung bình",
    rollup_min: "Nhóm thấp nhất",
    rollup_none: "Không tính tổng",

    errTemplateName: "Hãy đặt tên cho mẫu.",
    errMainGoal: "Hãy đặt tên cho mọi mục tiêu, hoặc xóa mục tiêu còn trống.",
    errSubGoals: "Hãy đặt tên cho mọi mục tiêu con, hoặc xóa mục tiêu con còn trống.",
    errNoMetrics: "Hãy thêm ít nhất một chỉ số.",
    errMetricNames: "Hãy đặt tên cho mọi chỉ số, hoặc xóa chỉ số còn trống.",
    errStart: "Mỗi giá trị ban đầu cần là số (0 cũng được).",
    errTarget: "Chỉ tiêu cần là số - hoặc để trống.",
    errTargetEqualsStart: "Chỉ tiêu bằng giá trị ban đầu nghĩa là không có chỉ tiêu - hãy để trống.",

    checkInPeriod: "Tần suất",
    metric: "Chỉ số",
    metricPlaceholder: "Doanh thu",
    unit: "Đơn vị",
    eachCheckInIs: "Mỗi check-in là",
    theNewValue: "Giá trị mới",
    anAmountToAdd: "Một lượng cộng thêm",
    totals: "Tổng",
    targetIsFor: "Chỉ tiêu tính cho",
    counts: "Tính",
    everyDay: "Mọi ngày",
    weekdaysOnly: "Chỉ ngày làm việc",
    progressIs: "Tiến độ là",
    theTotal: "Tổng",
    howOftenHit: "Tần suất đạt",
    start: "Ban đầu",
    defaultTarget: "Chỉ tiêu mặc định",
    defaultTargetPer_day: "Chỉ tiêu mặc định / ngày",
    defaultTargetPer_week: "Chỉ tiêu mặc định / tuần",
    defaultTargetPer_month: "Chỉ tiêu mặc định / tháng",
    defaultTargetPer_quarter: "Chỉ tiêu mặc định / quý",
    defaultTargetPer_year: "Chỉ tiêu mặc định / năm",
    eachTeamsOwn: "Mỗi nhóm tự đặt",
    removeMetricAria: "Xóa chỉ số {n} của {goal}",
  },
});

export default messages;

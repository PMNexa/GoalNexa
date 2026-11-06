import { defineMessages } from "platform-core";

const messages = defineMessages({
  en: {
    // Steps
    step_start: "Get started",
    step_organization: "Organization",
    step_goals: "Goals",
    step_metrics: "Metrics",
    step_review: "Review",
    step_connect: "Connect",
    step_skills: "Skills",
    step_try: "Try it",
    // Wizard
    welcome: "Welcome to GoalNexa",
    setUp: "Set up {name}",
    setUpPrefix: "Set up",
    leadExisting: "Add what it's working toward - it takes a minute.",
    leadWeb: "Set up your organization and what it's working toward - it takes a minute.",
    leadAgent: "Connect your AI assistant - then just tell it what you're working toward.",
    createFailed: "{error} - fix it and try again; what was already created is kept.",
    skip: "Skip for now",
    back: "Back",
    next: "Next",
    creating: "Creating…",
    createAndOpen: "Create and open dashboard",
    doneOpen: "Done - open dashboard",
    // Mode choice
    modeTitle: "How do you want to use GoalNexa?",
    modeHint: "You can always do both - this only picks where to start.",
    agentTitle: "Use an AI agent",
    agentText: "Connect Claude, ChatGPT, Gemini, Cursor… and manage goals by chatting - “we hit 420 beta users today”.",
    webTitle: "Use the website",
    webText: "Set up your organization, goals and metrics here, and log progress from the dashboard.",
    recommended: "Recommended",
    // Organization
    orgTitle: "Name your organization",
    orgHint: "Your team, company or household - goals belong to it, and you can invite others later.",
    orgName: "Organization name",
    orgPlaceholder: "e.g. Acme Inc.",
    // Goals
    goalsTitle: "What are you aiming for?",
    goalsHint: "Add a few goals. A target date is optional, but it lets the dashboard project whether you'll make it.",
    goal: "Goal",
    goalPlaceholder: "e.g. Grow monthly revenue",
    anotherGoal: "Another goal",
    targetDate: "Target date",
    removeGoal: "Remove goal {name}",
    goalDescription: "Goal description",
    goalDescriptionPlaceholder: "Description (optional) - why it matters, what done looks like",
    addGoal: "Add goal",
    // Metrics
    metricsTitle: "How will you measure each goal?",
    metricsHint:
      "A metric goes from a start value to a target (down works too - e.g. churn from 8% to 3%). A goal's progress is the average of its metrics.",
    metric: "Metric",
    unit: "Unit",
    start: "Start",
    target: "Target",
    metricName: "Metric name",
    metricPlaceholder: "e.g. Monthly revenue",
    unitPlaceholder: "unit",
    startValue: "Start value",
    startPlaceholder: "start",
    targetValue: "Target value",
    targetPlaceholder: "target",
    removeMetric: "Remove metric",
    removeMetricNamed: "Remove metric {name}",
    metricDescription: "Metric description",
    metricDescriptionPlaceholder: "Description (optional) - how it's measured",
    addMetric: "Add metric",
    // Review
    reviewTitle: "Ready to go",
    reviewAdds: (v: { n: number; org: unknown }) => (
      <>
        This adds {v.n} goal{v.n === 1 ? "" : "s"} to <strong>{v.org as string}</strong>.
      </>
    ),
    reviewCreates: (v: { n: number; org: unknown }) => (
      <>
        This creates <strong>{v.org as string}</strong> with {v.n} goal{v.n === 1 ? "" : "s"}.
      </>
    ),
    reviewLater: "You can change anything later, and log progress with check-ins from the dashboard.",
    by: "by {date}",
    // Problems
    metricNoName: "Every metric needs a name.",
    metricNoTarget: "\"{name}\" needs a target.",
    metricBadStart: "\"{name}\" has an invalid start value.",
    metricSameTarget: "\"{name}\": the target must differ from the start value.",
    orgNoName: "Give your organization a name.",
    noGoals: "Add at least one goal.",
    goalNoTitle: "Every goal needs a title.",
    goalNoMetric: "\"{title}\" needs at least one metric.",
    // Agent steps
    connectTitle: "Connect your AI assistant",
    connectHint:
      "Pick the app you use. It gets exactly your access in GoalNexa - nothing more - and you can disconnect it any time from “MCP access”.",
    skillsTitle: "Teach it GoalNexa",
    skillsHint:
      "Skills are ready-made playbooks - planning goals, checking in, weekly reviews. Paste this into Claude Code, Codex or any agent that supports skills. (A Claude connector works without them; skip this step then.)",
    skillsPromptLabel: "Skills install prompt",
    skillsSee: "See what gets installed",
    tryTitle: "Tell it what you're working toward",
    tryHint:
      "Start with a plan - your agent creates the organization, goals and metrics, and asks before saving. Then keep it updated in plain words.",
    skillPlan: "Plan",
    skillCheckIn: "Check in",
    skillReview: "Review",
    promptPlan: "Set up GoalNexa for my team Acme: we want to grow monthly revenue from $40k to $60k by December 31.",
    promptCheckIn: "We're at $45k monthly revenue now.",
    promptReview: "How are my goals doing? Anything at risk?",
  },
  vi: {
    step_start: "Bắt đầu",
    step_organization: "Tổ chức",
    step_goals: "Mục tiêu",
    step_metrics: "Chỉ số",
    step_review: "Xem lại",
    step_connect: "Kết nối",
    step_skills: "Skill",
    step_try: "Dùng thử",
    welcome: "Chào mừng bạn đến với GoalNexa",
    setUp: "Thiết lập {name}",
    setUpPrefix: "Thiết lập",
    leadExisting: "Thêm những gì tổ chức đang hướng tới - chỉ mất một phút.",
    leadWeb: "Thiết lập tổ chức và những gì tổ chức đang hướng tới - chỉ mất một phút.",
    leadAgent: "Kết nối trợ lý AI của bạn - rồi chỉ cần kể cho nó điều bạn đang hướng tới.",
    createFailed: "{error} - hãy sửa rồi thử lại; những gì đã tạo vẫn được giữ.",
    skip: "Để sau",
    back: "Quay lại",
    next: "Tiếp",
    creating: "Đang tạo…",
    createAndOpen: "Tạo và mở bảng điều khiển",
    doneOpen: "Xong - mở bảng điều khiển",
    modeTitle: "Bạn muốn dùng GoalNexa thế nào?",
    modeHint: "Bạn luôn có thể dùng cả hai - lựa chọn này chỉ để chọn nơi bắt đầu.",
    agentTitle: "Dùng trợ lý AI",
    agentText:
      "Kết nối Claude, ChatGPT, Gemini, Cursor… và quản lý mục tiêu bằng cách trò chuyện - “hôm nay đã có 420 người dùng thử”.",
    webTitle: "Dùng trang web",
    webText: "Thiết lập tổ chức, mục tiêu và chỉ số tại đây, rồi ghi nhận tiến độ từ bảng điều khiển.",
    recommended: "Khuyên dùng",
    orgTitle: "Đặt tên cho tổ chức",
    orgHint: "Nhóm, công ty hay gia đình của bạn - mục tiêu thuộc về tổ chức, và bạn có thể mời người khác sau.",
    orgName: "Tên tổ chức",
    orgPlaceholder: "VD: Công ty Acme",
    goalsTitle: "Bạn đang hướng tới điều gì?",
    goalsHint:
      "Thêm vài mục tiêu. Hạn chót không bắt buộc, nhưng có nó thì bảng điều khiển dự báo được bạn có kịp hay không.",
    goal: "Mục tiêu",
    goalPlaceholder: "VD: Tăng doanh thu hằng tháng",
    anotherGoal: "Mục tiêu khác",
    targetDate: "Hạn chót",
    removeGoal: "Xóa mục tiêu {name}",
    goalDescription: "Mô tả mục tiêu",
    goalDescriptionPlaceholder: "Mô tả (không bắt buộc) - vì sao quan trọng, thế nào là hoàn thành",
    addGoal: "Thêm mục tiêu",
    metricsTitle: "Bạn sẽ đo từng mục tiêu thế nào?",
    metricsHint:
      "Một chỉ số đi từ giá trị ban đầu đến chỉ tiêu (giảm cũng được - VD: tỷ lệ rời bỏ từ 8% xuống 3%). Tiến độ của mục tiêu là trung bình các chỉ số của nó.",
    metric: "Chỉ số",
    unit: "Đơn vị",
    start: "Ban đầu",
    target: "Chỉ tiêu",
    metricName: "Tên chỉ số",
    metricPlaceholder: "VD: Doanh thu hằng tháng",
    unitPlaceholder: "đơn vị",
    startValue: "Giá trị ban đầu",
    startPlaceholder: "ban đầu",
    targetValue: "Chỉ tiêu",
    targetPlaceholder: "chỉ tiêu",
    removeMetric: "Xóa chỉ số",
    removeMetricNamed: "Xóa chỉ số {name}",
    metricDescription: "Mô tả chỉ số",
    metricDescriptionPlaceholder: "Mô tả (không bắt buộc) - đo như thế nào",
    addMetric: "Thêm chỉ số",
    reviewTitle: "Sẵn sàng",
    reviewAdds: (v: { n: number; org: unknown }) => (
      <>
        Thao tác này thêm {v.n} mục tiêu vào <strong>{v.org as string}</strong>.
      </>
    ),
    reviewCreates: (v: { n: number; org: unknown }) => (
      <>
        Thao tác này tạo <strong>{v.org as string}</strong> với {v.n} mục tiêu.
      </>
    ),
    reviewLater: "Bạn có thể thay đổi mọi thứ sau, và ghi nhận tiến độ bằng check-in từ bảng điều khiển.",
    by: "hạn {date}",
    metricNoName: "Chỉ số nào cũng cần có tên.",
    metricNoTarget: "\"{name}\" cần có chỉ tiêu.",
    metricBadStart: "\"{name}\" có giá trị ban đầu không hợp lệ.",
    metricSameTarget: "\"{name}\": chỉ tiêu phải khác giá trị ban đầu.",
    orgNoName: "Hãy đặt tên cho tổ chức.",
    noGoals: "Hãy thêm ít nhất một mục tiêu.",
    goalNoTitle: "Mục tiêu nào cũng cần có tiêu đề.",
    goalNoMetric: "\"{title}\" cần ít nhất một chỉ số.",
    connectTitle: "Kết nối trợ lý AI",
    connectHint:
      "Chọn ứng dụng bạn dùng. Nó có đúng quyền truy cập của bạn trong GoalNexa - không hơn - và bạn có thể ngắt kết nối bất cứ lúc nào từ “Truy cập MCP”.",
    skillsTitle: "Dạy nó dùng GoalNexa",
    skillsHint:
      "Skill là các quy trình soạn sẵn - lập mục tiêu, check-in, đánh giá hằng tuần. Dán đoạn này vào Claude Code, Codex hoặc bất kỳ trợ lý nào hỗ trợ skill. (Connector của Claude hoạt động mà không cần chúng; khi đó hãy bỏ qua bước này.)",
    skillsPromptLabel: "Lệnh cài skill",
    skillsSee: "Xem những gì sẽ được cài",
    tryTitle: "Kể cho nó điều bạn đang hướng tới",
    tryHint:
      "Bắt đầu bằng một kế hoạch - trợ lý sẽ tạo tổ chức, mục tiêu và chỉ số, và hỏi bạn trước khi lưu. Sau đó cập nhật cho nó bằng lời thường.",
    skillPlan: "Lập kế hoạch",
    skillCheckIn: "Check-in",
    skillReview: "Đánh giá",
    promptPlan:
      "Thiết lập GoalNexa cho nhóm Acme của tôi: chúng tôi muốn tăng doanh thu hằng tháng từ 40 triệu lên 60 triệu trước ngày 31/12.",
    promptCheckIn: "Doanh thu hằng tháng hiện đạt 45 triệu.",
    promptReview: "Các mục tiêu của tôi đang thế nào? Có gì đang có rủi ro không?",
  },
});

export default messages;

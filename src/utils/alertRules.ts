/**
 * 排班警示規則檢查模組。
 *
 * 本檔案定義六項排班規則檢查器（每項規則對應一個獨立函式），
 * 用於在建立/修改任務時偵測是否違反排班限制（如證照、連續工作日、
 * 每日工時、時段重疊、指定休假、人數不足）。
 * 每個規則檢查器接收任務資料與上下文，若違反規則則回傳 AlertViolation，
 * 否則回傳 null。runAlertChecks 會依序執行所有規則並彙整結果。
 */
import type { TaskFormData, TaskAssignee } from '@/types/task';
import type {
  AlertViolation,
  AlertValidationResult,
  AlertContext,
  AlertRuleChecker,
} from '@/types/alert';
import { calculateDurationMinutes, getMaxConsecutiveDays, isTimeStringOverlap } from './date';

/**
 * 規則一：證照要求 (License Required)
 * 若客戶要求特定證照，指派的員工中必須至少有一人同時持有所有要求之證照。
 */
export const checkLicenseRequired: AlertRuleChecker = (task, context) => {
  const { customerLicenses, employees } = context;
  // 若客戶無證照要求，或要求清單僅包含 'NONE'，則不需檢查
  if (customerLicenses.length === 0 || customerLicenses.every((l) => l === 'NONE')) return null;

  // 過濾掉 'NONE'，取得真正需要的證照清單
  const requiredLicenses = customerLicenses.filter((l) => l !== 'NONE');
  if (requiredLicenses.length === 0) return null;

  const assignedEmployees = employees.filter((e) => task.assignees.includes(e.id));
  // 只要有任一位指派員工同時持有「全部」要求證照即符合規則（不需多人分別持有）
  const hasQualified = assignedEmployees.some((emp) =>
    requiredLicenses.every((lic) => emp.licenses.includes(lic)),
  );

  if (!hasQualified) {
    return {
      ruleId: 'LICENSE_REQUIRED',
      severity: 'BLOCKING',
      message: '指派員工中無人持有客戶要求之證照',
      details: { required: requiredLicenses },
      affectedEmployees: task.assignees,
    };
  }
  return null;
};

/**
 * 規則二：連續工作日 (Consecutive Days)
 * 員工不應連續工作超過 7 天（含本次新任務日期）。
 */
export const checkConsecutiveDays: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    // 取得該員工所有既有任務的日期清單
    const empTaskDates = context.existingTasks
      .filter((t) => t.assignees.some((a: TaskAssignee) => a.employeeId === empId))
      .map((t) => t.date);

    // 將新任務日期併入既有日期一併計算最長連續工作天數
    const maxDays = getMaxConsecutiveDays(empTaskDates, task.date);
    if (maxDays > 7) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'CONSECUTIVE_DAYS',
      severity: 'BLOCKING',
      message: '指派員工連續工作超過七日',
      details: { maxAllowed: 7 },
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * 規則三：每日工時超時 (Daily Hours Exceeded)
 * 員工單日工時（含既有任務與新任務加總）不應超過 10 小時。
 */
export const checkDailyHoursExceeded: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const sameDayTasks = context.existingTasks.filter(
      (t) => t.date === task.date && t.assignees.some((a: TaskAssignee) => a.employeeId === empId),
    );

    // Calculate total minutes including the new task.
    // Summing integer minutes (rather than float hours) avoids floating-point
    // precision drift near the 10-hour (600-minute) boundary.
    let totalMinutes = calculateDurationMinutes(task.startTime, task.endTime);
    for (const existingTask of sameDayTasks) {
      totalMinutes += calculateDurationMinutes(existingTask.startTime, existingTask.endTime);
    }

    if (totalMinutes > 600) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'DAILY_HOURS_EXCEEDED',
      severity: 'BLOCKING',
      message: '指派員工當日工時超過十小時',
      details: { maxAllowed: 10 },
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * 規則四：時段重複 (Duplicate Slot)
 * 員工於同一天內，不應被排入時間重疊的任務時段。
 */
export const checkDuplicateSlot: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const sameDayTasks = context.existingTasks.filter(
      (t) => t.date === task.date && t.assignees.some((a: TaskAssignee) => a.employeeId === empId),
    );

    // 只要與任一筆同日既有任務時段重疊，即視為違反規則
    const hasOverlap = sameDayTasks.some((existingTask) =>
      isTimeStringOverlap(
        task.startTime,
        task.endTime,
        existingTask.startTime,
        existingTask.endTime,
      ),
    );

    if (hasOverlap) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'DUPLICATE_SLOT',
      severity: 'BLOCKING',
      message: '指派員工於相同時段已有排班',
      details: {},
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * 規則五：指定休假日 (Designated Leave)
 * 員工不應於其指定休假日當天被排班。
 */
export const checkDesignatedLeave: AlertRuleChecker = (task, context) => {
  const violations: string[] = [];

  for (const empId of task.assignees) {
    const emp = context.employees.find((e) => e.id === empId);
    if (emp && emp.designatedLeaves.includes(task.date)) {
      violations.push(empId);
    }
  }

  if (violations.length > 0) {
    return {
      ruleId: 'DESIGNATED_LEAVE',
      severity: 'BLOCKING',
      message: '指派員工於指定休假日被排班',
      details: {},
      affectedEmployees: violations,
    };
  }
  return null;
};

/**
 * 規則六：人數低於最低需求 (Headcount Below Minimum)
 * 實際指派人數不應低於任務所需之最低人數 (headcount)。
 */
export const checkHeadcountBelowMin: AlertRuleChecker = (task) => {
  if (task.assignees.length < task.headcount) {
    return {
      ruleId: 'HEADCOUNT_BELOW_MIN',
      severity: 'BLOCKING',
      message: '指派人數低於最低需求人數',
      details: { required: task.headcount, actual: task.assignees.length },
    };
  }
  return null;
};

/**
 * 警示檢查主入口 - 依序執行全部 6 項規則檢查器，並彙整所有違規結果。
 *
 * @param task 欲檢查之任務表單資料
 * @param context 檢查所需之上下文（員工、既有任務、客戶證照要求等）
 * @returns 驗證結果，包含是否有效 (isValid)、違規清單 (violations) 及是否可覆蓋 (canOverride)
 */
export const runAlertChecks = (
  task: TaskFormData,
  context: AlertContext,
): AlertValidationResult => {
  const checkers: AlertRuleChecker[] = [
    checkLicenseRequired,
    checkConsecutiveDays,
    checkDailyHoursExceeded,
    checkDuplicateSlot,
    checkDesignatedLeave,
    checkHeadcountBelowMin,
  ];

  // 逐一執行每個規則檢查器，過濾掉未違規（null）的結果
  const violations = checkers
    .map((checker) => checker(task, context))
    .filter((v): v is AlertViolation => v !== null);

  return {
    isValid: violations.length === 0,
    violations,
    canOverride: true, // 實際是否允許覆蓋由後端決定
  };
};

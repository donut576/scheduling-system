/**
 * TaskForm 元件
 *
 * 業務用途：建立/編輯排班任務之主表單，整合集團→分店連動選擇、員工指派、
 * 循環頻率設定，並於送出前執行前端警示規則預檢（證照資格、連續7日上班、日工時超10H、
 * 時段重複、指定休假等）。若偵測到違規則跳出警示並要求填寫必填備註說明後覆蓋排入。
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Form,
  Select,
  DatePicker,
  InputNumber,
  Input,
  Button,
  Space,
  Divider,
  Checkbox,
  Radio,
  Typography,
  Row,
  Col,
  Card,
} from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { Task, TaskFormData, TaskType, TaskContent, RecurrenceRule } from '@/types/task';
import type { AlertValidationResult, AlertContext } from '@/types/alert';
import type { CustomerGroup } from '@/types/customer';
import { useDictStore } from '@/stores/useDictStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import { runAlertChecks } from '@/utils/alertRules';
import { isHoliday } from '@/utils/date';
import { HOLIDAYS_2026 } from '@/constants/holidays';
import EmployeeSelect from '@/components/business/EmployeeSelect';
import TimeSelect from '@/components/business/TimeSelect';
import RecurrenceEditor from '@/components/business/RecurrenceEditor';
import ConflictPanel from '@/components/business/ConflictPanel';
import RecurrenceModifyScopeDialog from './RecurrenceModifyScope';
import type { RecurrenceModifyScope } from './RecurrenceModifyScope';

const { Text } = Typography;
const { TextArea } = Input;

export interface TaskFormProps {
  mode: 'create' | 'edit';
  initialData?: Task;
  onSubmit: (task: TaskFormData) => Promise<void>;
  onCancel: () => void;
}

/**
 * 任務類型單選（以 checkbox 呈現，但行為為單選）
 */
interface TaskTypeCheckboxGroupProps {
  value?: TaskType;
  onChange?: (value: TaskType) => void;
  options: { label: string; value: string | number }[];
}

const TaskTypeCheckboxGroup: React.FC<TaskTypeCheckboxGroupProps> = ({
  value,
  onChange,
  options,
}) => (
  <Space size="large" wrap>
    {options.map((opt) => (
      <Checkbox
        key={opt.value}
        checked={value === opt.value}
        onChange={(e) => {
          if (e.target.checked) onChange?.(opt.value as TaskType);
        }}
      >
        <span style={{ fontSize: 14, fontWeight: value === opt.value ? 600 : 400 }}>
          {opt.label}
        </span>
      </Checkbox>
    ))}
  </Space>
);

const DEFAULT_RECURRENCE_RULE: RecurrenceRule = {
  frequency: 'daily',
  interval: 1,
  endType: 'never',
};

/**
 * TaskForm - 任務建立/編輯表單
 */
const TaskForm: React.FC<TaskFormProps> = ({ mode, initialData, onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [enableRecurrence, setEnableRecurrence] = useState(true);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(
    initialData?.recurrenceRule ?? DEFAULT_RECURRENCE_RULE,
  );
  const [alertResults, setAlertResults] = useState<AlertValidationResult | null>(null);
  const [showModifyScope, setShowModifyScope] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<TaskFormData | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(initialData?.groupId);

  // 判斷目前是否為編輯週期任務之某一實例，若是則送出前需詢問修改範圍
  const isRecurringTask = mode === 'edit' && !!initialData?.recurrenceId;

  // Store references
  const { taskTypes, shifts, routes, contents } = useDictStore();
  const { setAlertResults: setStoreAlertResults } = useTaskStore();

  // Fetch customer groups for cascading group → branch
  const { data: customerGroups = [] } = useCustomerGroups();

  // Fetch employees for alert context
  const { data: employeeData } = useEmployeeList({ page: 1, pageSize: 500 });
  const employees = useMemo(() => employeeData?.list ?? [], [employeeData]);

  // Fetch existing tasks for alert context (same date)
  const watchDate = Form.useWatch('date', form);
  const watchBranchId = Form.useWatch('branchId', form);
  const assigneesValue: string[] = Form.useWatch('assignees', form) ?? [];
  const contentsValue: TaskContent[] = Form.useWatch('contents', form) ?? [];
  const currentDate = watchDate ? dayjs(watchDate).format('YYYY-MM-DD') : undefined;

  const { data: existingTaskData } = useTaskList({
    page: 1,
    pageSize: 200,
    startDate: currentDate,
    endDate: currentDate,
  });
  const existingTasks = useMemo(() => existingTaskData?.list ?? [], [existingTaskData]);

  // 國定假日列表，用於日期選擇器紅字標示
  const holidays: string[] = HOLIDAYS_2026;

  // Compute branches based on selected group
  const branchOptions = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = customerGroups.find((g: CustomerGroup) => g.id === selectedGroupId);
    if (!group) return [];
    return group.branches.map((b) => ({
      label: b.name,
      value: b.id,
    }));
  }, [selectedGroupId, customerGroups]);

  // Group options from customer groups
  const groupOptions = useMemo(() => {
    return customerGroups.map((g: CustomerGroup) => ({
      label: g.name,
      value: g.id,
    }));
  }, [customerGroups]);

  // Compute required licenses from selected branch
  const requiredLicenses = useMemo(() => {
    if (!selectedGroupId || !watchBranchId) return [];
    const group = customerGroups.find((g: CustomerGroup) => g.id === selectedGroupId);
    const branch = group?.branches.find((b) => b.id === watchBranchId);
    return branch?.requiredLicenses ?? [];
  }, [selectedGroupId, watchBranchId, customerGroups]);

  // Form initial values
  const defaultFormValues = useMemo(() => {
    if (initialData) {
      return {
        groupId: initialData.groupId,
        branchId: initialData.branchId,
        taskType: initialData.taskType,
        date: initialData.date ? dayjs(initialData.date) : undefined,
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        headcount: initialData.headcount,
        shift: initialData.shift,
        route: initialData.route,
        contents: initialData.contents,
        otherContentNote: initialData.otherContentNote,
        assignees: initialData.assignees.map((a) => a.employeeId),
        remarks: initialData.remarks,
      };
    }
    return {
      taskType: 'CONTRACT',
      headcount: 1,
      shift: shifts[0]?.value as string,
      route: routes[0]?.value as string,
      contents: [],
    };
  }, [initialData, shifts, routes]);

  // Handle group change: clear branch
  const handleGroupChange = useCallback(
    (groupId: string) => {
      setSelectedGroupId(groupId);
      form.setFieldsValue({ branchId: undefined });
      setAlertResults(null);
    },
    [form],
  );

  // Holiday date cell render for DatePicker
  const dateRender = useCallback(
    (current: Dayjs) => {
      const dateStr = current.format('YYYY-MM-DD');
      const isHol = isHoliday(dateStr, holidays);
      return (
        <div className="ant-picker-cell-inner" style={{ color: isHol ? '#ff4d4f' : undefined }}>
          {current.date()}
        </div>
      );
    },
    [holidays],
  );

  // Build TaskFormData from form values
  const buildFormData = useCallback(
    (overrideRemark?: string): TaskFormData | null => {
      const values = form.getFieldsValue(true);
      if (!values.groupId || !values.branchId) return null;

      const isOther = values.contents?.includes('OTHER') || values.contents?.includes('其他');

      return {
        groupId: values.groupId,
        branchId: values.branchId,
        taskType: values.taskType || 'CONTRACT',
        date: values.date ? dayjs(values.date).format('YYYY-MM-DD') : '',
        startTime: values.startTime || '',
        endTime: values.endTime || '',
        headcount: values.headcount ?? 1,
        shift: values.shift || (shifts[0]?.value as string) || '早班',
        route: values.route ?? '',
        contents: values.contents ?? [],
        otherContentNote: isOther ? values.otherContentNote : undefined,
        assignees: values.assignees ?? [],
        remarks: values.remarks,
        recurrence: enableRecurrence ? recurrenceRule : undefined,
        overrideRemark: overrideRemark || values.overrideRemark,
      };
    },
    [form, enableRecurrence, recurrenceRule, shifts],
  );

  // 處理 ConflictPanel 之覆蓋操作：使用者確認覆蓋違規並輸入備註後呼叫
  const handleOverride = useCallback(
    async (remark: string) => {
      setAlertResults(null);
      setStoreAlertResults(null);

      const formData = buildFormData(remark);
      if (!formData) return;

      // 若正在編輯週期任務實例，覆蓋後仍需先詢問修改範圍，再送出
      if (isRecurringTask) {
        setPendingFormData(formData);
        setShowModifyScope(true);
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setSubmitting(false);
      }
    },
    [buildFormData, onSubmit, setStoreAlertResults, isRecurringTask],
  );

  // Submit form data after all checks pass
  const submitFormData = useCallback(
    async (formData: TaskFormData) => {
      setSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit],
  );

  // Handle recurrence modify scope confirmation
  const handleModifyScopeConfirm = useCallback(
    async (scope: RecurrenceModifyScope) => {
      setShowModifyScope(false);
      if (!pendingFormData) return;

      const dataWithScope = {
        ...pendingFormData,
        recurrenceModifyScope: scope,
      };

      await submitFormData(dataWithScope as TaskFormData);
      setPendingFormData(null);
    },
    [pendingFormData, submitFormData],
  );

  // Handle recurrence modify scope cancel
  const handleModifyScopeCancel = useCallback(() => {
    setShowModifyScope(false);
    setPendingFormData(null);
  }, []);

  // 表單送出處理：先執行前端警示規則預檢，若有違規則暫停送出並顯示 ConflictPanel 要求必填備註
  const handleFinish = useCallback(async () => {
    const formData = buildFormData();
    if (!formData) return;

    // 當已填寫日期與時間時，執行排班預檢（含人數不足、證照不符、連續上班等）
    if (formData.date && formData.startTime && formData.endTime) {
      const alertContext: AlertContext = {
        employees,
        existingTasks,
        customerLicenses: requiredLicenses,
        holidays,
      };

      const result = runAlertChecks(formData, alertContext);

      if (!result.isValid) {
        setAlertResults(result);
        setStoreAlertResults(result);
        return;
      }
    }

    // 若正在編輯週期任務實例，送出前先詢問修改範圍
    if (isRecurringTask) {
      setPendingFormData(formData);
      setShowModifyScope(true);
      return;
    }

    // 無違規且非週期任務編輯 → 直接送出
    await submitFormData(formData);
  }, [
    buildFormData,
    employees,
    existingTasks,
    requiredLicenses,
    holidays,
    isRecurringTask,
    submitFormData,
    setStoreAlertResults,
  ]);

  // 全部清除
  const handleClearAll = useCallback(() => {
    form.resetFields();
    setSelectedGroupId(undefined);
    setEnableRecurrence(true);
    setRecurrenceRule(DEFAULT_RECURRENCE_RULE);
    setAlertResults(null);
    setStoreAlertResults(null);
  }, [form, setStoreAlertResults]);

  const showOtherContentNote =
    contentsValue.includes('OTHER') || (contentsValue as string[]).includes('其他');

  return (
    <div data-testid="task-form" style={{ padding: '4px 0' }}>
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={defaultFormValues}>
        <Row gutter={[16, 16]}>
          {/* 左欄：基本資訊 ＋ 排程循環 */}
          <Col xs={24} lg={12}>
            {/* 區塊 1: 基本任務資訊 */}
            <Card size="small" title="🏢 基本資訊" style={{ marginBottom: 16, borderRadius: 8 }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="groupId"
                    label={t('task.group')}
                    rules={[{ required: true, message: t('task.groupRequired') }]}
                  >
                    <Select
                      placeholder={t('task.groupSearchPlaceholder')}
                      options={groupOptions}
                      onChange={handleGroupChange}
                      showSearch
                      optionFilterProp="label"
                      aria-label={t('task.group')}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="branchId"
                    label={t('task.branch')}
                    rules={[{ required: true, message: t('task.branchRequired') }]}
                  >
                    <Select
                      placeholder={
                        selectedGroupId
                          ? t('task.branchSearchPlaceholder')
                          : t('task.selectGroupFirst')
                      }
                      options={branchOptions}
                      disabled={!selectedGroupId}
                      showSearch
                      optionFilterProp="label"
                      aria-label={t('task.branch')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="taskType"
                label={t('task.taskType')}
                rules={[{ required: true, message: t('task.taskTypeRequired') }]}
                style={{ marginBottom: 8 }}
              >
                <TaskTypeCheckboxGroup options={taskTypes} />
              </Form.Item>
            </Card>

            {/* 區塊 2: 排程與循環頻率 */}
            <Card size="small" title="⏰ 排程與循環" style={{ borderRadius: 8 }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="shift"
                    label={t('task.shift')}
                    rules={[{ required: true, message: t('task.shiftRequired') }]}
                  >
                    <Select
                      placeholder={t('task.shiftPlaceholder')}
                      options={shifts}
                      showSearch
                      optionFilterProp="label"
                      aria-label={t('task.shift')}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="route" label={t('task.route')}>
                    <Select
                      placeholder={t('task.routePlaceholder')}
                      options={routes}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      aria-label={t('task.route')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="date" label={t('task.date')} extra="未填寫日期將視為待排時間客戶">
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder="請選擇日期（可留空為待排）"
                  cellRender={(current) => {
                    if (typeof current === 'number' || typeof current === 'string') {
                      return <div className="ant-picker-cell-inner">{current}</div>;
                    }
                    return dateRender(current as Dayjs);
                  }}
                  aria-label={t('task.taskDate')}
                />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="startTime" label={t('task.startTime')}>
                    <TimeSelect aria-label={t('task.startTime')} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="endTime" label={t('task.endTime')}>
                    <TimeSelect aria-label={t('task.endTime')} />
                  </Form.Item>
                </Col>
              </Row>
              <Text
                type="secondary"
                style={{ display: 'block', marginTop: -8, marginBottom: 12, fontSize: 12 }}
              >
                {t('task.overnightHint')}
              </Text>

              <Divider style={{ margin: '12px 0' }} />

              <Form.Item label="週期" required style={{ marginBottom: 8 }}>
                <Radio.Group
                  value={enableRecurrence ? 'yes' : 'no'}
                  onChange={(e) => setEnableRecurrence(e.target.value === 'yes')}
                  style={{ marginBottom: enableRecurrence ? 12 : 0 }}
                >
                  <Radio.Button value="no">無週期</Radio.Button>
                  <Radio.Button value="yes">有週期</Radio.Button>
                </Radio.Group>

                {enableRecurrence && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 14px',
                      background: '#fafafa',
                      borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <RecurrenceEditor value={recurrenceRule} onChange={setRecurrenceRule} />
                  </div>
                )}
              </Form.Item>
            </Card>
          </Col>

          {/* 右欄：內容與指派 ＋ 備註 */}
          <Col xs={24} lg={12}>
            {/* 區塊 3: 內容與指派人員 */}
            <Card
              size="small"
              title="🛠️ 內容與指派人員"
              style={{ marginBottom: 16, borderRadius: 8 }}
            >
              <Form.Item
                name="contents"
                label={t('task.content')}
                rules={[{ required: true, message: t('task.contentRequired'), type: 'array' }]}
              >
                <Checkbox.Group options={contents} />
              </Form.Item>

              {showOtherContentNote && (
                <Form.Item
                  name="otherContentNote"
                  label={t('task.otherContentNote')}
                  rules={[{ required: true, message: '請輸入其他內容說明' }]}
                >
                  <Input
                    placeholder="請輸入其他內容說明（必填）"
                    aria-label={t('task.otherContentNote')}
                  />
                </Form.Item>
              )}

              <Form.Item name="headcount" label={t('task.headcount')}>
                <InputNumber
                  min={1}
                  max={50}
                  style={{ width: '100%' }}
                  placeholder="人數需求（預設 1 人）"
                  aria-label={t('task.headcount')}
                />
              </Form.Item>

              <Form.Item name="assignees" label="指派人員（按鈕式點選）">
                <EmployeeSelect
                  value={assigneesValue}
                  onChange={(ids) => form.setFieldValue('assignees', ids)}
                  date={currentDate}
                  requiredLicenses={requiredLicenses}
                />
              </Form.Item>
            </Card>

            {/* 區塊 4: 備註說明 */}
            <Card size="small" title="📝 備註說明" style={{ borderRadius: 8 }}>
              <Form.Item name="remarks" style={{ marginBottom: 0 }}>
                <TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder={t('task.remarksPlaceholder')}
                  aria-label={t('task.remarks')}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        {/* ConflictPanel - 當偵測到 5 大警示規則違規時顯示，要求必填備註後覆蓋 */}
        {alertResults && !alertResults.isValid && (
          <div style={{ marginBottom: 20 }}>
            <ConflictPanel
              violations={alertResults.violations}
              onOverride={handleOverride}
              canOverride={alertResults.canOverride}
            />
          </div>
        )}

        {/* Form Actions */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              aria-label={t('common.save')}
            >
              {t('common.save')}
            </Button>
            <Button htmlType="button" onClick={onCancel} aria-label={t('common.cancel')}>
              {t('common.cancel')}
            </Button>
            <Button htmlType="button" onClick={handleClearAll} aria-label={t('common.clearAll')}>
              {t('common.clearAll')}
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* Recurrence Modify Scope Dialog */}
      <RecurrenceModifyScopeDialog
        open={showModifyScope}
        onConfirm={handleModifyScopeConfirm}
        onCancel={handleModifyScopeCancel}
      />
    </div>
  );
};

export default TaskForm;

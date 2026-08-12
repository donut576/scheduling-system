import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Form,
  Select,
  DatePicker,
  TimePicker,
  InputNumber,
  Input,
  Button,
  Space,
  Divider,
  Switch,
  Typography,
} from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { Task, TaskFormData, TaskContent, RecurrenceRule } from '@/types/task';
import type { AlertValidationResult, AlertContext } from '@/types/alert';
import type { CustomerGroup } from '@/types/customer';
import { useDictStore } from '@/stores/useDictStore';
import { useTaskStore } from '@/stores/useTaskStore';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import { runAlertChecks } from '@/utils/alertRules';
import { isHoliday } from '@/utils/date';
import EmployeeSelect from '@/components/business/EmployeeSelect';
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
 * TaskForm - 任務建立/編輯表單
 * 整合集團→分店連動、警示引擎預檢、ConflictPanel 違規顯示
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */
const TaskForm: React.FC<TaskFormProps> = ({ mode, initialData, onSubmit, onCancel }) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [enableRecurrence, setEnableRecurrence] = useState(!!initialData?.recurrenceRule);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | undefined>(
    initialData?.recurrenceRule,
  );
  const [alertResults, setAlertResults] = useState<AlertValidationResult | null>(null);
  const [showModifyScope, setShowModifyScope] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<TaskFormData | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(initialData?.groupId);

  // Determine if we're editing a recurring task instance
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
  const currentDate = watchDate ? dayjs(watchDate).format('YYYY-MM-DD') : undefined;

  const { data: existingTaskData } = useTaskList({
    page: 1,
    pageSize: 200,
    startDate: currentDate,
    endDate: currentDate,
  });
  const existingTasks = useMemo(() => existingTaskData?.list ?? [], [existingTaskData]);

  // Holidays list - normally from API, using empty for now
  const holidays: string[] = useMemo(() => [], []);

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

  // Get required licenses for selected branch
  const requiredLicenses = useMemo(() => {
    if (!selectedGroupId) return [];
    const group = customerGroups.find((g: CustomerGroup) => g.id === selectedGroupId);
    if (!group) return [];
    const branchId = form.getFieldValue('branchId');
    const branch = group.branches.find((b) => b.id === branchId);
    return branch?.requiredLicenses ?? [];
  }, [selectedGroupId, customerGroups, form]);

  // Initialize form values for edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      form.setFieldsValue({
        groupId: initialData.groupId,
        branchId: initialData.branchId,
        taskType: initialData.taskType,
        date: dayjs(initialData.date),
        startTime: dayjs(initialData.startTime, 'HH:mm'),
        endTime: dayjs(initialData.endTime, 'HH:mm'),
        headcount: initialData.headcount,
        shift: initialData.shift,
        route: initialData.route,
        contents: initialData.contents,
        assignees: initialData.assignees.map((a) => a.employeeId),
        remarks: initialData.remarks,
      });
      setSelectedGroupId(initialData.groupId);
      if (initialData.recurrenceRule) {
        setEnableRecurrence(true);
        setRecurrenceRule(initialData.recurrenceRule);
      }
    }
  }, [mode, initialData, form]);

  // Handle group change → clear branch
  const handleGroupChange = useCallback(
    (groupId: string) => {
      setSelectedGroupId(groupId);
      form.setFieldValue('branchId', undefined);
      // Clear alert results when form changes
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
  const buildFormData = useCallback((): TaskFormData | null => {
    const values = form.getFieldsValue(true);
    if (!values.groupId || !values.branchId || !values.date) return null;

    return {
      groupId: values.groupId,
      branchId: values.branchId,
      taskType: values.taskType,
      date: dayjs(values.date).format('YYYY-MM-DD'),
      startTime: dayjs(values.startTime).format('HH:mm'),
      endTime: dayjs(values.endTime).format('HH:mm'),
      headcount: values.headcount ?? 1,
      shift: values.shift ?? '',
      route: values.route ?? '',
      contents: values.contents ?? [],
      assignees: values.assignees ?? [],
      remarks: values.remarks,
      recurrence: enableRecurrence ? recurrenceRule : undefined,
    };
  }, [form, enableRecurrence, recurrenceRule]);

  // Handle override from ConflictPanel
  const handleOverride = useCallback(
    async (remark: string) => {
      setAlertResults(null);
      setStoreAlertResults(null);

      const formData = buildFormData();
      if (!formData) return;

      // If editing a recurring task, show modify scope dialog
      if (isRecurringTask) {
        setPendingFormData(formData);
        setShowModifyScope(true);
        return;
      }

      // Attach override remark and submit
      setSubmitting(true);
      try {
        await onSubmit(formData);
      } finally {
        setSubmitting(false);
      }
      // Note: In full implementation, the override remark would be sent
      // to the API via taskApi.overrideWarning. Here we trust the parent
      // to handle override logic with the remark.
      void remark;
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

      // Attach the modify scope to the form data
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

  // Handle form submission with alert checks
  const handleFinish = useCallback(async () => {
    const formData = buildFormData();
    if (!formData) return;

    // Build alert context
    const alertContext: AlertContext = {
      employees,
      existingTasks,
      customerLicenses: requiredLicenses,
      holidays,
    };

    // Run front-end pre-check
    const result = runAlertChecks(formData, alertContext);

    if (!result.isValid) {
      setAlertResults(result);
      setStoreAlertResults(result);
      return;
    }

    // If editing a recurring task, show modify scope dialog before submitting
    if (isRecurringTask) {
      setPendingFormData(formData);
      setShowModifyScope(true);
      return;
    }

    // No violations and not a recurring edit → submit directly
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

  return (
    <div data-testid="task-form">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          taskType: 'CONTRACT',
          headcount: 1,
          contents: [],
          assignees: [],
        }}
      >
        {/* 集團 (Group) */}
        <Form.Item name="groupId" label="集團" rules={[{ required: true, message: '請選擇集團' }]}>
          <Select
            placeholder="請選擇集團"
            options={groupOptions}
            onChange={handleGroupChange}
            showSearch
            optionFilterProp="label"
            aria-label="集團"
          />
        </Form.Item>

        {/* 分店 (Branch) - cascading from group */}
        <Form.Item name="branchId" label="分店" rules={[{ required: true, message: '請選擇分店' }]}>
          <Select
            placeholder={selectedGroupId ? '請選擇分店' : '請先選擇集團'}
            options={branchOptions}
            disabled={!selectedGroupId}
            showSearch
            optionFilterProp="label"
            aria-label="分店"
          />
        </Form.Item>

        {/* 地圖按鈕：帶入目前選定之集團/分店，開啟地圖檢視並定位至相關位置 */}
        {/* Validates: Requirements 15.4 */}
        <Form.Item>
          <Button
            icon={<EnvironmentOutlined />}
            disabled={!selectedGroupId}
            aria-label="地圖檢視"
            onClick={() =>
              navigate('/map', {
                state: {
                  groupId: selectedGroupId,
                  branchId: form.getFieldValue('branchId'),
                },
              })
            }
          >
            地圖
          </Button>
        </Form.Item>

        {/* 任務類型 (Task Type) */}
        <Form.Item
          name="taskType"
          label="任務類型"
          rules={[{ required: true, message: '請選擇任務類型' }]}
        >
          <Select placeholder="請選擇任務類型" options={taskTypes} aria-label="任務類型" />
        </Form.Item>

        {/* 日期 (Date) with holiday red markers */}
        <Form.Item name="date" label="日期" rules={[{ required: true, message: '請選擇日期' }]}>
          <DatePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            cellRender={(current) => {
              if (typeof current === 'number' || typeof current === 'string') {
                return <div className="ant-picker-cell-inner">{current}</div>;
              }
              return dateRender(current as Dayjs);
            }}
            aria-label="任務日期"
          />
        </Form.Item>

        {/* 起訖時間 (Start/End Time) - 24hr format, cross-day allowed */}
        <Space style={{ width: '100%' }} size="middle">
          <Form.Item
            name="startTime"
            label="起始時間"
            rules={[{ required: true, message: '請選擇起始時間' }]}
            style={{ flex: 1 }}
          >
            <TimePicker
              format="HH:mm"
              minuteStep={5}
              style={{ width: '100%' }}
              aria-label="起始時間"
            />
          </Form.Item>
          <Form.Item
            name="endTime"
            label="結束時間"
            rules={[{ required: true, message: '請選擇結束時間' }]}
            style={{ flex: 1 }}
          >
            <TimePicker
              format="HH:mm"
              minuteStep={5}
              style={{ width: '100%' }}
              aria-label="結束時間"
            />
          </Form.Item>
        </Space>
        <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 16 }}>
          若結束時間早於起始時間，將自動視為跨日任務
        </Text>

        {/* 人數 (Headcount) */}
        <Form.Item
          name="headcount"
          label="人數"
          rules={[{ required: true, message: '請輸入人數' }]}
        >
          <InputNumber min={1} max={50} style={{ width: '100%' }} aria-label="人數" />
        </Form.Item>

        {/* 班別 (Shift) */}
        <Form.Item name="shift" label="班別">
          <Select
            placeholder="請選擇班別"
            options={shifts}
            allowClear
            showSearch
            optionFilterProp="label"
            aria-label="班別"
          />
        </Form.Item>

        {/* 路線 (Route) */}
        <Form.Item name="route" label="路線">
          <Select
            placeholder="請選擇路線"
            options={routes}
            allowClear
            showSearch
            optionFilterProp="label"
            aria-label="路線"
          />
        </Form.Item>

        {/* 工作內容 (Task Contents - Multi-select) */}
        <Form.Item
          name="contents"
          label="工作內容"
          rules={[{ required: true, message: '請選擇工作內容', type: 'array' }]}
        >
          <Select<TaskContent[]>
            mode="multiple"
            placeholder="請選擇工作內容"
            options={contents}
            aria-label="工作內容"
          />
        </Form.Item>

        {/* 備註 (Remarks) */}
        <Form.Item name="remarks" label="備註">
          <TextArea rows={3} maxLength={500} showCount placeholder="請輸入備註" aria-label="備註" />
        </Form.Item>

        {/* 指派員工 (Assignees - EmployeeSelect) */}
        <Form.Item name="assignees" label="指派員工">
          <EmployeeSelect
            value={form.getFieldValue('assignees') ?? []}
            onChange={(ids) => form.setFieldValue('assignees', ids)}
            date={currentDate}
            requiredLicenses={requiredLicenses}
          />
        </Form.Item>

        <Divider />

        {/* 週期設定 (Recurrence) */}
        <Space align="center" style={{ marginBottom: 16 }}>
          <Text strong>週期設定</Text>
          <Switch
            checked={enableRecurrence}
            onChange={setEnableRecurrence}
            aria-label="啟用週期設定"
          />
        </Space>

        {enableRecurrence && (
          <RecurrenceEditor value={recurrenceRule} onChange={setRecurrenceRule} />
        )}

        <Divider />

        {/* ConflictPanel - show when violations exist */}
        {alertResults && !alertResults.isValid && (
          <div style={{ marginBottom: 24 }}>
            <ConflictPanel
              violations={alertResults.violations}
              onOverride={handleOverride}
              canOverride={alertResults.canOverride}
            />
          </div>
        )}

        {/* Form Actions */}
        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              aria-label={mode === 'create' ? '建立任務' : '儲存變更'}
            >
              {mode === 'create' ? '建立任務' : '儲存變更'}
            </Button>
            <Button onClick={onCancel} aria-label="取消">
              取消
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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Form,
  DatePicker,
  Radio,
  Checkbox,
  Select,
  Space,
  Button,
  Divider,
  Alert,
  message,
} from 'antd';
import { CopyOutlined, CalendarOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useCopySchedule } from '@/queries/useScheduleQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { AREA_OPTIONS } from '@/constants/groups';
import type { CopyScheduleParams, CopyScheduleResult } from '@/types/schedule';
import type { TaskType } from '@/types/task';

const { RangePicker } = DatePicker;

export interface CopyScheduleModalProps {
  open: boolean;
  onCancel: () => void;
  defaultSourceRange?: { start: string; end: string };
  onSuccess?: (result: CopyScheduleResult) => void;
}

export const CopyScheduleModal: React.FC<CopyScheduleModalProps> = ({
  open,
  onCancel,
  defaultSourceRange,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const copyScheduleMutation = useCopySchedule();

  const { data: employeesData } = useEmployeeList({ page: 1, pageSize: 500 });
  const employees = useMemo(() => employeesData?.list ?? [], [employeesData?.list]);

  // 內部狀態管理
  const [sourceRange, setSourceRange] = useState<[Dayjs, Dayjs]>([
    defaultSourceRange?.start ? dayjs(defaultSourceRange.start) : dayjs().startOf('week'),
    defaultSourceRange?.end ? dayjs(defaultSourceRange.end) : dayjs().endOf('week'),
  ]);

  const [targetRange, setTargetRange] = useState<[Dayjs, Dayjs]>([
    defaultSourceRange?.start
      ? dayjs(defaultSourceRange.start).add(1, 'week')
      : dayjs().startOf('week').add(1, 'week'),
    defaultSourceRange?.end
      ? dayjs(defaultSourceRange.end).add(1, 'week')
      : dayjs().endOf('week').add(1, 'week'),
  ]);

  const [employeeScope, setEmployeeScope] = useState<'all' | 'area' | 'custom'>('all');

  // 當 defaultSourceRange 或 open 變更時重設預設區間
  useEffect(() => {
    if (open && defaultSourceRange?.start && defaultSourceRange?.end) {
      const sStart = dayjs(defaultSourceRange.start);
      const sEnd = dayjs(defaultSourceRange.end);
      const durationDays = sEnd.diff(sStart, 'day');

      setSourceRange([sStart, sEnd]);
      setTargetRange([sStart.add(durationDays + 1, 'day'), sEnd.add(durationDays + 1, 'day')]);

      form.setFieldsValue({
        source: [sStart, sEnd],
        target: [sStart.add(durationDays + 1, 'day'), sEnd.add(durationDays + 1, 'day')],
        employeeScope: 'all',
        taskTypes: ['CONTRACT', 'ONETIME'],
        overwrite: false,
      });
    }
  }, [open, defaultSourceRange, form]);

  // 快捷設置目標區間
  const handleQuickSetTarget = useCallback(
    (offsetType: 'nextWeek' | 'nextTwoWeeks' | 'nextMonth') => {
      const [sStart, sEnd] = sourceRange;
      const days = sEnd.diff(sStart, 'day');

      let newTargetStart: Dayjs;
      if (offsetType === 'nextWeek') {
        newTargetStart = sStart.add(1, 'week');
      } else if (offsetType === 'nextTwoWeeks') {
        newTargetStart = sStart.add(2, 'week');
      } else {
        newTargetStart = sStart.add(1, 'month');
      }

      const newTargetEnd = newTargetStart.add(days, 'day');
      setTargetRange([newTargetStart, newTargetEnd]);
      form.setFieldsValue({ target: [newTargetStart, newTargetEnd] });
    },
    [sourceRange, form],
  );

  // 員工多選選項
  const employeeOptions = useMemo(() => {
    return employees.map((emp) => ({
      label: `${emp.name} (${emp.area || '台北'} ${emp.shift || '早班'})`,
      value: emp.id,
    }));
  }, [employees]);

  // 提交複製
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const [srcStart, srcEnd] = values.source as [Dayjs, Dayjs];
      const [tgtStart, tgtEnd] = values.target as [Dayjs, Dayjs];

      const params: CopyScheduleParams = {
        sourceStartDate: srcStart.format('YYYY-MM-DD'),
        sourceEndDate: srcEnd.format('YYYY-MM-DD'),
        targetStartDate: tgtStart.format('YYYY-MM-DD'),
        targetEndDate: tgtEnd.format('YYYY-MM-DD'),
        taskTypes: values.taskTypes as TaskType[],
        overwrite: values.overwrite ?? false,
        area: values.employeeScope === 'area' ? values.area : undefined,
        employeeIds: values.employeeScope === 'custom' ? values.employeeIds : undefined,
      };

      const result = await copyScheduleMutation.mutateAsync(params);

      if (result.copiedCount === 0) {
        message.warning(t('schedule.copyEmpty') || '來源區間內沒有符合條件的排班事件可供複製');
      } else {
        const skippedMsg =
          result.skippedCount > 0
            ? ` ${t('schedule.copySkipped', { count: result.skippedCount })}`
            : '';
        message.success(`${t('schedule.copySuccess', { count: result.copiedCount })}${skippedMsg}`);
      }

      onSuccess?.(result);
      onCancel();
    } catch {
      // Form validation error or API error handled by query client
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <CopyOutlined style={{ color: '#1677ff' }} />
          <span>{t('schedule.copyScheduleTitle') || '快速複製排班'}</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('common.cancel') || '取消'}
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={copyScheduleMutation.isPending}
          onClick={handleSubmit}
          style={{ backgroundColor: '#1677ff' }}
        >
          {t('schedule.startCopy') || '開始複製'}
        </Button>,
      ]}
      width={560}
      destroyOnClose
    >
      <Alert
        message={
          t('schedule.copyScheduleDesc') ||
          '將指定區間的排班與指派人員批量複製至未來目標週期，大幅節省常態班表排定時間。'
        }
        type="info"
        showIcon
        style={{ marginBottom: 16, fontSize: 13 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          source: sourceRange,
          target: targetRange,
          employeeScope: 'all',
          taskTypes: ['CONTRACT', 'ONETIME'],
          overwrite: false,
        }}
      >
        {/* 1. 來源區間 */}
        <Form.Item
          label={
            <span style={{ fontWeight: 600 }}>
              <CalendarOutlined style={{ marginRight: 6 }} />
              {t('schedule.sourcePeriod') || '來源區間'}
            </span>
          }
          name="source"
          rules={[{ required: true, message: '請選擇來源區間' }]}
        >
          <RangePicker
            style={{ width: '100%' }}
            allowClear={false}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setSourceRange([dates[0], dates[1]]);
              }
            }}
          />
        </Form.Item>

        {/* 2. 目標區間 ＋ 快捷選擇標籤 */}
        <Form.Item
          label={
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                <CalendarOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                {t('schedule.targetPeriod') || '目標區間'}
              </span>
              <Space size="small">
                <Button size="small" type="dashed" onClick={() => handleQuickSetTarget('nextWeek')}>
                  {t('schedule.nextWeek') || '下一週'}
                </Button>
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => handleQuickSetTarget('nextTwoWeeks')}
                >
                  {t('schedule.nextTwoWeeks') || '未來兩週'}
                </Button>
                <Button
                  size="small"
                  type="dashed"
                  onClick={() => handleQuickSetTarget('nextMonth')}
                >
                  {t('schedule.nextMonth') || '下個月'}
                </Button>
              </Space>
            </div>
          }
          name="target"
          rules={[{ required: true, message: '請選擇目標區間' }]}
        >
          <RangePicker
            style={{ width: '100%' }}
            allowClear={false}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setTargetRange([dates[0], dates[1]]);
              }
            }}
          />
        </Form.Item>

        <Divider style={{ margin: '14px 0' }} />

        {/* 3. 員工與區域範圍 */}
        <Form.Item
          label={
            <span style={{ fontWeight: 600 }}>{t('schedule.employeeScope') || '員工範圍'}</span>
          }
          name="employeeScope"
        >
          <Radio.Group onChange={(e) => setEmployeeScope(e.target.value)} value={employeeScope}>
            <Radio value="all">{t('schedule.allEmployees') || '全體員工'}</Radio>
            <Radio value="area">{t('schedule.areaScope') || '依區域'}</Radio>
            <Radio value="custom">{t('schedule.individual') || '指定員工'}</Radio>
          </Radio.Group>
        </Form.Item>

        {employeeScope === 'area' && (
          <Form.Item
            name="area"
            label={t('schedule.areaLabel') || '地區'}
            rules={[{ required: true, message: '請選擇區域' }]}
          >
            <Select
              placeholder={t('schedule.selectAreaPlaceholder') || '選擇地區'}
              options={AREA_OPTIONS}
            />
          </Form.Item>
        )}

        {employeeScope === 'custom' && (
          <Form.Item
            name="employeeIds"
            label={t('schedule.employeeLabel') || '員工'}
            rules={[{ required: true, message: '請選擇至少一位員工' }]}
          >
            <Select
              mode="multiple"
              placeholder={t('schedule.selectEmployeePlaceholder') || '選擇員工'}
              options={employeeOptions}
              maxTagCount={3}
            />
          </Form.Item>
        )}

        {/* 4. 複製任務類型 */}
        <Form.Item
          label={
            <span style={{ fontWeight: 600 }}>
              {t('schedule.taskTypesToCopy') || '複製任務類型'}
            </span>
          }
          name="taskTypes"
          rules={[{ required: true, message: '請至少選擇一種任務類型' }]}
        >
          <Checkbox.Group>
            <Space size="large">
              <Checkbox value="CONTRACT">{t('task.contract') || '合約常態單'}</Checkbox>
              <Checkbox value="ONETIME">{t('task.onetime') || '單次任務'}</Checkbox>
              <Checkbox value="ESR">{t('task.esr') || 'ESR 急件'}</Checkbox>
            </Space>
          </Checkbox.Group>
        </Form.Item>

        {/* 5. 衝突與覆蓋策略 */}
        <Form.Item
          label={
            <span style={{ fontWeight: 600 }}>{t('schedule.overwriteStrategy') || '覆蓋策略'}</span>
          }
          name="overwrite"
        >
          <Radio.Group>
            <Space direction="vertical">
              <Radio value={false}>
                {t('schedule.skipConflicts') || '僅填補空檔（若目標時段已有排班則略過，防呆安全）'}
              </Radio>
              <Radio value={true}>
                {t('schedule.overwriteAll') || '完整覆蓋（目標時段已有排班亦強制新增）'}
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CopyScheduleModal;

// 開發用固定帳號（暫時固定登入）。只在 ENABLE_DEV_LOGIN=true 時使用，正式環境務必關閉。
// 密碼寫在程式碼中，僅限這種測試密碼；正式登入完成後整個檔案移除。
export const DEV_USERS = [
  { id: '1', account: 'admin', password: 'admin123', name: '系統管理員', employeeNo: 'ADMIN01', role: 'ADMIN' },
  { id: '2', account: 'manager', password: 'manager123', name: '副理', employeeNo: 'MGR01', role: 'MANAGER' },
  { id: '3', account: 'leader', password: 'leader123', name: '主任', employeeNo: 'LDR01', role: 'LEADER' },
  { id: '4', account: 'staff', password: 'staff123', name: '組員', employeeNo: 'STAFF01', role: 'STAFF' },
  { id: '5', account: 'TPA02', password: 'staff123', name: '蔡孟潔', employeeNo: 'TPA02', role: 'STAFF' },
];

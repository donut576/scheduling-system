// 暫時的任務可視範圍設定（PE 的轄區與權限規則確認後調整，只需改這個檔案）
// 同一組內的轄區，主任可以互相查看；其他角色只看自己的轄區
export const REGION_GROUPS = [
  ['台北', '新竹'],
  ['台中', '台南'],
];

// 可看全部轄區的角色（副理、管理員）
export const SEE_ALL_ROLES = ['ADMIN', 'MANAGER'];

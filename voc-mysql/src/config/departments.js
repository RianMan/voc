// src/config/departments.js

export const DEPARTMENT_MAP = {
  'UI': '蔡光磊',
  '投放': '曹雨萱',
  '产品': '王玲',
  '运营': '高雪',
  'BIZ': '张冬冬',
  '贷后': '陈向丽',
  '客服': '陈玲'
};

export const DEPARTMENTS = Object.keys(DEPARTMENT_MAP);

/**
 * 根据部门列表获取对应的负责人列表
 * @param {string[]} depts - 例如 ['UI', '产品']
 * @returns {string[]} - 例如 ['蔡光磊', '王玲']
 */
export function getOwnersByDepartments(depts) {
  if (!Array.isArray(depts)) return [];
  // 去重并过滤空值
  const owners = new Set();
  depts.forEach(d => {
    if (DEPARTMENT_MAP[d]) owners.add(DEPARTMENT_MAP[d]);
  });
  return Array.from(owners);
}
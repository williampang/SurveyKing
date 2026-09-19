// utils/validator.js
// 表单验证工具，参考 SurveyKing 前端产物的校验规则

const formula = require('./formula.js');

/**
 * 中国大陆身份证号校验（含校验位）
 */
function isValidIdCard(v) {
  if (!v || typeof v !== 'string') return false;
  const s = v.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(s)) return false;
  // 校验位
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += parseInt(s[i], 10) * weights[i];
  return checkCodes[sum % 11] === s[17];
}

/**
 * 中国大陆手机号
 */
function isValidMobile(v) {
  return !!v && /^1[3-9]\d{9}$/.test(String(v).trim());
}

/**
 * 邮箱
 */
function isValidEmail(v) {
  return !!v && /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(String(v).trim());
}

/**
 * 数字（整数或小数）
 */
function isValidNumber(v) {
  if (v === '' || v === null || v === undefined) return false;
  return !isNaN(Number(v));
}

/**
 * 整数
 */
function isValidInteger(v) {
  return !!v && /^-?\d+$/.test(String(v).trim());
}

/**
 * 日期字符串（YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY-MM-DD HH:mm:ss）
 */
function isValidDate(v) {
  if (!v) return false;
  const s = String(v).trim();
  const d = new Date(s.replace(/-/g, '/'));
  return !isNaN(d.getTime());
}

/**
 * 时间字符串 HH:mm 或 HH:mm:ss
 */
function isValidTime(v) {
  return !!v && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(v).trim());
}

/**
 * URL
 */
function isValidUrl(v) {
  return !!v && /^https?:\/\/[^\s]+$/.test(String(v).trim());
}

/**
 * 单值是否为空
 */
function isEmpty(v) {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object') {
    // 对象：所有 value 都为空则视为空
    const keys = Object.keys(v);
    if (keys.length === 0) return true;
    return keys.every(k => isEmpty(v[k]));
  }
  return false;
}

/**
 * 根据 dataType 校验单个值
 * 支持：idCard / mobile / email / number / integer / date / dateTime / time / url / text
 * 返回错误消息，通过则返回 null
 */
function validateByDataType(value, dataType, opts = {}) {
  if (isEmpty(value)) return null; // 空值交给 required 校验处理
  const v = typeof value === 'string' ? value.trim() : value;
  switch (dataType) {
    case 'idCard':
      return isValidIdCard(v) ? null : '身份证号格式不正确';
    case 'mobile':
    case 'phone':
      return isValidMobile(v) ? null : '手机号格式不正确';
    case 'email':
      return isValidEmail(v) ? null : '邮箱格式不正确';
    case 'number':
      return isValidNumber(v) ? null : '请输入数字';
    case 'integer':
      return isValidInteger(v) ? null : '请输入整数';
    case 'date':
    case 'dateTime':
      return isValidDate(v) ? null : '日期格式不正确';
    case 'time':
      return isValidTime(v) ? null : '时间格式不正确';
    case 'url':
      return isValidUrl(v) ? null : 'URL 格式不正确';
    default:
      // 长度限制
      if (opts.minLength && String(v).length < opts.minLength) {
        return `至少 ${opts.minLength} 个字符`;
      }
      if (opts.maxLength && String(v).length > opts.maxLength) {
        return `最多 ${opts.maxLength} 个字符`;
      }
      if (opts.pattern) {
        try {
          const re = new RegExp(opts.pattern);
          if (!re.test(String(v))) return opts.patternMessage || '格式不正确';
        } catch (e) {}
      }
      return null;
  }
}

/**
 * 校验一道题
 * @param {Object} question - 题目 schema
 * @param {*} value - 用户答案
 * @param {Object} [formulaCtx] - 可选公式上下文
 * @returns {String|null} 错误消息
 */
function validateQuestion(question, value, formulaCtx) {
  const attr = question.attribute || {};
  const type = question.type;

  // 展示型题型（Remark 文字描述/分割线/分页等）无作答值，跳过校验
  if (type === 'Remark' || type === 'SplitLine' || type === 'Section' || type === 'Pagination') return null;

  // 处于公式隐藏状态的题目跳过校验
  if (attr.visibleRule && formulaCtx) {
    const isVisible = formula.evaluateVisibleRule(attr.visibleRule, formulaCtx);
    if (!isVisible) return null;
  }

  // 必填
  if (attr.required && isEmpty(value)) {
    return '此题为必填';
  }
  if (isEmpty(value)) return null;

  // 按题型分别校验
  switch (type) {
    case 'FillBlank':
    case 'Textarea': {
      // 填空题的 dataType 在 children[0].attribute.dataType
      const child = (question.children || [])[0] || {};
      const childAttr = child.attribute || {};
      let dataType = childAttr.dataType;
      // dateTimeFormat 为时间格式时按 time 校验，避免 dataType=date + HH:mm:ss 被误判成日期
      const fmt = childAttr.dateTimeFormat || '';
      if (fmt === 'HH:mm:ss' || fmt === 'HH:mm') dataType = 'time';
      const opts = {
        minLength: childAttr.minLength,
        maxLength: childAttr.maxLength,
        pattern: childAttr.pattern,
        patternMessage: childAttr.patternMessage
      };
      // 填空题的答案可能是字符串，也可能是 { childId: value }
      const raw = typeof value === 'object' && value !== null
        ? value[child.id] !== undefined ? value[child.id] : Object.values(value)[0]
        : value;
      return validateByDataType(raw, dataType, opts);
    }

    case 'MultipleBlank': {
      // 每个子空可能有独立 dataType
      const kids = question.children || [];
      const val = typeof value === 'object' ? value : {};
      for (const k of kids) {
        const dt = (k.attribute || {}).dataType;
        const err = validateByDataType(val[k.id], dt, k.attribute || {});
        if (err) return `${k.title || '填空'}：${err}`;
        if (attr.required && isEmpty(val[k.id])) {
          return `${k.title || '填空'} 不能为空`;
        }
      }
      return null;
    }

    case 'HorzBlank': {
      const kids = question.children || [];
      const val = typeof value === 'object' ? value : {};
      for (const k of kids) {
        const dt = (k.attribute || {}).dataType;
        const err = validateByDataType(val[k.id], dt, k.attribute || {});
        if (err) return `${k.id}：${err}`;
        if (attr.required && isEmpty(val[k.id])) {
          return `${k.id} 不能为空`;
        }
      }
      return null;
    }

    case 'Checkbox': {
      // 多选题：最少/最多选
      if (attr.minSelection && value.length < attr.minSelection) {
        return `至少选择 ${attr.minSelection} 项`;
      }
      if (attr.maxSelection && value.length > attr.maxSelection) {
        return `最多选择 ${attr.maxSelection} 项`;
      }
      return null;
    }

    case 'MatrixRadio':
    case 'MatrixFillBlank': {
      // 每行都必须填
      const rows = question.row || [];
      const val = typeof value === 'object' ? value : {};
      if (attr.required) {
        for (const r of rows) {
          if (isEmpty(val[r.id])) return `${r.title} 未填写`;
        }
      }
      return null;
    }

    case 'MatrixCheckbox': {
      const rows = question.row || [];
      const val = typeof value === 'object' ? value : {};
      if (attr.required) {
        for (const r of rows) {
          if (!val[r.id] || !val[r.id].length) return `${r.title} 未选择`;
        }
      }
      return null;
    }

    case 'MatrixAuto': {
      // 至少一行，且每行都要填完整
      if (!Array.isArray(value) || value.length === 0) {
        return attr.required ? '至少添加一行' : null;
      }
      const cols = question.children || [];
      for (let i = 0; i < value.length; i++) {
        const row = value[i];
        for (const c of cols) {
          if (isEmpty(row[c.id])) return `第 ${i + 1} 行 "${c.title}" 未填写`;
          const dt = (c.attribute || {}).dataType;
          const err = validateByDataType(row[c.id], dt, c.attribute || {});
          if (err) return `第 ${i + 1} 行 "${c.title}"：${err}`;
        }
      }
      return null;
    }

    default:
      break;
  }

  // 4. 单题如果配置了 validateRule 且传入了 formulaCtx，进行公式校验
  if (attr.validateRule && formulaCtx) {
    const ruleRes = formula.evaluateValidateRule(attr.validateRule, formulaCtx);
    if (!ruleRes.valid) {
      return ruleRes.message || '输入内容不符合限制规则';
    }
  }

  return null;
}

/**
 * 校验一道题
 * @param {Object} question - 题目 schema
 * @param {*} value - 用户答案
 * @param {Object} [formulaCtx] - 可选公式上下文
 * @returns {String|null} 错误消息
 */
function validateAll(questions, answers, ctx) {
  const formulaCtx = ctx || formula.buildVariableContext(questions, answers);
  const errors = {};
  let firstErrorQid = null;

  questions.forEach(q => {
    // 1. 若配置了 visibleRule 且当前处于隐藏状态，跳过校验
    const attr = q.attribute || {};
    if (attr.visibleRule) {
      const isVisible = formula.evaluateVisibleRule(attr.visibleRule, formulaCtx);
      if (!isVisible) return;
    }

    // 2. 基础题型及数据类型、必填、单题 validateRule 校验
    const err = validateQuestion(q, answers[q.id], formulaCtx);
    if (err) {
      errors[q.id] = err;
      if (!firstErrorQid) firstErrorQid = q.id;
      return;
    }

    // 3. 兜底 validateRule 校验（防止未答题目如 Q1 虽未填写特定内容但违反全局逻辑）
    if (attr.validateRule) {
      const ruleRes = formula.evaluateValidateRule(attr.validateRule, formulaCtx);
      if (!ruleRes.valid) {
        errors[q.id] = ruleRes.message || '输入内容不符合限制规则';
        if (!firstErrorQid) firstErrorQid = q.id;
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    firstErrorQid
  };
}

module.exports = {
  isValidIdCard,
  isValidMobile,
  isValidEmail,
  isValidNumber,
  isValidInteger,
  isValidDate,
  isValidTime,
  isValidUrl,
  isEmpty,
  validateByDataType,
  validateQuestion,
  validateAll
};

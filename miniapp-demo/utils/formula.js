// utils/formula.js
// SurveyKing 小程序公式解析与计算引擎
// 支持 SurveyKing 测评表单逻辑规范：
// 1. 字段/选项引用：Q1, Q1A1, Q1~4, Q1~Q4, QS1, QS1Q1, QS1Q1A1, TEXT(Q1), SCORE(Q1), COUNT(Q1) 等
// 2. 常用函数：IF, IFS, AND, OR, NOT, XOR, SUM, AVERAGE, COUNT, COUNTA, COUNTIF, COUNTBLANK,
//            MAX, MIN, ROUND, ROUNDUP, ROUNDDOWN, INT, MOD, PRODUCT, ABS, CONCATENATE, LEN,
//            TRIM, UPPER, LOWER, LEFT, RIGHT, MID, SUBSTITUTE, REPLACE, TRUE, FALSE, IFERROR, IFNA,
//            CURRENT_DATE, CURRENT_TIME, CURRENT_DATETIME, UUID, VLOOKUP, MATCH, CHOOSE, SWITCH 等
// 3. 动态富文本/标签渲染支持：如 Remark 中的 SUM(Q1~Q11)

/**
 * 展平嵌套数组或多参数
 */
function flatten(args) {
  const res = [];
  for (let i = 0; i < args.length; i++) {
    const item = args[i];
    if (Array.isArray(item)) {
      res.push(...flatten(item));
    } else {
      res.push(item);
    }
  }
  return res;
}

/**
 * 安全转为数字，非数字转为 NaN
 */
function toNumber(val) {
  if (val === true) return 1;
  if (val === false) return 0;
  if (val === null || val === undefined || val === '') return NaN;
  const n = Number(val);
  return n;
}

/**
 * 是否有有效值
 */
function isValid(v) {
  return v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v));
}

// 内置常用函数库
const FUNCTIONS = {
  // 逻辑函数
  IF(condition, trueVal, falseVal) {
    if (trueVal === undefined && falseVal === undefined) {
      return Boolean(condition);
    }
    return condition ? trueVal : (falseVal !== undefined ? falseVal : false);
  },
  IFS(...args) {
    for (let i = 0; i < args.length - 1; i += 2) {
      if (args[i]) return args[i + 1];
    }
    // 奇数个参数时最后一个为 default
    if (args.length % 2 === 1) return args[args.length - 1];
    return null;
  },
  AND(...args) {
    const list = flatten(args);
    if (!list.length) return false;
    return list.every(Boolean);
  },
  OR(...args) {
    const list = flatten(args);
    return list.some(Boolean);
  },
  NOT(val) {
    return !val;
  },
  XOR(...args) {
    const list = flatten(args);
    let trueCount = 0;
    for (const item of list) {
      if (item) trueCount++;
    }
    return trueCount % 2 === 1;
  },
  TRUE() { return true; },
  FALSE() { return false; },
  IFERROR(val, fallback) {
    if (val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
      return fallback;
    }
    return val;
  },
  IFNA(val, fallback) {
    return (val === '#N/A' || val === null || val === undefined) ? fallback : val;
  },
  CHOOSE(index, ...values) {
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 1 || idx > values.length) return null;
    return values[idx - 1];
  },
  SWITCH(target, ...rest) {
    for (let i = 0; i < rest.length - 1; i += 2) {
      if (rest[i] === target) return rest[i + 1];
    }
    if (rest.length % 2 === 1) return rest[rest.length - 1];
    return null;
  },

  // 数学与统计函数
  SUM(...args) {
    const list = flatten(args);
    let sum = 0;
    for (const item of list) {
      const n = toNumber(item);
      if (!isNaN(n)) {
        sum += n;
      } else if (typeof item === 'string' && item.trim() !== '') {
        // 兼容 Remark 里 SUM(Q1~Q11) 之类的“填写进度”用法：
        // 填空题/文本题现在存的是实际文本，非空即视为已填写，计为 1
        sum += 1;
      }
    }
    return sum;
  },
  AVERAGE(...args) {
    const list = flatten(args);
    let sum = 0;
    let count = 0;
    for (const item of list) {
      const n = toNumber(item);
      if (!isNaN(n)) {
        sum += n;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  },
  COUNT(...args) {
    const list = flatten(args);
    let count = 0;
    for (const item of list) {
      const n = toNumber(item);
      if (!isNaN(n)) count++;
    }
    return count;
  },
  COUNTA(...args) {
    const list = flatten(args);
    let count = 0;
    for (const item of list) {
      if (isValid(item)) count++;
    }
    return count;
  },
  COUNTBLANK(...args) {
    const list = flatten(args);
    let count = 0;
    for (const item of list) {
      if (!isValid(item)) count++;
    }
    return count;
  },
  COUNTIF(range, criteria) {
    const list = Array.isArray(range) ? flatten(range) : [range];
    let count = 0;
    for (const item of list) {
      if (matchesCriteria(item, criteria)) {
        count++;
      }
    }
    return count;
  },
  MAX(...args) {
    const list = flatten(args).map(toNumber).filter(n => !isNaN(n));
    return list.length ? Math.max(...list) : 0;
  },
  MIN(...args) {
    const list = flatten(args).map(toNumber).filter(n => !isNaN(n));
    return list.length ? Math.min(...list) : 0;
  },
  ROUND(num, digits = 0) {
    const n = toNumber(num);
    if (isNaN(n)) return 0;
    const factor = Math.pow(10, digits);
    return Math.round(n * factor) / factor;
  },
  ROUNDUP(num, digits = 0) {
    const n = toNumber(num);
    if (isNaN(n)) return 0;
    const factor = Math.pow(10, digits);
    return Math.ceil(n * factor) / factor;
  },
  ROUNDDOWN(num, digits = 0) {
    const n = toNumber(num);
    if (isNaN(n)) return 0;
    const factor = Math.pow(10, digits);
    return Math.floor(n * factor) / factor;
  },
  INT(num) {
    const n = toNumber(num);
    return isNaN(n) ? 0 : Math.floor(n);
  },
  ABS(num) {
    const n = toNumber(num);
    return isNaN(n) ? 0 : Math.abs(n);
  },
  MOD(dividend, divisor) {
    const d1 = toNumber(dividend);
    const d2 = toNumber(divisor);
    return (isNaN(d1) || isNaN(d2) || d2 === 0) ? 0 : d1 % d2;
  },
  PRODUCT(...args) {
    const list = flatten(args);
    let res = 1;
    let hasValid = false;
    for (const item of list) {
      const n = toNumber(item);
      if (!isNaN(n)) {
        res *= n;
        hasValid = true;
      }
    }
    return hasValid ? res : 0;
  },
  POWER(base, exp) {
    return Math.pow(toNumber(base), toNumber(exp));
  },
  SQRT(num) {
    return Math.sqrt(toNumber(num));
  },

  // 文本函数
  CONCATENATE(...args) {
    const list = flatten(args);
    return list.map(x => (x === null || x === undefined) ? '' : String(x)).join('');
  },
  LEN(text) {
    return text ? String(text).length : 0;
  },
  LOWER(text) {
    return text ? String(text).toLowerCase() : '';
  },
  UPPER(text) {
    return text ? String(text).toUpperCase() : '';
  },
  TRIM(text) {
    return text ? String(text).trim() : '';
  },
  LEFT(text, numChars = 1) {
    if (!text) return '';
    return String(text).substring(0, numChars);
  },
  RIGHT(text, numChars = 1) {
    if (!text) return '';
    const s = String(text);
    return s.substring(Math.max(0, s.length - numChars));
  },
  MID(text, startNum, numChars) {
    if (!text) return '';
    // startNum 1-based
    return String(text).substr(startNum - 1, numChars);
  },
  SUBSTITUTE(text, oldText, newText) {
    if (!text) return '';
    return String(text).split(oldText).join(newText);
  },
  REPLACE(text, startNum, numChars, newText) {
    if (!text) return '';
    const s = String(text);
    const start = Math.max(0, startNum - 1);
    return s.slice(0, start) + newText + s.slice(start + numChars);
  },

  // 日期时间函数
  CURRENT_DATE() {
    const d = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  CURRENT_TIME() {
    const d = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },
  CURRENT_DATETIME() {
    return `${FUNCTIONS.CURRENT_DATE()} ${FUNCTIONS.CURRENT_TIME()}`;
  },
  NOW() {
    return FUNCTIONS.CURRENT_DATETIME();
  },
  UUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

/**
 * 判断值是否匹配条件（用于 COUNTIF 等）
 */
function matchesCriteria(val, criteria) {
  // 若 criteria 是函数（如 TRUE() 被写成了 TRUE），执行函数取其返回值
  if (typeof criteria === 'function') {
    try {
      criteria = criteria();
    } catch (e) {}
  }
  if (typeof criteria === 'boolean') {
    return Boolean(val) === criteria;
  }
  if (typeof criteria === 'number') {
    return Number(val) === criteria;
  }
  if (typeof criteria === 'string') {
    const c = criteria.trim();
    if (c.startsWith('>=')) {
      return Number(val) >= Number(c.slice(2));
    }
    if (c.startsWith('<=')) {
      return Number(val) <= Number(c.slice(2));
    }
    if (c.startsWith('>')) {
      return Number(val) > Number(c.slice(1));
    }
    if (c.startsWith('<')) {
      return Number(val) < Number(c.slice(1));
    }
    if (c.startsWith('!=') || c.startsWith('<>')) {
      return String(val) !== c.replace(/^(!=|<>)/, '').trim();
    }
    if (c.startsWith('==')) {
      return String(val) === c.slice(2).trim();
    }
    if (c.startsWith('=')) {
      return String(val) === c.slice(1).trim();
    }
    if (c.toUpperCase() === 'TRUE') return Boolean(val) === true;
    if (c.toUpperCase() === 'FALSE') return Boolean(val) === false;
    return String(val) === c;
  }
  return val === criteria;
}

/**
 * 构建题目别名查找表
 * @param {Array} questions 问卷 children 题目列表
 * @param {Object} answers 答案字典 { qid: value }
 * @returns {Object} 变量映射字典，包含 Q1, Q1A1, Q1A2, TEXT(Q1), SCORE(Q1), COUNT(Q1), VISIBLE(Q1) 等
 */
function buildVariableContext(questions, answers) {
  const ctx = {};
  if (!Array.isArray(questions)) return ctx;

  let qIndex = 0;
  questions.forEach(q => {
    // 题目索引 (Q1, Q2, ...)
    qIndex++;
    const qKey = `Q${qIndex}`;
    const rawVal = answers[q.id];

    // 1. 题目本身的值
    // 对于单选题/填空题等，取简要值；如果未填，提供 null 或对应题型的空值
    let val = rawVal;
    if (q.type === 'FillBlank' && typeof rawVal === 'object' && rawVal !== null) {
      val = Object.values(rawVal)[0];
    } else if (q.type === 'Radio' || q.type === 'Select') {
      val = rawVal;
    }
    // 填空题/文本题：保留实际文本值，以支持字符串比较（如 Q13==Q12, Q13!=""）。
    // 未填写时统一归一化为空字符串，避免 undefined != "" 在 JS 松散比较下为 true 的陷阱。
    // 需要在算术里按“是否填写”计数时，请改用 COUNTA(Q1~Q11) 或 COUNT(Qx)（ctx 中已单独暴露 COUNT_Qx）。
    if (q.type === 'FillBlank' || q.type === 'Textarea') {
      ctx[qKey] = isValid(val) ? String(val) : '';
    } else {
      ctx[qKey] = val;
    }
    ctx[q.id] = val; // 同时支持用真实 qid 访问

    // 2. 选项判断 (Q1A1, Q1A2, ...)
    if (Array.isArray(q.children)) {
      q.children.forEach((opt, optIdx) => {
        const aKey = `${qKey}A${optIdx + 1}`;
        const optIdKey = `${q.id}A${optIdx + 1}`;
        let selected = false;

        if (q.type === 'Radio' || q.type === 'Select') {
          selected = (rawVal === opt.id);
        } else if (q.type === 'Checkbox') {
          selected = Array.isArray(rawVal) && rawVal.includes(opt.id);
        } else if (q.type === 'FillBlank' || q.type === 'Textarea') {
          // 填空题只有一个输入
          selected = isValid(val);
        }
        ctx[aKey] = selected;
        ctx[optIdKey] = selected;
      });
    }

    // 3. 矩阵题行与单元格 (Q1S1, Q1S1A1)
    if (Array.isArray(q.row)) {
      q.row.forEach((r, rIdx) => {
        const sKey = `${qKey}S${rIdx + 1}`;
        const rowAns = (typeof rawVal === 'object' && rawVal !== null) ? rawVal[r.id] : undefined;
        ctx[sKey] = rowAns;

        if (Array.isArray(q.children)) {
          q.children.forEach((col, colIdx) => {
            const cellKey = `${sKey}A${colIdx + 1}`;
            let cellSelected = false;
            if (q.type === 'MatrixRadio') {
              cellSelected = (rowAns === col.id);
            } else if (q.type === 'MatrixCheckbox') {
              cellSelected = Array.isArray(rowAns) && rowAns.includes(col.id);
            } else if (q.type === 'MatrixFillBlank') {
              cellSelected = typeof rowAns === 'object' && rowAns !== null && isValid(rowAns[col.id]);
            }
            ctx[cellKey] = cellSelected;
          });
        }
      });
    }

    // 4. TEXT(Q1), SCORE(Q1), COUNT(Q1)
    // 文本值
    let textVal = '';
    if (q.type === 'Radio' || q.type === 'Select') {
      const matchOpt = (q.children || []).find(o => o.id === rawVal);
      textVal = matchOpt ? (matchOpt.title || '') : (rawVal || '');
    } else if (q.type === 'Checkbox' && Array.isArray(rawVal)) {
      textVal = (q.children || [])
        .filter(o => rawVal.includes(o.id))
        .map(o => o.title || '')
        .join(',');
    } else {
      textVal = (val === null || val === undefined) ? '' : String(val);
    }
    ctx[`TEXT_${qKey}`] = textVal;

    // 分值 (若有显式 score/examScore 取之，否则单选选中第几个选项取索引 t+1)
    let scoreVal = 0;
    if (q.type === 'Radio' || q.type === 'Select') {
      const optIdx = (q.children || []).findIndex(o => o.id === rawVal);
      if (optIdx >= 0) {
        const matchOpt = q.children[optIdx];
        const explicitScore = matchOpt.attribute && (matchOpt.attribute.score || matchOpt.attribute.examScore);
        scoreVal = explicitScore !== undefined ? toNumber(explicitScore) : (optIdx + 1);
      }
    } else if (q.type === 'Checkbox' && Array.isArray(rawVal)) {
      (q.children || []).forEach((o, optIdx) => {
        if (rawVal.includes(o.id)) {
          const explicitScore = o.attribute && (o.attribute.score || o.attribute.examScore);
          scoreVal += explicitScore !== undefined ? toNumber(explicitScore) : (optIdx + 1);
        }
      });
    } else if (q.type === 'Score' || q.type === 'Nps') {
      scoreVal = toNumber(rawVal);
    }
    ctx[`SCORE_${qKey}`] = scoreVal;

    // 数量
    let countVal = 0;
    if (Array.isArray(rawVal)) {
      countVal = rawVal.length;
    } else if (rawVal && typeof rawVal === 'object') {
      countVal = Object.keys(rawVal).length;
    } else if (isValid(rawVal)) {
      countVal = 1;
    }
    ctx[`COUNT_${qKey}`] = countVal;
  });

  // 5. 题目可见性 (VISIBLE_Q1, VISIBLE_<qid>)
  // 说明：visibleRule 会引用其他题的答案，需要在基础 ctx 构建完成后再做第二遍扫描，
  // 避免出现 Q1 的 visibleRule 引用 Q2 时，Q2 尚未注入到 ctx 的情况。
  // 判定顺序：
  //   a) attribute.display === 'hidden' → 后台原生隐藏，直接 false（与 validateAll/submit 过滤保持一致）
  //   b) attribute.visibleRule 存在 → 调用 evaluateVisibleRule 计算
  //   c) 其他情况默认可见
  let visIndex = 0;
  questions.forEach(q => {
    visIndex++;
    // console.log(q)
    const qKey = `Q${visIndex}`;
    const attr = (q && q.attribute) || {};
    let visible = true;
    if (attr.visibleRule) {
      try {
        visible = evaluateVisibleRule(attr.visibleRule, ctx);
        // console.log(visible)
      } catch (e) {
        console.warn(`[Formula] visibleRule 计算失败: ${attr.visibleRule}`, e);
        visible = true;
      }
    } else if (attr.display === 'hidden') {
      visible = false;
    }
    visible = Boolean(visible);
    ctx[`VISIBLE_${qKey}`] = visible;
    if (q && q.id) ctx[`VISIBLE_${q.id}`] = visible;

    // 隐藏的分值题（FillBlank/Textarea）：填写内容按空字符串处理，
    // 同步刷新其派生变量，避免被隐藏的评分仍参与 SUM/SCORE/COUNT 等计算。
    if (!visible && (q.type === 'FillBlank' || q.type === 'Textarea')) {
      ctx[qKey] = '';
      if (q && q.id) ctx[q.id] = '';
      ctx[`TEXT_${qKey}`] = '';
      ctx[`SCORE_${qKey}`] = 0;
      ctx[`COUNT_${qKey}`] = 0;
    }
  });

  return ctx;
}

/**
 * 预处理范围表达式，例如将 Q1~Q11 或 Q1~4 展开为 Q1, Q2, ..., Q11
 */
function expandRanges(formulaStr) {
  if (!formulaStr || typeof formulaStr !== 'string') return '';
  // 匹配 Q1~Q11 或 Q1~11
  return formulaStr.replace(/\bQ(\d+)\s*~\s*(?:Q)?(\d+)\b/gi, (match, start, end) => {
    const s = parseInt(start, 10);
    const e = parseInt(end, 10);
    if (isNaN(s) || isNaN(e)) return match;
    const list = [];
    const min = Math.min(s, e);
    const max = Math.max(s, e);
    for (let i = min; i <= max; i++) {
      list.push(`Q${i}`);
    }
    return list.join(',');
  });
}

/**
 * 转换特殊函数语法为安全标识符
 * TEXT(Q1) -> TEXT_Q1
 * SCORE(Q1) -> SCORE_Q1
 * COUNT(Q1) -> COUNT_Q1
 * validate Q1 with ... -> 提取 with 后面的公式内容
 */
function normalizeFormulas(formulaStr) {
  let str = expandRanges(formulaStr);
  // 去除 validate Qx with 前缀（如 validate Q1 with IF(...)）
  str = str.replace(/^validate\s+Q\d+\s+with\s+/i, '');
  // 特殊提取 TEXT(Qx), SCORE(Qx)
  str = str.replace(/\bTEXT\s*\(\s*(Q\d+)\s*\)/gi, 'TEXT_$1');
  str = str.replace(/\bSCORE\s*\(\s*(Q\d+)\s*\)/gi, 'SCORE_$1');
  str = str.replace(/\bCOUNT\s*\(\s*(Q\d+)\s*\)/gi, 'COUNT_$1');
  str = str.replace(/\bVISIBLE\s*\(\s*(Q\d+)\s*\)/gi, 'VISIBLE_$1');
  return str;
}

/**
 * 词法分词器：将公式字符串切分为 Token 序列（支持跨平台小程序沙箱环境，不依赖 eval/new Function）
 */
function tokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // 字符串字面量
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let s = '';
      i++;
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\' && i + 1 < str.length) {
          s += str[i + 1];
          i += 2;
        } else {
          s += str[i];
          i++;
        }
      }
      i++;
      tokens.push({ type: 'STRING', value: s });
      continue;
    }
    // 数值字面量
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(str[i + 1]))) {
      let numStr = '';
      while (i < str.length && (/\d/.test(str[i]) || str[i] === '.')) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }
    // 双字符操作符
    const two = str.substr(i, 2);
    if (['==', '!=', '<>', '>=', '<=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'OP', value: two === '<>' ? '!=' : two });
      i += 2;
      continue;
    }
    // 单字符操作符与标点
    if (['+', '-', '*', '/', '%', '>', '<', '=', '!'].includes(ch)) {
      tokens.push({ type: 'OP', value: ch === '=' ? '==' : ch });
      i++;
      continue;
    }
    if (['(', ')', '[', ']', ','].includes(ch)) {
      tokens.push({ type: 'PUNCT', value: ch });
      i++;
      continue;
    }
    // 标识符（变量名 / 函数名 / 关键字）
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = '';
      while (i < str.length && /[a-zA-Z0-9_$]/.test(str[i])) {
        id += str[i];
        i++;
      }
      tokens.push({ type: 'ID', value: id });
      continue;
    }
    i++;
  }
  return tokens;
}

/**
 * 递归下降语法解析器与执行器
 */
class FormulaParser {
  constructor(tokens, functions, ctx) {
    this.tokens = tokens;
    this.pos = 0;
    this.functions = functions;
    this.ctx = ctx || {};
  }

  peek() {
    return this.tokens[this.pos] || { type: 'EOF', value: '' };
  }

  next() {
    return this.tokens[this.pos++];
  }

  expect(val) {
    const tok = this.next();
    if (!tok || tok.value !== val) {
      throw new Error(`Expected "${val}", but found "${tok ? tok.value : 'EOF'}"`);
    }
    return tok;
  }

  parse() {
    if (this.tokens.length === 0) return null;
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.peek().type === 'OP' && this.peek().value === '||') {
      this.next();
      const right = this.parseLogicalAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseComparison();
    while (this.peek().type === 'OP' && this.peek().value === '&&') {
      this.next();
      const right = this.parseComparison();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAddSub();
    while (this.peek().type === 'OP' && ['==', '!=', '>', '<', '>=', '<='].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAddSub();
      switch (op) {
        case '==': left = (left == right); break;
        case '!=': left = (left != right); break;
        case '>':  left = (left > right); break;
        case '<':  left = (left < right); break;
        case '>=': left = (left >= right); break;
        case '<=': left = (left <= right); break;
      }
    }
    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const right = this.parseMulDiv();
      if (op === '+') {
        if (typeof left === 'number' && typeof right === 'number') {
          left = left + right;
        } else if (typeof left === 'boolean' || typeof right === 'boolean') {
          left = (Number(left) || 0) + (Number(right) || 0);
        } else if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right);
        } else {
          left = (Number(left) || 0) + (Number(right) || 0);
        }
      } else {
        left = (Number(left) || 0) - (Number(right) || 0);
      }
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseUnary();
    while (this.peek().type === 'OP' && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseUnary();
      if (op === '*') {
        left = (Number(left) || 0) * (Number(right) || 0);
      } else if (op === '/') {
        const d = Number(right);
        left = d === 0 ? 0 : (Number(left) || 0) / d;
      } else if (op === '%') {
        const d = Number(right);
        left = d === 0 ? 0 : (Number(left) || 0) % d;
      }
    }
    return left;
  }

  parseUnary() {
    const tok = this.peek();
    if (tok.type === 'OP' && (tok.value === '+' || tok.value === '-' || tok.value === '!')) {
      this.next();
      const val = this.parseUnary();
      if (tok.value === '+') return +val;
      if (tok.value === '-') return -val;
      if (tok.value === '!') return !val;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const tok = this.peek();

    // 括号
    if (tok.type === 'PUNCT' && tok.value === '(') {
      this.next();
      const val = this.parse();
      this.expect(')');
      return val;
    }

    // 数组字面量 [a, b, c]
    if (tok.type === 'PUNCT' && tok.value === '[') {
      this.next();
      const arr = [];
      if (this.peek().value !== ']') {
        arr.push(this.parse());
        while (this.peek().value === ',') {
          this.next();
          arr.push(this.parse());
        }
      }
      this.expect(']');
      return arr;
    }

    // 数字
    if (tok.type === 'NUMBER') {
      this.next();
      return tok.value;
    }

    // 字符串
    if (tok.type === 'STRING') {
      this.next();
      return tok.value;
    }

    // 标识符 (函数调用 / 变量 / 特殊值)
    if (tok.type === 'ID') {
      this.next();
      const name = tok.value;

      // 检查是否是函数调用
      if (this.peek().type === 'PUNCT' && this.peek().value === '(') {
        this.next();
        const args = [];
        if (this.peek().value !== ')') {
          args.push(this.parse());
          while (this.peek().value === ',') {
            this.next();
            args.push(this.parse());
          }
        }
        this.expect(')');

        const upperName = name.toUpperCase();
        const fn = this.functions[upperName] || this.functions[name];
        if (typeof fn === 'function') {
          return fn(...args);
        }
        console.warn(`[Formula] 未知函数: ${name}`);
        return null;
      }

      // 常量字面量
      const upper = name.toUpperCase();
      if (upper === 'TRUE') return true;
      if (upper === 'FALSE') return false;
      if (upper === 'NULL') return null;
      if (upper === 'UNDEFINED') return undefined;

      // 变量上下文查询
      if (Object.prototype.hasOwnProperty.call(this.ctx, name)) {
        return this.ctx[name];
      }
      if (Object.prototype.hasOwnProperty.call(this.ctx, upper)) {
        return this.ctx[upper];
      }
      if (/^Q\d+A\d+$/i.test(name)) return false;
      if (/^Q\d+$/i.test(name)) return null;

      return null;
    }

    throw new Error(`Unexpected token "${tok.value}" of type ${tok.type}`);
  }
}

/**
 * 核心执行器：执行一条公式并返回结果
 * 采用纯 JavaScript 递归下降解释器，彻底规避微信小程序对 eval 和 new Function 的沙箱限制
 * @param {string} formulaStr 公式文本，如 COUNTIF([Q1A2,Q2A2],TRUE)
 * @param {Object} ctx 变量上下文
 * @returns {*} 计算结果
 */
function evaluateFormula(formulaStr, ctx = {}) {
  if (!formulaStr || typeof formulaStr !== 'string') return null;
  const trimmed = formulaStr.trim();
  if (!trimmed) return null;

  try {
    const prepared = normalizeFormulas(trimmed);
    const tokens = tokenize(prepared);
    const parser = new FormulaParser(tokens, FUNCTIONS, ctx);
    const result = parser.parse();
    return result;
  } catch (err) {
    // 降级与容错：如果执行出错，返回 null 并打印调试日志
    console.warn(`[Formula] 计算失败: "${formulaStr}"`, err);
    return null;
  }
}

/**
 * 校验规则执行器：计算 validateRule 是否通过
 * @param {string} rule 公式规则字符串，例如：IF(SUM(...) >= 1) 或 SUM(...) >= 1 或 IF(Q1>0, "", "错误")
 * @param {Object} ctx 上下文
 * @returns {{ valid: boolean, message?: string }}
 */
function evaluateValidateRule(rule, ctx = {}) {
  if (!rule || typeof rule !== 'string') return { valid: true };
  const res = evaluateFormula(rule, ctx);

  // 1. 若返回字符串：空字符串视为通过，非空字符串为错误提示（SurveyKing 常见写法 IF(Q1>0,"","错误")）
  if (typeof res === 'string') {
    if (res.trim() === '') return { valid: true };
    return { valid: false, message: res };
  }

  // 2. 若返回 boolean：true 为通过，false 为不通过
  if (typeof res === 'boolean') {
    return { valid: res };
  }

  // 3. 若返回数字：>0 视为通过，<=0 视为不通过
  if (typeof res === 'number') {
    return { valid: res > 0 };
  }

  // 其他情况（如 null/undefined 或异常）默认为通过
  return { valid: true };
}

/**
 * 显示逻辑执行器：计算 visibleRule 是否应显示
 * @param {string} rule visibleRule 规则
 * @param {Object} ctx 上下文
 * @returns {boolean} true: 显示, false: 隐藏
 */
function evaluateVisibleRule(rule, ctx = {}) {
  if (!rule || typeof rule !== 'string') return true;
  const res = evaluateFormula(rule, ctx);
  if (typeof res === 'boolean') return res;
  if (typeof res === 'number') return res > 0;
  if (typeof res === 'string') return res !== '' && res !== '0' && res.toLowerCase() !== 'false';
  return Boolean(res);
}

/**
 * 渲染富文本中内嵌的公式，如 Remark 中的 <span class="ql-formula" data-value="SUM(Q1~Q11)">...</span>
 * 采用嵌套深度扫描，完整剥除 katex 及其所有子 DOM
 * @param {string} html 富文本 HTML
 * @param {Object} ctx 变量上下文
 * @returns {string} 替换后的 HTML / 文本
 */
function renderFormulaHtml(html, ctx = {}) {
  if (!html || typeof html !== 'string') return html;

  let out = '';
  let i = 0;
  const marker = '<span class="ql-formula"';

  while (i < html.length) {
    const start = html.indexOf(marker, i);
    if (start === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, start);
    const tagEnd = html.indexOf('>', start);
    if (tagEnd === -1) {
      out += html.slice(start);
      break;
    }

    const tagHeader = html.slice(start, tagEnd + 1);
    const valMatch = tagHeader.match(/data-value="([^"]+)"/i);
    const formulaVal = valMatch ? valMatch[1] : '';

    // 通过统计嵌套的 <span 和 </span> 深度精准定位闭合标签
    let depth = 1;
    let cur = tagEnd + 1;
    while (cur < html.length && depth > 0) {
      const openIdx = html.indexOf('<span', cur);
      const closeIdx = html.indexOf('</span>', cur);
      if (closeIdx === -1) {
        cur = html.length;
        break;
      }
      if (openIdx !== -1 && openIdx < closeIdx) {
        depth++;
        cur = openIdx + 5;
      } else {
        depth--;
        cur = closeIdx + 7;
      }
    }

    // 解码 HTML 实体并求值
    const decodedFormula = formulaVal
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    const val = evaluateFormula(decodedFormula, ctx);
    const displayVal = (val === null || val === undefined) ? '0' : String(val);
    out += `<span class="ql-formula-result" style="font-weight:bold;color:#1890ff;padding:0 4px;">${displayVal}</span>`;
    i = cur;
  }

  return out;
}

module.exports = {
  FUNCTIONS,
  buildVariableContext,
  normalizeFormulas,
  evaluateFormula,
  evaluateValidateRule,
  evaluateVisibleRule,
  renderFormulaHtml
};

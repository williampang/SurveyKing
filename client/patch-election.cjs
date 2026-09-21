/**
 * 选举菜单/页面补丁脚本（路线 A）
 *
 * 作用对象：server/api/src/main/resources/static/ 下的 UmiJS 编译产物。
 * 1. umi.cc68a383.js        ：新增 /survey/:id/election 子路由（懒加载自制 chunk 90001）；
 *                             chunk hashMap 增加 90001 条目；chunk 266 指向重命名后的 p__survey 文件。
 * 2. p__survey.0f24b26a.async.js：tab 白名单增加 election；左侧导航插入“选举”菜单项。
 * 3. 新增 90001.<hash>.async.js ：路由组件 = 铺满内容区的 iframe（srcdoc 骨架加载 /election.js、/election.css）。
 * 4. index.html             ：入口 umi.<hash>.js 改名同步（破 24h 静态缓存）。
 *
 * 说明：后台 WebConfig 的兜底 @GetMapping 会吞掉 *.html 请求，故选举页不走独立 html 文件，
 * 而是 iframe srcdoc + 白名单扩展名（.js/.css）静态资源。
 * 脚本可重复执行：始终从原始文件（umi.cc68a383.js / p__survey.0f24b26a.async.js）重新生成。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const staticDir = path.resolve(__dirname, '../server/api/src/main/resources/static');
const UMI_SRC = 'umi.cc68a383.js';
const SURVEY_SRC = 'p__survey.0f24b26a.async.js';
const CHUNK_ID = 90001;

const md5 = (text) => crypto.createHash('md5').update(text).digest('hex').slice(0, 8);

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`[patch-election] ${label}: 期望 1 处匹配，实际 ${count} 处`);
  }
  return source.replace(from, to);
}

function cleanupStale(pattern, keep) {
  const regex = new RegExp(pattern);
  fs.readdirSync(staticDir).forEach((name) => {
    if (regex.test(name) && !keep.includes(name)) {
      fs.unlinkSync(path.join(staticDir, name));
      console.log(`清理旧产物: ${name}`);
    }
  });
}

// ---------- 1. 选举页资源版本号（用于 iframe 内静态资源破缓存） ----------
const electionJs = fs.readFileSync(path.join(staticDir, 'election.js'), 'utf8');
const electionCss = fs.readFileSync(path.join(staticDir, 'election.css'), 'utf8');
const assetVersion = md5(electionJs + electionCss);

// ---------- 2. 自制 webpack chunk 90001（iframe 路由组件） ----------
const chunkContent = String.raw`(self["webpackChunksurvey_king"]=self["webpackChunksurvey_king"]||[]).push([[${CHUNK_ID}],{${CHUNK_ID}:function(e,a,n){"use strict";n.r(a);n.d(a,{default:function(){return c}});var t=n(4637),s="${assetVersion}";function c(){var e=window.location.pathname.split("/").filter(Boolean),a=new URLSearchParams(window.location.search).get("mode")||"survey",c={id:e[1]||"",mode:a,v:s},l="<html><head><meta charset=\"UTF-8\"/><link rel=\"stylesheet\" href=\"/election.css?v="+s+"\"/></head><body><div id=\"election-root\"><div class=\"elec-loading\">加载选举数据中...</div></div><script>window.ELECTION_CTX="+JSON.stringify(c).replace(/</g,"\\u003c")+";</script><script src=\"/election.js?v="+s+"\"></script></body></html>";return(0,t.jsx)("iframe",{title:"\u9009\u4e3e",srcDoc:l,style:{width:"100%",height:"100%",border:"none",display:"block",background:"#f0f2f5"}})}}}]);`;
const chunkHash = md5(chunkContent);
const chunkName = `${CHUNK_ID}.${chunkHash}.async.js`;

// ---------- 3. 补丁 p__survey chunk（左菜单） ----------
const surveySource = fs.readFileSync(path.join(staticDir, SURVEY_SRC), 'utf8');
let surveyPatched = replaceOnce(
  surveySource,
  '["edit","poster","setting","flow","data","report"].includes(e)',
  '["edit","poster","setting","flow","data","report","election"].includes(e)',
  'p__survey tab 白名单'
);
surveyPatched = replaceOnce(
  surveyPatched,
  '(0,S.jsx)("div",{className:"action-item",children:(0,S.jsx)("a",{className:"action-label",',
  // 注意：NavigatorPanel 作用域内局部变量 n（问卷路径）遮蔽了 webpack require，
  // 不能写 n(31629) 取图标模块；改用内联 SVG（antd CheckOutlined 路径）作为 icon。
  '(0,S.jsx)("div",{className:"action-item",children:(0,S.jsx)(Z.rU,{to:"".concat(n,"/election?mode=").concat(c),className:w()("action-label",{active:"election"===h,disabled:"new"===a}),children:(0,S.jsx)(u.Z,{type:"text",shape:"circle",icon:(0,S.jsx)("svg",{viewBox:"64 64 896 896",width:"1em",height:"1em",fill:"currentColor",children:(0,S.jsx)("path",{d:"M912 190h-63.6c-10.7 0-20.9 5-27.4 13.5L430 674.3 283 487.2A34.9 34.9 0 00255.6 474H192c-7.1 0-11 8.2-6.6 13.7l217.2 273.9c14 17.6 40.8 17.6 54.8 0l461.2-557.9c4.4-5.5.5-13.7-6.6-13.7z"})}),size:"large",children:"\\u9009\\u4e3e"})})}),(0,S.jsx)("div",{className:"action-item",children:(0,S.jsx)("a",{className:"action-label",',
  'p__survey 选举菜单项'
);
const surveyHash = md5(surveyPatched);
const surveyName = `p__survey.${surveyHash}.async.js`;

// ---------- 4. 补丁 umi.js（路由 + chunk hashMap + 266 重命名） ----------
const umiSource = fs.readFileSync(path.join(staticDir, UMI_SRC), 'utf8');
const routeAnchor = '{path:"/survey/:id/report"';
const routeStart = umiSource.indexOf(routeAnchor);
if (routeStart === -1) throw new Error('[patch-election] 未找到 /survey/:id/report 路由锚点');
const routeEndMark = 'exact:!0}';
const routeEnd = umiSource.indexOf(routeEndMark, routeStart);
if (routeEnd === -1 || routeEnd - routeStart > 3000) {
  throw new Error('[patch-election] 路由锚点后方未找到 exact:!0} 结束符');
}
const routeInsertAt = routeEnd + routeEndMark.length;
const electionRoute = ',{path:"/survey/:id/election",name:"survey-election",icon:"smile",component:(0,Ue.dynamic)({loader:function(){return r.e(' + CHUNK_ID + ').then(r.bind(r,' + CHUNK_ID + '))},loading:at.Z}),exact:!0}';
let umiPatched = umiSource.slice(0, routeInsertAt) + electionRoute + umiSource.slice(routeInsertAt);

umiPatched = replaceOnce(
  umiPatched,
  '9890:"5a3b890a"}',
  `9890:"5a3b890a",${CHUNK_ID}:"${chunkHash}"}`,
  'umi chunk hashMap 增加 90001'
);
umiPatched = replaceOnce(
  umiPatched,
  '266:"0f24b26a"',
  `266:"${surveyHash}"`,
  'umi chunk hashMap 重命名 266'
);
const umiHash = md5(umiPatched);
const umiName = `umi.${umiHash}.js`;

// ---------- 5. index.html 入口引用同步 ----------
const indexSource = fs.readFileSync(path.join(staticDir, 'index.html'), 'utf8');
const indexMatches = indexSource.match(/\/umi\.[a-f0-9]{8}\.js/g) || [];
if (indexMatches.length !== 1) {
  throw new Error(`[patch-election] index.html 期望 1 处 umi 引用，实际 ${indexMatches.length} 处`);
}
const indexPatched = indexSource.replace(/\/umi\.[a-f0-9]{8}\.js/, `/${umiName}`);

// ---------- 6. 写盘 ----------
cleanupStale('^90001\\.[a-f0-9]{8}\\.async\\.js$', [chunkName]);
cleanupStale('^p__survey\\.[a-f0-9]{8}\\.async\\.js$', [SURVEY_SRC, surveyName]);
cleanupStale('^umi\\.[a-f0-9]{8}\\.js$', [UMI_SRC, umiName]);

fs.writeFileSync(path.join(staticDir, chunkName), chunkContent);
fs.writeFileSync(path.join(staticDir, surveyName), surveyPatched);
fs.writeFileSync(path.join(staticDir, umiName), umiPatched);
fs.writeFileSync(path.join(staticDir, 'index.html'), indexPatched);

console.log('补丁完成：');
console.log(`  新增 ${chunkName}   (选举路由组件 iframe)`);
console.log(`  新增 ${surveyName}   (左菜单 + tab 白名单)`);
console.log(`  新增 ${umiName}   (路由表 + chunk hashMap)`);
console.log('  更新 index.html   (入口脚本引用)');
console.log(`  选举页资源版本 v=${assetVersion} (election.js/election.css)`);
console.log('服务器部署时需删除的旧文件：');
console.log(`  ${UMI_SRC}`);
console.log(`  ${SURVEY_SRC}`);

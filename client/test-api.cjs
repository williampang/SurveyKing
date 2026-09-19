const crypto = require('crypto');

async function test() {
  const sys = await (await fetch('http://127.0.0.1:4173/api/system')).json();
  const pem = `-----BEGIN PUBLIC KEY-----\n${sys.data.publicKey}\n-----END PUBLIC KEY-----`;
  const enc = crypto.publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from('123456')).toString('base64');
  const loginRes = await fetch('http://127.0.0.1:4173/api/public/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: enc }),
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  
  const endpoints = [
    '/api/project/list?current=1&pageSize=10',
    '/api/exercise/list?current=1&pageSize=10',
    '/api/repo/list?current=1&pageSize=10',
    '/api/template/list?current=1&pageSize=10',
    '/api/system/user/list?current=1&pageSize=10',
    '/api/system/role/list?current=1&pageSize=10',
    '/api/system/dept/list?current=1&pageSize=10',
    '/api/system/position/list?current=1&pageSize=10',
    '/api/system/dict/list?current=1&pageSize=10',
  ];

  for (const ep of endpoints) {
    const pRes = await fetch('http://127.0.0.1:4173/api/project?id=tmjWKk', { headers: { Cookie: cookie } });
    const pData = (await pRes.json()).data;
    const setting = pData.setting || {};
    if (!setting.answerSetting) setting.answerSetting = {};
    setting.answerSetting.whitelistLimit = { limitNum: 1 };

    const res = await fetch('http://127.0.0.1:4173/api/project/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        id: 'tmjWKk',
        setting: setting
      })
    });
    console.log('Update setting status:', res.status, await res.text());
    break;
  }
}

test();

import { API_BASE, jsonRequest, request } from '../shared/api.js';
import { JSEncrypt } from '../shared/jsencrypt.js';

const form = document.querySelector('#login-form');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const message = document.querySelector('#login-message');
const submitButton = document.querySelector('#submit-button');
const brandName = document.querySelector('#brand-name');
const brandDescription = document.querySelector('#brand-description');
const registerPrompt = document.querySelector('#register-prompt');

document.querySelectorAll('a[href^="/"]').forEach((link) => {
  link.href = `${window.location.origin}${link.getAttribute('href')}`;
});

function encryptPassword(password, publicKey) {
  const encryptor = new JSEncrypt({ log: false });
  encryptor.setPublicKey(publicKey);
  const encrypted = encryptor.encrypt(password);
  if (!encrypted) throw new Error('密码加密失败');
  return encrypted;
}

async function getPublicKey() {
  const data = await request('/system');
  if (!data.publicKey) throw new Error('系统未返回登录公钥');
  brandName.textContent = data.name || brandName.textContent;
  brandDescription.textContent = data.description || brandDescription.textContent;
  registerPrompt.hidden = data.registerInfo?.registerEnabled !== true;
  return data.publicKey;
}

async function login(username, password) {
  const publicKey = await getPublicKey();
  await jsonRequest('/public/login', {
    username,
    password: await encryptPassword(password, publicKey),
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  if (!usernameInput.value.trim() || !passwordInput.value) {
    message.textContent = '请输入用户名和密码';
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = '登录中...';
  try {
    await login(usernameInput.value.trim(), passwordInput.value);
    window.location.assign(`${API_BASE}/home`);
  } catch (error) {
    message.textContent = error.message || '登录失败，请稍后重试';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '登录';
  }
});
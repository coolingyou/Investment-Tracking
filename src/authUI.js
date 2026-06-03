/**
 * 认证 UI 模块 — 登录 / 注册 / 忘记密码 界面
 */
import { signIn, signUp, signInWithOAuth, sendPasswordReset, signOut } from './auth.js';

/* 状态 */
var authMode = 'login'; // login | register | forgot
var authCallback = null;

/* 显示认证页面，隐藏主应用 */
export function showAuth(parentCallback) {
  authCallback = parentCallback;
  var app = document.getElementById('app');
  var authEl = document.getElementById('authPage');
  if (authEl) authEl.style.display = 'flex';
  if (app) app.style.display = 'none';
}

/* 隐藏认证页面，显示主应用 */
export function hideAuth() {
  var app = document.getElementById('app');
  var authEl = document.getElementById('authPage');
  if (authEl) authEl.style.display = 'none';
  if (app) app.style.display = 'block';
}

/* 切换模式 */
function setAuthMode(mode) {
  authMode = mode;
  var formTitle = document.getElementById('authFormTitle');
  var authBtn = document.getElementById('authSubmitBtn');
  var authToggle = document.getElementById('authToggle');
  var forgotLink = document.getElementById('forgotLink');
  var nameGroup = document.getElementById('authNameGroup');

  if (mode === 'login') {
    if (formTitle) formTitle.textContent = '登录账户';
    if (authBtn) authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
    if (authToggle) authToggle.innerHTML = '还没有账户？<a href="#" id="authToggleLink">立即注册</a>';
    if (forgotLink) forgotLink.style.display = 'block';
    if (nameGroup) nameGroup.style.display = 'none';
  } else if (mode === 'register') {
    if (formTitle) formTitle.textContent = '创建账户';
    if (authBtn) authBtn.innerHTML = '<i class="fas fa-user-plus"></i> 注册';
    if (authToggle) authToggle.innerHTML = '已有账户？<a href="#" id="authToggleLink">去登录</a>';
    if (forgotLink) forgotLink.style.display = 'none';
    if (nameGroup) nameGroup.style.display = 'block';
  } else if (mode === 'forgot') {
    if (formTitle) formTitle.textContent = '重置密码';
    if (authBtn) authBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 发送验证邮件';
    if (authToggle) authToggle.innerHTML = '想起密码了？<a href="#" id="authToggleLink">返回登录</a>';
    if (forgotLink) forgotLink.style.display = 'none';
    if (nameGroup) nameGroup.style.display = 'none';
  }

  // 重新绑定切换链接
  var link = document.getElementById('authToggleLink');
  if (link) {
    link.onclick = function (e) {
      e.preventDefault();
      setAuthMode(mode === 'login' ? 'register' : 'login');
    };
  }
  if (forgotLink) {
    forgotLink.onclick = function (e) {
      e.preventDefault();
      setAuthMode('forgot');
    };
  }

  // 清空消息
  var msg = document.getElementById('authMessage');
  if (msg) { msg.textContent = ''; msg.className = 'auth-message'; }
}

/* 提交表单 */
async function handleAuthSubmit() {
  var email = document.getElementById('authEmail');
  var password = document.getElementById('authPassword');
  var name = document.getElementById('authName');
  var msg = document.getElementById('authMessage');

  if (!msg) return;
  msg.textContent = '';
  msg.className = 'auth-message';

  try {
    if (authMode === 'login') {
      if (!email || !email.value.trim()) { msg.textContent = '请输入邮箱'; msg.className = 'auth-message error'; return; }
      if (!password || !password.value) { msg.textContent = '请输入密码'; msg.className = 'auth-message error'; return; }
      await signIn(email.value.trim(), password.value);
      if (authCallback) authCallback();
    } else if (authMode === 'register') {
      if (!email || !email.value.trim()) { msg.textContent = '请输入邮箱'; msg.className = 'auth-message error'; return; }
      if (!password || !password.value || password.value.length < 6) { msg.textContent = '密码至少 6 位'; msg.className = 'auth-message error'; return; }
      await signUp(email.value.trim(), password.value, name ? name.value.trim() : '');
      msg.textContent = '注册成功！请查收验证邮件完成激活。';
      msg.className = 'auth-message success';
      if (password) password.value = '';
    } else if (authMode === 'forgot') {
      if (!email || !email.value.trim()) { msg.textContent = '请输入邮箱'; msg.className = 'auth-message error'; return; }
      await sendPasswordReset(email.value.trim());
      msg.textContent = '重置密码邮件已发送，请查收。';
      msg.className = 'auth-message success';
    }
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'auth-message error';
  }
}

/** OAuth 登录 */
async function handleOAuth(provider) {
  var msg = document.getElementById('authMessage');
  if (msg) { msg.textContent = ''; msg.className = 'auth-message'; }
  try {
    await signInWithOAuth(provider);
    // redirect 后页面会刷新，不需要后续处理
  } catch (err) {
    if (msg) { msg.textContent = err.message; msg.className = 'auth-message error'; }
  }
}

/** 初始化认证页面 DOM */
export function initAuthUI() {
  // 如果已经注入过则跳过
  if (document.getElementById('authPage')) return;

  var authHtml = `
<div class="auth-page" id="authPage">
  <div class="auth-container">
    <div class="auth-header">
      <img src="https://cdn.jsdelivr.net/gh/coolingyou/Investment-Tracking@main/TT-logo-1.png" alt="TradeTracker" class="auth-logo-img" />
      <h1>TradeTracker</h1>
      <p>美股投资分析平台</p>
    </div>
    <div class="auth-card">
      <h2 id="authFormTitle">登录账户</h2>
      <div class="auth-social">
        <button class="auth-social-btn google" onclick="window._authOAuth('google')">
          <i class="fab fa-google"></i> Google
        </button>
        <button class="auth-social-btn microsoft" onclick="window._authOAuth('microsoft')">
          <i class="fab fa-microsoft"></i> Microsoft
        </button>
        <button class="auth-social-btn facebook" onclick="window._authOAuth('facebook')">
          <i class="fab fa-facebook"></i> Facebook
        </button>
      </div>
      <div class="auth-divider"><span>或使用邮箱</span></div>
      <div class="auth-form">
        <div class="auth-field" id="authNameGroup" style="display:none;">
          <label>昵称</label>
          <input type="text" id="authName" placeholder="如何称呼您？" />
        </div>
        <div class="auth-field">
          <label>邮箱</label>
          <input type="email" id="authEmail" placeholder="your@email.com" />
        </div>
        <div class="auth-field">
          <label>密码</label>
          <input type="password" id="authPassword" placeholder="输入密码" />
        </div>
        <div class="auth-message" id="authMessage"></div>
        <button class="auth-submit-btn" id="authSubmitBtn"><i class="fas fa-sign-in-alt"></i> 登录</button>
        <div class="auth-toggle" id="authToggle">
          还没有账户？<a href="#" id="authToggleLink">立即注册</a>
        </div>
        <a href="#" id="forgotLink" class="auth-forgot">忘记密码？</a>
      </div>
    </div>
  </div>
</div>`;

  var div = document.createElement('div');
  div.innerHTML = authHtml;
  document.body.insertBefore(div.firstElementChild, document.body.firstChild);

  // 事件绑定
  document.getElementById('authSubmitBtn').addEventListener('click', function (e) {
    e.preventDefault();
    handleAuthSubmit();
  });

  // 回车提交
  document.querySelectorAll('#authPage input').forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleAuthSubmit();
    });
  });

  // 暴露 OAuth handler 到 window
  window._authOAuth = handleOAuth;

  setAuthM
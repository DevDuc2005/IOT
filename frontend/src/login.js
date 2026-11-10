import { api } from './common.js';

let isSetup = false;

const form = document.getElementById('auth-form');
const nameField = document.getElementById('name-field');
const nameInput = document.getElementById('name-input');
const emailLabel = document.getElementById('email-label');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const togglePasswordBtn = document.getElementById('toggle-password-btn');
const errorBox = document.getElementById('auth-error');
const submitBtn = document.getElementById('submit-btn');

// Kiểm tra trạng thái hệ thống & phiên đăng nhập
async function checkStatus() {
  try {
    const status = await api('/auth/status');
    isSetup = !!status.setupRequired;

    // Nếu đã đăng nhập rồi thì chuyển thẳng về trang Tổng quan
    try {
      await api('/profile');
      window.location.href = '/';
      return;
    } catch {
      // Chưa đăng nhập -> hiển thị form
    }

    if (isSetup) {
      nameField.style.display = 'block';
      nameInput.required = true;
      emailLabel.textContent = 'Email';
      emailInput.type = 'email';
      passwordInput.minLength = 8;
      passwordInput.autocomplete = 'new-password';
      submitBtn.textContent = 'Tạo tài khoản';
    }
  } catch (err) {
    showError(err.message);
  }
}

function showError(msg) {
  if (!msg) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
    return;
  }
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

// Ẩn / hiện mật khẩu
togglePasswordBtn.addEventListener('click', () => {
  const visible = passwordInput.type === 'text';
  passwordInput.type = visible ? 'password' : 'text';
  togglePasswordBtn.title = visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu';
});

// Gửi biểu mẫu đăng nhập hoặc tạo tài khoản đầu tiên
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang xử lý…';

  const payload = Object.fromEntries(new FormData(form));
  try {
    await api(isSetup ? '/auth/setup' : '/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    window.location.href = '/';
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = isSetup ? 'Tạo tài khoản' : 'Đăng nhập';
  }
});

checkStatus();


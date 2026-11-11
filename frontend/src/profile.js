import { api, escapeHtml, initDashboardLayout } from './common.js';

let profile = null;
let draftAvatar = '';

const avatarEl = document.getElementById('profile-avatar');
const nameEl = document.getElementById('profile-name');
const accountEl = document.getElementById('profile-account');
const roleEl = document.getElementById('profile-role');
const messageEl = document.getElementById('profile-message');

const viewBox = document.getElementById('profile-view');
const editForm = document.getElementById('profile-edit-form');
const editFieldset = document.getElementById('profile-edit-fieldset');
const btnEdit = document.getElementById('btn-edit-profile');
const btnCancel = document.getElementById('btn-cancel-edit');
const avatarFileInput = document.getElementById('avatar-file-input');
const btnRemoveAvatar = document.getElementById('btn-remove-avatar');

const editName = document.getElementById('edit-name');
const editUsername = document.getElementById('edit-username');
const editEmail = document.getElementById('edit-email');
const editPhone = document.getElementById('edit-phone');
const editGithub = document.getElementById('edit-github');
const editFigma = document.getElementById('edit-figma');
const editArchitecture = document.getElementById('edit-architecture');
const editPdf = document.getElementById('edit-pdf');

function showMessage(text) {
  if (!text) {
    messageEl.style.display = 'none';
    messageEl.textContent = '';
    return;
  }
  messageEl.textContent = text;
  messageEl.style.display = 'block';
}

function renderAvatar(avatarSrc, fallbackName) {
  if (avatarSrc) {
    avatarEl.innerHTML = `<img src="${escapeHtml(avatarSrc)}" alt="Ảnh đại diện" />`;
  } else {
    avatarEl.textContent = (fallbackName || 'U').charAt(0).toUpperCase();
  }
}

function renderLink(containerId, url) {
  const el = document.getElementById(containerId);
  if (url) {
    el.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Mở liên kết ↗</a>`;
  } else {
    el.innerHTML = `<span>Chưa thêm liên kết</span>`;
  }
}

function renderProfile() {
  if (!profile) return;
  renderAvatar(profile.avatar, profile.name);
  nameEl.textContent = profile.name;
  accountEl.textContent = profile.username || profile.email;
  roleEl.textContent = profile.role;

  document.getElementById('view-name').textContent = profile.name;
  document.getElementById('view-username').textContent =
    profile.username || 'Dùng email để đăng nhập';
  document.getElementById('view-email').textContent = profile.email;
  document.getElementById('view-phone').textContent = profile.phone || 'Chưa cập nhật';
  document.getElementById('view-role').textContent = profile.role;

  renderLink('view-github', profile.github);
  renderLink('view-figma', profile.figma);
  renderLink('view-architecture', profile.architecture);
  renderLink('view-pdf', profile.pdf || '/bao-cao-iot.pdf');
}

function openEditMode() {
  if (!profile) return;
  showMessage('');
  draftAvatar = profile.avatar || '';
  editName.value = profile.name || '';
  editUsername.value = profile.username || '';
  editEmail.value = profile.email || '';
  editPhone.value = profile.phone || '';
  editGithub.value = profile.github || '';
  editFigma.value = profile.figma || '';
  editArchitecture.value = profile.architecture || '';
  editPdf.value = profile.pdf || '';

  btnRemoveAvatar.style.display = draftAvatar ? 'inline-flex' : 'none';
  viewBox.style.display = 'none';
  btnEdit.style.display = 'none';
  editForm.style.display = 'block';
}

function closeEditMode() {
  viewBox.style.display = 'block';
  btnEdit.style.display = 'inline-flex';
  editForm.style.display = 'none';
  if (profile) renderAvatar(profile.avatar, profile.name);
}

// Xử lý chọn và cắt vuông ảnh đại diện 256x256
async function handleChooseAvatar(file) {
  if (!file) return;
  showMessage('');

  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  ) {
    showMessage('Chọn ảnh JPG, PNG hoặc WebP không quá 5 MB.');
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);

    const size = Math.min(img.width, img.height);
    ctx.drawImage(
      img,
      (img.width - size) / 2,
      (img.height - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256
    );

    draftAvatar = canvas.toDataURL('image/jpeg', 0.88);
    renderAvatar(draftAvatar, editName.value || profile.name);
    btnRemoveAvatar.style.display = 'inline-flex';
  } catch {
    showMessage('Không đọc được ảnh. Hãy thử một ảnh khác.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Khởi chạy trang Hồ sơ cá nhân
async function startProfilePage() {
  const user = await initDashboardLayout();
  if (!user) return;

  profile = user;
  renderProfile();

  btnEdit.addEventListener('click', openEditMode);
  btnCancel.addEventListener('click', () => {
    showMessage('');
    closeEditMode();
  });

  avatarFileInput.addEventListener('change', (e) => {
    handleChooseAvatar(e.target.files?.[0]);
    e.target.value = '';
  });

  btnRemoveAvatar.addEventListener('click', () => {
    draftAvatar = '';
    btnRemoveAvatar.style.display = 'none';
    renderAvatar('', editName.value || profile.name);
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage('');
    editFieldset.disabled = true;

    try {
      const payload = {
        name: editName.value,
        username: editUsername.value,
        email: editEmail.value,
        phone: editPhone.value,
        github: editGithub.value,
        figma: editFigma.value,
        architecture: editArchitecture.value,
        pdf: editPdf.value,
        avatar: draftAvatar,
      };
      profile = await api('/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      renderProfile();
      closeEditMode();
      showMessage('Đã lưu thông tin và ảnh đại diện.');
    } catch (err) {
      showMessage(err.message);
    } finally {
      editFieldset.disabled = false;
    }
  });

  // Ẩn / hiện mật khẩu ở phần đổi mật khẩu
  document.querySelectorAll('.password-eye[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      input.type = input.type === 'text' ? 'password' : 'text';
    });
  });

  // Đổi mật khẩu
  const passwordForm = document.getElementById('password-form');
  const passwordFieldset = document.getElementById('password-fieldset');
  const passwordMsg = document.getElementById('password-message');
  const btnChangePw = document.getElementById('btn-change-password');

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordMsg.style.display = 'none';

    const currentPassword = document.getElementById('cur-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      passwordMsg.textContent = 'Mật khẩu xác nhận không khớp.';
      passwordMsg.style.display = 'block';
      return;
    }

    passwordFieldset.disabled = true;
    btnChangePw.textContent = 'Đang xử lý…';

    try {
      await api('/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      passwordForm.reset();
      passwordMsg.textContent =
        'Đã đổi mật khẩu. Vui lòng đăng nhập lại bằng mật khẩu mới.';
      passwordMsg.style.display = 'block';
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 1500);
    } catch (err) {
      passwordMsg.textContent = err.message;
      passwordMsg.style.display = 'block';
      passwordFieldset.disabled = false;
      btnChangePw.textContent = 'Đổi mật khẩu';
    }
  });
}

startProfilePage();


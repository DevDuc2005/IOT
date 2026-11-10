const API_BASE = '/api';

// Gửi request HTTP (GET/POST/PUT/DELETE) đến API backend và tự động xử lý kết quả JSON
export async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Yêu cầu thất bại');
  }
  return data;
}

// Định dạng thời gian theo múi giờ Việt Nam (dd/mm/yyyy hh:mm:ss)
export function formatTime(value) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Thời gian không hợp lệ';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (key) => parts.find((p) => p.type === key)?.value;
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// Tính danh sách các số trang cần hiển thị trên thanh phân trang (pagination)
export function buildPageNumbers(page, pages) {
  return [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((n) => n > 0 && n <= pages)
    .sort((a, b) => a - b);
}

// Mã hóa ký tự đặc biệt để chống tấn công XSS khi render dữ liệu ra HTML
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Hiển thị thông báo nổi (toast message) ở góc dưới màn hình
let toastTimer = null;
export function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    toast.style.display = 'none';
    document.body.appendChild(toast);
  }

  if (!message) {
    toast.style.display = 'none';
    return;
  }

  toast.innerHTML = `
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="m9 12 2 2 4-4"></path>
    </svg>
    <span>${escapeHtml(message)}</span>
    <button type="button" id="toast-close-btn" aria-label="Đóng">✕</button>
  `;
  toast.style.display = 'flex';
  toast.querySelector('#toast-close-btn')?.addEventListener('click', () => {
    toast.style.display = 'none';
  });

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.display = 'none';
  }, 5500);
}

// Khởi tạo bố cục chung của Dashboard: kiểm tra đăng nhập, menu mobile, đăng xuất và trạng thái hệ thống
export async function initDashboardLayout() {
  try {
    const user = await api('/profile');

    // Khởi tạo đóng/mở menu trên điện thoại
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const openBtn = document.getElementById('mobile-open-btn');
    const closeBtn = document.getElementById('mobile-close-btn');

    const closeMobile = () => {
      sidebar?.classList.remove('show');
      if (overlay) overlay.style.display = 'none';
    };

    openBtn?.addEventListener('click', () => {
      sidebar?.classList.add('show');
      if (overlay) overlay.style.display = 'block';
    });
    closeBtn?.addEventListener('click', closeMobile);
    overlay?.addEventListener('click', closeMobile);

    // Xử lý nút Đăng xuất
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
      } catch (err) {
        showToast(err.message);
      }
    });

    // Cập nhật nhãn chế độ (DỮ LIỆU MÔ PHỎNG / DỮ LIỆU THỰC) trên Sidebar
    const modeLabel = document.getElementById('sidebar-mode-label');
    if (modeLabel) {
      api('/system/status')
        .then((sys) => {
          modeLabel.textContent = sys.mode === 'DEMO' ? 'DỮ LIỆU MÔ PHỎNG' : 'DỮ LIỆU THỰC';
        })
        .catch(() => { });
    }

    return user;
  } catch {
    window.location.href = '/login.html';
    return null;
  }
}

// Gắn sự kiện click sao chép thời gian vào clipboard cho các nút copy trong bảng
export function bindCopyTimeButtons(container) {
  container.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-time') || '';
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(() => {
        const oldHtml = btn.innerHTML;
        btn.textContent = '✓';
        setTimeout(() => {
          btn.innerHTML = oldHtml;
        }, 1500);
      });
    });
  });
}

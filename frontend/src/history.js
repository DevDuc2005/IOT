import { io } from 'socket.io-client';
import {
  api,
  bindCopyTimeButtons,
  buildPageNumbers,
  escapeHtml,
  formatTime,
  initDashboardLayout,
} from './common.js';

const RESULT_LABELS = {
  LOADING: 'LOADING',
  PENDING: 'LOADING',
  ON: 'ON',
  OFF: 'OFF',
  TIMEOUT: 'Hết thời gian chờ',
  ERROR: 'Lỗi',
};

let page = 1;
let limit = 5;
let total = 0;
let pages = 1;
let filters = { led: '', action: '', result: '', time: '' };

const summaryEl = document.getElementById('records-summary');
const errorEl = document.getElementById('records-error');
const tbodyEl = document.getElementById('records-tbody');
const pagerInfoEl = document.getElementById('pager-info');
const pageButtonsEl = document.getElementById('page-buttons');

const filterForm = document.getElementById('filter-form');
const filterLed = document.getElementById('filter-led');
const filterAction = document.getElementById('filter-action');
const filterResult = document.getElementById('filter-result');
const filterTime = document.getElementById('filter-time');
const pageLimit = document.getElementById('page-limit');

// Tải dữ liệu lịch sử điều khiển từ API
async function loadHistory(silent = false) {
  errorEl.style.display = 'none';
  if (!silent) {
    tbodyEl.innerHTML = `<tr><td colspan="6" class="empty">Đang tải dữ liệu…</td></tr>`;
  }

  const params = new URLSearchParams({
    ...filters,
    page: String(page),
    limit: String(limit),
  });

  try {
    const data = await api('/devices/history?' + params);
    if (page > data.pages) {
      page = data.pages;
      return loadHistory(silent);
    }

    total = data.total;
    pages = data.pages;
    summaryEl.textContent = `${total.toLocaleString('vi-VN')} hoạt động phù hợp`;
    renderTable(data.items);
    renderPager();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    tbodyEl.innerHTML = `<tr><td colspan="6" class="empty">Không có dữ liệu phù hợp.</td></tr>`;
    total = 0;
    pages = 1;
    renderPager();
  }
}

// Hiển thị bảng lịch sử điều khiển
function renderTable(rows) {
  if (!rows.length) {
    tbodyEl.innerHTML = `<tr><td colspan="6" class="empty">Không có dữ liệu phù hợp.</td></tr>`;
    return;
  }

  tbodyEl.innerHTML = rows
    .map((r) => {
      const actionBadge = r.action === 'ON' ? 'on' : 'off';
      const actionText = r.action === 'ON' ? 'Bật' : 'Tắt';

      // Chuẩn hóa giá trị trạng thái: khi đang xử lý là LOADING, hoàn tất là ON hoặc OFF
      const normalizedResult =
        r.result === 'SUCCESS' || r.result === 'STATE_CONFIRMED'
          ? r.action
          : r.result === 'PENDING'
          ? 'LOADING'
          : r.result;

      const resultBadge =
        normalizedResult === 'ON'
          ? 'on'
          : normalizedResult === 'LOADING'
          ? 'light'
          : 'off';
      const resultText = RESULT_LABELS[normalizedResult] || normalizedResult;
      const resultContent =
        normalizedResult === 'LOADING'
          ? `<span class="spinner-ring"></span>&nbsp;${escapeHtml(resultText)}`
          : escapeHtml(resultText);
      const timeFormatted = formatTime(r.createdAt);

      return `
        <tr>
          <td>#${escapeHtml(r.id)}</td>
          <td><b>LED ${escapeHtml(r.led)}</b></td>
          <td>
            ${escapeHtml(r.user || 'Thiết bị / không xác định')}
            <small class="unit">${escapeHtml(r.source || '')}</small>
          </td>
          <td><span class="sensor-badge ${actionBadge}">${actionText}</span></td>
          <td><span class="sensor-badge ${resultBadge}">${resultContent}</span></td>
          <td>
            <span class="time-cell">
              ${escapeHtml(timeFormatted)}
              <button type="button" class="copy-btn" data-time="${escapeHtml(timeFormatted)}" title="Sao chép thời gian">⧉</button>
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  bindCopyTimeButtons(tbodyEl);
}

// Hiển thị thanh phân trang
function renderPager() {
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);
  pagerInfoEl.textContent = `Hiển thị ${from}–${to} / ${total}`;

  const nums = buildPageNumbers(page, pages);
  let html = `<button type="button" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>Trước</button>`;

  nums.forEach((n, idx) => {
    if (idx > 0 && n - nums[idx - 1] > 1) {
      html += `<span> … </span>`;
    }
    html += `<button type="button" data-page="${n}" class="${page === n ? 'selected' : ''}">${n}</button>`;
  });

  html += `<button type="button" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau</button>`;
  pageButtonsEl.innerHTML = html;

  pageButtonsEl.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = Number(btn.getAttribute('data-page'));
      if (target >= 1 && target <= pages && target !== page) {
        page = target;
        loadHistory();
      }
    });
  });
}

// Khởi chạy trang Lịch sử hoạt động
async function startHistoryPage() {
  const user = await initDashboardLayout();
  if (!user) return;

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    page = 1;
    filters = {
      led: filterLed.value,
      action: filterAction.value,
      result: filterResult.value,
      time: filterTime.value,
    };
    loadHistory();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    filterLed.value = '';
    filterAction.value = '';
    filterResult.value = '';
    filterTime.value = '';
    filters = { led: '', action: '', result: '', time: '' };
    page = 1;
    loadHistory();
  });

  document.getElementById('btn-reload').addEventListener('click', () => loadHistory());

  pageLimit.addEventListener('change', () => {
    limit = Number(pageLimit.value);
    page = 1;
    loadHistory();
  });

  // Lắng nghe Socket.IO để tự động cập nhật bảng khi trạng thái chuyển từ LOADING sang ON / OFF
  const socket = io('/', { path: '/socket.io' });
  socket.on('history', () => {
    loadHistory(true);
  });

  loadHistory();
}

startHistoryPage();

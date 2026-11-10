import {
  api,
  bindCopyTimeButtons,
  buildPageNumbers,
  escapeHtml,
  formatTime,
  initDashboardLayout,
} from './common.js';

const SENSOR_NAMES = {
  temperature: 'Nhiệt độ',
  humidity: 'Độ ẩm',
  light: 'Ánh sáng',
};

let page = 1;
let limit = 5;
let total = 0;
let pages = 1;
let filters = { type: '', value: '', time: '' };

const summaryEl = document.getElementById('records-summary');
const errorEl = document.getElementById('records-error');
const tbodyEl = document.getElementById('records-tbody');
const pagerInfoEl = document.getElementById('pager-info');
const pageButtonsEl = document.getElementById('page-buttons');

const filterForm = document.getElementById('filter-form');
const filterType = document.getElementById('filter-type');
const filterValue = document.getElementById('filter-value');
const filterTime = document.getElementById('filter-time');
const pageLimit = document.getElementById('page-limit');

// Tải dữ liệu cảm biến từ API
async function loadRecords() {
  errorEl.style.display = 'none';
  tbodyEl.innerHTML = `<tr><td colspan="5" class="empty">Đang tải dữ liệu…</td></tr>`;

  const params = new URLSearchParams({
    ...filters,
    page: String(page),
    limit: String(limit),
  });

  try {
    const data = await api('/sensors/records?' + params);
    if (page > data.pages) {
      page = data.pages;
      return loadRecords();
    }

    total = data.total;
    pages = data.pages;
    summaryEl.textContent = `${total.toLocaleString('vi-VN')} giá trị cảm biến phù hợp`;
    renderTable(data.items);
    renderPager();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    tbodyEl.innerHTML = `<tr><td colspan="5" class="empty">Không có dữ liệu phù hợp.</td></tr>`;
    total = 0;
    pages = 1;
    renderPager();
  }
}

// Hiển thị các dòng dữ liệu trong bảng
function renderTable(rows) {
  if (!rows.length) {
    tbodyEl.innerHTML = `<tr><td colspan="5" class="empty">Không có dữ liệu phù hợp.</td></tr>`;
    return;
  }

  tbodyEl.innerHTML = rows
    .map((r) => {
      const displayValue =
        r.type === 'light'
          ? r.value === 'LIGHT'
            ? 'SÁNG'
            : 'TỐI'
          : Number(r.value).toFixed(2);
      const unit =
        r.type === 'temperature'
          ? '°C'
          : r.type === 'humidity'
          ? '% RH'
          : 'Tín hiệu số DO';
      const timeFormatted = formatTime(r.createdAt);

      return `
        <tr>
          <td>#${escapeHtml(r.id)}</td>
          <td><span class="sensor-badge ${escapeHtml(r.type)}">${escapeHtml(SENSOR_NAMES[r.type] || r.type)}</span></td>
          <td>${escapeHtml(r.type)}</td>
          <td>
            <b>${escapeHtml(displayValue)}</b>
            <small class="unit">${unit}</small>
          </td>
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
        loadRecords();
      }
    });
  });
}

// Khởi chạy trang Giám sát cảm biến
async function startSensorsPage() {
  const user = await initDashboardLayout();
  if (!user) return;

  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    page = 1;
    filters = {
      type: filterType.value,
      value: filterValue.value,
      time: filterTime.value,
    };
    loadRecords();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    filterType.value = '';
    filterValue.value = '';
    filterTime.value = '';
    filters = { type: '', value: '', time: '' };
    page = 1;
    loadRecords();
  });

  document.getElementById('btn-reload').addEventListener('click', () => loadRecords());

  pageLimit.addEventListener('change', () => {
    limit = Number(pageLimit.value);
    page = 1;
    loadRecords();
  });

  loadRecords();
}

startSensorsPage();


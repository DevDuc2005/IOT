import { io } from 'socket.io-client';
import { api, initDashboardLayout, showToast } from './common.js';

let currentMetric = 'both';
let latestSensor = null;
let ledStatus = { led1: 'OFF', led2: 'OFF', led3: 'OFF', pendingCommand: '' };
let readings = [];
let commandBusy = false;
let localCommand = '';

const valTemp = document.getElementById('val-temperature');
const valHum = document.getElementById('val-humidity');
const valLight = document.getElementById('val-light');
const iconLight = document.getElementById('icon-light');
const chartSubtitle = document.getElementById('chart-subtitle');
const chartContainer = document.getElementById('chart-container');
const chartTabs = document.getElementById('chart-tabs');
const modeLabel = document.getElementById('sidebar-mode-label');

// Biểu tượng mặt trời / mặt trăng cho thẻ Ánh sáng
const SUN_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-15.07 7.07 1.41-1.41m11.32-11.32 1.41-1.41"></path></svg>`;
const MOON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;

// Cập nhật 3 thẻ cảm biến
function renderMetrics() {
  if (!latestSensor) {
    valTemp.textContent = '--';
    valHum.textContent = '--';
    valLight.textContent = '--';
    return;
  }
  valTemp.textContent = Number(latestSensor.temperature).toFixed(1) + '°C';
  valHum.textContent = Number(latestSensor.humidity).toFixed(1) + '%';
  valLight.textContent = latestSensor.light === 'LIGHT' ? 'SÁNG' : 'TỐI';
  iconLight.innerHTML = latestSensor.light === 'DARK' ? MOON_SVG : SUN_SVG;
}

// Kiểm tra đèn LED n có đang trong trạng thái LOADING hay không
function isLedLoading(n, activeCmd) {
  if (!activeCmd) return false;
  return activeCmd.startsWith('all ') || activeCmd.startsWith(`led ${n} `);
}

// Cập nhật trạng thái 3 đèn LED
function renderLeds() {
  const activeCmd = localCommand || ledStatus.pendingCommand || '';
  const anyBusy = commandBusy || !!activeCmd;

  [1, 2, 3].forEach((n) => {
    const isOn = ledStatus['led' + n] === 'ON';
    const loading = isLedLoading(n, activeCmd);
    const bulb = document.getElementById('bulb-' + n);
    const tag = document.getElementById('tag-' + n);
    const sw = document.getElementById('switch-' + n);

    bulb.className = 'bulb small' + (isOn ? ' lit' : '') + (loading ? ' bulb-loading' : '');
    if (loading) {
      tag.className = 'tag tag-loading';
      tag.innerHTML = `<span class="spinner-ring"></span>LOADING`;
      sw.className = 'switch switch-loading' + (isOn ? ' switch-on' : '');
      sw.innerHTML = `<span class="knob-spinner"></span>`;
    } else {
      tag.className = 'tag ' + (isOn ? 'tag-ok' : 'tag-bad');
      tag.innerHTML = `<span class="tag-dot"></span>${isOn ? 'ON' : 'OFF'}`;
      sw.className = 'switch' + (isOn ? ' switch-on' : '');
      sw.innerHTML = `<span></span>`;
    }
    sw.disabled = anyBusy;
  });

  document.getElementById('btn-all-on').disabled = anyBusy;
  document.getElementById('btn-all-off').disabled = anyBusy;
}

// Định dạng giờ:phút:giây cho trục hoành biểu đồ
function formatShortTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Vẽ biểu đồ môi trường bằng SVG chuẩn xác và mượt mà
function renderChart() {
  const subtitles = {
    both: '10 điểm gần nhất · Nhiệt độ (°C) và độ ẩm (%)',
    temperature: '10 điểm gần nhất · Nhiệt độ (°C)',
    humidity: '10 điểm gần nhất · Độ ẩm (%)',
    light: '10 điểm gần nhất · SÁNG = 1, TỐI = 0',
  };
  chartSubtitle.textContent = subtitles[currentMetric] || subtitles.both;

  const points = readings.slice(-10);
  if (!points.length) {
    chartContainer.innerHTML = `<div class="empty">Đang chờ dữ liệu từ thiết bị...</div>`;
    return;
  }

  const width = Math.max(chartContainer.clientWidth || 640, 320);
  const height = Math.max(chartContainer.clientHeight || 280, 220);
  const padLeft = 46;
  const padRight = currentMetric === 'both' ? 46 : 20;
  const padTop = 16;
  const padBottom = 56;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xAt = (i) =>
    points.length === 1 ? padLeft + plotW / 2 : padLeft + (i / (points.length - 1)) * plotW;

  const maxTempVal = Math.max(32, ...points.map((p) => Number(p.temperature) || 0));
  const tempMax = Math.ceil(maxTempVal / 8) * 8;

  // Các đường lưới ngang (5 mức)
  let gridSvg = '';
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = padTop + plotH - ratio * plotH;
    gridSvg += `<line x1="${padLeft}" y1="${y}" x2="${padLeft + plotW}" y2="${y}" stroke="#e9eef5" stroke-dasharray="3 5" />`;

    if (currentMetric === 'both') {
      const tVal = Math.round(ratio * tempMax);
      const hVal = Math.round(ratio * 100);
      gridSvg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#ef5350">${tVal}°C</text>`;
      gridSvg += `<text x="${padLeft + plotW + 8}" y="${y + 4}" text-anchor="start" font-size="11" fill="#089fbd">${hVal}%</text>`;
    } else if (currentMetric === 'temperature') {
      const tVal = Math.round(ratio * tempMax);
      gridSvg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#648096">${tVal}°C</text>`;
    } else if (currentMetric === 'humidity') {
      const hVal = Math.round(ratio * 100);
      gridSvg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#648096">${hVal}%</text>`;
    } else {
      if (i === 0 || i === 4) {
        const lVal = i === 4 ? '1' : '0';
        gridSvg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#648096">${lVal}</text>`;
      }
    }
  }

  // Khung trục
  gridSvg += `<line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#94a3b8" />`;
  gridSvg += `<line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#94a3b8" />`;
  if (currentMetric === 'both') {
    gridSvg += `<line x1="${padLeft + plotW}" y1="${padTop}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#94a3b8" />`;
  }

  // Nhãn thời gian trục X
  points.forEach((p, idx) => {
    if (points.length > 6 && idx % 2 !== 1 && idx !== points.length - 1) return;
    const x = xAt(idx);
    const label = formatShortTime(p.at || p.createdAt || idx);
    gridSvg += `<text x="${x}" y="${padTop + plotH + 18}" text-anchor="middle" font-size="11" fill="#648096">${label}</text>`;
  });

  // Hàm vẽ 1 đường biểu đồ + các điểm tròn rỗng
  function buildSeries(values, minVal, maxVal, color) {
    const coords = values.map((v, i) => {
      const clamped = Math.max(minVal, Math.min(maxVal, v));
      const y = padTop + plotH - ((clamped - minVal) / (maxVal - minVal || 1)) * plotH;
      return [xAt(i), y, v];
    });
    const pathD = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
    const dots = coords
      .map(
        ([x, y, v], i) =>
          `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="1.8"><title>${formatShortTime(points[i].at || points[i].createdAt)}: ${v}</title></circle>`
      )
      .join('');
    return `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" />${dots}`;
  }

  let seriesSvg = '';
  let legendHtml = '';

  if (currentMetric === 'both') {
    seriesSvg += buildSeries(
      points.map((p) => Number(p.temperature)),
      0,
      tempMax,
      '#f26b6b'
    );
    seriesSvg += buildSeries(
      points.map((p) => Number(p.humidity)),
      0,
      100,
      '#08b3d5'
    );
    legendHtml = `
      <div class="chart-legend">
        <span style="color:#f26b6b">○ Nhiệt độ (°C)</span>
        <span style="color:#08b3d5">○ Độ ẩm (%)</span>
      </div>
    `;
  } else if (currentMetric === 'temperature') {
    seriesSvg += buildSeries(
      points.map((p) => Number(p.temperature)),
      0,
      tempMax,
      '#f26b6b'
    );
    legendHtml = `<div class="chart-legend"><span style="color:#f26b6b">○ Nhiệt độ (°C)</span></div>`;
  } else if (currentMetric === 'humidity') {
    seriesSvg += buildSeries(
      points.map((p) => Number(p.humidity)),
      0,
      100,
      '#08b3d5'
    );
    legendHtml = `<div class="chart-legend"><span style="color:#08b3d5">○ Độ ẩm (%)</span></div>`;
  } else {
    seriesSvg += buildSeries(
      points.map((p) => (p.light === 'LIGHT' ? 1 : 0)),
      0,
      1,
      '#e6a21a'
    );
    legendHtml = `<div class="chart-legend"><span style="color:#e6a21a">○ Ánh sáng (0=TỐI, 1=SÁNG)</span></div>`;
  }

  chartContainer.innerHTML = `
    <svg width="100%" height="${height - 26}" viewBox="0 0 ${width} ${height - 26}">
      ${gridSvg}
      ${seriesSvg}
    </svg>
    ${legendHtml}
  `;
}

// Gửi lệnh điều khiển đèn LED (loading ~3s trước khi hoàn tất)
async function sendCommand(command) {
  if (commandBusy || ledStatus.pendingCommand) return;
  commandBusy = true;
  localCommand = command;
  renderLeds();

  try {
    const res = await api('/devices/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    if (res && res.status) {
      ledStatus = res.status;
    }
    showToast(
      res.mode === 'DEMO'
        ? 'Đã thực hiện (mô phỏng): ' + command
        : 'Đã thực hiện thành công: ' + command
    );
  } catch (err) {
    showToast(err.message);
  } finally {
    commandBusy = false;
    localCommand = '';
    renderLeds();
  }
}

// Khởi chạy trang Tổng quan
async function startOverview() {
  const user = await initDashboardLayout();
  if (!user) return;

  // Sự kiện chuyển tab biểu đồ
  chartTabs.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      chartTabs.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentMetric = btn.getAttribute('data-metric') || 'both';
      renderChart();
    });
  });

  // Sự kiện bật/tắt từng đèn & tất cả đèn
  [1, 2, 3].forEach((n) => {
    document.getElementById('switch-' + n).addEventListener('click', () => {
      const isOn = ledStatus['led' + n] === 'ON';
      sendCommand(`led ${n} ${isOn ? 'off' : 'on'}`);
    });
  });
  document.getElementById('btn-all-on').addEventListener('click', () => sendCommand('all on'));
  document.getElementById('btn-all-off').addEventListener('click', () => sendCommand('all off'));

  // Tải dữ liệu ban đầu
  try {
    const [sLatest, dStatus, sysStatus, sHistory] = await Promise.all([
      api('/sensors/latest'),
      api('/devices/status'),
      api('/system/status'),
      api('/sensors/history?limit=100'),
    ]);
    latestSensor = sLatest;
    ledStatus = dStatus;
    readings = sHistory.reverse();
    if (modeLabel && sysStatus) {
      modeLabel.textContent = sysStatus.mode === 'DEMO' ? 'DỮ LIỆU MÔ PHỎNG' : 'DỮ LIỆU THỰC';
    }
    renderMetrics();
    renderLeds();
    renderChart();
  } catch (err) {
    showToast(err.message);
  }

  // Kết nối Socket.IO nhận dữ liệu thời gian thực
  const socket = io('/', { path: '/socket.io' });
  socket.on('sensor', (data) => {
    latestSensor = data;
    readings = [...readings.slice(-99), data];
    renderMetrics();
    renderChart();
  });
  socket.on('status', (data) => {
    ledStatus = data;
    renderLeds();
  });
  socket.on('system', (sys) => {
    if (modeLabel && sys) {
      modeLabel.textContent = sys.mode === 'DEMO' ? 'DỮ LIỆU MÔ PHỎNG' : 'DỮ LIỆU THỰC';
    }
  });

  window.addEventListener('resize', () => renderChart());
}

startOverview();


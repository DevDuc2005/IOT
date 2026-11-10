// User input is Vietnamese local time (UTC+07), never the server's local zone.
export function timeWindow(value) {
  if (!value) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2})\/(\d{2})\/(\d{2})$/.exec(String(value).trim());
  const invalid = () => { throw Object.assign(new Error('Thời gian phải hợp lệ theo dd/mm/yyyy hh/mm/ss, ví dụ 28/10/2026 16/40/38'), {status:400}); };
  if (!m) return invalid();
  const [,d,mo,y,h,mi,s] = m.map(Number);
  const local = new Date(Date.UTC(y,mo-1,d,h,mi,s));
  if (y < 1900 || local.getUTCFullYear()!==y || local.getUTCMonth()!==mo-1 || local.getUTCDate()!==d || h>23 || mi>59 || s>59) return invalid();
  const start = new Date(local.getTime()-7*3600000);
  return {gte:start,lt:new Date(start.getTime()+1000)};
}
export function pagination(q) {
  const page=Number(q.page||1), limit=Number(q.limit||5);
  if (!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>100) throw Object.assign(new Error('Phân trang không hợp lệ'),{status:400});
  return {page,limit};
}

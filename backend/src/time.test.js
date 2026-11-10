import test from 'node:test';
import assert from 'node:assert/strict';
import {timeWindow,pagination} from './time.js';
test('Vietnam local time is converted to UTC, exact second including milliseconds',()=>{
 const {gte,lt}=timeWindow('28/10/2026 16/40/38');
 assert.equal(gte.toISOString(),'2026-10-28T09:40:38.000Z');
 assert.equal(lt.toISOString(),'2026-10-28T09:40:39.000Z');
 for(const t of ['2026-10-28T09:40:38.000Z','2026-10-28T09:40:38.999Z']) assert.ok(new Date(t)>=gte&&new Date(t)<lt);
 assert.ok(new Date('2026-10-28T09:40:39Z')>=lt);
});
test('midnight and leap-day boundaries',()=>{
 assert.equal(timeWindow('01/01/2026 00/00/00').gte.toISOString(),'2025-12-31T17:00:00.000Z');
 assert.equal(timeWindow('29/02/2024 23/59/59').lt.toISOString(),'2024-02-29T17:00:00.000Z');
});
test('invalid calendar dates and incomplete inputs are rejected',()=>{
 for(const input of ['29/02/2025 12/00/00','31/04/2026 12/00/00','28/10/2026 24/00/00','28/10/2026 16/60/00','28/10/2026 16/00/60','28/10/2026','2026-10-28','28/10/2026 16:40:38','00/10/2026 10/00/00']) assert.throws(()=>timeWindow(input),e=>e.status===400);
 assert.equal(timeWindow(''),null);
});
test('pagination validation',()=>{
 assert.deepEqual(pagination({}),{page:1,limit:5});
 assert.deepEqual(pagination({page:'3',limit:'20'}),{page:3,limit:20});
 for(const q of [{page:'-1'},{page:'1.5'},{limit:'101'},{limit:'x'}])assert.throws(()=>pagination(q));
});

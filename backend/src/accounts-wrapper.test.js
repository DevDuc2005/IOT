import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./accounts.js',import.meta.url),'utf8');
// Test the actual wrapper and actual authentication middleware without requiring a DB.
const expression=source.match(/const wrap=(.*);/)[1];
const wrap=Function('return ('+expression+')')();
const body=source.split("app.use('/api',wrap(async(req,res,next)=>{")[1].split('\n }));')[0];
function middleware(user){return wrap(Function('lookup','return async(req,res,next)=>{'+body+'}')(async()=>user))}
test('authenticated request reaches next middleware',async()=>{
 let calls=0;const req={method:'GET',headers:{}};
 await middleware({id:1,name:'Test'})(req,{},error=>{assert.equal(error,undefined);calls++});
 assert.equal(calls,1);assert.equal(req.user.id,1);
});
test('unauthenticated request returns 401 without calling next',async()=>{
 let status,body;await middleware(null)({method:'GET',headers:{}},{status(x){status=x;return this},json(x){body=x}},()=>assert.fail('next should not be called'));
 assert.equal(status,401);assert.equal(body.error,'Vui lòng đăng nhập');
});
test('wrapper forwards asynchronous failures',async()=>{
 const failure=new Error('database unavailable');let received;
 await wrap(async()=>{throw failure})({}, {},error=>{received=error});assert.equal(received,failure);
});
test('wrapper forwards synchronous failures too',async()=>{
 const failure=new Error('sync error');let received;
 await wrap(()=>{throw failure})({}, {},error=>{received=error});assert.equal(received,failure);
});
test('old wrapper reproduces next is not a function',async()=>{
 const broken=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);let received;
 await broken(async(req,res,next)=>next())({}, {},error=>{received=error});assert.match(received.message,/next is not a function/);
});

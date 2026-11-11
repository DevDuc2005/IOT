import {randomBytes} from 'node:crypto';
import {hashPassword,verifyPassword,validAvatar} from './profile-security.js';
import {z} from 'zod';
export function accounts(app,prisma,onPasswordChanged=()=>{}) {
 const sessions=new Map(), attempts=new Map();
 const cookie=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('iot_session='))?.slice(12);
 const safe=u=>{const {passwordHash,...profile}=u;return profile};
 const lookup=async req=>{const session=sessions.get(cookie(req));if(!session||session.until<Date.now())return null;return prisma.user.findUnique({where:{id:session.id}})};
 const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res,next)).catch(next);
 const hash=hashPassword;
 const session=(req,res,u)=>{const id=randomBytes(32).toString('hex');sessions.set(id,{id:u.id,until:Date.now()+86400000});res.cookie('iot_session',id,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:86400000});res.json(safe(u))};
 app.get('/api/auth/status',wrap(async(req,res)=>res.json({setupRequired:await prisma.user.count()===0})));
 app.post('/api/auth/setup',wrap(async(req,res)=>{
  const data=z.object({name:z.string().trim().min(1).max(100),email:z.string().email().max(200),password:z.string().min(8).max(128)}).parse(req.body);
  const user=await prisma.$transaction(async tx=>{if(await tx.user.count())throw Object.assign(new Error('Tài khoản quản trị đã được tạo'),{status:409});return tx.user.create({data:{id:1,name:data.name,email:data.email.toLowerCase(),passwordHash:hash(data.password)}})});
  session(req,res,user);
 }));
 app.post('/api/auth/login',wrap(async(req,res)=>{
  const key=req.ip,entry=attempts.get(key);if(entry&&entry.until>Date.now()&&entry.count>=10)throw Object.assign(new Error('Thử đăng nhập quá nhiều. Vui lòng chờ 15 phút.'),{status:429});
  const data=z.object({email:z.string().trim().min(1).max(200),password:z.string().max(128)}).parse(req.body);
  attempts.set(key,{until:entry?.until>Date.now()?entry.until:Date.now()+900000,count:entry?.until>Date.now()?entry.count+1:1});
  const user=await prisma.user.findUnique({where:data.email.includes('@')?{email:data.email.toLowerCase()}:{username:data.email.toLowerCase()}});
  if(!verifyPassword(data.password,user?.passwordHash||hash('dummy'))||!user)throw Object.assign(new Error('Tài khoản hoặc mật khẩu không đúng'),{status:401});
  attempts.delete(key);session(req,res,user);
 }));
 app.post('/api/auth/logout',(req,res)=>{sessions.delete(cookie(req));res.clearCookie('iot_session');res.json({ok:true})});
 app.use('/api',wrap(async(req,res,next)=>{
  req.user=await lookup(req);if(!req.user)return res.status(401).json({error:'Vui lòng đăng nhập'});
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`${req.protocol}://${req.headers.host}`&&req.headers.origin!==(process.env.FRONTEND_ORIGIN||'http://localhost:5173'))return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ'});
  next();
 }));
 app.get('/api/profile',(req,res)=>res.json(safe(req.user)));
 const link=z.string().max(1000).refine(v=>!v||/^https?:\/\//.test(v)||v.startsWith('/'),'Liên kết phải bắt đầu bằng http://, https:// hoặc /');
 const username=z.string().trim().toLowerCase().max(40).refine(v=>!v||/^[a-z0-9_.-]{3,40}$/.test(v),'Tài khoản gồm 3–40 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang');
 app.put('/api/profile',wrap(async(req,res)=>{
  const data=z.object({name:z.string().trim().min(1).max(100),email:z.string().email().max(200),username,avatar:z.string().max(400100).refine(validAvatar,'Ảnh đại diện phải là JPEG/PNG, tối đa 300 KB sau xử lý'),phone:z.string().max(30),github:link,figma:link,architecture:link,pdf:link}).parse(req.body);
  data.email=data.email.toLowerCase();
  try{res.json(safe(await prisma.user.update({where:{id:req.user.id},data:{...data,username:data.username||null}})))}catch(error){if(error.code==='P2002')throw Object.assign(new Error('Tài khoản hoặc email đã được sử dụng'),{status:409});throw error}
 }));
 app.put('/api/profile/password',wrap(async(req,res)=>{
  const data=z.object({currentPassword:z.string().min(1).max(128),newPassword:z.string().min(8).max(128),confirmPassword:z.string().min(8).max(128)}).parse(req.body);
  if(data.newPassword!==data.confirmPassword)return res.status(400).json({error:'Mật khẩu xác nhận không khớp'});
  if(!verifyPassword(data.currentPassword,req.user.passwordHash))return res.status(400).json({error:'Mật khẩu hiện tại không đúng'});
  if(data.newPassword===data.currentPassword)return res.status(400).json({error:'Mật khẩu mới phải khác mật khẩu hiện tại'});
  // Conditional update prevents concurrent changes from reusing a stale password.
  const updated=await prisma.user.updateMany({where:{id:req.user.id,passwordHash:req.user.passwordHash},data:{passwordHash:hash(data.newPassword)}});
  if(!updated.count)return res.status(409).json({error:'Mật khẩu đã thay đổi. Vui lòng đăng nhập lại'});
  for(const [key,value] of sessions)if(value.id===req.user.id)sessions.delete(key);
  res.clearCookie('iot_session');onPasswordChanged(req.user.id);
  res.json({ok:true});
 }));
 return {lookup};
}

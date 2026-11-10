import 'dotenv/config';
import {timeWindow,pagination} from './time.js';
import {accounts} from './accounts.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mqtt from 'mqtt';
import http from 'node:http';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 4000);
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const DEMO = process.env.DEMO_MODE === 'true';
const TOPICS = {
  sensor:'iot/room1/sensors', history:'iot/room1/led/history',
  status:'iot/room1/devices/status', command:'iot/room1/command',
  demo1:'iot/room1/demo/t1', demo2:'iot/room1/demo/t2',
};
const prisma = new PrismaClient();
const app = express();
app.use(helmet());
app.use(cors({origin:ORIGIN}));
app.use(express.json({limit:'512kb'}));
const server = http.createServer(app);
const io = new Server(server,{cors:{origin:ORIGIN}});
let mqttConnected = false;
let latestSensor = null;
let lastSensorAt = null;
let lastDeviceAt = null;
let ledStates = {led1:'OFF',led2:'OFF',led3:'OFF'};
let lastStatusAt = null;
let pendingCommand = '';
let suppressEspHistoryUntil = 0;
const online = () => DEMO || !!(mqttConnected && lastSensorAt && Date.now()-new Date(lastSensorAt).getTime() < Number(process.env.DEVICE_STALE_MS||15000));
const system = () => ({ mqttConnected: DEMO || mqttConnected, espOnline: online(), mode:DEMO?'DEMO':'REAL', lastSensorAt, lastDeviceAt, lastStatusAt, topics:TOPICS });
const emitSystem = () => io.emit('system',system());
const pending = new Map();
const auth=accounts(app,prisma,userId=>{for(const socket of io.sockets.sockets.values())if(socket.data.userId===userId)socket.disconnect(true)});
io.use(async(socket,next)=>{try {const user=await auth.lookup(socket.request);if(user){socket.data.userId=user.id;next();}else next(new Error("Unauthorized"));}catch(e){next(e)}});
const normalized = value => String(value).toUpperCase()==='ON' ? 'ON' : 'OFF';

async function ensureRelationalTables() {
  const devCount = await prisma.deviceList.count();
  if (devCount === 0) {
    await prisma.deviceList.create({
      data: { id: 1, name: 'ESP32-C6 Controller', type: 'CONTROLLER', parent_id: null, gpio_pin: null, room: 'Phòng 1', status: 'ON', is_online: 1 },
    });
    await prisma.deviceList.createMany({
      data: [
        { id: 2, name: 'LED 1', type: 'LED', parent_id: 1, gpio_pin: 18, room: 'Phòng 1', status: 'OFF', is_online: 1 },
        { id: 3, name: 'LED 2', type: 'LED', parent_id: 1, gpio_pin: 19, room: 'Phòng 1', status: 'OFF', is_online: 1 },
        { id: 4, name: 'LED 3', type: 'LED', parent_id: 1, gpio_pin: 22, room: 'Phòng 1', status: 'OFF', is_online: 1 },
      ],
    });
  }
  const sensorCount = await prisma.sensorList.count();
  if (sensorCount === 0) {
    await prisma.sensorList.createMany({
      data: [
        { id: 1, controller_id: 1, name: 'Cảm biến nhiệt độ DHT11', type: 'temperature', unit: '°C', gpio_pin: 23 },
        { id: 2, controller_id: 1, name: 'Cảm biến độ ẩm DHT11', type: 'humidity', unit: '%', gpio_pin: 23 },
        { id: 3, controller_id: 1, name: 'Cảm biến ánh sáng LDR', type: 'light', unit: 'LIGHT/DARK', gpio_pin: 1 },
      ],
    });
  }
  const userCount = await prisma.users.count();
  if (userCount === 0) {
    await prisma.users.create({
      data: {
        id: 1,
        name: 'Phạm Việt Hoàng',
        email: 'swallownest59@gmail.com',
        password_hash: 'scrypt$iot-dashboard-2026',
        phone: '0987654321',
        github: 'https://github.com/hoangpv-iot/iot-light-blue-v2',
        figma: '/figma-design.html',
        system_architecture: '/system-architecture.html',
        role: 'ADMIN',
      },
    });
  }
}
void ensureRelationalTables().catch(console.error);

function addLog(channel,topic,message) {
  io.emit('terminal',{channel,topic,message,at:new Date().toISOString()});
}
async function storeSensor(payload) {
  const parsed = z.object({temperature:z.number().finite().min(-50).max(120),humidity:z.number().finite().min(0).max(100),light:z.enum(['LIGHT','DARK']),light_raw:z.number().int().min(0).max(1)}).safeParse(payload);
  if(!parsed.success) return;
  const v=parsed.data;
  latestSensor={temperature:v.temperature,humidity:v.humidity,light:v.light,light_raw:v.light_raw,at:new Date().toISOString()};
  lastSensorAt=latestSensor.at;
  await prisma.sensorReading.create({data:{temperature:v.temperature,humidity:v.humidity,light:v.light,lightRaw:v.light_raw}});
  await prisma.dataSensor.createMany({
    data: [
      { sensor_id: 1, value: v.temperature },
      { sensor_id: 2, value: v.humidity },
      { sensor_id: 3, value: v.light_raw },
    ],
  }).catch(() => {});
  io.emit('sensor',latestSensor);
  emitSystem();
}
async function storeEvent(payload) {
  if(pendingCommand || Date.now() < suppressEspHistoryUntil) return;
  const parsed=z.object({led:z.number().int().min(1).max(3),action:z.enum(['ON','OFF']),result:z.string().max(40),uptime_ms:z.number().nonnegative().optional()}).safeParse(payload);
  if(!parsed.success) return;
  const v=parsed.data;
  const finalResult = (v.result==='SUCCESS'||v.result==='STATE_CONFIRMED') ? v.action : v.result;
  const event=await prisma.deviceEvent.create({data:{led:v.led,action:v.action,result:finalResult,uptimeMs:v.uptime_ms==null?null:Math.floor(v.uptime_ms),source:DEMO?'DEMO':'ESP32',user:payload.actor||null}});
  await prisma.actionDevice.create({
    data: {
      request_id: crypto.randomUUID(),
      group_request_id: null,
      user_id: 1,
      device_id: v.led + 1,
      action: v.action,
      status: finalResult,
      finished_at: new Date(),
    },
  }).catch(() => {});
  await prisma.deviceList.update({
    where: { id: v.led + 1 },
    data: { status: v.action },
  }).catch(() => {});
  lastDeviceAt=event.createdAt;
  io.emit('history',event);
  addLog('history',TOPICS.history,JSON.stringify(payload));
}
function receiveStatus(data,retained=false) {
  if(!data || !['led1','led2','led3'].every(k=>data[k]==='ON'||data[k]==='OFF')) return;
  ledStates={led1:data.led1,led2:data.led2,led3:data.led3};
  lastStatusAt=new Date().toISOString();
  if(!pendingCommand) {
    io.emit('status',{...ledStates,at:lastStatusAt,pendingCommand});
  }
  emitSystem();
  if(retained)return;
  for(const [id,p] of pending) {
    if(p.targets.every(([key,val])=>ledStates[key]===val)) {clearTimeout(p.timer);p.resolve({ok:true,status:ledStates});pending.delete(id);}
  }
}
const client=DEMO ? null : mqtt.connect(process.env.MQTT_URL||'mqtt://127.0.0.1:1883', {
  username:process.env.MQTT_USERNAME||undefined,password:process.env.MQTT_PASSWORD||undefined,
  reconnectPeriod:3000,connectTimeout:10000,clientId:'iot-web-backend-'+Math.random().toString(16).slice(2),
});
if(client) {
  client.on('connect',()=>{mqttConnected=true;client.subscribe(Object.values(TOPICS).filter(x=>x!==TOPICS.command),{qos:0});emitSystem();});
  client.on('offline',()=>{mqttConnected=false;emitSystem();});
  client.on('close',()=>{mqttConnected=false;emitSystem();});
  client.on('error',e=>console.warn('MQTT:',e.message));
  client.on('message',(topic,buf,packet)=>{
    const message=buf.toString('utf8');
    if(topic===TOPICS.sensor){addLog('sensor',topic,message);try{void storeSensor(JSON.parse(message)).catch(console.error)}catch{}}
    else if(topic===TOPICS.history){try{void storeEvent(JSON.parse(message)).catch(console.error)}catch{}}
    else if(topic===TOPICS.status){try{receiveStatus(JSON.parse(message),packet.retain)}catch{}}
    else if(topic===TOPICS.demo1 || topic===TOPICS.demo2) addLog(topic===TOPICS.demo1?'sensor':'history',topic,message);
  });
}
const commandSchema=z.object({command:z.enum(['led 1 on','led 1 off','led 2 on','led 2 off','led 3 on','led 3 off','all on','all off'])});
const targetsFor = command => {
  const val=command.endsWith('on')?'ON':'OFF';
  return command.startsWith('all') ? [['led1',val],['led2',val],['led3',val]] : [['led'+command.split(' ')[1],val]];
};
function demoCommand(command,actor){
  const targets=targetsFor(command);
  targets.forEach(([key,value])=>{ledStates[key]=value;void storeEvent({led:Number(key.at(-1)),action:value,result:'SUCCESS',actor,uptime_ms:Math.floor(process.uptime()*1000)}).catch(console.error)});
  receiveStatus({...ledStates});
}
async function issue(command,actor){
  if(DEMO){demoCommand(command,actor);return {ok:true,status:ledStates,mode:'DEMO'};}
  if(!mqttConnected) throw Object.assign(new Error('MQTT Broker chưa kết nối'),{status:503});
  const targets=targetsFor(command);
  // MQTT cannot correlate a command acknowledgment without a request ID from firmware.
  // A matching status update is best-effort, NOT proof of execution of this specific request.
  return await new Promise((resolve,reject)=>{
    const id=Date.now()+Math.random();
    const timer=setTimeout(()=>{pending.delete(id);reject(Object.assign(new Error('Hết thời gian chờ ESP32 cập nhật trạng thái'),{status:504}));},8000);
    pending.set(id,{targets,timer,resolve,actor});
    client.publish(TOPICS.command,command,{qos:0,retain:false},err=>{
      if(err){clearTimeout(timer);pending.delete(id);reject(err);}
    });
  });
}
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
app.get('/api/system/status',(req,res)=>res.json(system()));
app.get('/api/devices/status',(req,res)=>res.json({...ledStates,at:lastStatusAt,pendingCommand}));
app.get('/api/sensors/latest',(req,res)=>res.json(latestSensor));
app.get('/api/dashboard',asyncRoute(async(req,res)=>res.json({sensor:latestSensor,status:ledStates,system:system(),recent:await prisma.deviceEvent.findMany({take:5,orderBy:{id:'desc'}})})));
app.get('/api/sensors/history',asyncRoute(async(req,res)=>res.json((await prisma.sensorReading.findMany({take:Math.min(Number(req.query.limit)||100,500),orderBy:{id:'desc'}})).map(x=>({...x,light_raw:x.lightRaw})))));
app.get('/api/devices/history',asyncRoute(async(req,res)=>{
  const {page,limit:take}=pagination(req.query);
  const where={};const time=timeWindow(req.query.time);if(time)where.createdAt=time;if(req.query.result)where.result=String(req.query.result);if(['1','2','3'].includes(req.query.led))where.led=Number(req.query.led);
  if(['ON','OFF'].includes(req.query.action))where.action=req.query.action;
  const [items,total]=await Promise.all([prisma.deviceEvent.findMany({where,orderBy:{id:'desc'},skip:(page-1)*take,take}),prisma.deviceEvent.count({where})]);
  res.json({items,total,page,pages:Math.max(1,Math.ceil(total/take)),limit:take});
}));

app.get('/api/sensors/records',asyncRoute(async(req,res)=>{
 const {page,limit}=pagination(req.query), time=timeWindow(req.query.time);
 const type=String(req.query.type||'');
 if(type&&!['temperature','humidity','light'].includes(type))return res.status(400).json({error:'Loại cảm biến không hợp lệ'});
 const value=String(req.query.value||'').trim();
 const conditions=[],params=[];
 if(type){conditions.push('type = ?');params.push(type)}
 if(time){conditions.push('createdAt >= ? AND createdAt < ?');params.push(time.gte.getTime(),time.lt.getTime())}
 if(value){
  const text=value.toUpperCase();
  if(['SÁNG','TỐI','LIGHT','DARK'].includes(text)){conditions.push("type = 'light' AND value = ?");params.push(['SÁNG','LIGHT'].includes(text)?'LIGHT':'DARK')}
  else {const match=/^(-?\d+(?:[.,]\d+)?)\s*(°C|%\s*(?:RH)?|lux)?$/i.exec(value);if(!match)return res.status(400).json({error:'Giá trị phải là số, °C, %, hoặc SÁNG/TỐI'});if(match[2]?.toLowerCase()==='lux')return res.status(400).json({error:'Cảm biến hiện tại chỉ trả SÁNG/TỐI, chưa có dữ liệu lux'});conditions.push("type != 'light' AND CAST(value AS REAL) = ?");params.push(Number(match[1].replace(',','.')));if(match[2]){conditions.push('type = ?');params.push(match[2].includes('%')?'humidity':'temperature')}}
 }
 const union=`SELECT id, 'temperature' AS type, CAST(temperature AS TEXT) AS value, createdAt FROM SensorReading UNION ALL SELECT id, 'humidity', CAST(humidity AS TEXT), createdAt FROM SensorReading UNION ALL SELECT id, 'light', light, createdAt FROM SensorReading`;
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const items=await prisma.$queryRawUnsafe('SELECT * FROM ('+union+')'+where+' ORDER BY createdAt DESC,id DESC,type LIMIT ? OFFSET ?',...params,limit,(page-1)*limit);
 const count=await prisma.$queryRawUnsafe('SELECT COUNT(*) AS total FROM ('+union+')'+where,...params);
 const total=Number(count[0].total);
 res.json({items:items.map(x=>({...x,id:x.id+'-'+x.type,createdAt:new Date(typeof x.createdAt==='bigint'?Number(x.createdAt):x.createdAt).toISOString()})),total,page,limit,pages:Math.max(1,Math.ceil(total/limit))});
}));

const LOADING_DELAY_MS = 3000;
let lastCommand=0;
app.post('/api/devices/command',asyncRoute(async(req,res)=>{
  const parsed=commandSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Lệnh không hợp lệ'});
  if(pendingCommand || pending.size)return res.status(409).json({error:'Đang xử lý lệnh trước. Vui lòng chờ hoàn tất.'});
  if(Date.now()-lastCommand<250)return res.status(429).json({error:'Gửi lệnh quá nhanh'});
  lastCommand=Date.now();
  const command=parsed.data.command;
  const targets=targetsFor(command);

  pendingCommand=command;
  const groupReqId = targets.length > 1 ? crypto.randomUUID() : null;
  const records=await prisma.$transaction(
    targets.map(([key,action])=>
      prisma.deviceEvent.create({
        data:{
          led:Number(key.at(-1)),
          action,
          result:'LOADING',
          source:DEMO?'DEMO':'WEB',
          user:req.user.name,
        },
      })
    )
  );
  const actionRecords = await prisma.$transaction(
    targets.map(([key,action])=>
      prisma.actionDevice.create({
        data:{
          request_id: crypto.randomUUID(),
          group_request_id: groupReqId,
          user_id: 1,
          device_id: Number(key.at(-1)) + 1,
          action,
          status: 'LOADING',
          error_message: null,
        },
      })
    )
  ).catch(() => []);
  io.emit('status',{...ledStates,at:lastStatusAt,pendingCommand});
  io.emit('history',{});

  try{
    await new Promise(resolve=>setTimeout(resolve,LOADING_DELAY_MS));
    if(DEMO){
      targets.forEach(([key,val])=>{ledStates[key]=val;});
      lastStatusAt=new Date().toISOString();
    }else{
      suppressEspHistoryUntil=Date.now()+4000;
      await issue(command,req.user.name);
    }
    await prisma.$transaction(
      records.map(r=>
        prisma.deviceEvent.update({
          where:{id:r.id},
          data:{result:r.action},
        })
      )
    );
    if (actionRecords.length) {
      await prisma.$transaction([
        ...actionRecords.map(ar =>
          prisma.actionDevice.update({
            where: { id: ar.id },
            data: { status: ar.action, finished_at: new Date() },
          })
        ),
        ...targets.map(([key, val]) =>
          prisma.deviceList.update({
            where: { id: Number(key.at(-1)) + 1 },
            data: { status: val },
          })
        ),
      ]).catch(() => {});
    }
    pendingCommand='';
    io.emit('status',{...ledStates,at:lastStatusAt,pendingCommand:''});
    io.emit('history',{});
    res.json({ok:true,status:{...ledStates,pendingCommand:''},mode:DEMO?'DEMO':'REAL'});
  }catch(error){
    const errStatus = error.status===504?'TIMEOUT':'ERROR';
    await prisma.deviceEvent.updateMany({
      where:{id:{in:records.map(x=>x.id)}},
      data:{result:errStatus},
    });
    if (actionRecords.length) {
      await prisma.actionDevice.updateMany({
        where: { id: { in: actionRecords.map(x => x.id) } },
        data: { status: errStatus, error_message: error.message || 'Lỗi điều khiển', finished_at: new Date() },
      }).catch(() => {});
    }
    pendingCommand='';
    io.emit('status',{...ledStates,at:lastStatusAt,pendingCommand:''});
    io.emit('history',{});
    throw error;
  }
}));
app.post('/api/mqtt/publish-demo',asyncRoute(async(req,res)=>{
  const parsed=z.object({terminal:z.enum(['1','2']),message:z.string().min(1).max(300)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Dữ liệu không hợp lệ'});
  const topic=parsed.data.terminal==='1'?TOPICS.demo1:TOPICS.demo2;
  if(DEMO)addLog(parsed.data.terminal==='1'?'sensor':'history',topic,parsed.data.message);
  else {if(!mqttConnected)return res.status(503).json({error:'MQTT chưa kết nối'}); await new Promise((resolve,reject)=>client.publish(topic,parsed.data.message,{retain:false},err=>err?reject(err):resolve()));}
  res.json({ok:true,topic});
}));
app.use((err,req,res,next)=>{console.error(err);res.status(err.status||(err.name==='ZodError'?400:500)).json({error:err.message||'Lỗi máy chủ'});});

if(DEMO){
  console.log('DEMO_MODE enabled - no real device control');
  const samples=[];
  setInterval(()=>{
    const n=Date.now()/10000;
    const temp=Math.round((29.5+1.5*Math.sin(n))*10)/10;
    const hum=Math.round((65+4*Math.cos(n))*10)/10;
    const light_raw=Math.sin(n/2)>0?0:1;
    const p={temperature:temp,humidity:hum,light:light_raw?'DARK':'LIGHT',light_raw};
    addLog('sensor',TOPICS.sensor,JSON.stringify(p));
    void storeSensor(p).catch(console.error);
  },3000);
}
setInterval(emitSystem,3000);
server.listen(PORT,()=>console.log(`IoT API http://localhost:${PORT} (${DEMO?'DEMO':'REAL'})`));
process.on('SIGINT',async()=>{await prisma.$disconnect();client?.end();server.close();process.exit(0)});

import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function verifyPassword(password,stored){const [salt,expected]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(expected,'hex'))}
export function validAvatar(value){
 if(value==='')return true;
 const m=/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!m)return false;
 const bytes=Buffer.from(m[2],'base64');
 if(bytes.length>300000||bytes.length<12)return false;
 return m[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
}

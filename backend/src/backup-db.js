import {readFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
const env=existsSync('.env')?readFileSync('.env','utf8'):'';
const value=process.env.DATABASE_URL||env.match(/^\s*DATABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1]||'file:./iot.db';
if(!value.startsWith('file:'))throw new Error('Only SQLite file URLs are supported');
const database=resolve('prisma',value.slice(5));
if(existsSync(database)){
 const folder=join(dirname(database),'backups',new Date().toISOString().replace(/[:.]/g,'-'));
 mkdirSync(folder,{recursive:true});
 for(const suffix of ['','-wal','-shm'])if(existsSync(database+suffix))copyFileSync(database+suffix,join(folder,basename(database)+suffix));
 console.log('Database backup: '+folder);
}else console.log('New installation: no existing database.');

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTournament,saveResult} from '../public/engine.js';
test('SQLite bewaart uitslagen na serverherstart en voorkomt overschrijven',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fifa-db-'));let child;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3198',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('Server gestopt: '+code)));});}
 async function stop(){const p=new Promise(r=>child.once('exit',r));child.kill();await p;}
 try{await start();const url='http://127.0.0.1:3198/api/state';const s=await fetch(url).then(r=>r.json());
 const version={id:'test-version',name:'Test',source:'testfixture',mode:'test',date:'2026-11-18',teams:[{id:'a',name:'Test A'},{id:'b',name:'Test B'}],players:[]};const t=createTournament('Opslagtest',version,['a','b']);saveResult(t,0,0,{score:[1,0],goals:[]});s.versions.push(version);s.tournaments.push(t);
 const put=()=>fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});assert.equal((await put()).status,200);assert.equal((await put()).status,409);await stop();await start();const restored=await fetch(url).then(r=>r.json());assert.deepEqual(restored.tournaments[0],t);assert.equal(restored.revision,1);
 }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});

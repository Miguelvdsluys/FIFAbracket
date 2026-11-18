import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||resolve(root,'data');
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(resolve(dataDir,'tracker.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL)');
db.prepare('INSERT OR IGNORE INTO state VALUES (1,0,?)').run(JSON.stringify({versions:[],tournaments:[]}));
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/api/state'){
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   if(req.method==='GET'){const row=db.prepare('SELECT * FROM state WHERE id=1').get();return res.end(JSON.stringify({revision:row.revision,...JSON.parse(row.body)}));}
   if(req.method==='PUT'){
    if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);return res.end('{}');}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>32_000_000){res.writeHead(413);return res.end('{}');}}
    const {revision,versions,tournaments}=JSON.parse(body);
    if(!Array.isArray(versions)||!Array.isArray(tournaments))throw Error('Ongeldige gegevens');
    const result=db.prepare('UPDATE state SET revision=revision+1,body=? WHERE id=1 AND revision=?').run(JSON.stringify({versions,tournaments}),revision);
    if(!result.changes){res.writeHead(409);return res.end(JSON.stringify({error:'Gegevens zijn elders gewijzigd. Herlaad de pagina.'}));}
    return res.end(JSON.stringify({revision:revision+1}));
   }
   res.writeHead(405);return res.end('{}');
  }
  const path=req.url.split('?')[0];const file=path==='/'?'index.html':path.slice(1);
  const localLogo=/^data\/team-logos\/[0-9]+\.(svg|png)$/.test(file);
  if(!localLogo&&!['index.html','app.js','team-drag.js','bracket.js','catalog.js','data/fifa22-sofifa-220002.json','engine.js','storage.js','style.css','pwa.js','sw.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable.png','icons/apple-touch-icon.png'].includes(file)){res.writeHead(404);return res.end('Niet gevonden');}
  res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.json')?'application/json':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/html');res.end(readFileSync(resolve(root,'public',file)));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('FIFA 22 Bracket Tracker gestart op poort '+(process.env.PORT||3000)));

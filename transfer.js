import {winner} from './engine.js?v=2d4c2687bf211252';
const FORMAT='fifa22-encrypted-backup',ITERATIONS=600000,MAX_FILE=64*1024*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const fail=message=>{throw Error(message);};
const id=value=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\u0000-\u001f]/.test(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const unique=values=>new Set(values).size===values.length;
const integer=value=>Number.isInteger(value)&&value>=0&&value<=999;
function checkVersion(version){
 if(!version||!id(version.id)||!text(version.name)||!text(version.source)||!text(version.mode)||!text(version.date)||!Array.isArray(version.teams)||!Array.isArray(version.players))fail('Een selectie in het bestand is onvolledig.');
 const teams=new Set(),players=new Set();
 for(const team of version.teams){if(!id(team.id)||!text(team.name)||teams.has(team.id))fail('Een selectie bevat ongeldige of dubbele teams.');teams.add(team.id);}
 for(const player of version.players){const key=player.id+'\0'+player.teamId;if(!id(player.id)||!text(player.name)||!teams.has(player.teamId)||players.has(key))fail('Een selectie bevat een ongeldige spelerkoppeling.');players.add(key);}
 return {teams,players};
}
function checkTournament(t){
 if(!t||!id(t.id)||!text(t.name)||!date(t.createdAt)||!Array.isArray(t.teamIds)||t.teamIds.length<1||!unique(t.teamIds)||!Array.isArray(t.rounds))fail('Een toernooi in het bestand is ongeldig.');
 const count=t.teamCount??t.teamIds.length;if(!Number.isInteger(count)||count<2||count>32||t.teamIds.length>count)fail('Een toernooi heeft een ongeldig aantal plekken.');
 const version=checkVersion(t.version);if(t.entryCatalog)checkVersion(t.entryCatalog);
 if(t.teamIds.some(team=>!version.teams.has(team)))fail('Een toernooi verwijst naar een ontbrekend team.');
 const size=2**Math.ceil(Math.log2(count)),ids=new Set();
 if(t.rounds.length!==Math.log2(size))fail('Het aantal rondes klopt niet.');
 for(let r=0;r<t.rounds.length;r++){
  const round=t.rounds[r];if(!Array.isArray(round)||round.length!==size/2**(r+1))fail('Het wedstrijdschema is onvolledig.');
  for(const m of round){
   if(!m||!id(m.id)||ids.has(m.id)||!Array.isArray(m.teams)||m.teams.length!==2||m.teams.some(team=>team!==null&&!t.teamIds.includes(team))||m.teams[0]&&m.teams[0]===m.teams[1])fail('Een wedstrijd bevat ongeldige teams.');ids.add(m.id);
   if(m.bye&&(r!==0||m.teams[1]!==null||m.result))fail('Een vrijstelling in het bestand is ongeldig.');
   if(m.result){
    const result=m.result;
    if(m.teams.some(team=>!team)||!Array.isArray(result.score)||result.score.length!==2||!result.score.every(integer)||!Array.isArray(result.goals)||!date(result.date))fail('Een uitslag in het bestand is ongeldig.');
    if(result.score[0]===result.score[1]){if(!Array.isArray(result.penalties)||result.penalties.length!==2||!result.penalties.every(integer)||result.penalties[0]===result.penalties[1])fail('Een gelijkspel mist een beslissende strafschoppenserie.');}
    else if(result.penalties!=null)fail('Een uitslag bevat een ongeldige strafschoppenserie.');
    const totals=[0,0];
    for(const goal of result.goals){if(!goal||![0,1].includes(goal.side)||!['player','own','unknown'].includes(goal.kind)||!Number.isInteger(goal.count)||goal.count<1||goal.count>999)fail('Een doelpunt in het bestand is ongeldig.');if(goal.kind==='player'&&!version.players.has(goal.playerId+'\0'+m.teams[goal.side]))fail('Een doelpuntenmaker hoort niet bij de opgeslagen selectie.');totals[goal.side]+=goal.count;}
    if(totals.some((n,s)=>n>result.score[s]))fail('Er zijn meer doelpunten toegewezen dan gescoord.');
   }
  }
 }
 const first=t.rounds[0],entries=first.flatMap(m=>m.teams.filter(Boolean));
 if(!unique(entries)||entries.length!==t.teamIds.length||first.filter(m=>m.bye).length!==size-count)fail('De eerste ronde komt niet overeen met de deelnemers.');
 for(let r=1;r<t.rounds.length;r++)for(let i=0;i<t.rounds[r].length;i++)if(t.rounds[r][i].teams[0]!==winner(t.rounds[r-1][i*2])||t.rounds[r][i].teams[1]!==winner(t.rounds[r-1][i*2+1]))fail('De doorgestroomde winnaars kloppen niet.');
}
function checkStructure(value){
 const pending=[[value,0]];let nodes=0;
 while(pending.length){const [item,depth]=pending.pop();if(++nodes>2000000||depth>60)fail('Het bestand is te groot of te ingewikkeld.');if(item&&typeof item==='object')for(const value of Object.values(item))if(value&&typeof value==='object')pending.push([value,depth+1]);}
}
export function validateArchive(archive){
 checkStructure(archive);
 if(!archive||archive.app!=='FIFA22BracketTracker'||archive.version!==1||!date(archive.createdAt)||typeof archive.label!=='string'||archive.label.length>80||!Array.isArray(archive.state?.versions)||!Array.isArray(archive.state?.tournaments))fail('Dit is geen ondersteunde FIFA 22-back-up.');
 const state=archive.state;
 if(!unique(state.versions.map(v=>v?.id))||!unique(state.tournaments.map(t=>t?.id)))fail('Het bestand bevat dubbele selecties of toernooien.');
 state.versions.forEach(checkVersion);state.tournaments.forEach(checkTournament);return archive;
}
function base64(bytes){let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);}
function bytes(value){if(typeof value!=='string'||value.length>MAX_FILE||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail('Het beveiligde bestand is beschadigd.');try{return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{fail('Het beveiligde bestand is beschadigd.');}}
async function keyFor(password,salt){if(!globalThis.crypto?.subtle)fail('Open de app via de beveiligde https-link om bestanden over te zetten.');const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptBackup(state,password,label=''){
 if(typeof password!=='string'||password.length<8)fail('Kies een wachtwoord van minimaal 8 tekens.');
 const archive=validateArchive({app:'FIFA22BracketTracker',version:1,createdAt:new Date().toISOString(),label:label.trim().slice(0,80),state:{versions:state.versions,tournaments:state.tournaments}});
 const plain=encoder.encode(JSON.stringify(archive));if(plain.length>MAX_FILE*.74)fail('Je gegevens zijn te groot voor één overdrachtsbestand.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await keyFor(password,salt);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(FORMAT+':1')},key,plain);
 return JSON.stringify({format:FORMAT,version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:base64(salt),iv:base64(iv),data:base64(new Uint8Array(encrypted))});
}
export async function decryptBackup(file,password){
 if(typeof file!=='string'||file.length>MAX_FILE)fail('Het bestand is te groot of ongeldig.');let envelope;
 try{envelope=JSON.parse(file);}catch{fail('Dit is geen geldig beveiligd bestand.');}
 if(!envelope||envelope.format!==FORMAT||envelope.version!==1||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==ITERATIONS)fail('Dit bestand heeft een onbekend formaat.');
 const salt=bytes(envelope.salt),iv=bytes(envelope.iv),data=bytes(envelope.data);
 if(salt.length!==16||iv.length!==12||data.length<16)fail('Het beveiligde bestand is beschadigd.');
 let plain;
 try{const key=await keyFor(password,salt);plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(FORMAT+':1')},key,data);}catch{fail('Het wachtwoord is onjuist of het bestand is beschadigd.');}
 let archive;try{archive=JSON.parse(decoder.decode(plain));}catch{fail('De inhoud van het bestand is beschadigd.');}
 return validateArchive(archive);
}
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const versionBody=v=>{const {id,...body}=v;return canonical(body);};
const tournamentBody=t=>{const copy={...t,version:{...t.version,id:''}};if(t.entryCatalog)copy.entryCatalog={...t.entryCatalog,id:''};return canonical(copy);};
export function planImport(current,archive,useFileConflicts=false){
 validateArchive(archive);const versions=[...current.versions],versionMap=new Map(),bodyMap=new Map(versions.map(v=>[versionBody(v),v.id]));
 for(const version of archive.state.versions){const body=versionBody(version);let id=bodyMap.get(body);if(!id){id=versions.some(v=>v.id===version.id)?version.id+':import:'+crypto.randomUUID():version.id;versions.push({...version,id});bodyMap.set(body,id);}versionMap.set(version.id,id);}
 const remap=t=>({...t,version:{...t.version,id:versionMap.get(t.version.id)||t.version.id},...(t.entryCatalog?{entryCatalog:{...t.entryCatalog,id:versionMap.get(t.entryCatalog.id)||t.entryCatalog.id}}:{})});
 const tournaments=[...current.tournaments],summary={added:0,unchanged:0,conflicts:[],replaced:0};
 for(const incoming of archive.state.tournaments){const index=tournaments.findIndex(t=>t.id===incoming.id);if(index<0){tournaments.push(remap(incoming));summary.added++;}else if(tournamentBody(tournaments[index])===tournamentBody(incoming))summary.unchanged++;else{summary.conflicts.push(incoming.name);if(useFileConflicts){tournaments[index]=remap(incoming);summary.replaced++;}}}
 return {state:{...current,versions,tournaments},summary};
}
export const MAX_BACKUP_BYTES=MAX_FILE;

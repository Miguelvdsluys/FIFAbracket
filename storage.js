const browserStorage=document.documentElement.dataset.storage==='browser';
let db;
async function database(){
 if(db)return db;
 db=await new Promise((resolve,reject)=>{const request=indexedDB.open('fifa22-bracket-tracker',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return db;
}
export async function loadState(){
 if(!browserStorage){const response=await fetch('/api/state');if(!response.ok)throw Error('Database niet bereikbaar');return response.json();}
 const databaseInstance=await database();return new Promise((resolve,reject)=>{const tx=databaseInstance.transaction('state','readonly');const request=tx.objectStore('state').get('current');request.onsuccess=()=>resolve(request.result||{revision:0,versions:[],tournaments:[]});request.onerror=()=>reject(request.error);});
}
export async function saveState(state){
 if(!browserStorage){const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});const data=await response.json();if(!response.ok)throw Error(data.error||'Opslaan mislukt');return data.revision;}
 const databaseInstance=await database();return new Promise((resolve,reject)=>{const tx=databaseInstance.transaction('state','readwrite');const store=tx.objectStore('state');const request=store.get('current');let revision;
 request.onsuccess=()=>{if((request.result?.revision||0)!==state.revision){tx.abort();return;}revision=state.revision+1;store.put({...state,revision},'current');};
 tx.oncomplete=()=>resolve(revision);tx.onabort=()=>reject(Error('Gegevens zijn in een ander tabblad gewijzigd. Herlaad de pagina.'));tx.onerror=()=>reject(tx.error||Error('Opslaan mislukt. Controleer de beschikbare browseropslag.'));});
}

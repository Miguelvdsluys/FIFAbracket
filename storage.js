import { connect } from './account.js?v=315fceaf15fba590';
import { createAccountStorage } from './account-storage.js?v=315fceaf15fba590';

const browserStorage=document.documentElement.dataset.storage==='browser';
let db;
async function database(){
 if(db)return db;
 db=await new Promise((resolve,reject)=>{const request=indexedDB.open('fifa22-bracket-tracker',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return db;
}
export async function loadLocalState(){
 if(!browserStorage){const response=await fetch('/api/state');if(!response.ok)throw Error('Database niet bereikbaar');return response.json();}
 const databaseInstance=await database();return new Promise((resolve,reject)=>{const tx=databaseInstance.transaction('state','readonly');const request=tx.objectStore('state').get('current');request.onsuccess=()=>resolve(request.result||{revision:0,versions:[],tournaments:[]});request.onerror=()=>reject(request.error);});
}
async function saveLocalState(state){
 if(!browserStorage){const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});const data=await response.json();if(!response.ok)throw Error(data.error||'Opslaan mislukt');return data.revision;}
 const databaseInstance=await database();return new Promise((resolve,reject)=>{const tx=databaseInstance.transaction('state','readwrite');const store=tx.objectStore('state');const request=store.get('current');let revision;
 request.onsuccess=()=>{if((request.result?.revision||0)!==state.revision){tx.abort();return;}revision=state.revision+1;store.put({...state,revision},'current');};
 tx.oncomplete=()=>resolve(revision);tx.onabort=()=>reject(Error('Gegevens zijn in een ander tabblad gewijzigd. Herlaad de pagina.'));tx.onerror=()=>reject(tx.error||Error('Opslaan mislukt. Controleer de beschikbare browseropslag.'));});
}


let accountStorage;
export async function initializeStorage() {
  if (!browserStorage) return 'local';
  const connection = await connect().catch(() => null);
  if (!connection) return 'local';
  const { auth, sdk } = connection;
  const uid = auth.currentUser?.uid;
  sdk.onAuthStateChanged(auth, user => {
    if (user?.uid !== uid) location.reload();
  });
  if (!uid) return 'local';

  try {
    const firestore = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js');
    const storage = createAccountStorage(firestore, auth, uid);
    const state = await storage.load();
    accountStorage = storage;
    return { state };
  } catch (error) {
    if (['permission-denied', 'not-found', 'failed-precondition'].includes(error.code)) return 'unavailable';
    throw error;
  }
}

export async function loadState() {
  return accountStorage ? accountStorage.load() : loadLocalState();
}

export async function saveState(state) {
  return accountStorage ? accountStorage.save(state) : saveLocalState(state);
}

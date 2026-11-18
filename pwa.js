const button=document.querySelector('#install-button');
let installPrompt;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
function explainInstall(){
 const dialog=document.querySelector('#modal');
 document.querySelector('#dialog-content').innerHTML=`<div class="modal-head"><h2>Op je telefoon installeren</h2><button data-close aria-label="Sluiten">×</button></div><div class="install-icon">22</div><p>Je eigen toernooitracker op je beginscherm, met een schermvullende weergave.</p><h3>iPhone / iPad</h3><p>Open deze website in <b>Safari</b>. Tik op <b>Deel</b> en vervolgens <b>Zet op beginscherm</b> (of <b>Voeg toe aan beginscherm</b>). Schakel ‘Open als webapp’ in als die optie verschijnt.</p><h3>Android</h3><p>Open de website in <b>Chrome</b>. Kies in het menu <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.</p><div class="notice">Na de eerste volledige download werkt de GitHub-versie ook offline. Toernooien blijven op dit apparaat opgeslagen. Een andere browser of beginscherm-app kan een eigen opslag gebruiken.</div>`;
 if(!dialog.open)dialog.showModal();
}
button.hidden=standalone();
button.addEventListener('click',async()=>{
 if(!installPrompt){explainInstall();return;}
 const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;button.textContent='App installeren';
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=false;});
window.addEventListener('appinstalled',()=>{button.hidden=true;installPrompt=null;});
const connection=document.querySelector('#connection-status');
function connectionStatus(){connection.hidden=navigator.onLine;connection.textContent='Offline · gegevens blijven op dit apparaat';}
window.addEventListener('online',connectionStatus);window.addEventListener('offline',connectionStatus);connectionStatus();
const updateButton=document.querySelector('#update-button');
const notice=document.querySelector('#update-notice');
const initialController=navigator.serviceWorker?.controller;
let registration,readyToReload=false,checking=false;
const tell=text=>{const toast=document.querySelector('#toast');toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),5000);};
function updateReady(){readyToReload=true;notice.hidden=false;updateButton.textContent='Nieuwe versie';}
function reloadApp(){
 if(document.querySelector('dialog[open]')&&!confirm('Er staat nog een formulier open. Niet-opgeslagen invoer gaat verloren. Nu bijwerken?'))return;
 const url=new URL(location.href);url.searchParams.set('update',Date.now());location.replace(url);
}
document.querySelector('#apply-update').addEventListener('click',reloadApp);
function watchWorker(worker){
 if(!worker)return;
 worker.addEventListener('statechange',()=>{if(worker.state==='activated'&&initialController)updateReady();});
}
async function checkForUpdate(manual=false){
 if(checking)return;
 if(readyToReload){if(manual)reloadApp();return;}
 if(!navigator.onLine){if(manual)tell('Je bent offline. Je kunt blijven spelen; bijwerken kan zodra je internet hebt.');return;}
 if(!registration){if(manual)tell('Open de online app om updates te controleren.');return;}
 checking=true;updateButton.disabled=true;updateButton.textContent='Controleren…';
 try{
  await registration.update();
  if(registration.installing){watchWorker(registration.installing);if(manual)tell('De nieuwste versie wordt gedownload. Je toernooien blijven bewaard.');}
  else if(readyToReload){if(manual)reloadApp();}
  else if(manual)reloadApp(); // also repairs a restored standalone window
 }catch{if(manual)tell('Bijwerken lukt nu niet. Probeer het straks opnieuw; je gegevens blijven bewaard.');}
 finally{checking=false;updateButton.disabled=false;updateButton.textContent=readyToReload?'Nieuwe versie':'Bijwerken';}
}
updateButton.addEventListener('click',()=>checkForUpdate(true));
if(document.documentElement.dataset.storage==='browser'&&'serviceWorker' in navigator){
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(initialController)updateReady();});
 navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='APP_UPDATED'&&initialController)updateReady();});
 navigator.serviceWorker.register('./sw.js?v=4bf80c2a8be62518',{updateViaCache:'none'}).then(async value=>{
  registration=value;registration.addEventListener('updatefound',()=>watchWorker(registration.installing));watchWorker(registration.installing);
  await navigator.serviceWorker.ready;document.querySelector('#offline-ready').hidden=false;
  await checkForUpdate();
 }).catch(()=>{document.querySelector('#offline-ready').hidden=true;});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForUpdate();});
 window.addEventListener('online',()=>checkForUpdate());
}else updateButton.hidden=true;

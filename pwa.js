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
if(document.documentElement.dataset.storage==='browser'&&'serviceWorker' in navigator){
 navigator.serviceWorker.register('./sw.js').then(async()=>{await navigator.serviceWorker.ready;const cache=await caches.keys();if(cache.some(key=>key.startsWith('fifa22-')))document.querySelector('#offline-ready').hidden=false;}).catch(()=>{document.querySelector('#offline-ready').hidden=true;});
}

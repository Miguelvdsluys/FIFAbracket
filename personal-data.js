import {encryptBackup,decryptBackup,planImport,MAX_BACKUP_BYTES} from './transfer.js?v=9b75b7ceeb47db7f';
export function installPersonalData({getState,onApply,modal,notify}){
 const $=selector=>document.querySelector(selector),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const countMatches=tournaments=>tournaments.reduce((total,t)=>total+t.rounds.flat().filter(m=>m.result).length,0);
 let incoming=null,file=null,url=null;
 function clean(){if(url)URL.revokeObjectURL(url);url=null;file=null;incoming=null;}
 $('#modal').addEventListener('close',clean);
 function hub(){clean();const state=getState();modal('Mijn gegevens',`<p>Neem je toernooien, uitslagen en topscorers mee naar een andere telefoon.</p><div class="transfer-summary"><span><b>${state.tournaments.length}</b> toernooien</span><span><b>${countMatches(state.tournaments)}</b> gespeelde wedstrijden</span></div><div class="transfer-options"><button class="primary" data-transfer="export">Beveiligd bestand maken →</button><button data-transfer="import">Bestand terugzetten →</button></div><p class="transfer-note">De overdracht gebeurt handmatig. Maak op je oude telefoon een bestand en zet dit op je nieuwe telefoon terug met hetzelfde wachtwoord.</p>`);}
 function exportForm(){clean();modal('Beveiligd overzetten',`<form id="transfer-export-form"><p>Alle toernooien, uitslagen, doelpuntenmakers en vastgelegde selecties gaan mee.</p><label>Naam van deze back-up (optioneel)<input name="label" maxlength="80" placeholder="Bijvoorbeeld: Mijn FIFA-toernooien"></label><label>Wachtwoord<input type="password" name="password" minlength="8" maxlength="256" autocomplete="new-password" required placeholder="Minimaal 8 tekens"></label><label>Wachtwoord herhalen<input type="password" name="repeat" minlength="8" maxlength="256" autocomplete="new-password" required></label><div class="notice">Bewaar het wachtwoord apart. Zonder dit wachtwoord kan het bestand niet worden teruggezet.</div><p class="transfer-error" role="alert"></p><p class="transfer-progress" role="status"></p><div class="transfer-actions"><button type="button" class="subtle" data-transfer="hub">← Terug</button><button class="primary">Bestand maken</button></div></form>`);}
 function importForm(){clean();modal('Gegevens terugzetten',`<form id="transfer-import-form"><p>Kies het beveiligde bestand van je andere telefoon en vul het bijbehorende wachtwoord in.</p><label>Beveiligd bestand<input type="file" name="backup" accept=".fifabackup,.json,application/octet-stream,application/json" required></label><label>Wachtwoord<input type="password" name="password" maxlength="256" autocomplete="current-password" required></label><p class="transfer-note">Je ziet eerst wat er in het bestand staat. Er verandert nog niets op dit toestel.</p><p class="transfer-error" role="alert"></p><p class="transfer-progress" role="status"></p><div class="transfer-actions"><button type="button" class="subtle" data-transfer="hub">← Terug</button><button class="primary">Bestand openen</button></div></form>`);}
 function preview(){
  const {summary}=planImport(getState(),incoming);const tournaments=incoming.state.tournaments;
  modal('Controleer de overdracht',`<p><b>${escape(incoming.label||'FIFA 22-back-up')}</b><br><small>Gemaakt op ${escape(new Date(incoming.createdAt).toLocaleString('nl-NL'))}</small></p><div class="transfer-summary"><span><b>${tournaments.length}</b> toernooien in dit bestand</span><span><b>${countMatches(tournaments)}</b> uitslagen</span></div><p>${summary.added} nieuw · ${summary.unchanged} al aanwezig · ${summary.conflicts.length} afwijkend</p>${summary.conflicts.length?`<div class="notice"><b>Deze toernooien verschillen van je huidige gegevens:</b><ul>${summary.conflicts.map(name=>`<li>${escape(name)}</li>`).join('')}</ul><label class="transfer-checkbox"><input type="checkbox" id="transfer-use-file"><span>Voor deze toernooien de versie uit het bestand gebruiken.</span></label><p>Zonder dit vinkje blijven de huidige versies op dit toestel behouden.</p></div>`:''}<p>Andere toernooien op dit toestel blijven staan. Een bestand opnieuw terugzetten maakt geen dubbele toernooien.</p><p class="transfer-error" role="alert"></p><div class="transfer-actions"><button data-transfer="import">← Terug</button><button class="primary" data-transfer="apply">Terugzetten</button></div>`);
 }
 function busy(form,text){form.querySelectorAll('button,input').forEach(e=>e.disabled=!!text);form.querySelector('.transfer-progress').textContent=text;form.querySelector('.transfer-error').textContent='';}
 function error(message){const target=$('#dialog-content .transfer-error');if(target)target.textContent=message;else notify(message);}
 document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  try{
   if(button.hasAttribute('data-personal-data')){hub();return;}
   const action=button.dataset.transfer;
   if(action==='hub')hub();if(action==='export')exportForm();if(action==='import')importForm();
   if(action==='share'&&file){try{await navigator.share({files:[file],title:'FIFA 22-back-up'});}catch(e){if(e.name!=='AbortError')error('Delen lukt hier niet. Gebruik Bestand bewaren.');}}
   if(action==='apply'){
    button.disabled=true;const useFile=$('#transfer-use-file')?.checked||false;
    const planned=planImport(getState(),incoming,useFile);await onApply(planned.state);
    incoming=null;modal('Gegevens teruggezet',`<p>Je toernooien staan op dit toestel, inclusief uitslagen, doelpuntenmakers en selecties.</p><p><b>${planned.summary.added}</b> toegevoegd · <b>${planned.summary.replaced}</b> bestaande versies vervangen · <b>${planned.summary.unchanged+planned.summary.conflicts.length-planned.summary.replaced}</b> huidige versies behouden.</p><button class="primary" data-close>Klaar</button>`);notify('Gegevens veilig teruggezet.');
   }
  }catch(e){button.disabled=false;error(e.message);}
 });
 document.addEventListener('submit',async event=>{
  const form=event.target;if(!['transfer-export-form','transfer-import-form'].includes(form.id))return;event.preventDefault();
  try{
   if(form.id==='transfer-export-form'){
    const password=form.elements.password.value;if(password!==form.elements.repeat.value)throw Error('De wachtwoorden zijn niet hetzelfde.');
    const label=form.elements.label.value;busy(form,'Bestand beveiligen…');
    const encrypted=await encryptBackup(getState(),password,label);form.elements.password.value='';form.elements.repeat.value='';
    file=new File([encrypted],`FIFA22-backup-${new Date().toLocaleDateString('sv-SE')}.fifabackup`,{type:'application/octet-stream'});url=URL.createObjectURL(file);
    const share=navigator.canShare?.({files:[file]})&&navigator.share;
    modal('Je bestand is klaar',`<p>Bewaar dit bestand op je telefoon of deel het met jezelf, bijvoorbeeld via AirDrop of een berichtenapp.</p><div class="transfer-options"><a class="button-link primary" id="transfer-download" download="${escape(file.name)}" href="${url}">Bestand bewaren ↓</a>${share?'<button data-transfer="share">Bestand delen ↗</button>':''}</div><div class="notice">Op de andere telefoon: open deze app → Mijn gegevens → Bestand terugzetten. Gebruik hetzelfde wachtwoord.</div><p class="transfer-note">Je wachtwoord staat niet in het bestand en wordt niet opgeslagen. Bewaar het apart; er is geen wachtwoordherstel.</p><button class="subtle" data-transfer="hub">← Mijn gegevens</button>`);
   }else{
    const selected=form.elements.backup.files[0];if(!selected)throw Error('Kies eerst een bestand.');if(selected.size>MAX_BACKUP_BYTES)throw Error('Dit bestand is te groot.');
    const password=form.elements.password.value;busy(form,'Bestand openen en controleren…');
    incoming=await decryptBackup(await selected.text(),password);form.elements.password.value='';preview();
   }
  }catch(e){if(form.isConnected){busy(form,'');error(e.message);}else notify(e.message);}
 });
}

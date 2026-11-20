import {installPersonalData} from './personal-data.js?v=c09ce07adec7ab4d';
import {installTeamDrag} from './team-drag.js?v=c09ce07adec7ab4d';
import {bracketLayout,linearBracketLayout} from './bracket.js?v=c09ce07adec7ab4d';
import {loadBuiltInCatalog,withDefaultCatalog,withSpecialTeams} from './catalog.js?v=c09ce07adec7ab4d';
import {initializeStorage,loadLocalState,loadState,saveState} from './storage.js?v=c09ce07adec7ab4d';
import {planImport} from './transfer.js?v=c09ce07adec7ab4d';
import {createTournament,addTeam,editTeam,openTeamSlots,winner,saveResult,matches,stats,nextTournamentMatch,generalStatistics} from './engine.js?v=c09ce07adec7ab4d';
import {recordBook,recordSections,recordSubjects} from './record-book.js?v=c09ce07adec7ab4d';
let storage, initialState;
try {
 storage=await initializeStorage();
 initialState=storage.state??await loadState();
} catch(error) {
 const app=document.querySelector('#app');
 app.innerHTML='<div class="empty"><h2>Toernooien laden lukt niet</h2><p>Controleer je internetverbinding om je accounttoernooien te openen.</p><button class="primary" type="button">Opnieuw proberen</button></div>';
 app.querySelector('button').onclick=()=>location.reload();
 throw error;
}
if(storage==='unavailable'){
 const notice=document.querySelector('#sync-notice');
 notice.hidden=false;
 notice.textContent='Accountopslag is nog niet beschikbaar. Toernooien worden op dit apparaat opgeslagen.';
}
if(storage.state){
 document.documentElement.dataset.accountStorage='true';
 document.querySelector('#storage-label').textContent='Opgeslagen in je account';
}
let state=initialState,page='dashboard',selected=null,filterTournament='',filterDate='',sort='titles';
const statsSections = [
 ['general', 'Algemeen'],
 ['teams', 'Teams'],
 ['scorers', 'Topscorers'],
 ['duels', 'Onderlinge duels'],
 ['venue', 'Thuis / uit'],
 ['records', 'Records']
];
let statsSection = 'teams';
let scorerView = 'players';
let recordSection='goals';
let recordNumber=1;
let recordSubject='teams';
let defaultCatalog;
try{defaultCatalog=await loadBuiltInCatalog(state);state=withDefaultCatalog(state,defaultCatalog);}catch(error){document.querySelector('#app').innerHTML='<div class="empty"><h2>Teams laden lukt nog niet</h2><p>Controleer je verbinding en open de app opnieuw.</p><button onclick="location.reload()">Opnieuw proberen</button></div>';throw error;}
const mobileRounds={},bracketViews={},bracketZoom={},bracketScroll={};
let bracketObserver,bracketFocus=true;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),date=s=>new Date(s).toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'});
const name=(t,id)=>t.version.teams.find(x=>x.id===id)?.name||'Nog te bepalen';
const initials=n=>n.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const teamNames=new Map(defaultCatalog.teams.map(t=>[t.name,t])),teamIds=new Map(defaultCatalog.teams.map(t=>[t.id,t]));
const catalogPlayerIds=new Set(defaultCatalog.players.map(player=>player.id));
const catalogScorers = new Map(defaultCatalog.players.filter(player => player.flagCode).map(player => [player.id, player]));
const flagSprite = new URL('./data/nationality-flags.svg', import.meta.url).href;
const regionNames = new Intl.DisplayNames(['nl'],{type:'region',fallback:'none'});
const subdivisionNames = {'gb-eng':'Engeland','gb-nir':'Noord-Ierland','gb-sct':'Schotland','gb-wls':'Wales'};
function nationalityName(code,fallback){
 return subdivisionNames[code]||regionNames.of(code.toUpperCase())||fallback||code.toUpperCase();
}
function nationalityFlag({flagCode,nationality},decorative=false){
 const accessibility=decorative?'aria-hidden="true"':`role="img" aria-label="${esc(nationality)}"`;
 return `<svg class="scorer-flag" ${accessibility}><use href="${esc(flagSprite)}#flag-${esc(flagCode)}"></use></svg>`;
}
function scorerLabel(player, team){
 const source = catalogScorers.get(player?.id);
 const club = source?.clubName || (team?.type === 'club' ? team.name : '');
 const label = esc(player?.displayName || player?.name || 'Onbekende doelpuntenmaker') + (club ? ` (${esc(club)})` : '');
 if (!source) return label;
 return `${nationalityFlag(source)} ${label}`;
}
function matchGoalLabel(tournament, match, goal){
 if (goal.kind !== 'player') return goal.kind === 'own' ? 'Eigen doelpunt' : 'Onbekend';
 const teamId = match.teams[goal.side];
 const player = tournament.version.players.find(p => p.id === goal.playerId && p.teamId === teamId);
 return scorerLabel(player, tournament.version.teams.find(team => team.id === teamId));
}
const badge=(n,id)=>{const team=(id?teamIds.get(id):teamNames.get(n)),logo=team?.localLogo||team?.logoUrl;return logo?`<span class="badge has-logo"><img class="${team.id==='special:soccer-aid'?'soccer-aid-logo':''}" src="${esc(logo)}" data-team-logo data-fallback="${esc(team.flagUrl||'')}" loading="lazy" decoding="async" draggable="false" alt=""><span class="badge-fallback">${esc(initials(n))}</span></span>`:`<span class="badge">${esc(initials(n))}</span>`;};
document.addEventListener('error',event=>{const img=event.target;if(!img.matches?.('[data-team-logo]'))return;if(img.dataset.fallback&&img.src!==img.dataset.fallback){const fallback=img.dataset.fallback;img.dataset.fallback='';img.src=fallback;}else {img.hidden=true;img.parentElement.classList.add('logo-failed');}},true);
const normalizeSearch=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const teamMatches=(team,query)=>[team.name,...team.aliases||[]].some(name=>normalizeSearch(name).includes(normalizeSearch(query)));
const done=t=>!!t.rounds.at(-1)[0].result;
const roundName=(t,r)=>t.rounds.length-r===1?'Finale':t.rounds.length-r===2?'Halve finale':t.rounds.length-r===3?'Kwartfinale':t.rounds.length-r===4?'Achtste finale':t.rounds.length-r===5?'Zestiende finale':`Ronde ${r+1}`;
const notify=s=>{$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4500);};
let confirmedState=structuredClone(state);
async function persist(){
 try{state.revision=await saveState(state);confirmedState=structuredClone(state);}
 catch(error){
  try{state=withDefaultCatalog(await loadState(),defaultCatalog);confirmedState=structuredClone(state);}
  catch{state=structuredClone(confirmedState);}
  render();
  throw error;
 }
}
function modal(title,body){$('#dialog-content').innerHTML=`<div class="modal-head"><h2>${title}</h2><button data-close aria-label="Sluiten">×</button></div>${body}`;$('#modal').classList.toggle('team-picker-modal',body.includes('id="team-picker"')||body.includes('id="entry-picker"')||body.includes('id="team-manager"'));if(!$('#modal').open)$('#modal').showModal();}
const empty=(title,text,button='Nieuw toernooi',action='new')=>`<div class="empty"><span class="empty-symbol">⌘</span><h3>${title}</h3><p>${text}</p><button class="primary" data-action="${action}">${button} ↗</button></div>`;
const title=(eyebrow,h,sub,button=true)=>`<div class="page-title"><div><div class="eyebrow">${eyebrow}</div><h1>${h}</h1><p>${sub}</p></div>${button?'<div class="title-actions"><button class="mobile-catalog subtle" data-action="catalog" aria-label="Teamcatalogus beheren">⚙</button><button class="primary" data-action="new">＋ Nieuw toernooi</button></div>':''}</div>`;
function matchCard(t,m,r,i){return `<button class="match-card ${m.result?'played':''}" data-match="${t.id}|${r}|${i}"><div class="match-meta">${esc(t.name)} <span>${m.bye?'VRIJSTELLING':m.result?'AFGEROND':m.teams.every(Boolean)?'TE SPELEN':'WACHT OP TEAMS'}</span></div>${m.teams.map((id,s)=>`<div class="team-line ${winner(m)===id&&id?'winning':''}">${badge(id?name(t,id):'–')}<span>${id?esc(name(t,id)):m.bye?'Vrijgesteld':'Nog te bepalen'}</span><b>${m.result?m.result.score[s]:'–'}</b></div>`).join('')}<div class="match-foot">${roundName(t,r)} ${m.result?.penalties?`<span>Strafschoppen ${m.result.penalties.join(' – ')}</span>`:'<span>Bekijk wedstrijd →</span>'}</div></button>`;}
function tournamentCard(t){return `<article class="tournament-tile"><button class="tournament-card" data-tournament="${t.id}"><div class="match-meta"><span class="pill ${done(t)?'finished':''}">${done(t)?'AFGEROND':'ACTIEF'}</span><span></span></div><div class="trophy">${done(t)?'♜':'⌘'}</div><h3>${esc(t.name)}</h3><p>${t.teamIds.length}/${t.teamCount||t.teamIds.length} teams <span>·</span> ${matches([t]).length} wedstrijden gespeeld</p><div class="card-bottom">${done(t)?'Kampioen: '+esc(name(t,winner(t.rounds.at(-1)[0]))):'De weg naar de finale'}<span>→</span></div></button><button class="tile-delete" data-delete="${t.id}" aria-label="${esc(t.name)} verwijderen">Verwijderen</button></article>`;}
function tournamentOverviewCard(t){
 const completed=done(t);
 const next=completed?null:nextTournamentMatch(t);
 const ids=completed?[winner(t.rounds.at(-1)[0])]:next?.match.teams||[];
 const colors=ids.map(id=>{
  const color=teamIds.get(id)?.cardColor;
  return /^#[0-9a-f]{6}$/i.test(color)?color:'#a0b09f';
 });
 const style=colors.length
  ? ` style="--club-left:${colors[0]};--club-right:${colors.at(-1)}"`
  : '';
 const team=id=>`<span class="tournament-preview-team">
  <span class="tournament-preview-logo">${badge(name(t,id),id)}</span>
  <strong>${esc(name(t,id))}</strong>
 </span>`;
 const preview=completed
  ? `<span class="tournament-preview-kicker">Kampioen</span><span class="tournament-preview-lineup champion-lineup">${team(ids[0])}</span>`
  : next
   ? `<span class="tournament-preview-kicker">Volgende wedstrijd · ${roundName(t,next.round)}</span>
      <span class="tournament-preview-lineup">${team(ids[0])}<span class="tournament-preview-versus">tegen</span>${team(ids[1])}</span>`
   : '<span class="tournament-preview-kicker">Wacht op deelnemers</span>';
 return `<article class="tournament-tile tournament-preview-tile tournament-preview-card"${style}>
  <div class="tournament-preview-header">
   <span class="pill ${completed?'finished':''}">${completed?'AFGEROND':'ACTIEF'}</span>
   <button type="button" class="tournament-preview-title" data-rename-tournament="${esc(t.id)}" aria-label="Naam wijzigen: ${esc(t.name)}" aria-haspopup="dialog"><span>${esc(t.name)}</span><span class="tournament-title-edit" aria-hidden="true">✎</span></button>
  </div>
  <span class="tournament-preview">${preview}</span>
  <div class="tournament-preview-footer">
   <span>${t.teamIds.length}/${t.teamCount||t.teamIds.length} teams · ${matches([t]).length} gespeeld</span>
   <button type="button" class="tournament-preview-open" data-tournament="${esc(t.id)}" aria-label="Open toernooi: ${esc(t.name)}">Open toernooi <span aria-hidden="true">→</span></button>
  </div>
  <button type="button" class="tile-delete" data-delete="${esc(t.id)}" aria-label="${esc(t.name)} verwijderen">Verwijderen</button>
 </article>`;
}
function dashboard(){const ts=state.tournaments,ms=matches(ts),active=ts.filter(t=>!done(t)),champions=ts.filter(done);return title('JOUW TOERNOOICENTRUM','Klaar voor de aftrap<span class="lime">?</span>','De rivaliteit begint op het veld. De historie schrijf je hier.')+`<section class="hero"><div><div class="eyebrow">ELKE WEDSTRIJD TELT</div><h2>Één schema.<br>Één kampioen.<br><span>Jullie verhaal.</span></h2><p>Van de eerste aftrap tot de beslissende penalty.<br>Houd de strijd bij, wij bewaren de cijfers.</p><button class="primary" data-action="new">Start een toernooi ↗</button></div><div class="hero-art" aria-hidden="true"><div class="pitch"></div><div class="giant">22</div><div class="art-caption">THE ROAD TO GLORY <span>↗</span></div></div></section><div class="metrics">${[['Actieve toernooien',active.length,'⌘'],['Gespeelde wedstrijden',ms.length,'⚽'],['Gescoorde goals',ms.reduce((a,m)=>a+m.result.score[0]+m.result.score[1],0),'↗'],['Gekroonde kampioenen',champions.length,'♜']].map(([label,n,icon])=>`<div class="metric"><span>${label}<i>${icon}</i></span><strong>${String(n).padStart(2,'0')}</strong><small>Over alle toernooien</small></div>`).join('')}</div><div class="section-title"><h2>De bal rolt <span class="count">${active.length}</span></h2><a href="#tournaments">Alle toernooien ↗</a></div>${active.length?`<div class="cards">${active.map(tournamentCard).join('')}</div>`:empty('Jouw eerste kampioen wacht','Nodig je vrienden uit, kies je teams en laat de strijd beginnen.')}<div class="two-col"><section><div class="section-title"><h2>Volgende aftrap</h2><span class="eyebrow">KLAAR OM TE SPELEN</span></div>${ts.flatMap(t=>t.rounds.flatMap((round,r)=>round.map((m,i)=>({t,m,r,i})))).filter(x=>!x.m.bye&&!x.m.result&&x.m.teams.every(Boolean)).slice(0,4).map(x=>matchCard(x.t,x.m,x.r,x.i)).join('')||'<div class="quiet">Het speelschema verschijnt zodra je een toernooi start.</div>'}</section><section><div class="section-title"><h2>Laatste fluitsignaal</h2><a href="#archive">Het archief ↗</a></div>${ms.slice().sort((a,b)=>b.result.date.localeCompare(a.result.date)).slice(0,4).map(m=>matchCard(m.tournament,m,m.round,m.tournament.rounds[m.round].findIndex(x=>x.id===m.id))).join('')||'<div class="quiet">Nog geen uitslagen. Tijd om geschiedenis te schrijven.</div>'}</section></div>${champions.length?'<div class="section-title"><h2>De eregalerij</h2></div><div class="cards">'+champions.map(tournamentCard).join('')+'</div>':''}`;}
function renderTree(t){
 const layout=bracketFocus?linearBracketLayout(t):bracketLayout(t),view=bracketViews[t.id]||'overview';
 const card=(n)=>{const m=t.rounds[n.round][n.index];const names=m.teams.map((id,side)=>id?name(t,id):m.bye&&side===1?'Vrijstelling':n.round?`Winnaar ${roundName(t,n.round-1).toLowerCase()} ${n.index*2+side+1}`:'＋ Team toevoegen');return `<div class="tree-node ${n.side==='final'?'tree-final':''}" style="left:${n.x}px;top:${n.y}px;width:${layout.cardWidth}px;height:${layout.cardHeight}px">${n.side==='final'?'<div class="final-heading">♜ DE FINALE</div>':''}<button class="tree-match ${m.result?'is-played':''} ${m.bye?'is-bye':''}" data-match="${t.id}|${n.round}|${n.index}" aria-label="${esc(roundName(t,n.round)+': '+names.join(' tegen ')+(m.result?', '+m.result.score.join(' tegen '):''))}"><span class="tree-match-status">#${n.index+1} · ${m.bye&&m.teams[0]?'DIRECT DOOR':m.result?'AFGEROND':m.teams.every(Boolean)?'TE SPELEN':n.round===0?'TEAMS AANVULLEN':'WACHT OP WINNAAR'}</span>${names.map((label,side)=>`<span ${m.teams[side]?`data-drag-team="${t.id}|${teamPosition(t,m.teams[side]).index}|${teamPosition(t,m.teams[side]).side}" data-team-drop="${t.id}|${teamPosition(t,m.teams[side]).index}|${teamPosition(t,m.teams[side]).side}"`:n.round===0&&!(m.bye&&side===1)?`data-team-drop="${t.id}|${n.index}|${side}"`:''} ${n.round===0&&!m.teams[side]&&!(m.bye&&side===1)?`data-empty-slot="${t.id}|${n.index}|${side}"`: ''} class="tree-team ${m.teams[side]&&winner(m)===m.teams[side]?'tree-winner':''}">${badge(m.teams[side]?label:'–',m.teams[side])}<span title="${esc(label)}">${esc(label)}</span><b>${m.result?m.result.score[side]:m.bye&&side===0?'↗':'–'}</b></span>`).join('')}${m.result?.penalties?`<span class="tree-penalties">Strafschoppen ${m.result.penalties.join('–')}</span>`:''}</button></div>`;};
 return `<section class="bracket-section"><div class="bracket-toolbar"><p class="team-drag-help">Houd een team even ingedrukt en sleep het naar een andere plek om snel te wisselen.</p><div class="tournament-menu-actions"><button data-personal-data>Mijn gegevens overzetten</button><button data-manage-teams="${t.id}">⇄ Teams wisselen</button><button class="danger" data-delete="${t.id}">Toernooi verwijderen</button></div><button class="focus-toggle" data-toggle-focus>${bracketFocus?'Normaal venster':'Hele scherm'}</button><div class="bracket-tabs" aria-label="Schemaweergave"><button data-bracket-view="overview" aria-pressed="${view==='overview'}">Volledig schema</button><button data-bracket-view="rounds" aria-pressed="${view==='rounds'}">Per ronde</button></div><div class="bracket-zoom" ${view==='overview'?'':'hidden'}><button data-tree-zoom="out" aria-label="Schema verkleinen">−</button><span id="tree-zoom-label"></span><button data-tree-zoom="in" aria-label="Schema vergroten">＋</button><button data-tree-zoom="fit">Alles in beeld</button></div></div><div class="tree-view" ${view==='overview'?'':'hidden'}><p class="bracket-hint">Van buiten naar binnen, op weg naar de finale. Tik op een wedstrijd om de uitslag in te vullen.</p><div class="tree-viewport" tabindex="0" role="region" aria-label="Volledig knock-outschema, verschuif om alle wedstrijden te bekijken"><div class="tree-space"><div class="tree-canvas" data-width="${layout.width}" data-height="${layout.height}" style="width:${layout.width}px;height:${layout.height}px"><svg class="tree-lines" width="${layout.width}" height="${layout.height}" aria-hidden="true">${layout.edges.map(edge=>`<path d="${edge.path}" class="${winner(t.rounds[edge.from[0]][edge.from[1]])?'advanced':''}"/>`).join('')}</svg>${layout.headers.map(h=>`<h3 class="tree-round-title" style="left:${h.x}px;width:${layout.cardWidth}px">${roundName(t,h.round)}</h3>`).join('')}${layout.nodes.map(card).join('')}</div></div></div><div class="bracket-legend"><span><i></i> Te spelen</span><span><i class="played"></i> Afgerond</span><span>De groene lijn volgt een doorgestroomd team</span></div></div></section>`;
}
function setupBracket(){
 bracketObserver?.disconnect();const viewport=$('.tree-viewport'),canvas=$('.tree-canvas');if(!viewport||!canvas||$('.tree-view').hidden)return;
 const resize=()=>{const width=Number(canvas.dataset.width),height=Number(canvas.dataset.height);const fit=Math.min(viewport.clientWidth/width,viewport.clientHeight/height,1.5);const zoom=bracketZoom[selected]??(bracketFocus?1:innerWidth<=760?Math.max(.85,fit):Math.min(1,fit));canvas.style.transform=`scale(${zoom})`;const spaceWidth=Math.max(width*zoom,viewport.clientWidth),spaceHeight=Math.max(height*zoom,viewport.clientHeight);$('.tree-space').style.width=`${spaceWidth}px`;$('.tree-space').style.height=`${spaceHeight}px`;canvas.style.left=bracketFocus?'0px':`${(spaceWidth-width*zoom)/2}px`;canvas.style.top=bracketFocus?'0px':`${(spaceHeight-height*zoom)/2}px`;$('#tree-zoom-label').textContent=`${Math.round(zoom*100)}%`;canvas.dataset.zoom=zoom;};
 resize();const pan=bracketScroll[selected];if(pan){viewport.scrollLeft=pan.left;viewport.scrollTop=pan.top;}viewport.addEventListener('scroll',()=>{bracketScroll[selected]={left:viewport.scrollLeft,top:viewport.scrollTop};},{passive:true});bracketObserver=new ResizeObserver(resize);bracketObserver.observe(viewport);
}
function tournaments(){if(!selected)return title('DE WEG NAAR GOUD','Toernooien','Van de eerste ronde naar eeuwige roem.')+(state.tournaments.length?`<div class="cards tournament-overview">${state.tournaments.map(tournamentOverviewCard).join('')}</div>`:empty('Een nieuw toernooi begint bij jou','Kies 2 tot 32 teams. Wij regelen het knock-outschema.'));const t=state.tournaments.find(t=>t.id===selected);if(!t){selected=null;return tournaments();}return `<div class="bracket-focus-bar"><button class="subtle" data-action="back">← Toernooien</button><div><b>${esc(t.name)}</b><small>${t.teamIds.length}/${t.teamCount||t.teamIds.length} teams · ${matches([t]).length} wedstrijden gespeeld</small></div><button class="bracket-eye" data-toggle-overview aria-label="Hele schema bekijken"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="bracket-menu-button" data-bracket-menu aria-label="Toernooiopties" aria-expanded="false">⋮</button></div><div class="tournament-heading"><button class="subtle" data-action="back">← Alle toernooien</button>`+title(`${t.teamIds.length}/${t.teamCount||t.teamIds.length} TEAMS · ${done(t)?'AFGEROND':'ACTIEF'}`,esc(t.name),`FIFA 22 · ${matches([t]).length} gespeelde wedstrijden`,false)+`</div>${openTeamSlots(t).length?`<div class="pending-teams-bar"><span>${openTeamSlots(t).length} plekken nog vrij. Je kunt al wedstrijden spelen.</span><button data-fill-teams="${t.id}" class="primary">Teams aanvullen</button></div>`:''}`+(done(t)?`<div class="champion">♜ <div><small>KAMPIOEN</small><h2>${badge(name(t,winner(t.rounds.at(-1)[0])),winner(t.rounds.at(-1)[0]))} ${esc(name(t,winner(t.rounds.at(-1)[0])))}</h2><p>Finalist: ${esc(name(t,t.rounds.at(-1)[0].teams.find(x=>x!==winner(t.rounds.at(-1)[0]))))}</p></div></div>`:'')+renderTree(t)+`<div class="round-view" ${bracketViews[t.id]==='rounds'?'':'hidden'}><label class="mobile-round">Ronde <select id="round-select">${t.rounds.map((_,r)=>`<option value="${r}" ${r===(mobileRounds[t.id]||0)?'selected':''}>${roundName(t,r)}</option>`).join('')}</select></label><div class="bracket">${t.rounds.map((round,r)=>`<section class="bracket-round ${r===(mobileRounds[t.id]||0)?'mobile-selected':''}" data-round="${r}"><h3>${roundName(t,r)} <span>${round.length}</span></h3><div class="round-matches">${round.map((m,i)=>matchCard(t,m,r,i)).join('')}</div></section>`).join('')}</div></div><button class="danger" data-delete="${t.id}">Toernooi verwijderen</button>`;}
function filtered(){return state.tournaments.filter(t=>!filterTournament||t.id===filterTournament).map(t=>{if(!filterDate)return t;const clone=structuredClone(t);clone.rounds.forEach(r=>r.forEach(m=>{if(m.result&&m.result.date.slice(0,10)<filterDate)m.result=null;}));return clone;});}
function filters(){return `<div class="filters"><label>Toernooi<select id="filter-tournament"><option value="">Alle toernooien</option>${state.tournaments.map(t=>`<option value="${t.id}" ${filterTournament===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label>Resultaten vanaf<input id="filter-date" type="date" value="${filterDate}"></label><button class="subtle" data-action="clear-filter">Filters wissen</button></div>`;}
function archiveRows(ms){return ms.length?`<div class="table-wrap"><table><thead><tr><th>Wedstrijd</th><th>Uitslag</th><th>Toernooi / ronde</th><th>Datum</th></tr></thead><tbody>${ms.map(m=>`<tr data-match="${m.tournament.id}|${m.round}|${m.tournament.rounds[m.round].findIndex(x=>x.id===m.id)}"><td>${badge(name(m.tournament,m.teams[0]),m.teams[0])} ${esc(name(m.tournament,m.teams[0]))} <span class="muted">tegen</span> ${badge(name(m.tournament,m.teams[1]),m.teams[1])} ${esc(name(m.tournament,m.teams[1]))}<small>${m.result.goals.map(g=>`${matchGoalLabel(m.tournament,m,g)} (${g.count})`).join(' · ')||'Doelpuntenmakers nog niet ingevuld'}</small></td><td><b class="score">${m.result.score.join(' – ')}</b>${m.result.penalties?'<small>Strafschoppen '+m.result.penalties.join(' – ')+'</small>':''}</td><td>${esc(m.tournament.name)}<small>${roundName(m.tournament,m.round)}</small></td><td>${date(m.result.date)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="quiet">Nog geen wedstrijden in deze selectie.</div>';}
function venueResults({homeWins,awayWins}){
 return `<section aria-labelledby="venue-results-heading">
  <h2 id="venue-results-heading">Thuis- en uitzeges</h2>
  <dl class="metrics venue-results">
   <div class="metric"><dt>Thuiszeges</dt><dd><strong>${homeWins}</strong></dd></div>
   <div class="metric"><dt>Uitzeges</dt><dd><strong>${awayWins}</strong></dd></div>
  </dl>
 </section>`;
}
function rankings(){
 const buttons = statsSections.map(([id, label]) =>
  `<button type="button" data-stats-section="${id}" aria-pressed="${id === statsSection}" aria-controls="stats-content">${label}</button>`
 ).join('');
 return title('DE CIJFERS ACHTER DE STRIJD','Statistieken','Wie domineert het veld? Alle bevestigde uitslagen, bij elkaar.',false)
  + `<div class="stats-switcher stats-main-switcher" role="group" aria-label="Statistiekonderdelen">${buttons}</div>`
  + filters()
  + `<div id="stats-content">${renderStatsSection()}</div>`;
}
function nationalityRankings(players){
 const nationalities=new Map();
 for(const player of players){
  const source=catalogScorers.get(player.id);
  if(!source?.flagCode||!source.nationality)continue;
  const {flagCode,nationality}=source;
  if(!nationalities.has(flagCode)){
   const displayName=nationalityName(flagCode,nationality);
   nationalities.set(flagCode,{flagCode,nationality:displayName,goals:0,players:[]});
  }
  const group=nationalities.get(flagCode);
  group.goals+=player.goals;
  group.players.push(player);
 }
 return [...nationalities.values()].sort((a,b)=>b.goals-a.goals||a.nationality.localeCompare(b.nationality,'nl'));
}
function renderNationalityTable(players){
 const groups=nationalityRankings(players);
 if(!groups.length)return '<div class="quiet">Nog geen goals van spelers met een bekende nationaliteit in deze selectie.</div>';
 return `<div class="table-wrap"><table class="nationality-table">
  <thead><tr><th scope="col">NATIONALITEIT</th><th scope="col">GOALS</th></tr></thead>
  <tbody>${groups.map((group,index)=>`<tr><td><button type="button" class="subtle nationality-button" data-nationality="${esc(group.flagCode)}" aria-haspopup="dialog"><span class="rank">${index+1}</span>${nationalityFlag(group,true)} <span>${esc(group.nationality)}</span></button></td><td class="lime">${group.goals}</td></tr>`).join('')}</tbody>
 </table></div>`;
}
function openNationality(code){
 const group=nationalityRankings(stats(state.tournaments).players).find(nation=>nation.flagCode===code);
 if(!group)return;
 const players=group.players.sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,'nl'));
 modal(`${nationalityFlag(group,true)} ${esc(group.nationality)}`,
  `<p>${group.goals} goals over alle toernooien</p><div class="table-wrap"><table>
  <thead><tr><th scope="col">DOELPUNTENMAKER</th><th scope="col">GOALS</th></tr></thead>
  <tbody>${players.map(player=>`<tr><td>${scorerLabel(player)}</td><td class="lime">${player.goals}</td></tr>`).join('')}</tbody>
  </table></div>`);
}
function recordTable(headers,rows){
 return rows.length?`<div class="table-wrap"><table>
  <thead><tr>${headers.map(header=>`<th scope="col">${header}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody>
 </table></div>`:'<div class="quiet">Nog geen resultaten voor dit record in deze selectie.</div>';
}
function recordHolderLabel(holder){
 const teamLabel=team=>`${badge(team.name,team.id)} ${esc(team.name)}`;
 if(holder.teams)return holder.teams.map(teamLabel).join(' – ');
 if(holder.team)return teamLabel(holder);
 if(holder.player){
  const logos=holder.playedFor.map(team=>badge(team.name,team.id)).join(' ');
  return `${logos} ${scorerLabel(holder)}`;
 }
 return esc(holder.name);
}
function renderRecords(tournaments){
 const section=recordSections.find(category=>category.id===recordSection);
 const subjects=recordSubjects(recordNumber);
 const {rows,format,unavailable}=recordBook(recordNumber,tournaments,{history:state.tournaments,subject:recordSubject});
 const selection=`<div class="filters record-filters">
  <label>Categorie<select id="record-section">${recordSections.map(({id,label})=>`<option value="${id}" ${id===recordSection?'selected':''}>${label}</option>`).join('')}</select></label>
  <label>Record<select id="record-number">${section.items.map(({number,name})=>`<option value="${number}" ${number===recordNumber?'selected':''}>${name}</option>`).join('')}</select></label>
  ${subjects.length?`<label>Doelpunten<select id="record-subject">${subjects.map(([id,label])=>`<option value="${id}" ${id===recordSubject?'selected':''}>${label}</option>`).join('')}</select></label>`:''}
 </div>`;
 if(unavailable)return selection+`<p class="notice">${esc(unavailable)}</p>`;
 const numberFormat=new Intl.NumberFormat('nl-NL',{style:format==='percent'?'percent':'decimal',maximumFractionDigits:format==='integer'?0:2});
 const dateFormat=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'short',year:'numeric'});
 const time=value=>`<time datetime="${esc(value)}">${dateFormat.format(new Date(value))}</time>`;
 const tableRows=rows.map(({holder,value,first,last,detail},index)=>{
  const tournament=first.tournament.id===last.tournament.id?esc(last.tournament.name):`${esc(first.tournament.name)} → ${esc(last.tournament.name)}`;
  const dates=first.day===last.day?time(last.date):`${time(first.date)} – ${time(last.date)}`;
  return `<tr><td><span class="rank">${index+1}</span>${recordHolderLabel(holder)}</td>
   <td class="lime">${numberFormat.format(value)}${detail?`<small>${esc(detail)}</small>`:''}</td>
   <td>${tournament}</td><td>${dates}</td></tr>`;
 });
 const note=[63,90,99].includes(recordNumber)
  ? 'De regerend kampioen is de winnaar van het laatst afgeronde toernooi vóór de wedstrijd.'
  : recordSection==='titles'
   ? 'Titelrecords volgen de volgorde van afgeronde toernooien.'
   : 'Goals en gelijke spelen volgen de eindstand vóór de strafschoppenserie. De serie beslist wel wie wint en verliest.';
 return selection+`<p class="muted">${note}</p>`+recordTable(['RECORDHOUDER','RECORDWAARDE','TOERNOOI','DATUM'],tableRows);
}
function scorerCountries(ids){
 const countries=new Map();
 for(const id of ids){
  const source=catalogScorers.get(id);
  if(source) countries.set(source.flagCode,nationalityName(source.flagCode,source.nationality));
 }
 return countries;
}
const generalCountryOrder=(a,b)=>a[1].localeCompare(b[1],'nl');
const generalTeamOrder=(a,b)=>a.name.localeCompare(b.name,'nl');
function generalCountryLabel(flagCode,nationality){
 return `${nationalityFlag({flagCode,nationality},true)} ${esc(nationality)}`;
}
function generalMore(key,count){
 return `<button type="button" class="general-detail" data-general-list="${key}" aria-haspopup="dialog">+${count} meer</button>`;
}
function overviewFlags(countries,key){
 if(!countries.size)return '';
 const ordered=[...countries].sort(generalCountryOrder);
 const chips=ordered.slice(0,6).map(([flagCode,nationality])=>`<span>${generalCountryLabel(flagCode,nationality)}</span>`);
 const remaining=ordered.length-chips.length;
 if(remaining)chips.push(generalMore(key,remaining));
 return `<div class="general-flags">${chips.join('')}</div>`;
}
function overviewLogos(teams,key){
 if(!teams.size)return '';
 const ordered=[...teams.values()].sort(generalTeamOrder);
 const logos=ordered.slice(0,5).map(team=>`<span class="general-team-logo" title="${esc(team.name)}" role="img" aria-label="${esc(team.name)}">${badge(team.name,team.id)}</span>`);
 const remaining=ordered.length-logos.length;
 if(remaining)logos.push(generalMore(key,remaining));
 return `<div class="general-team-logos">${logos.join('')}</div>`;
}
function generalMetric(label,value,context,visual=''){
 return `<article class="general-metric">
  <h4>${label}</h4><strong>${value.toLocaleString('nl-NL')}</strong><p>${context}</p>${visual}
 </article>`;
}
function generalScorerMetric(scorers){
 const catalogScored=[...scorers].filter(id=>catalogPlayerIds.has(id)).length;
 const total=catalogPlayerIds.size;
 const otherScorers=scorers.size-catalogScored;
 const percentage=new Intl.NumberFormat('nl-NL',{style:'percent',maximumFractionDigits:2}).format(total?catalogScored/total:0);
 return `<article class="general-metric general-scorers">
  <h4>Doelpuntenmakers</h4>
  <strong class="general-scorer-ratio">${catalogScored.toLocaleString('nl-NL')}<span>/${total.toLocaleString('nl-NL')}</span></strong>
  <p><b>${percentage}</b> van de spelers in de FIFA 22-catalogus heeft gescoord.</p>
  ${otherScorers?`<p>${otherScorers} buiten de catalogus</p>`:''}
  <button type="button" class="general-detail" data-general-list="scorers" aria-haspopup="dialog">Bekijk alle doelpuntenmakers</button>
 </article>`;
}
function generalOverview(tournaments){
 const data=generalStatistics(tournaments,teamIds,{onlyPlayed:Boolean(filterDate)});
 return {...data,
  scoringCountries:scorerCountries(data.scorers),
  topCountries:scorerCountries(data.topScorers),
  clubCountries:new Map([...data.clubCountries].map(code=>[code,nationalityName(code)]))
 };
}
function openGeneralList(button){
 const key=button.dataset.generalList;
 const title=esc(button.closest('.general-metric').querySelector('h4').textContent);
 const tournaments=filtered();
 if(key==='scorers'){
  openScorerDirectory(tournaments);
  return;
 }
 const items=generalOverview(tournaments)[key];
 const countries=key==='scoringCountries'||key==='topCountries'||key==='clubCountries';
 const labels=countries
  ? [...items].sort(generalCountryOrder).map(([code,name])=>generalCountryLabel(code,name))
  : [...items.values()].sort(generalTeamOrder).map(team=>`${badge(team.name,team.id)} ${esc(team.name)}`);
 modal(title,`<ul class="general-detail-list">${labels.map(label=>`<li>${label}</li>`).join('')}</ul>`);
}
let scorerDirectory;
const directoryName=player=>String(player.displayName||player.name);
function directoryLeagueFlags(teams){
 const countries=new Map();
 for(const team of teams){
  if(team.type!=='club'||!team.league)continue;
  const flag=team.flagUrl?.match(/\/([a-z]{2}(?:-[a-z]{3})?)\.png$/i)?.[1];
  if(!flag)continue;
  if(!countries.has(team.league))countries.set(team.league,new Map());
  const votes=countries.get(team.league);
  votes.set(flag,(votes.get(flag)||0)+1);
 }
 const flags=new Map();
 for(const [league,votes] of countries){
  const ranked=[...votes].sort((a,b)=>b[1]-a[1]);
  if(ranked[0][1]!==ranked[1]?.[1])flags.set(league,ranked[0][0]);
 }
 // The FIFA 22 catalogue features Wrexham as the only club in this English league.
 flags.set('English National League','gb-eng');
 return flags;
}
function openScorerDirectory(tournaments){
 const teams=new Map(),rosters=new Map();
 function addVersion(version){
  for(const team of version.teams){
   if(!teams.has(team.id))teams.set(team.id,team);
  }
  for(const player of version.players){
   if(!rosters.has(player.teamId))rosters.set(player.teamId,new Map());
   const roster=rosters.get(player.teamId);
   if(!roster.has(player.id))roster.set(player.id,player);
  }
 }
 addVersion(defaultCatalog);
 for(const tournament of state.tournaments)addVersion(tournament.version);
 const leagues=new Map();
 for(const team of teams.values()){
  const leagueName=typeof team.league==='string'?team.league.trim():'';
  const league=team.type==='nationaal'?'Landenteams'
   :team.type==='special'?'Speciale teams'
   :leagueName||(team.type==='club'?'Overige clubs':'Overige teams');
  if(!leagues.has(league))leagues.set(league,[]);
  leagues.get(league).push(team);
 }
 const goals=new Map(stats(tournaments).players.map(player=>[player.id,player.goals]));
 scorerDirectory={goals,leagues,rosters,leagueFlags:directoryLeagueFlags(defaultCatalog.teams)};
 renderScorerDirectory();
}
function renderScorerDirectory(league='',teamId=''){
 const {goals,leagues,rosters,leagueFlags}=scorerDirectory;
 const leagueFlag=name=>{
  const flagCode=leagueFlags.get(name);
  return flagCode?nationalityFlag({flagCode,nationality:nationalityName(flagCode)}):'';
 };
 const clubs=leagues.get(league);
 const team=clubs?.find(club=>club.id===teamId);
 const competitionLink='<button type="button" data-scorer-directory>Alle competities</button>';
 const breadcrumb=team
  ? `${competitionLink}<span aria-hidden="true">›</span><button type="button" data-scorer-directory data-directory-league="${esc(league)}">${esc(league)}</button>`
  : clubs?competitionLink:'';
 let title,content;
 if(team){
  const roster=[...(rosters.get(team.id)?.values()||[])].sort((a,b)=>
   (goals.get(b.id)||0)-(goals.get(a.id)||0)||directoryName(a).localeCompare(directoryName(b),'nl'));
  title=`${badge(team.name,team.id)} ${esc(team.name)}`;
  content=roster.length?`<ul class="scorer-directory-players">${roster.map(player=>{
   const total=goals.get(player.id)||0;
   const flag=catalogScorers.get(player.id);
   const positions=player.position||(Array.isArray(player.positions)?player.positions.join(' · '):'');
   return `<li class="${total?'has-scored':''}">
    <span>${flag?nationalityFlag(flag)+' ':''}${esc(directoryName(player))}
     <small class="scorer-directory-position">${positions?'Positie: '+esc(positions):'Positie onbekend'}</small>
    </span>
    ${total?`<strong>${total} ${total===1?'goal':'goals'}</strong>`:''}
   </li>`;
  }).join('')}</ul>`:'<p>Geen spelers beschikbaar voor dit team.</p>';
 }else if(clubs){
  title=`${leagueFlag(league)} ${esc(league)}`;
  content=`<ul class="scorer-directory-options">${[...clubs].sort(generalTeamOrder).map(club=>`
   <li><button type="button" data-scorer-directory data-directory-league="${esc(league)}" data-directory-team="${esc(club.id)}">
    ${badge(club.name,club.id)} <span>${esc(club.name)}</span><span aria-hidden="true">›</span>
   </button></li>`).join('')}</ul>`;
 }else{
  title='Competities en teams';
  content=`<ul class="scorer-directory-options">${[...leagues.keys()].sort((a,b)=>a.localeCompare(b,'nl')).map(name=>`
   <li><button type="button" data-scorer-directory data-directory-league="${esc(name)}">
    ${leagueFlag(name)} <span>${esc(name)}</span><span aria-hidden="true">›</span>
   </button></li>`).join('')}</ul>`;
 }
 const goalContext=filterTournament||filterDate?'binnen je statistiekfilters':'over alle toernooien';
 modal('Doelpuntenmakers',`<section id="scorer-directory" aria-labelledby="scorer-directory-title">
  ${breadcrumb?`<div role="navigation" aria-label="Terug naar overzicht" class="scorer-directory-path">${breadcrumb}</div>`:''}
  <h3 id="scorer-directory-title" tabindex="-1">${title}</h3>
  ${team?`<p>De gemarkeerde spelers hebben ${goalContext} gescoord. Goals bij andere teams tellen mee.</p>`:''}
  ${content}
 </section>`);
 $('#scorer-directory-title').focus();
}
function renderGeneral(tournaments){
 const data=generalOverview(tournaments);
 const {scoringCountries,topCountries,clubCountries}=data;
 const section=(id,icon,title,metrics)=>`<section class="general-group" aria-labelledby="${id}">
  <h3 id="${id}"><span aria-hidden="true">${icon}</span> ${title}</h3>
  <div class="general-grid">${metrics.join('')}</div>
 </section>`;
 return '<div class="section-title"><h2>Algemene statistieken</h2></div>'
  +section('general-goals','⚽','Doelpunten',[
   generalMetric('Scorende nationaliteiten',scoringCountries.size,'Bekende nationaliteiten van spelers die scoorden',overviewFlags(scoringCountries,'scoringCountries')),
   generalScorerMetric(data.scorers),
   generalMetric('Nationaliteiten van topscorers',topCountries.size,'Topscorers per toernooi, inclusief gedeelde eerste plaatsen',overviewFlags(topCountries,'topCountries')),
   generalMetric('Spelers met een hattrick',data.hatTrickScorers.size,'Minstens drie goals voor hetzelfde team in één wedstrijd')
  ])
  +section('general-clubs','🌍','Clubs en landen',[
   generalMetric('Gebruikte clubs',data.clubs.size,'Unieke clubs die hebben meegedaan',overviewLogos(data.clubs,'clubs')),
   generalMetric('Herkomstlanden van clubs',clubCountries.size,'Landen van de gebruikte clubs',overviewFlags(clubCountries,'clubCountries'))
  ])
  +section('general-finals','🏆','Finales en titels',[
   generalMetric('Verschillende kampioenen',data.champions.size,'Clubs, landenteams en speciale teams met een titel',overviewLogos(data.champions,'champions')),
   generalMetric('Clubs met een titel',data.clubChampions.size,'Unieke clubs die een toernooi wonnen',overviewLogos(data.clubChampions,'clubChampions')),
   generalMetric('Verschillende finalisten',data.finalists.size,'Clubs, landenteams en speciale teams die een finale haalden',overviewLogos(data.finalists,'finalists')),
   generalMetric('Clubs in een finale',data.clubFinalists.size,'Unieke clubs die een finale haalden',overviewLogos(data.clubFinalists,'clubFinalists'))
  ]);
}
function renderStatsSection(){
 const tournaments=filtered();
 if(statsSection==='general')return renderGeneral(tournaments);
 if(statsSection==='records')return renderRecords(tournaments);
 const s=stats(tournaments);
 switch (statsSection) {
 case 'venue':
  return venueResults(s);
 case 'teams':
  return `<div class="section-title"><h2>Teams</h2><label>Sorteer op <select id="sort">${[['titles','Titels'],['finals','Finales'],['wins','Gewonnen'],['gf','Goals voor'],['entries','Deelnames'],['played','Gespeeld'],['ga','Goals tegen'],['difference','Doelsaldo']].map(([v,l])=>`<option value="${v}" ${sort===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
   <div class="table-wrap"><table>
    <thead><tr><th>TEAM</th><th>DEELN.</th><th>GS</th><th>W</th><th>GV</th><th>GT</th><th>DS</th><th>FINALES</th><th>TITELS</th></tr></thead>
    <tbody>${s.teams.sort((a,b)=>(sort==='difference'?b.gf-b.ga-a.gf+a.ga:b[sort]-a[sort])||a.name.localeCompare(b.name)).map((x,i)=>`<tr data-team="${esc(x.id)}"><td><span class="rank">${i+1}</span>${badge(x.name)} ${esc(x.name)}</td>${[x.entries,x.played,x.wins,x.gf,x.ga,x.gf-x.ga,x.finals,x.titles].map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody>
   </table>${!s.teams.length?'<div class="quiet">Nog geen teams in deze selectie.</div>':''}</div>`;
 case 'scorers':
  return `<div class="section-title"><h2>Topscorers</h2><span class="eyebrow">EXCLUSIEF STRAFSCHOPPENSERIES</span></div>
   <div class="stats-switcher scorer-switcher" role="group" aria-label="Topscorers groeperen">
    <button type="button" data-scorer-view="players" aria-pressed="${scorerView==='players'}" aria-controls="scorer-results">Spelers</button>
    <button type="button" data-scorer-view="nationalities" aria-pressed="${scorerView==='nationalities'}" aria-controls="scorer-results">Nationaliteiten</button>
   </div>
   <div id="scorer-results">${scorerView==='nationalities'?renderNationalityTable(s.players):`<div class="table-wrap"><table>
    <thead><tr><th>SPELER</th><th>GOALS</th><th><span aria-hidden="true">🏟️</span> GESPEELD</th><th>TOERNOOIEN</th><th><span aria-hidden="true">🏆</span> TITELS (FINALES)</th></tr></thead>
    <tbody>${s.players.sort((a,b)=>b.goals-a.goals).map((p,i)=>`<tr data-player="${esc(p.id)}"><td><span class="rank">${i+1}</span>${scorerLabel(p)}</td><td class="lime">${p.goals}</td><td>${p.played}</td><td>${p.tournamentsPlayed}</td><td>${p.titles} (${p.finals})</td></tr>`).join('')}</tbody>
   </table>${!s.players.length?'<div class="quiet">Nog geen doelpunten aan spelers toegewezen.</div>':''}</div>`}</div>`;
 case 'duels':
  return `<div class="section-title"><h2>Onderlinge duels</h2></div>
   ${s.duels.length ? `<div class="cards">${s.duels.map((d,i)=>`<button class="tournament-card" data-duel="${i}"><h3>${d.ids.map(id=>esc(s.teams.find(t=>t.id===id)?.name)).join(' × ')}</h3><p>${d.matches.length} ontmoetingen · ${d.goals} goals</p><small>${d.ids.map(id=>`${esc(s.teams.find(t=>t.id===id)?.name)}: ${d.matches.filter(m=>winner(m)===id).length} zeges`).join(' · ')}</small></button>`).join('')}</div>` : '<div class="quiet">Nog geen onderlinge duels in deze selectie.</div>'}`;
 }
}
function render(){page=location.hash.slice(1)||'dashboard';if(!['dashboard','tournaments','rankings','archive'].includes(page))page='dashboard';document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+page));document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.body.classList.toggle('bracket-screen',page==='tournaments'&&!!selected&&bracketFocus);$('#app').innerHTML=page==='dashboard'?dashboard():page==='tournaments'?tournaments():page==='rankings'?rankings():title('GEEN WEDSTRIJD VERGETEN','Wedstrijdarchief','Elke uitslag heeft een verhaal. Dit is jullie geschiedenis.',false)+filters()+archiveRows(matches(filtered()).sort((a,b)=>b.result.date.localeCompare(a.result.date)));setupBracket();}
function catalog(){modal('FIFA 22-teams',`<div class="catalog-summary"><strong>${defaultCatalog.teams.length}</strong><span>teams staan voor je klaar</span></div><p>701 clubs, 33 nationale ploegen en 2 speciale teams. Soccer Aid bevat 41 spelers en adidas All-Star 23 spelers uit de aangeleverde screenshots. Deze selectie is standaard beschikbaar, ook als je de app voor het eerst opent.</p><button class="primary" data-action="new">Maak een toernooi →</button><details class="source-details"><summary>Over deze selectie</summary><p>FIFA 22 · SoFIFA-versie 220002. De exacte selectiedatum is niet bevestigd. Vrouwenploegen ontbreken en volledige dekking van Kick-off is niet bevestigd. Landfilters voor clubs zijn alleen beschikbaar als de bron het clubl­and vermeldt.</p><a href="https://github.com/Pearlkhanna/fifa22-dataset" target="_blank" rel="noopener noreferrer">Bekijk de databron ↗</a></details>`);}
let draft={};
function stepIndicator(step){return `<ol class="wizard-steps" aria-label="Toernooi maken">${['Naam','Aantal teams','Teams kiezen'].map((label,i)=>`<li class="${i+1===step?'current':i+1<step?'complete':''}" ${i+1===step?'aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join('')}</ol>`;}
function newTournament(){draft={name:'',count:6,ids:[],method:'random',preview:null};wizardStep(1);}
function wizardStep(step){
 draft.step=step;
 if(step===1){modal('Nieuw toernooi',`${stepIndicator(1)}<form id="name-form"><h3>Hoe heet jullie toernooi?</h3><p>Geef de strijd een eigen naam.</p><label>Toernooinaam<input name="name" required maxlength="100" value="${esc(draft.name)}" placeholder="Bijvoorbeeld: De vrijdagavondcup" autocomplete="off"></label><div class="wizard-actions"><button class="primary">Volgende →</button></div></form>`);return;}
 if(step===2){modal('Hoeveel teams doen mee?',`${stepIndicator(2)}<form id="count-form"><p><b>${esc(draft.name)}</b> · kies 2 tot en met 32 teams.</p><div class="count-options">${[2,4,6,8,16,32].map(n=>`<button type="button" data-count="${n}" class="${draft.count===n?'chosen':''}" aria-pressed="${draft.count===n}">${n}<small>teams</small></button>`).join('')}</div><label>Of kies een ander aantal<input name="count" type="number" inputmode="numeric" min="2" max="32" required value="${draft.count}"></label><div class="wizard-actions"><button type="button" class="subtle" data-step="1">← Terug</button><button class="primary">Teams kiezen →</button></div></form>`);return;}
 modal('Kies jullie teams',`${stepIndicator(3)}<form id="new-form"><p class="wizard-summary"><b>${esc(draft.name)}</b> · ${draft.count} plekken</p><p>Kies minimaal twee teams om te beginnen. De overige teams kun je later in het schema toevoegen.</p><div class="team-search"><label>Zoek een team<input id="team-search" type="search" placeholder="Bijvoorbeeld: Ajax of Paris…" autocomplete="off"></label><details class="team-filters"><summary>Filters en indeling</summary><div class="filters"><select id="league" aria-label="Competitie"></select><select id="country" aria-label="Land"></select><select id="type" aria-label="Teamtype"><option value="">Clubs en nationale ploegen</option><option value="club">Clubs</option><option value="nationaal">Nationale ploegen</option><option value="special">Speciale teams</option></select><label>Wedstrijden indelen<select name="method"><option value="random" ${draft.method==='random'?'selected':''}>Eerste ronde loten</option><option value="manual" ${draft.method==='manual'?'selected':''}>Teams in mijn selectievolgorde</option></select></label></div></details></div><div id="selection-count" class="selection-count" role="status"></div><div id="selected-teams" class="selected-teams"></div><div id="team-picker"></div><div class="wizard-actions"><button type="button" class="subtle" data-step="2">← Terug</button><button class="primary" id="preview-button">Bekijk speelschema →</button></div></form>`);
 updatePicker(true);
}
function updatePicker(reset=false){
 if(!$('#new-form'))return;const v=defaultCatalog;
 if(reset)for(const key of ['league','country'])$('#'+key).innerHTML=`<option value="">Alle ${key==='league'?'competities':'landen'}</option>`+[...new Set(v.teams.map(t=>t[key]).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join('');
 const query=$('#team-search').value.toLocaleLowerCase('nl');
 const teams=v.teams.filter(t=>teamMatches(t,query)&&(!$('#league').value||t.league===$('#league').value)&&(!$('#country').value||t.country===$('#country').value)&&(!$('#type').value||t.type===$('#type').value)).sort((a,b)=>a.name.localeCompare(b.name));
 $('#team-picker').innerHTML=teams.length?teams.map(t=>`<button type="button" class="pick-team ${draft.ids.includes(t.id)?'chosen':''}" data-pick="${esc(t.id)}" aria-pressed="${draft.ids.includes(t.id)}" ${!draft.ids.includes(t.id)&&draft.ids.length>=draft.count?'disabled':''}>${badge(t.name)}<span>${esc(t.name)}<small>${t.rosterStatus==='unverified'?'Selectie nog niet geverifieerd':t.rosterStatus==='user-supplied'?'Selectie uit aangeleverde screenshots':esc(t.league||t.country||'Nationale ploeg')}</small></span><b>${draft.ids.includes(t.id)?'✓':'＋'}</b></button>`).join(''):'<div class="quiet">Geen teams gevonden. Probeer een andere naam of pas je filters aan.</div>';
 $('#selection-count').textContent=`${draft.ids.length} / ${draft.count} gekozen${draft.ids.length===draft.count?' · Klaar voor de aftrap!':` · Nog ${draft.count-draft.ids.length} te kiezen`}`;
 $('#selected-teams').innerHTML=draft.ids.map(id=>`<button type="button" class="team-chip" data-pick="${esc(id)}" aria-label="${esc(v.teams.find(t=>t.id===id).name)} verwijderen">${badge(v.teams.find(t=>t.id===id).name,id)}${esc(v.teams.find(t=>t.id===id).name)} ×</button>`).join('');
 $('#preview-button').disabled=draft.ids.length<2;$('#preview-button').textContent=draft.ids.length<draft.count?'Starten met '+draft.ids.length+' teams →':'Bekijk speelschema →';
}
function teamCatalog(t){const base=t.entryCatalog||state.versions.find(v=>v.id===t.version.id)||t.version;return withSpecialTeams(base,defaultCatalog);}
function teamPosition(t,id){for(let index=0;index<t.rounds[0].length;index++){const side=t.rounds[0][index].teams.indexOf(id);if(side>=0)return {index,side};}return null;}
function openTeamManager(tid){
 const t=state.tournaments.find(t=>t.id===tid);
 modal('Teams wisselen',`<p>Tik op een team om het te vervangen of te ruilen met een andere deelnemer.</p><div class="entry-picker" id="team-manager">${t.rounds[0].flatMap((m,index)=>m.teams.map((id,side)=>m.bye&&side===1?'':`<button class="pick-team" data-edit-seed="${t.id}|${index}|${side}">${badge(id?name(t,id):'–',id)}<span>${id?esc(name(t,id)):'Team toevoegen'}<small>Eerste ronde · wedstrijd ${index+1} · plek ${side+1}</small></span><b>⇄</b></button>`)).join('')}</div>`);
}
function openTeamChoice(tid,index,side,mode){
 const t=state.tournaments.find(t=>t.id===tid);draft.teamEntry={tid,index,side,mode};
 const current=t.rounds[0][index].teams[side];
 const removeButton=mode==='edit'&&openTeamSlots(t).length&&t.teamIds.length>1
  ? '<button type="button" class="danger" data-remove-team>Team verwijderen</button>' : '';
 modal(mode==='edit'?'Team omwisselen':'Team toevoegen',`<p><b>${mode==='edit'?esc(name(t,current)):esc(t.name)}</b> · ${mode==='edit'?'kies een vervanger of een team om mee te ruilen':`${t.teamIds.length} / ${t.teamCount||t.teamIds.length} teams ingevuld`}</p>${removeButton}<label>Zoek een club of land<input id="entry-search" type="search" placeholder="Zoek bijvoorbeeld Ajax…" autocomplete="off"></label><label>Teamtype<select id="entry-type"><option value="">Alle teams</option><option value="club">Clubs</option><option value="nationaal">Nationale ploegen</option><option value="special">Speciale teams</option></select></label><div id="entry-picker" class="entry-picker"></div>`);updateEntryPicker();
}
function openAddTeams(tid,index,side){
 const t=state.tournaments.find(t=>t.id===tid),slots=openTeamSlots(t);if(!slots.length){notify('Alle plekken zijn ingevuld.');return;}
 const slot=index!==undefined?slots.find(s=>s.index===index&&s.side===side):slots[0];if(!slot){notify('Deze plek is al ingevuld.');return;}
 openTeamChoice(tid,slot.index,slot.side,'add');
}
function updateEntryPicker(){
 if(!draft.teamEntry||!$('#entry-picker'))return;const {tid,index,side,mode}=draft.teamEntry,t=state.tournaments.find(t=>t.id===tid),query=$('#entry-search').value.toLowerCase(),type=$('#entry-type').value,current=t.rounds[0][index].teams[side];
 const available=teamCatalog(t).teams.filter(team=>team.id!==current&&(mode==='edit'||!t.teamIds.includes(team.id))&&teamMatches(team,query)&&(!type||team.type===type)).sort((a,b)=>(mode==='edit'?Number(t.teamIds.includes(b.id))-Number(t.teamIds.includes(a.id)):0)||a.name.localeCompare(b.name));
 $('#entry-picker').innerHTML=available.length?available.map((team,i)=>`${mode==='edit'&&(i===0||t.teamIds.includes(available[i-1].id)!==t.teamIds.includes(team.id))?`<h3 class="team-choice-group">${t.teamIds.includes(team.id)?'Omwisselen met een deelnemer':'Vervangen door een ander team'}</h3>`:''}<button class="pick-team" type="button" ${mode==='edit'?'data-change-team':'data-add-team'}="${esc(team.id)}">${badge(team.name,team.id)}<span>${esc(team.name)}<small>${t.teamIds.includes(team.id)?'⇄ Omwisselen met deze deelnemer':team.rosterStatus==='unverified'?'Selectie nog niet geverifieerd':team.rosterStatus==='user-supplied'?'Selectie uit aangeleverde screenshots':esc(team.league||team.country)}</small></span><b>${t.teamIds.includes(team.id)?'⇄':'＋'}</b></button>`).join(''):'<div class="quiet">Geen beschikbare teams gevonden.</div>';
}
async function applyTeamEdit(tid,index,side,target){
 const t=state.tournaments.find(t=>t.id===tid);if(!t)throw Error('Toernooi niet gevonden.');
 const removing=target===null;
 const catalog=removing?null:teamCatalog(t);
 const result=editTeam(t,index,side,target,catalog);
 if(result.needsConfirmation){
  const details=result.needsConfirmation.map(x=>`${roundName(t,x.round)}: ${x.match.teams.map(id=>name(t,id)).join(' – ')} (${x.match.result.score.join('–')})`).join('\n');
  const action=removing?`${name(t,t.rounds[0][index].teams[side])} verwijderen`:'Deze teamwissel';
  if(!confirm(action+' zet de volgende uitslagen terug:\n'+details+'\nDoorgaan?'))return false;
  editTeam(t,index,side,target,catalog,true);
 }
 await persist();if($('#modal').open)$('#modal').close();render();notify(removing?'Team verwijderd. De plek is weer vrij.':'Teams aangepast.');return true;
}
function openRenameTournament(id){
 const tournament=state.tournaments.find(t=>t.id===id);
 if(!tournament)return;
 modal('Toernooinaam wijzigen',`<form id="rename-tournament-form" data-tournament-id="${esc(id)}">
  <label>Toernooinaam<input name="tournamentName" value="${esc(tournament.name)}" required></label>
  <div class="delete-actions"><button type="button" data-close>Annuleren</button><button type="submit" class="primary">Opslaan</button></div>
 </form>`);
 const input=$('#rename-tournament-form').elements.tournamentName;
 input.focus();
 input.select();
}
async function renameTournament(form){
 const {tournamentId}=form.dataset;
 const tournament=state.tournaments.find(t=>t.id===tournamentId);
 if(!tournament)throw Error('Toernooi niet gevonden.');
 const input=form.elements.tournamentName;
 const newName=input.value.trim();
 if(!newName){
  input.focus();
  throw Error('Geef je toernooi een naam.');
 }
 const button=form.querySelector('[type="submit"]');
 if(button.disabled)return;
 if(newName===tournament.name){
  $('#modal').close();
  return;
 }
 button.disabled=true;
 try{
  tournament.name=newName;
  await persist();
  const returnFocus=form.isConnected&&$('#modal').open;
  if(returnFocus)$('#modal').close();
  render();
  if(returnFocus)$(`[data-rename-tournament="${CSS.escape(tournamentId)}"]`)?.focus();
  notify('Toernooinaam gewijzigd.');
 }finally{
  button.disabled=false;
 }
}
function confirmDeletion(tid){
 const t=state.tournaments.find(t=>t.id===tid);if(!t)return;
 modal('Toernooi verwijderen',`<p>Wil je <b>${esc(t.name)}</b> verwijderen, inclusief ${matches([t]).length} opgeslagen uitslagen?</p><p>De bijbehorende goals en resultaten verdwijnen ook uit de statistieken.</p><div class="delete-actions"><button data-close>Annuleren</button><button class="danger" data-confirm-delete="${t.id}">Toernooi verwijderen</button></div>`);
}

function openMatch(tid,r,i){const t=state.tournaments.find(t=>t.id===tid),m=t.rounds[r][i];if(r===0&&m.teams.some((id,side)=>!id&&!(m.bye&&side===1))){openAddTeams(tid,i,m.teams.findIndex((id,side)=>!id&&!(m.bye&&side===1)));return;}if(m.bye){modal('Vrijstelling',`<p>${esc(name(t,m.teams[0]))} gaat direct door. Dit telt niet als gespeelde of gewonnen wedstrijd.</p>`);return;}if(!m.teams.every(Boolean)){notify('Speel eerst de voorgaande wedstrijden.');return;}draft.match={tid,r,i,goals:structuredClone(m.result?.goals||[])};modal(roundName(t,r),`<div class="eyebrow">${esc(t.name)}</div><form id="result-form"><div class="score-entry">${m.teams.map((id,s)=>`<label>${badge(name(t,id))}<b>${esc(name(t,id))}</b><input type="number" inputmode="numeric" min="0" max="999" required name="score${s}" value="${m.result?.score[s]??0}" aria-label="Score ${esc(name(t,id))}"></label>`).join('<span>:</span>')}</div><div class="notice">Eindstand inclusief verlenging.</div><div class="match-team-actions">${m.teams.map(id=>{const pos=teamPosition(t,id);return `<button type="button" class="subtle" data-edit-seed="${t.id}|${pos.index}|${pos.side}">⇄ ${esc(name(t,id))} wijzigen</button>`;}).join('')}</div><button type="button" class="subtle penalty-toggle" data-toggle-penalties aria-expanded="${!!m.result?.penalties}">${m.result?.penalties?'−':'＋'} Strafschoppenserie</button><div id="penalty-fields" class="form-grid" ${m.result?.penalties?'':'hidden'}><label>Strafschoppen ${esc(name(t,m.teams[0]))}<input name="pen0" type="number" inputmode="numeric" min="0" max="999" value="${m.result?.penalties?.[0]??''}"></label><label>Strafschoppen ${esc(name(t,m.teams[1]))}<input name="pen1" type="number" inputmode="numeric" min="0" max="999" value="${m.result?.penalties?.[1]??''}"></label></div>${m.teams.some(id=>t.version.teams.find(team=>team.id===id)?.rosterStatus==='unverified')?'<div class="notice">De speciale FIFA 22-selectie is nog niet geverifieerd. Je kunt goals voorlopig als onbekend opslaan.</div>':''}<h3>Doelpuntenmakers</h3><p>Vul de eindstand in en tik op een speler om één doelpunt toe te wijzen.</p><div id="goals-list"></div><div class="goal-add"><label>Team<select id="goal-side">${m.teams.map((id,s)=>`<option value="${s}">${esc(name(t,id))}</option>`).join('')}</select></label><label>Zoek speler<input id="player-search" type="search" placeholder="Naam speler"></label></div><div id="goals-remaining" class="notice" role="status"></div><div id="goal-players" class="goal-players" role="group" aria-label="Spelers"></div><div class="goal-extras"><button type="button" class="subtle" data-goal-kind="unknown">＋ Onbekend</button><button type="button" class="subtle" data-goal-kind="own" aria-label="Eigen doelpunt van de tegenstander toevoegen">＋ Eigen doelpunt tegenstander</button></div><button class="primary">${m.result?'Correctie bevestigen':'Uitslag bevestigen'} →</button></form>`);goalOptions();drawGoals();}
function goalOptions(){
 const {tid,r,i}=draft.match,t=state.tournaments.find(t=>t.id===tid);
 const teamId=t.rounds[r][i].teams[Number($('#goal-side').value)];
 const team=t.version.teams.find(team=>team.id===teamId);
 const query=normalizeSearch($('#player-search').value);
 const players=t.version.players.filter(p=>p.teamId===teamId&&[p.name,p.displayName,p.shortName].some(n=>normalizeSearch(n).includes(query)));
 const list=$('#goal-players');
 list.innerHTML=players.map(p=>`<button type="button" data-goal-kind="player" data-goal-player="${esc(p.id)}"><span>${scorerLabel(p,team)}</span><span aria-hidden="true">＋</span></button>`).join('')
  || '<p class="muted">Geen spelers gevonden.</p>';
 list.scrollTop=0;
}
function remainingGoals(side){
 const input=$('#result-form').elements['score'+side];
 const assigned=draft.match.goals.filter(goal=>goal.side===side).reduce((sum,goal)=>sum+goal.count,0);
 return (Number.isNaN(input.valueAsNumber)?0:input.valueAsNumber)-assigned;
}
function addGoal(kind,playerId){
 const side=Number($('#goal-side').value);
 if(remainingGoals(side)<1){
  notify('Vul een hogere score in of verwijder een toegewezen doelpunt.');
  return;
 }
 const goals=draft.match.goals;
 const existing=goals.find(goal=>goal.side===side&&goal.kind===kind&&goal.playerId===playerId);
 if(existing)existing.count++;
 else goals.push({side,kind,playerId,count:1});
 drawGoals();
}
function drawGoals(){
 const {tid,r,i,goals}=draft.match,t=state.tournaments.find(t=>t.id===tid),m=t.rounds[r][i];
 $('#goals-list').innerHTML=goals.map((g,index)=>`<div class="goal-row"><span>${esc(name(t,m.teams[g.side]))} · ${matchGoalLabel(t,m,g)}</span><b>× ${g.count}</b><button type="button" data-remove-goal="${index}" aria-label="Eén doelpunt verwijderen">−</button></div>`).join('');
 $('#goals-remaining').textContent=m.teams.map((id,side)=>{
  const remaining=remainingGoals(side);
  return `${name(t,id)}: ${remaining<0?`${-remaining} te veel toegewezen`:`${remaining} nog toe te wijzen`}`;
 }).join(' · ');
}
function profile(kind,id){const ts=filtered(),s=stats(ts);if(kind==='team'){const x=s.teams.find(x=>x.id===id);const ms=matches(ts).filter(m=>m.teams.includes(id));const scorers=s.players.filter(p=>p.teams[id]).sort((a,b)=>b.teams[id]-a.teams[id]);modal(esc(x.name),`<p>${x.entries} deelnames · ${x.wins} zeges · ${x.finals} finales · ${x.titles} titels</p><h3>Beste resultaat per toernooi</h3>${ts.filter(t=>t.teamIds.includes(id)).map(t=>{let best=0;t.rounds.forEach((round,r)=>{if(round.some(m=>m.teams.includes(id)))best=r;});return `<p>${esc(t.name)}: ${done(t)&&winner(t.rounds.at(-1)[0])===id?'Kampioen':roundName(t,best)}</p>`;}).join('')}<h3>Eigen topscorers</h3>${scorers.map(p=>`<p>${scorerLabel(p,teamIds.get(id))} · ${p.teams[id]} goals</p>`).join('')||'<p>Nog geen toegewezen goals.</p>'}${archiveRows(ms)}`);}else if(kind==='player'){const p=s.players.find(x=>x.id===id);modal(esc(p.name),`<p>${p.goals} goals in ${p.matchIds.size} wedstrijden</p><h3>Per team</h3>${Object.entries(p.teams).map(([id,n])=>`<p>${esc(s.teams.find(t=>t.id===id)?.name)}: ${n}</p>`).join('')}<h3>Per toernooi</h3>${Object.entries(p.tournaments).map(([id,n])=>`<p>${esc(ts.find(t=>t.id===id)?.name)}: ${n}</p>`).join('')}${archiveRows(matches(ts).filter(m=>p.matchIds.has(m.id)))}`);}else{const d=s.duels[Number(id)];modal('Onderlinge duels',archiveRows(d.matches));}}
$('#modal').addEventListener('click',event=>{
 const link=event.target.closest('[data-scorer-directory]');
 if(link&&scorerDirectory)renderScorerDirectory(link.dataset.directoryLeague,link.dataset.directoryTeam);
});
$('#modal').addEventListener('close',()=>{
 if(!$('#modal').open)scorerDirectory=null;
});
$('#app').addEventListener('click', event => {
 const generalButton=event.target.closest('[data-general-list]');
 if(generalButton){
  openGeneralList(generalButton);
  return;
 }
 const viewButton=event.target.closest('[data-scorer-view]');
 if(viewButton){
  if(viewButton.dataset.scorerView!==scorerView){
   scorerView=viewButton.dataset.scorerView;
   $('#stats-content').innerHTML=renderStatsSection();
   $(`[data-scorer-view="${scorerView}"]`).focus();
  }
  return;
 }
 const nationButton=event.target.closest('[data-nationality]');
 if(nationButton){
  openNationality(nationButton.dataset.nationality);
  return;
 }
 const button = event.target.closest('[data-stats-section]');
 if (!button || button.dataset.statsSection === statsSection) return;
 $('[data-stats-section][aria-pressed="true"]').setAttribute('aria-pressed', 'false');
 statsSection = button.dataset.statsSection;
 button.setAttribute('aria-pressed', 'true');
 $('#stats-content').innerHTML = renderStatsSection();
});
document.addEventListener('click',async e=>{const slot=e.target.closest('[data-empty-slot]');if(slot){const [tid,index,side]=slot.dataset.emptySlot.split('|');openAddTeams(tid,Number(index),Number(side));return;}const b=e.target.closest('button,a,tr');if(!b)return;try{if(b.dataset.manageTeams)openTeamManager(b.dataset.manageTeams);if(b.dataset.editSeed){const [tid,index,side]=b.dataset.editSeed.split('|');const t=state.tournaments.find(t=>t.id===tid);if(t.rounds[0][Number(index)].teams[Number(side)])openTeamChoice(tid,Number(index),Number(side),'edit');else openAddTeams(tid,Number(index),Number(side));}if(b.dataset.changeTeam){const {tid,index,side}=draft.teamEntry;await applyTeamEdit(tid,index,side,b.dataset.changeTeam);}if(b.hasAttribute('data-remove-team')){
 const {tid,index,side}=draft.teamEntry;
 await applyTeamEdit(tid,index,side,null);
 return;
}if(b.hasAttribute('data-toggle-penalties')){const fields=$('#penalty-fields');fields.hidden=!fields.hidden;if(fields.hidden)fields.querySelectorAll('input').forEach(input=>input.value='');b.setAttribute('aria-expanded',String(!fields.hidden));b.textContent=(fields.hidden?'＋':'−')+' Strafschoppenserie';}if(b.dataset.confirmDelete){const tid=b.dataset.confirmDelete;state.tournaments=state.tournaments.filter(t=>t.id!==tid);await persist();if(selected===tid)selected=null;if(filterTournament===tid)filterTournament='';$('#modal').close();render();notify('Toernooi verwijderd.');}if(b.hasAttribute('data-bracket-menu')){const toolbar=$('.bracket-toolbar');const open=toolbar.classList.toggle('options-open');b.setAttribute('aria-expanded',String(open));}if(b.hasAttribute('data-toggle-overview')){const canvas=$('.tree-canvas');if(Number(canvas.dataset.zoom)<.9){bracketZoom[selected]=1;}else{bracketZoom[selected]=Math.min(1.5,$('.tree-viewport').clientWidth/Number(canvas.dataset.width),$('.tree-viewport').clientHeight/Number(canvas.dataset.height));}bracketScroll[selected]={left:0,top:0};setupBracket();}if(b.hasAttribute('data-toggle-focus')){bracketFocus=!bracketFocus;render();}if(b.dataset.fillTeams)openAddTeams(b.dataset.fillTeams);if(b.dataset.addTeam){const {tid,index,side}=draft.teamEntry;const t=state.tournaments.find(t=>t.id===tid);addTeam(t,b.dataset.addTeam,index,side,teamCatalog(t));await persist();render();if(openTeamSlots(t).length)openAddTeams(tid);else{$('#modal').close();notify('Alle teams zijn ingevuld.');}}if(b.dataset.bracketView){bracketViews[selected]=b.dataset.bracketView;render();}if(b.dataset.treeZoom){const canvas=$('.tree-canvas');const zoom=Number(canvas.dataset.zoom);if(b.dataset.treeZoom==='fit')bracketScroll[selected]={left:0,top:0};bracketZoom[selected]=b.dataset.treeZoom==='fit'?Math.min(1.5,$('.tree-viewport').clientWidth/Number(canvas.dataset.width),$('.tree-viewport').clientHeight/Number(canvas.dataset.height)):Math.max(.2,Math.min(1.5,zoom+(b.dataset.treeZoom==='in'?.15:-.15)));setupBracket();}if(b.hasAttribute('data-close'))$('#modal').close();if(b.dataset.action==='new')newTournament();if(b.dataset.action==='catalog')catalog();if(b.dataset.action==='back'){selected=null;render();}if(b.dataset.action==='clear-filter'){filterTournament='';filterDate='';render();}if(b.dataset.renameTournament){openRenameTournament(b.dataset.renameTournament);return;}if(b.dataset.tournament){bracketFocus=true;selected=b.dataset.tournament;location.hash='tournaments';render();}if(b.dataset.match){const [tid,r,i]=b.dataset.match.split('|');openMatch(tid,Number(r),Number(i));}if(b.dataset.team)profile('team',b.dataset.team);if(b.dataset.player)profile('player',b.dataset.player);if(b.dataset.duel!==undefined)profile('duel',b.dataset.duel);if(b.dataset.pick){const id=b.dataset.pick,index=draft.ids.indexOf(id);if(index>=0)draft.ids.splice(index,1);else if(draft.ids.length<draft.count)draft.ids.push(id);else notify('Alle plekken zijn gevuld.');if(index<0&&$('#team-search'))$('#team-search').value='';updatePicker();}if(b.dataset.removeGoal!==undefined){
 const index=Number(b.dataset.removeGoal),goals=draft.match.goals;
 if(--goals[index].count===0)goals.splice(index,1);
 drawGoals();
 const buttons=$('#goals-list').querySelectorAll('[data-remove-goal]');
 (buttons[Math.min(index,buttons.length-1)]||$('#goal-side')).focus();
}if(b.dataset.goalKind)addGoal(b.dataset.goalKind,b.dataset.goalPlayer??null);if(b.dataset.action==='start'){state.tournaments.push(draft.preview);await persist();selected=draft.preview.id;$('#modal').close();location.hash='tournaments';render();notify('Toernooi gestart. Succes!');}if(b.dataset.action==='redo')wizardStep(3);if(b.dataset.step)wizardStep(Number(b.dataset.step));if(b.dataset.count){draft.count=Number(b.dataset.count);wizardStep(2);}if(b.dataset.delete)confirmDeletion(b.dataset.delete);}catch(err){notify(err.message);}});
document.addEventListener('submit',async e=>{e.preventDefault();try{const f=e.target;if(f.id==='rename-tournament-form'){await renameTournament(f);return;}if(f.id==='name-form'){draft.name=f.elements.name.value.trim();if(!draft.name)throw Error('Geef je toernooi een naam.');wizardStep(2);}if(f.id==='count-form'){const count=Number(f.elements.count.value);if(!Number.isInteger(count)||count<2||count>32)throw Error('Kies 2 tot en met 32 teams.');draft.count=count;draft.ids=draft.ids.slice(0,count);wizardStep(3);}if(f.id==='new-form'){const count=draft.count;if(draft.ids.length<2||draft.ids.length>count)throw Error('Kies minimaal twee teams om te starten.');draft.method=f.elements.method.value;draft.preview=createTournament(draft.name,defaultCatalog,draft.ids,draft.method==='random',draft.count);const t=draft.preview;modal('Jouw speelschema',`<p>${esc(t.name)} · ${t.teamIds.length}/${t.teamCount} teams ingevuld · ${t.rounds[0].filter(m=>m.bye).length} vrijstellingen</p>${t.rounds[0].map(m=>`<div class="goal-row">${m.teams[0]?badge(name(t,m.teams[0]),m.teams[0]):''}${esc(name(t,m.teams[0]))} <b>${m.bye?'→ direct door':'tegen'}</b> ${m.bye?'':esc(name(t,m.teams[1]))}</div>`).join('')}<div class="notice">Je kunt direct spelen. Lege plekken kun je later invullen door erop te tikken. Een vrijstelling betekent direct door naar de volgende ronde.</div><button class="subtle" data-action="redo">Opnieuw samenstellen</button> <button class="primary" data-action="start">Start toernooi →</button>`);}if(f.id==='result-form'){const {tid,r,i,goals}=draft.match,t=state.tournaments.find(t=>t.id===tid);const result={score:[Number(f.elements.score0.value),Number(f.elements.score1.value)],penalties:!$('#penalty-fields').hidden&&f.elements.pen0.value!==''&&f.elements.pen1.value!==''?[Number(f.elements.pen0.value),Number(f.elements.pen1.value)]:null,goals,date:t.rounds[r][i].result?.date};let outcome=saveResult(t,r,i,result);if(outcome.needsConfirmation){const text=outcome.needsConfirmation.map(m=>m.teams.map(id=>name(t,id)).join(' – ')).join('\n');if(!confirm('De winnaar verandert. Deze vervolguitslagen worden teruggezet:\n'+text+'\nDoorgaan?'))return;saveResult(t,r,i,result,true);}await persist();$('#modal').close();render();notify('Uitslag opgeslagen. Schema en statistieken bijgewerkt.');}}catch(err){notify(err.message);}});
document.addEventListener('change',async e=>{try{if(['record-section','record-number','record-subject'].includes(e.target.id)){
 const {id,value}=e.target;
 if(id==='record-section'){
  recordSection=value;
  recordNumber=recordSections.find(section=>section.id===value).items[0].number;
 }else if(id==='record-number')recordNumber=Number(value);
 else recordSubject=value;
 if(!recordSubjects(recordNumber).some(([subject])=>subject===recordSubject))recordSubject='teams';
 $('#stats-content').innerHTML=renderStatsSection();
 $(`#${id}`).focus();
 return;
}if(['league','country','type'].includes(e.target.id))updatePicker();if(e.target.id==='entry-type')updateEntryPicker();if(e.target.id==='goal-side'){$('#player-search').value='';goalOptions();}if(e.target.id==='filter-tournament'){filterTournament=e.target.value;render();}if(e.target.id==='filter-date'){filterDate=e.target.value;render();}if(e.target.id==='sort'){sort=e.target.value;render();}if(e.target.id==='round-select')mobileRounds[selected]=Number(e.target.value);if(e.target.id==='round-select')document.querySelectorAll('.bracket-round').forEach(el=>el.classList.toggle('mobile-selected',el.dataset.round===e.target.value));}catch(err){notify(err.message);}});
document.addEventListener('input',e=>{if(e.target.id==='entry-search')updateEntryPicker();if(e.target.id==='team-search')updatePicker();if(e.target.id==='player-search')goalOptions();if(e.target.name?.startsWith('score'))drawGoals();});
$('#catalog-button').onclick=catalog;window.addEventListener('hashchange',render);render();

installTeamDrag({onDrop:(from,to)=>applyTeamEdit(from.tid,from.index,from.side,{index:to.index,side:to.side}),onError:error=>notify(error.message)});

installPersonalData({getState:()=>state,modal,notify,onApply:async next=>{const restored=withDefaultCatalog(next,defaultCatalog);const revision=await saveState(restored);state={...restored,revision};confirmedState=structuredClone(state);selected=null;filterTournament='';filterDate='';location.hash='tournaments';render();}});

if(storage.state){
 const copyButton=$('#account-import'),copyStatus=$('#account-import-status');
 copyButton.hidden=false;
 copyButton.addEventListener('click',async()=>{
  copyButton.disabled=true;
  copyStatus.hidden=false;
  copyStatus.textContent='Lokale toernooien controleren…';
  try{
   const local=await loadLocalState();
   if(!local.tournaments.length){copyStatus.textContent='Dit apparaat heeft geen lokale toernooien.';return;}
   if(!confirm('Lokale toernooien naar dit account kopiëren? De lokale exemplaren blijven bewaard.')){
    copyStatus.textContent='Kopiëren geannuleerd.';return;
   }
   const current=withDefaultCatalog(await loadState(),defaultCatalog);
   const archive={app:'FIFA22BracketTracker',version:1,createdAt:new Date().toISOString(),label:'',state:local};
   const {state:next,summary}=planImport(current,archive);
   if(summary.added){
    next.revision=await saveState(next);
   }
   state=summary.added?next:current;
   confirmedState=structuredClone(state);
   render();
   copyStatus.textContent=summary.conflicts.length
    ? `Gekopieerd: ${summary.added}. Bestaande accountversies behouden: ${summary.conflicts.length}.`
    : summary.added ? `Gekopieerd: ${summary.added}. Je ziet ze nu ook op andere apparaten.` : 'Deze toernooien staan al in je account.';
  }catch(error){copyStatus.textContent=error.message||'Kopiëren mislukt. Probeer het opnieuw.';}
  finally{copyButton.disabled=false;}
 });
}

export const uid=()=>crypto.randomUUID();
export function createTournament(name,version,teamIds,shuffle=false,teamCount=teamIds.length){
 let ids=[...teamIds];
 if(!Number.isInteger(teamCount)||teamCount<2||teamCount>32||ids.length<2||ids.length>teamCount||new Set(ids).size!==ids.length)throw Error('Kies minimaal 2 unieke teams en maximaal het gekozen aantal plekken.');
 if(ids.some(id=>!version.teams.find(t=>t.id===id)))throw Error('Onbekend team.');
 if(shuffle)for(let i=ids.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
 const size=2**Math.ceil(Math.log2(teamCount)),byes=size-teamCount;
 const rounds=[];for(let count=size/2;count>=1;count/=2)rounds.push(Array.from({length:count},()=>({id:uid(),teams:[null,null],result:null})));
 rounds[0].forEach((m,i)=>{m.bye=i<byes;});
 const positions=[];
 // When starting early, put the first two teams in a playable match first.
 const indices=ids.length<teamCount?[...rounds[0].keys()].sort((a,b)=>Number(rounds[0][a].bye)-Number(rounds[0][b].bye)): [...rounds[0].keys()];
 for(const i of indices){positions.push([i,0]);if(!rounds[0][i].bye)positions.push([i,1]);}
 ids.forEach((id,i)=>{const [match,side]=positions[i];rounds[0][match].teams[side]=id;});
 const t={id:uid(),name,createdAt:new Date().toISOString(),teamCount,version:{...structuredClone(version),teams:structuredClone(version.teams.filter(t=>teamIds.includes(t.id))),players:structuredClone(version.players.filter(p=>teamIds.includes(p.teamId)))},teamIds:[...teamIds],rounds};
 // Pin the original roster until every empty entry has been filled.
 if(ids.length<teamCount)t.entryCatalog=structuredClone(version);
 propagate(t);return t;
}
export function nextTournamentMatch(tournament){
 for(const [round,matches] of tournament.rounds.entries()){
  const match=matches.find(candidate=>!candidate.bye&&!candidate.result&&candidate.teams.every(Boolean));
  if(match)return {match,round};
 }
 return null;
}
export function openTeamSlots(t){return t.rounds[0].flatMap((m,index)=>m.teams.flatMap((id,side)=>!id&&!(m.bye&&side===1)?[{index,side}]:[]));}
export function addTeam(t,teamId,index,side,extraCatalog=null){
 const m=t.rounds[0][index];
 if(!m||![0,1].includes(side)||m.teams[side]||m.bye&&side===1||m.result)throw Error('Deze plek kan niet meer worden ingevuld.');
 if(t.teamIds.includes(teamId))throw Error('Dit team doet al mee.');
 const base=t.entryCatalog;const manual=extraCatalog?.id===t.version.id&&extraCatalog.teams.find(team=>team.id===teamId&&team.manual&&team.type==='special');const catalog=base?.teams.some(team=>team.id===teamId)?base:manual?extraCatalog:base,team=catalog?.teams.find(team=>team.id===teamId);
 if(!team)throw Error('Dit team is niet beschikbaar in de vastgelegde selectie.');
 m.teams[side]=teamId;t.teamIds.push(teamId);t.version.teams.push(structuredClone(team));t.version.players.push(...structuredClone(catalog.players.filter(p=>p.teamId===teamId)));
 if(!openTeamSlots(t).length)delete t.entryCatalog;
 propagate(t);
}
export function editTeam(t,index,side,target,catalog,confirm=false){
 const from=t.rounds[0][index];
 if(!from||![0,1].includes(side)||from.bye&&side===1||!from.teams[side])throw Error('Kies een ingevulde teamplek.');
 const oldId=from.teams[side];let destination=null,newTeam=null;
 if(target===null){
  if(!openTeamSlots(t).length||t.teamIds.length<=1)throw Error('Verwijderen kan als er een vrije plek is en er minstens één team overblijft.');
 }else if(typeof target==='string'){
  if(target===oldId)return {saved:true};
  t.rounds[0].forEach((m,i)=>m.teams.forEach((id,s)=>{if(id===target)destination={index:i,side:s};}));
  if(!destination){
   const source=t.entryCatalog?.teams.some(team=>team.id===target)?t.entryCatalog:catalog;
   if(source?.id!==t.version.id)throw Error('De oorspronkelijke selectieversie is niet beschikbaar.');
   newTeam=source.teams.find(team=>team.id===target);if(!newTeam)throw Error('Onbekend team in deze selectieversie.');
   catalog=source;
  }
 }else {
  destination=target;const m=t.rounds[0][target?.index];
  if(!m||![0,1].includes(target.side)||m.bye&&target.side===1)throw Error('Kies een geldige andere plek.');
  if(destination.index===index&&destination.side===side)return {saved:true};
 }
 const paths=new Set();
 for(let i of [index,...(destination?[destination.index]:[])])for(let r=0;r<t.rounds.length;r++){paths.add(r+':'+i);i=Math.floor(i/2);}
 const impacted=[...paths].map(key=>{const [round,match]=key.split(':').map(Number);return {round,index:match,match:t.rounds[round][match]};}).filter(x=>x.match.result);
 if(impacted.length&&!confirm)return {needsConfirmation:impacted};
 for(const key of paths){const [r,i]=key.split(':').map(Number);t.rounds[r][i].result=null;}
 if(destination){const m=t.rounds[0][destination.index],other=m.teams[destination.side];m.teams[destination.side]=oldId;from.teams[side]=other;}
 else {
  from.teams[side]=newTeam?.id??null;
  t.teamIds=newTeam?t.teamIds.map(id=>id===oldId?newTeam.id:id):t.teamIds.filter(id=>id!==oldId);
  t.version.teams=t.version.teams.filter(team=>team.id!==oldId);
  t.version.players=t.version.players.filter(player=>player.teamId!==oldId);
  if(newTeam){
   t.version.teams.push(structuredClone(newTeam));
   t.version.players.push(...structuredClone(catalog.players.filter(player=>player.teamId===newTeam.id)));
  }
 }
 propagate(t);return {saved:true};
}
export function winner(m){if(m.bye)return m.teams[0];if(!m.result)return null;const r=m.result;return m.teams[r.score[0]===r.score[1]?(r.penalties[0]>r.penalties[1]?0:1):(r.score[0]>r.score[1]?0:1)];}
export function propagate(t){for(let r=1;r<t.rounds.length;r++)t.rounds[r].forEach((m,i)=>{m.teams=[winner(t.rounds[r-1][i*2]),winner(t.rounds[r-1][i*2+1])];});}
export function affected(t,r,i){const out=[];for(let n=r+1;n<t.rounds.length;n++){i=Math.floor(i/2);if(t.rounds[n][i].result)out.push(t.rounds[n][i]);}return out;}
export function saveResult(t,r,i,result,confirm=false){
 const m=t.rounds[r][i];if(m.bye||m.teams.some(x=>!x))throw Error('Deze wedstrijd kan nog niet worden gespeeld.');
 if(!result.score.every(x=>Number.isInteger(x)&&x>=0&&x<=999))throw Error('Vul geldige scores in.');
 if(result.score[0]===result.score[1]&&(!result.penalties||!result.penalties.every(x=>Number.isInteger(x)&&x>=0&&x<=999)||result.penalties[0]===result.penalties[1]))throw Error('Bij gelijkspel is een beslissende strafschoppenserie nodig.');
 result.goals.forEach(g=>{if(![0,1].includes(g.side)||!Number.isInteger(g.count)||g.count<1)throw Error('Ongeldige doelpunten.');if(g.kind==='player'&&!t.version.players.some(p=>p.id===g.playerId&&p.teamId===m.teams[g.side]))throw Error('Speler hoort niet bij deze selectie.');if(!['player','own','unknown'].includes(g.kind))throw Error('Ongeldig doelpunttype.');});
 for(let s=0;s<2;s++)if(result.goals.filter(g=>g.side===s).reduce((a,g)=>a+g.count,0)>result.score[s])throw Error('Meer doelpunten toegewezen dan gescoord.');
 const next={...m,result};const changes=winner(m)!==winner(next);const impacted=changes?affected(t,r,i):[];
 if(impacted.length&&!confirm)return {needsConfirmation:impacted};
 if(changes){let index=i;for(let n=r+1;n<t.rounds.length;n++){index=Math.floor(index/2);t.rounds[n][index].result=null;}}
 m.result={...result,penalties:result.score[0]===result.score[1]?result.penalties:null,date:result.date||new Date().toISOString()};propagate(t);return {saved:true};
}
export function matches(ts){return ts.flatMap(t=>t.rounds.flatMap((round,r)=>round.filter(m=>m.result).map(m=>({...m,tournament:t,round:r}))));}
function addPlayerAppearances(tournaments,scorers){
 if(!scorers.size)return;
 for(const t of tournaments){
  const roster=new Map(),appeared=new Set();
  for(const player of t.version.players){
   if(!scorers.has(player.id))continue;
   if(!roster.has(player.teamId))roster.set(player.teamId,[]);
   roster.get(player.teamId).push(player.id);
  }
  const final=t.rounds.at(-1)[0];
  for(const round of t.rounds)for(const match of round){
   if(!match.result)continue;
   const participants=new Set(match.teams.flatMap(id=>roster.get(id)||[]));
   const champions=match===final?new Set(roster.get(winner(match))):null;
   for(const id of participants){
    const player=scorers.get(id);
    player.played++;
    if(champions)player.finals++;
    if(champions?.has(id))player.titles++;
    appeared.add(id);
   }
  }
  for(const id of appeared)scorers.get(id).tournamentsPlayed++;
 }
}
export function stats(ts){
 const teams=new Map(),players=new Map(),duels=new Map();
 let homeWins=0,awayWins=0;
 const team=(t,id)=>{if(!teams.has(id))teams.set(id,{id,name:t.version.teams.find(x=>x.id===id)?.name||id,entries:0,played:0,wins:0,gf:0,ga:0,finals:0,titles:0});return teams.get(id);};
 ts.forEach(t=>{t.teamIds.forEach(id=>team(t,id).entries++);const f=t.rounds.at(-1)[0];f.teams.filter(Boolean).forEach(id=>team(t,id).finals++);if(f.result)team(t,winner(f)).titles++;});
 matches(ts).forEach(m=>{
 const t=m.tournament,winningTeam=winner(m);
 if(winningTeam===m.teams[0])homeWins++;
 else if(winningTeam===m.teams[1])awayWins++;
 m.teams.forEach((id,s)=>{const x=team(t,id);x.played++;x.gf+=m.result.score[s];x.ga+=m.result.score[1-s];if(winningTeam===id)x.wins++;});
 const key=[...m.teams].sort().join('|');if(!duels.has(key))duels.set(key,{ids:[...m.teams].sort(),matches:[],goals:0});const d=duels.get(key);d.matches.push(m);d.goals+=m.result.score[0]+m.result.score[1];
 m.result.goals.filter(g=>g.kind==='player').forEach(g=>{const p=t.version.players.find(p=>p.id===g.playerId);if(!players.has(p.id))players.set(p.id,{id:p.id,name:p.displayName||p.name,goals:0,matchIds:new Set(),teams:{},tournaments:{},played:0,tournamentsPlayed:0,titles:0,finals:0});const x=players.get(p.id);x.goals+=g.count;x.matchIds.add(m.id);x.teams[m.teams[g.side]]=(x.teams[m.teams[g.side]]||0)+g.count;x.tournaments[t.id]=(x.tournaments[t.id]||0)+g.count;});
 });
 addPlayerAppearances(ts,players);
 return {teams:[...teams.values()],players:[...players.values()],duels:[...duels.values()],homeWins,awayWins};
}
export function records(tournaments){
 const teams=new Map();
 for(const tournament of tournaments){
  const final=tournament.rounds.at(-1)[0];
  if(!final.result)continue;
  const champion=winner(final);
  for(const id of tournament.teamIds){
   if(!teams.has(id)){
    const name=tournament.version.teams.find(team=>team.id===id)?.name||id;
    teams.set(id,{id,name,tournaments:0,finals:0,titles:0});
   }
   const team=teams.get(id);
   team.tournaments++;
   if(final.teams.includes(id))team.finals++;
   if(id===champion)team.titles++;
  }
 }
 const rankRates=field=>[...teams.values()]
  .filter(team=>team[field]>0)
  .map(team=>({id:team.id,name:team.name,wins:team.titles,played:team[field]}))
  .sort((a,b)=>b.wins*a.played-a.wins*b.played||b.played-a.played||a.name.localeCompare(b.name,'nl'));
 const matchGoals=[],playerGoals=[];
 for(const match of matches(tournaments)){
  const isFinal=match.round===match.tournament.rounds.length-1;
  matchGoals.push({match,isFinal,goals:match.result.score[0]+match.result.score[1]});
  const scorers=new Map();
  for(const goal of match.result.goals){
   if(goal.kind!=='player')continue;
   const teamId=match.teams[goal.side];
   const player=match.tournament.version.players.find(p=>p.id===goal.playerId&&p.teamId===teamId);
   if(!player)continue;
   if(!scorers.has(player.id))scorers.set(player.id,{match,isFinal,player,teamId,goals:0});
   scorers.get(player.id).goals+=goal.count;
  }
  playerGoals.push(...scorers.values());
 }
 const mostGoals=(a,b)=>b.goals-a.goals||b.match.result.date.localeCompare(a.match.result.date);
 matchGoals.sort(mostGoals);
 playerGoals.sort(mostGoals);
 return {
  finalRates:rankRates('finals'),tournamentRates:rankRates('tournaments'),
  matchGoals,playerGoals
 };
}
export function validateVersion(v){
 if(!v.name||!v.source||!v.mode||!v.date||!Array.isArray(v.teams)||!Array.isArray(v.players))throw Error('Versie vereist name, source, mode, date, teams en players.');
 const teamIds=new Set();v.teams.forEach(t=>{if(!t.id||!t.name||teamIds.has(t.id))throw Error('Teams vereisen unieke id en name.');teamIds.add(t.id);});
 const links=new Set();v.players.forEach(p=>{const key=p.id+'|'+p.teamId;if(!p.id||!p.name||!teamIds.has(p.teamId)||links.has(key))throw Error('Spelers vereisen id, name en een geldig teamId; dubbele selectiekoppelingen zijn niet toegestaan.');links.add(key);});
 return {...v,id:uid(),teams:v.teams.map(t=>({...t,id:String(t.id)})),players:v.players.map(p=>({...p,id:String(p.id),teamId:String(p.teamId)}))};
}

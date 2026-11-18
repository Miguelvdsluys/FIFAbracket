import {validateVersion} from './engine.js';
export const DEFAULT_CATALOG_ID='builtin-sofifa-220002-v1';
export function supplementProvidedRosters(version,catalog){
 if(!version)return version;
 let changed=false;const additions=[];
 const teams=version.teams.map(team=>{
  const provided=catalog.teams.find(candidate=>candidate.id===team.id&&candidate.rosterStatus==='user-supplied');
  if(!provided||team.rosterStatus!=='unverified'||version.players.some(player=>player.teamId===team.id))return team;
  const roster=catalog.players.filter(player=>player.teamId===team.id);if(!roster.length)return team;
  changed=true;additions.push(...structuredClone(roster));return {...team,...structuredClone(provided)};
 });
 return changed?{...version,teams,players:[...version.players,...additions]}:version;
}
export function withSpecialTeams(base,catalog){
 const teams=catalog.teams.filter(team=>team.type==='special'&&team.manual&&!base.teams.some(existing=>existing.id===team.id));
 if(!teams.length)return base;
 const ids=new Set(teams.map(team=>team.id));
 return {...base,teams:[...base.teams,...teams],players:[...base.players,...catalog.players.filter(player=>ids.has(player.teamId))]};
}
export function withDefaultCatalog(state,catalog){
 return {...state,versions:[catalog,...state.versions.filter(v=>v.id!==DEFAULT_CATALOG_ID)],tournaments:state.tournaments.map(t=>{
  const version=supplementProvidedRosters(t.version,catalog),entryCatalog=supplementProvidedRosters(t.entryCatalog,catalog);
  return version===t.version&&entryCatalog===t.entryCatalog?t:{...t,version,...(entryCatalog?{entryCatalog}:{})};
 })};
}
export async function loadBuiltInCatalog(state){
 try{
  const response=await fetch(new URL('./data/fifa22-sofifa-220002.json',import.meta.url));
  if(!response.ok)throw Error('Catalogus niet bereikbaar');
  const version=validateVersion(await response.json());
  return {...version,id:DEFAULT_CATALOG_ID};
 }catch(error){
  const saved=state.versions.find(v=>v.id===DEFAULT_CATALOG_ID);
  if(saved)return saved;
  throw Error('De teams konden niet worden geladen. Controleer je verbinding en probeer opnieuw.');
 }
}

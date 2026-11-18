import {validateVersion} from './engine.js?v=b0d05c6c3085c56d';
export const DEFAULT_CATALOG_ID='builtin-sofifa-220002-v1';
export function withDefaultCatalog(state,catalog){
 return {...state,versions:[catalog,...state.versions.filter(v=>v.id!==DEFAULT_CATALOG_ID)]};
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

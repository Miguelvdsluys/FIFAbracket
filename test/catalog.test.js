import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateVersion,createTournament} from '../public/engine.js';
import {withDefaultCatalog,DEFAULT_CATALOG_ID} from '../public/catalog.js';
const catalog={...validateVersion(JSON.parse(readFileSync(new URL('../public/data/fifa22-sofifa-220002.json',import.meta.url)))),id:DEFAULT_CATALOG_ID};
test('vaste catalogus bevat echte teamkoppelingen en club/nationale selecties',()=>{assert.equal(catalog.teams.length,734);assert.equal(catalog.teams.filter(t=>t.type==='club').length,701);assert.equal(catalog.teams.filter(t=>t.type==='nationaal').length,33);assert.equal(new Set(catalog.players.map(p=>p.id)).size,19239);assert.ok(catalog.players.every(p=>catalog.teams.some(t=>t.id===p.teamId)));});
test('automatische catalogus is idempotent en behoudt bestaande toernooien en imports',()=>{const custom={id:'custom',teams:[],players:[]};const tournament=createTournament('Bestaand',catalog,catalog.teams.slice(0,2).map(t=>t.id));const original=structuredClone(tournament);const state={revision:5,versions:[custom],tournaments:[tournament]};let merged=withDefaultCatalog(state,catalog);merged=withDefaultCatalog(merged,{...catalog,name:'Nieuwe catalogusnaam'});assert.equal(merged.versions.length,2);assert.equal(merged.revision,5);assert.equal(merged.versions[1],custom);assert.deepEqual(merged.tournaments[0],original);assert.equal(state.versions.length,1);});

test('toernooisnapshot bevat uitsluitend gekozen teams en hun selecties',()=>{const ids=catalog.teams.filter(t=>t.type==='club').slice(0,6).map(t=>t.id);const t=createTournament('Compact',catalog,ids);assert.equal(t.version.teams.length,6);assert.ok(t.version.players.length>0);assert.ok(t.version.players.every(p=>ids.includes(p.teamId)));assert.equal(catalog.teams.length,734);});

test('alle clubs en nationale ploegen hebben een bronlogo',()=>{assert.equal(catalog.teams.filter(t=>/^https:\/\/cdn\.sofifa\.net\/teams\//.test(t.logoUrl)).length,734);});

test('lokale afbeeldingen bestaan en landenbadges worden meegeleverd',()=>{const records=JSON.parse(readFileSync(new URL('../public/data/logo-sources.json',import.meta.url)));assert.equal(records.length,453);assert.equal(catalog.teams.filter(t=>t.type==='nationaal'&&t.localLogo).length,33);for(const record of records){const data=readFileSync(new URL('../public/data/team-logos/'+record.file,import.meta.url));assert.ok(data.byteLength>100);assert.equal(catalog.teams.find(t=>t.id===record.teamId).localLogo,'./data/team-logos/'+record.file);}});

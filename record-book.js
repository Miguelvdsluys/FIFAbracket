import {matches, winner} from './engine.js?v=427d56543bb2f809';

const groupBy = (rows, key) => {
 const groups = new Map();
 for (const row of rows) {
  const id = key(row);
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(row);
 }
 return [...groups.values()];
};
const sum = (rows, value) => rows.reduce((total, row) => total + value(row), 0);
const count = (rows, condition) => sum(rows, row => Number(condition(row)));
const scored = row => row.goals;
const conceded = row => row.against;
const won = row => row.won;
const lost = row => !row.won;
const drawn = row => row.draw;
const clean = row => row.against === 0;
const title = row => row.title;
const finalist = row => row.finalist;
const year = row => row.day.slice(0, 4);
const localDay = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Amsterdam', year:'numeric', month:'2-digit', day:'2-digit'});
const sequenceKey = row => JSON.stringify([row.holder.id,row.opponent?.id]);
const scoreOf = row => row.match.result.score.join(' – ');

function entry(holder, value, rows, detail = '') {
 return {holder, value, first:rows[0], last:rows.at(-1), detail};
}

function matchRecords(rows, value = scored, accepts = () => true) {
 return rows.filter(accepts).map(row => entry(row.holder, value(row), [row], scoreOf(row)));
}

function aggregate(rows, key, value, accepts = () => true) {
 return groupBy(rows, key).filter(accepts).map(group => entry(group[0].holder, value(group), group));
}

function byTournament(rows, value, accepts) {
 return aggregate(rows, row => JSON.stringify([row.holder.id, row.tournament.id]), value, accepts);
}

function rates(rows,key,condition,min=1) {
 return groupBy(rows,key).filter(group=>group.length>=min).map(group=>{
  const wins=count(group,condition);
  return entry(group[0].holder,wins/group.length,group,`${wins} / ${group.length}`);
 });
}

function byYear(rows, value) {
 return aggregate(rows, row => JSON.stringify([row.holder.id, year(row)]), value);
}

function streaks(rows, condition, key = row => row.holder.id) {
 const best = [];
 for (const group of groupBy(rows, key)) {
  let start = 0;
  for (let i = 0; i <= group.length; i++) {
   if (i < group.length && condition(group[i])) continue;
   if (i > start) {
    best.push(entry(group[start].holder, i - start, [group[start], group[i-1]],
     group[start].opponent && key === sequenceKey ? group[start].opponent.name : ''));
   }
   start = i+1;
  }
 }
 return best;
}

function windows(rows, length, value) {
 const candidates=[];
 for(const group of groupBy(rows,row=>row.holder.id)){
  let total=0;
  for(let i=0;i<group.length;i++){
   total+=value(group[i]);
   if(i>=length)total-=value(group[i-length]);
   if(i>=length-1)candidates.push(entry(group[i].holder,total,[group[i-length+1],group[i]]));
  }
 }
 return candidates;
}

function milestones(rows, target, value) {
 const leaders = [];
 for (const group of groupBy(rows, row => row.holder.id)) {
  let total = 0;
  const hit = group.findIndex(row => (total += value(row)) >= target);
  if (hit >= 0) leaders.push(entry(group[0].holder, hit+1, [group[0],group[hit]]));
 }
 return leaders;
}

function finalsAgainstSameOpponent(rows) {
 const candidates = [];
 for (const group of groupBy(rows,row=>row.holder.id)) {
  let start = 0;
  for (let i=1;i<=group.length;i++) {
   if (group[i]?.opponent.id===group[start].opponent.id) continue;
   candidates.push(entry(group[start].holder,i-start,[group[start],group[i-1]],group[start].opponent.name));
   start=i;
  }
 }
 return candidates;
}

function betweenTitles(rows) {
 const candidates = [];
 for (const group of groupBy(rows, row=>row.holder.id)) {
  let previous = -1;
  group.forEach((row,index)=>{
   if (!row.title) return;
   if (previous >= 0) candidates.push(entry(row.holder,index-previous-1,[group[previous],row]));
   previous=index;
  });
 }
 return candidates;
}

function titleHistory(completions){
 const titles=new Map(), losses=new Set(), finished=new Set();
 for(const {match,champion} of completions){
  const runnerUp=match.teams.find(id=>id!==champion);
  titles.set(champion,(titles.get(champion)||0)+1);
  finished.add(match.tournament.id);
  losses.add(runnerUp);
 }
 return {titles,losses,finished};
}

function recordTeam(tournament,id){
 return {id,name:tournament.version.teams.find(team=>team.id===id)?.name||id,team:true};
}

function timeline(tournaments) {
 const played = matches(tournaments).sort((a,b)=>Date.parse(a.result.date)-Date.parse(b.result.date)
  ||Date.parse(a.tournament.createdAt)-Date.parse(b.tournament.createdAt)||a.round-b.round);
 const teams = [];
 const championHistory = [];
 let reigning = null;
 for(const match of played){
  const tournament=match.tournament;
  const isFinal=match.round===tournament.rounds.length-1;
  const isSemi=match.round===tournament.rounds.length-2;
  const champion=winner(match);
  const date=match.result.date;
  const day=localDay.format(new Date(date));
  for(const [side,id] of match.teams.entries()){
   const opponentId=match.teams[1-side];
   const goals=match.result.score[side],against=match.result.score[1-side];
   teams.push({holder:recordTeam(tournament,id),opponent:recordTeam(tournament,opponentId),
    tournament,match,date,day,isFinal,isSemi,goals,against,draw:goals===against,won:id===champion,
    reigning,side});
  }
  if(isFinal){
   championHistory.push({match,champion,defended:champion===reigning});
   reigning=champion;
  }
 }
 return {teams,championHistory};
}

function recordData(tournaments,history,includePlayers) {
 const {teams:historicalMatches,championHistory}=timeline(history);
 const included=new Map(tournaments.map(t=>[t.id,new Set(t.rounds.flat().filter(m=>m.result).map(m=>m.id))]));
 const selected=row=>included.get(row.tournament.id)?.has(row.match.id);
 const teams=historicalMatches.filter(selected);
 const matchTotals=teams.filter(row=>row.side===0).map(row=>({
  ...row,holder:{id:row.match.id,name:row.holder.name+' – '+row.opponent.name,teams:[row.holder,row.opponent]},
  goals:row.goals+row.against
 }));
 const matchGroups=new Map(groupBy(teams,row=>row.tournament.id).map(group=>[group[0].tournament.id,group]));
 const cups=[];
 for(const {match,champion,defended} of championHistory){
  const {tournament}=match;
  for(const id of tournament.teamIds){
   const games=matchGroups.get(tournament.id)?.filter(row=>row.holder.id===id)||[];
   const holder=games[0]?.holder||recordTeam(tournament,id);
   const date=match.result.date;
   cups.push({holder,tournament,match,date,day:localDay.format(new Date(date)),
    finalist:match.teams.includes(id),title:champion===id,defended:champion===id&&defended,goals:sum(games,scored)});
  }
 }
 const appearances=new Map();
 if(includePlayers){
  const rosters=new Map();
  for(const row of teams){
   const key=JSON.stringify([row.tournament.id,row.holder.id]);
   if(!rosters.has(key))rosters.set(key,row.tournament.version.players.filter(player=>player.teamId===row.holder.id));
   const goals=new Map();
   for(const goal of row.match.result.goals){
    if(goal.kind==='player'&&goal.side===row.side)goals.set(goal.playerId,(goals.get(goal.playerId)||0)+goal.count);
   }
   for(const player of rosters.get(key)){
    const playerMatch=JSON.stringify([player.id,row.match.id]);
    const total=goals.get(player.id)||0;
    const appearance=appearances.get(playerMatch);
    if(appearance){
     appearance.goals+=total;
     appearance.won||=row.won;
     appearance.holder.playedFor.push(row.holder);
    }else appearances.set(playerMatch,{
     ...row,holder:{id:player.id,name:player.displayName||player.name,player:true,playedFor:[row.holder]},goals:total
    });
   }
  }
 }
 const concededInCup=new Set(historicalMatches.filter(row=>row.against>0)
  .map(row=>JSON.stringify([row.tournament.id,row.holder.id])));
 return {teams,historicalMatches,matchTotals,players:[...appearances.values()],cups:cups.filter(selected),historicalCups:cups,selected,history:titleHistory(championHistory),concededInCup};
}

const finalOnly = row => row.isFinal;
const semiOnly = row => row.isSemi;
const margin = row => row.goals-row.against;
const sections = [
 ['goals','⚽ Doelpuntenrecords',[
  [1,'Meeste goals in één wedstrijd','goalMatch'],
  [2,'Meeste goals in één toernooi','goalTournament'],
  [3,'Meeste goals in één finale','goalFinal'],
  [4,'Meeste goals in één halve finale','goalSemi'],
  [5,'Meeste goals in één groepsfase','groups'],
  [6,'Meeste goals in één knock-outfase','goalTournament'],
  [7,'Meeste goals op één speeldag','goalDay'],
  [8,'Meeste goals in 3 opeenvolgende wedstrijden','goalWindow',3],
  [9,'Meeste goals in 5 opeenvolgende wedstrijden','goalWindow',5],
  [10,'Meeste goals in 10 opeenvolgende wedstrijden','goalWindow',10],
  [11,'Langste reeks wedstrijden met minimaal 1 goal','goalStreak',1],
  [12,'Langste reeks wedstrijden met minimaal 3 goals','goalStreak',3],
  [13,'Langste reeks wedstrijden met minimaal 5 goals','goalStreak',5],
  [14,'Meeste wedstrijden met 5+ goals in één toernooi','goalFrequency',5],
  [15,'Meeste wedstrijden met 10+ goals in één toernooi','goalFrequency',10],
  [16,'Hoogste doelpuntengemiddelde in één toernooi','goalAverage'],
  [17,'Snelste speler naar 50 goals','playerGoals',50],
  [18,'Snelste speler naar 100 goals','playerGoals',100],
  [19,'Snelste speler naar 250 goals','playerGoals',250],
  [20,'Snelste speler naar 500 goals','playerGoals',500]
 ]],
 ['titles','🏆 Titelrecords',[
  [21,'Meeste titels achter elkaar','titleStreak'],
  [22,'Meeste titels in één jaar','titlesYear'],
  [23,'Meeste titels in 5 opeenvolgende toernooien','titleWindow',5],
  [24,'Meeste titels in 10 opeenvolgende toernooien','titleWindow',10],
  [25,'Meeste finales achter elkaar gewonnen','finalWinStreak'],
  [26,'Meeste finales achter elkaar verloren','finalLossStreak'],
  [27,'Meeste finales achter elkaar bereikt','finalistStreak'],
  [28,'Meeste toernooien tussen twee titels','titleGap'],
  [29,'Minste deelnames nodig voor eerste titel','firstTitle'],
  [30,'Meeste deelnames zonder titel','entriesWithoutTitle'],
  [31,'Meeste wedstrijden nodig voor eerste titel','gamesFirstTitle'],
  [32,'Meeste gewonnen finales zonder ooit een finale te verliezen','perfectFinals'],
  [33,'Meeste verloren finales zonder titel','lostFinals'],
  [34,'Meeste opeenvolgende succesvolle titelverdedigingen','defenses'],
  [35,'Hoogste winstpercentage in finales (minimaal 5 finales)','finalRate',5],
  [101,'Hoogste percentage gewonnen finales','finalRate',1],
  [102,'Hoogste percentage gewonnen toernooien','cupRate']
 ]],
 ['matches','🎮 Wedstrijdrecords',[
  [36,'Meeste wedstrijden in één toernooi','gamesCup'],
  [37,'Meeste wedstrijden in één jaar','gamesYear'],
  [38,'Meeste opeenvolgende overwinningen','winStreak'],
  [39,'Meeste opeenvolgende nederlagen','lossStreak'],
  [40,'Meeste opeenvolgende gelijke spelen','drawStreak'],
  [41,'Langste ongeslagen reeks','winStreak'],
  [42,'Langste reeks zonder overwinning','lossStreak'],
  [43,'Meeste overwinningen in één toernooi','winsCup'],
  [44,'Meeste nederlagen in één toernooi','lossesCup'],
  [45,'Meeste gelijke spelen in één toernooi','drawsCup'],
  [46,'Hoogste winstpercentage in één toernooi','cupWinRate'],
  [47,'Laagste winstpercentage in één toernooi','cupWinRate'],
  [48,'Meeste gewonnen wedstrijden achter elkaar met 3+ goals verschil','marginStreak',3],
  [49,'Meeste gewonnen wedstrijden achter elkaar met 5+ goals verschil','marginStreak',5],
  [50,'Meeste wedstrijden zonder nederlaag in één toernooi','winsCup'],
  [51,'Snelste speler naar 50 overwinningen','playerWins',50],
  [52,'Snelste speler naar 100 overwinningen','playerWins',100],
  [53,'Snelste speler naar 250 overwinningen','playerWins',250],
  [54,'Snelste speler naar 500 wedstrijden','playerGames',500],
  [55,'Meeste wedstrijden zonder ooit kampioen te worden','gamesWithoutTitle']
 ]],
 ['results','🔥 Uitslagenrecords',[
  [56,'Grootste overwinning ooit','bigWin'],
  [57,'Grootste overwinning in een finale','bigWin',finalOnly],
  [58,'Grootste overwinning in een halve finale','bigWin',semiOnly],
  [59,'Grootste overwinning in een groepswedstrijd','groups'],
  [60,'Grootste overwinning in een knock-outwedstrijd','bigWin'],
  [61,'Grootste nederlaag ooit','bigLoss'],
  [62,'Grootste nederlaag in een finale','bigLoss',finalOnly],
  [63,'Grootste nederlaag van een regerend kampioen','bigLoss',row=>row.holder.id===row.reigning],
  [64,'Meeste totale goals in één wedstrijd','totalMatch'],
  [65,'Meeste totale goals in één finale','totalFinal'],
  [66,'Meeste totale goals in een gelijkspel','totalDraw'],
  [67,'Meeste goals gescoord in een verloren wedstrijd','goalsInLoss'],
  [68,'Meeste goals tegen gekregen in een gewonnen wedstrijd','againstInWin'],
  [69,'Grootste comeback ooit','comeback'],
  [70,'Grootste comeback in een finale','comeback'],
  [71,'Grootste comeback in een knock-outwedstrijd','comeback'],
  [72,'Meeste wedstrijden met 10+ totale goals in één toernooi','totalFrequency',10],
  [73,'Grootste doelsaldo in één wedstrijd','bigWin'],
  [74,'Beste doelsaldo in één toernooi','cupBalance'],
  [75,'Slechtste doelsaldo in één toernooi','cupBalance']
 ]],
 ['defence','🛡️ Verdedigingsrecords',[
  [76,'Meeste clean sheets achter elkaar','cleanStreak'],
  [77,'Meeste clean sheets in één toernooi','cleanCup'],
  [78,'Minste tegengoals in één toernooi','againstCup'],
  [79,'Meeste tegengoals in één toernooi','againstCup'],
  [80,'Langste reeks wedstrijden zonder tegengoal','cleanStreak'],
  [81,'Langste reeks wedstrijden met minimaal 3 tegengoals','againstStreak',3],
  [82,'Meeste wedstrijden met 5+ tegengoals in één toernooi','againstFrequency',5],
  [83,'Meeste wedstrijden met 10+ tegengoals in één toernooi','againstFrequency',10],
  [84,'Laagste gemiddelde tegengoals per wedstrijd in één toernooi','againstAverage'],
  [85,'Meeste gewonnen wedstrijden zonder tegengoal in één toernooi','cleanWins']
 ]],
 ['rivalries','⚔️ Rivaliteitsrecords',[
  [86,'Meeste opeenvolgende overwinningen tegen dezelfde tegenstander','rivalWins'],
  [87,'Meeste opeenvolgende nederlagen tegen dezelfde tegenstander','rivalLosses'],
  [88,'Meeste goals tegen één tegenstander in één wedstrijd','rivalMatchGoals'],
  [89,'Meeste goals tegen één tegenstander in één toernooi','rivalCupGoals'],
  [90,'Grootste overwinning op de regerend kampioen','bigWin',row=>row.opponent.id===row.reigning],
  [91,'Meeste finales achter elkaar tegen dezelfde tegenstander','rivalFinals'],
  [92,'Meeste knock-outoverwinningen achter elkaar tegen dezelfde tegenstander','rivalWins'],
  [93,'Langste ongeslagen reeks tegen één tegenstander','rivalWins'],
  [94,'Meeste onderlinge wedstrijden in één toernooi','meetings'],
  [95,'Grootste comeback tegen dezelfde tegenstander','comeback']
 ]],
 ['legendary','👑 Zeldzame en legendarische records',[
  [96,'Meeste toernooien achter elkaar met minimaal 10 goals','tenGoalCups'],
  [97,'Meeste toernooien achter elkaar met een finaleplaats','finalistStreak'],
  [98,'Meeste toernooien achter elkaar zonder groepsfase-uitschakeling','groups'],
  [99,'Meeste overwinningen op een kampioen binnen één toernooi','championWins'],
  [100,'Meeste wedstrijden gewonnen in een toernooi zonder tegengoal','perfectCup']
 ]]
];

export const recordSections=sections.map(([id,label,items])=>({id,label,items:items.map(([number,name])=>({number,name}))}));
const definitions=new Map(sections.flatMap(([, ,items])=>items.map(([number,name,kind,arg])=>[number,{kind,arg}])));
const ascending=new Set([17,18,19,20,29,47,51,52,53,54,75,78,84]);
const zeroRecords=new Set([16,35,46,47,74,75,78,84,101,102]);
const goalSubjects=new Set([1,2,3,4,6,7,8,9,10,11,12,13,14,15,16]);

export function recordSubjects(number){
 if(!goalSubjects.has(number))return [];
 const subjects=[['teams','Per team'],['players','Per speler']];
 if(number===1||number===3)subjects.push(['matches','Beide teams samen']);
 return subjects;
}

const calculations = {
 goalMatch: rows => matchRecords(rows),
 goalFinal: rows => matchRecords(rows,scored,finalOnly),
 goalSemi: rows => matchRecords(rows,scored,semiOnly),
 goalTournament: rows => byTournament(rows,group=>sum(group,scored)),
 goalDay: rows => aggregate(rows,row=>JSON.stringify([row.holder.id,row.day]),group=>sum(group,scored)),
 goalWindow: (rows,n) => windows(rows,n,scored),
 goalStreak: (rows,n) => streaks(rows,row=>row.goals>=n),
 goalFrequency: (rows,n) => byTournament(rows,group=>count(group,row=>row.goals>=n)),
 goalAverage: rows => byTournament(rows,group=>sum(group,scored)/group.length),
 playerGoals: (rows,n) => milestones(rows,n,scored),
 titleStreak: rows => streaks(rows,title),
 titlesYear: rows => byYear(rows,group=>count(group,title)),
 titleWindow: (rows,n) => windows(rows,n,row=>Number(row.title)),
 finalWinStreak: rows => streaks(rows.filter(finalist),title),
 finalLossStreak: rows => streaks(rows.filter(finalist),row=>!row.title),
 finalistStreak: rows => streaks(rows,finalist),
 titleGap: rows => betweenTitles(rows),
 firstTitle: (_,__,data) => milestones(data.historicalCups,1,row=>Number(row.title)).filter(row=>data.selected(row.last)),
 entriesWithoutTitle: (rows,_,data) => aggregate(rows.filter(row=>!data.history.titles.has(row.holder.id)),row=>row.holder.id,group=>group.length),
 gamesFirstTitle: (_,__,data) => milestones(data.historicalMatches,1,row=>Number(row.isFinal&&row.won)).filter(row=>data.selected(row.last)),
 perfectFinals: (rows,_,data) => aggregate(rows.filter(row=>row.title&&!data.history.losses.has(row.holder.id)),row=>row.holder.id,group=>group.length),
 lostFinals: (rows,_,data) => aggregate(rows.filter(row=>row.finalist&&!data.history.titles.has(row.holder.id)),row=>row.holder.id,group=>group.length),
 defenses: rows => streaks(rows,row=>row.defended),
 finalRate: (rows,min) => rates(rows.filter(finalist),row=>row.holder.id,title,min),
 cupRate: rows => rates(rows,row=>row.holder.id,title),
 gamesCup: rows => byTournament(rows,group=>group.length),
 gamesYear: rows => byYear(rows,group=>group.length),
 winStreak: (rows,_,data) => streaks(rows,data.number===41?row=>row.goals>=row.against:won),
 lossStreak: (rows,_,data) => streaks(rows,data.number===42?row=>row.goals<=row.against:lost),
 drawStreak: rows => streaks(rows,drawn),
 winsCup: (rows,_,data) => byTournament(rows,group=>count(group,data.number===50?row=>row.goals>=row.against:won)),
 lossesCup: rows => byTournament(rows,group=>count(group,lost)),
 drawsCup: rows => byTournament(rows,group=>count(group,drawn)),
 cupWinRate: rows => rates(rows,row=>JSON.stringify([row.holder.id,row.tournament.id]),won),
 marginStreak: (rows,n) => streaks(rows,row=>margin(row)>=n),
 playerWins: (rows,n) => milestones(rows,n,row=>Number(row.won)),
 playerGames: (rows,n) => milestones(rows,n,()=>1),
 gamesWithoutTitle: (rows,_,data) => aggregate(rows.filter(row=>!data.history.titles.has(row.holder.id)),row=>row.holder.id,group=>group.length),
 bigWin: (rows,accepts=()=>true) => matchRecords(rows,margin,row=>margin(row)>0&&accepts(row)),
 bigLoss: (rows,accepts=()=>true) => matchRecords(rows,row=>-margin(row),row=>margin(row)<0&&accepts(row)),
 totalMatch: rows => matchRecords(rows),
 totalFinal: rows => matchRecords(rows,scored,finalOnly),
 totalDraw: rows => matchRecords(rows,scored,drawn),
 goalsInLoss: rows => matchRecords(rows,scored,lost),
 againstInWin: rows => matchRecords(rows,conceded,won),
 totalFrequency: (rows,n) => aggregate(rows,row=>row.tournament.id,group=>count(group,row=>row.goals>=n))
  .map(row=>({...row,holder:{id:row.last.tournament.id,name:row.last.tournament.name}})),
 cupBalance: rows => byTournament(rows,group=>sum(group,margin)),
 cleanStreak: rows => streaks(rows,clean),
 cleanCup: rows => byTournament(rows,group=>count(group,clean)),
 againstCup: rows => byTournament(rows,group=>sum(group,conceded)),
 againstStreak: (rows,n) => streaks(rows,row=>row.against>=n),
 againstFrequency: (rows,n) => byTournament(rows,group=>count(group,row=>row.against>=n)),
 againstAverage: rows => byTournament(rows,group=>sum(group,conceded)/group.length),
 cleanWins: rows => byTournament(rows,group=>count(group,row=>row.won&&clean(row))),
 rivalWins: (rows,_,data) => streaks(rows,data.number===93?row=>row.goals>=row.against:won,sequenceKey),
 rivalLosses: rows => streaks(rows,lost,sequenceKey),
 rivalMatchGoals: rows => matchRecords(rows).map(row=>({...row,detail:row.last.opponent.name+' · '+row.detail})),
 rivalCupGoals: rows => aggregate(rows,row=>JSON.stringify([row.holder.id,row.opponent.id,row.tournament.id]),group=>sum(group,scored))
  .map(row=>({...row,detail:row.last.opponent.name})),
 rivalFinals: rows => finalsAgainstSameOpponent(rows.filter(finalOnly)),
 meetings: rows => aggregate(rows.filter(row=>row.holder.id<row.opponent.id),
  row=>JSON.stringify([row.holder.id,row.opponent.id,row.tournament.id]),group=>group.length)
  .map(row=>({...row,holder:{id:sequenceKey(row.last),name:row.last.holder.name+' – '+row.last.opponent.name,teams:[row.last.holder,row.last.opponent]}})),
 tenGoalCups: rows => streaks(rows,row=>row.goals>=10),
 championWins: rows => byTournament(rows,group=>count(group,row=>row.won&&row.opponent.id===row.reigning)),
 perfectCup: (rows,_,data) => byTournament(rows,group=>count(group,won),([row])=>
  data.history.finished.has(row.tournament.id)&&!data.concededInCup.has(JSON.stringify([row.tournament.id,row.holder.id])))
};

const cupRecords=new Set([21,22,23,24,25,26,27,28,29,30,32,33,34,35,96,97,101,102]);
const totalRecords=new Set([64,65,66,72]);
const percentages=new Set([35,46,47,101,102]);
const averages=new Set([16,84]);
const byMinutes=new Set([69,70,71,95]);

export function recordBook(number,tournaments,{history=tournaments,subject='teams'}={}){
 const definition=definitions.get(number);
 if(!definition)throw new Error('Onbekend record.');
 if(definition.kind==='groups')return {rows:[],unavailable:'FIFAbracket heeft momenteel alleen knock-outtoernooien. Voor dit record zijn groepswedstrijden nodig.'};
 if(byMinutes.has(number))return {rows:[],unavailable:'Voor dit record is het scoreverloop nodig. FIFAbracket bewaart de eindstand en doelpuntenmakers, zonder de volgorde waarin de goals vielen.'};
 const includePlayers=subject==='players'&&goalSubjects.has(number)||definition.kind.startsWith('player');
 const data=recordData(tournaments,history,includePlayers);
 const rows=cupRecords.has(number)?data.cups
  :totalRecords.has(number)||subject==='matches'&&[1,3].includes(number)?data.matchTotals
  :includePlayers?data.players:data.teams;
 const candidates=calculations[definition.kind](rows,definition.arg,{...data,number})
  .filter(row=>row.value!==0||zeroRecords.has(number)||number===28);
 const direction=ascending.has(number)?1:-1;
 candidates.sort((a,b)=>direction*(a.value-b.value)||Date.parse(b.last.date)-Date.parse(a.last.date)
  ||a.holder.name.localeCompare(b.holder.name,'nl'));
 const holders=new Set();
 const ranking=candidates.filter(row=>{
  if(holders.has(row.holder.id))return false;
  holders.add(row.holder.id);
  return true;
 });
 return {rows:ranking,format:percentages.has(number)?'percent':averages.has(number)?'decimal':'integer'};
}

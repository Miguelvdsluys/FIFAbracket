import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
const files=['app.js','bracket.js','engine.js','storage.js','style.css','pwa.js','manifest.webmanifest','catalog.js'];
const icons=['icon-192.png','icon-512.png','icon-maskable.png','apple-touch-icon.png'];
await mkdir('dist',{recursive:true});
const hash=createHash('sha256');
for(const file of ['index.html','sw.js',...files,'data/fifa22-sofifa-220002.json',...icons.map(icon=>'icons/'+icon)])hash.update(await readFile('public/'+file));
const version=hash.digest('hex').slice(0,16);
// Version every module import too: older installed workers must not intercept
// unversioned dependencies and combine an old module with a new app shell.
for(const file of files){
 let body=await readFile('public/'+file,'utf8');
 if(file.endsWith('.js'))body=body.replace(/(['"])(\.\/[^'"?]+\.js)\1/g,(_,quote,path)=>`${quote}${path}?v=${version}${quote}`);
 await writeFile('dist/'+file,body);
}
await cp('public/icons','dist/icons',{recursive:true});
await cp('public/data','dist/data',{recursive:true});
await writeFile('dist/sw.js',(await readFile('public/sw.js','utf8')).replaceAll('__VERSION__',version));
let html=(await readFile('public/index.html','utf8')).replace('<html lang="nl">','<html lang="nl" data-storage="browser">').replace('href="/style.css"','href="./style.css"').replace('src="/app.js"','src="./app.js"');
html=html.replace(/(src|href)="(\.\/[^"?]+\.(?:js|css))"/g,`$1="$2?v=${version}"`);
await writeFile('dist/index.html',html);await writeFile('dist/.nojekyll','');
console.log('GitHub Pages-versie gebouwd in dist/ · '+version);

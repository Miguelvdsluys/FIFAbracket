import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
const files=['app.js','engine.js','storage.js','style.css'];
await mkdir('dist',{recursive:true});
for(const file of files)await copyFile('public/'+file,'dist/'+file);
const html=(await readFile('public/index.html','utf8')).replace('<html lang="nl">','<html lang="nl" data-storage="browser">').replace('href="/style.css"','href="./style.css"').replace('src="/app.js"','src="./app.js"');
await writeFile('dist/index.html',html);await writeFile('dist/.nojekyll','');
console.log('GitHub Pages-versie gebouwd in dist/');

import {execFileSync} from 'node:child_process';
import {mkdtempSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(args,cwd=root,stdio='inherit')=>execFileSync('git',args,{cwd,stdio,encoding:'utf8'});
execFileSync(process.execPath,['scripts/build-pages.js'],{cwd:root,stdio:'inherit'});
const target=mkdtempSync(join(tmpdir(),'fifa22-pages-'));
try{
 const remote=git(['remote','get-url','origin'],root,'pipe').trim();
 git(['clone','--depth','1','--branch','gh-pages','--single-branch',remote,target]);
 cpSync(join(root,'dist'),target,{recursive:true});
 git(['add','.'],target);
 if(!git(['diff','--cached','--name-only'],target,'pipe').trim()){console.log('De gepubliceerde bestanden zijn al actueel.');}
 else {git(['commit','-m','Publish FIFA 22 app update'],target);git(['push','origin','gh-pages'],target);}
}finally{rmSync(target,{recursive:true,force:true});}

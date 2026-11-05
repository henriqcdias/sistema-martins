/* Auditoria local: não imprime valores de credenciais nem envia dados à rede. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const findings=[],rules=[
 ['chave privada',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['token GitHub',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
 ['chave secreta Supabase',/\bsb_secret_[A-Za-z0-9_-]{32,}\b/g],
 ['chave AWS',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
 ['senha literal',/(?:["']?(?:senha|password)["']?\s*[:=]\s*["'])([^"'\r\n]{4,})["']/gi],
 ['senha preenchida em HTML',/<input\b(?=[^>]*\btype=["']password["'])(?=[^>]*\bvalue=["'][^"']+["'])[^>]*>/gi],
 ['credencial em URL',/https?:\/\/[^\s/:@]+:[^\s/@]+@/gi]
];
for(const file of files){
 if(!fs.existsSync(file)||/\.(?:png|jpg|jpeg|ico|pdf|zip|gz)$/i.test(file)||file.startsWith('dist/vendor/')||file==='dist/logo_pdf.js'||file==='scripts/auditar-publicacao.cjs'||file.endsWith('.test.cjs'))continue;
 const content=fs.readFileSync(file,'utf8');
 for(const [category,pattern]of rules){pattern.lastIndex=0;for(const match of content.matchAll(pattern))findings.push({arquivo:file,linha:content.slice(0,match.index).split('\n').length,categoria:category});}
 if(file==='dist/supabase.config.js'&&!/url\s*:\s*['"]['"]\s*,\s*key\s*:\s*['"]['"]/.test(content))findings.push({arquivo:file,linha:1,categoria:'configuração Supabase preenchida: revisar antes de enviar'});
}
console.log(JSON.stringify({arquivosVersionados:files.length,achados:findings,valoresOcultos:true,limite:'Revisão complementar de dados pessoais e histórico necessária; fixtures sintéticas de testes e bibliotecas públicas foram excluídas destas regras.'},null,2));
process.exitCode=findings.length?1:0;

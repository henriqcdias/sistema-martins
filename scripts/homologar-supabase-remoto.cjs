'use strict';
const fs=require('node:fs'),path=require('node:path'),{preflight,run}=require('./lib/homologacao-remota.cjs');
async function main(){let config={};const source=process.env.MARTINS_HML_CONFIG_FILE;if(source){try{config=JSON.parse(fs.readFileSync(source,'utf8'));}catch{console.log(JSON.stringify({status:'bloqueado',erro:'Arquivo de configuração ausente ou inválido',remotoExecutado:false}));process.exitCode=2;return;}}
const gate=preflight(config);if(!gate.pronto||!process.argv.includes('--executar')){console.log(JSON.stringify({...gate,origem:'preflight_local',testesRemotosExecutados:0},null,2));process.exitCode=gate.pronto?0:2;return;}
const result=await run(config,{execute:true}),target=process.env.MARTINS_HML_REPORT||'output/RESULTADOS_SUPABASE_REMOTO.json';fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='aprovado_no_escopo'?0:1;}
if(require.main===module)main().catch(()=>{console.log(JSON.stringify({status:'falhou',erro:'Execução interrompida; confira conectividade e configuração sem publicar credenciais'}));process.exitCode=1;});
module.exports={main};

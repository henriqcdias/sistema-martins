// Build opcional para HTML/JavaScript puro. Não usa VITE_ nem chaves de servidor.
const fs=require('node:fs'),path=require('node:path'),S=require('../dist/supabase_conexao');
function build(env,directory){const cfg=S.config({url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY}),target=path.join(directory,'supabase.config.js'),temp=target+'.tmp';fs.writeFileSync(temp,'// Configuração pública gerada no build. Sem conexão automática.\nwindow.MARTINS_SUPABASE_PUBLIC_CONFIG = '+JSON.stringify(cfg).replaceAll('<','\\u003c')+';\n');fs.renameSync(temp,target);return target;}
if(require.main===module){try{build(process.env,path.resolve(__dirname,'../dist'));process.stdout.write('Configuração pública preparada. Nenhuma conexão ou migração executada.\n');}catch{process.stderr.write('Configuração inválida: defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY públicas. Build interrompido.\n');process.exitCode=1;}}
module.exports={build};

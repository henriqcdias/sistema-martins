// HTTP/Auth/Storage simulados; SQL/RLS executados no PostgreSQL local. Nunca usa Supabase remoto.
const Q=require('./banco-financeiro-qa.cjs'),fs=require('node:fs');
async function create(){const db=await Q.setup();await db.exec(fs.readFileSync('supabase/homologacao/007_financeiro_consultas.sql','utf8'));await db.exec("ALTER TABLE storage.objects ADD UNIQUE(bucket_id,name);INSERT INTO martins_hml_v1.ambiente VALUES(1,'abcdefghijklmnopqrst','homologacao',1)");const files=new Map,calls=[];let actor=Q.A;
async function fetcher(url,opt={}){calls.push({url,opt});const u=new URL(url),p=u.pathname,body=opt.body&&typeof opt.body==='string'?JSON.parse(opt.body):null;let result,status=200;try{
if(p==='/auth/v1/token'){actor=body.email==='master@example.invalid'?Q.M:body.email==='b@example.invalid'?Q.B:Q.A;result={access_token:'qa-'+actor,refresh_token:'qa-refresh',expires_in:3600,user:{id:actor}};}
else if(p==='/auth/v1/user')result={id:actor,email:actor===Q.M?'master@example.invalid':actor===Q.B?'b@example.invalid':'a@example.invalid'};
else if(p==='/auth/v1/logout'){status=204;result=null;}
else{await Q.as(db,actor);
if(p==='/rest/v1/ambiente')result=(await db.query('SELECT project_ref,tipo,contrato FROM martins_hml_v1.ambiente')).rows;
else if(p==='/rest/v1/membros')result=(await db.query('SELECT usuario_id,empresa_id,ativo,papel FROM martins_hml_v1.membros WHERE usuario_id=$1',[actor])).rows;
else if(p.startsWith('/rest/v1/rpc/')){const name=p.split('/').at(-1),args={fin_membro:['e'],fin_master:['e'],fin_pode:['e','l','escrever'],fin_salvar:['e','l','revisao','d','op'],fin_compartilhar:['e','ids','usuarios','ver','editar'],fin_autorizar_conta:['e','c','u','usar','proprios','todos','saldo'],fin_conferir:['e','l','revisao','estado','motivo'],fin_usuarios:['e']}[name];if(!args)throw Error('RPC fora da fixture');const params=args.map(k=>k==='d'?JSON.stringify(body[k]):body[k]),query='SELECT '+(name==='fin_usuarios'?'* FROM ':'')+'martins_hml_v1.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+')'+(name==='fin_usuarios'?'':' AS result'),r=await db.query(query,params);result=name==='fin_usuarios'?r.rows:r.rows[0].result;}
else if(p.startsWith('/rest/v1/')){const table=p.split('/').at(-1);if(!['fin_lancamentos','fin_contas','fin_acessos_contas','fin_saldos','fin_auditoria'].includes(table))throw Error('Tabela fora da fixture');result=(await db.query('SELECT * FROM martins_hml_v1.'+table+' WHERE empresa_id=$1',[u.searchParams.get('empresa_id')?.replace(/^eq\./,'')])).rows;}
else if(p.startsWith('/storage/v1/object/')){const rest=p.replace('/storage/v1/object/','').replace(/^authenticated\//,''),slash=rest.indexOf('/'),bucket=rest.slice(0,slash),name=rest.slice(slash+1);if(opt.method==='POST'){await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,name]);files.set(rest,new Uint8Array(opt.body));result={Key:rest};}else{const rows=(await db.query('SELECT * FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,name])).rows;if(!rows.length||!files.has(rest)){status=404;result={};}else{const bytes=files.get(rest);return {ok:true,status:200,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}}}
else throw Error('Rota fora da fixture');}
}catch(e){status=e.code==='40001'||e.code==='23505'?409:403;result={error:'Operação recusada na fixture',message:e.message};}
return {ok:status<400,status,json:async()=>result};}
return {db,fetcher,calls,setActor:u=>{actor=u;},close:()=>db.close()};}
module.exports={create,...Q};

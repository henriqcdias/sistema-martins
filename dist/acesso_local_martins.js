/* Primeiro acesso local sem senha embutida. Não substitui Supabase Auth. */
(function(root,factory){if(typeof module==='object')module.exports=factory();else root.MartinsAcessoLocal=factory();})(globalThis,()=>{'use strict';
function pending(users){return Array.isArray(users)&&users.length===1&&users[0].id==='DEMO-MASTER'&&users[0].usuario==='teste'&&users[0].status!=='Inativo'&&users[0].senha==='';}
function setup(users,password,confirmation){if(!pending(users))throw Error('Primeiro acesso indisponível: cadastros existentes foram preservados');if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Escolha uma senha entre 12 e 128 caracteres');if(password!==confirmation)throw Error('A confirmação da senha não confere');const next=structuredClone(users);next[0].senha=password;next[0].senhaTemporaria=false;return next;}
return {pending,setup};});

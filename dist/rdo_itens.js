(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.MartinsItens=api;})(globalThis,()=>{'use strict';
function format(items){return items.map(x=>'• '+x.texto.replace(/\n/g,'\n  ')).join('\n');}
function load(text='',items){const raw=String(text??'');const valid=Array.isArray(items)&&items.every(x=>x&&typeof x.texto==='string'&&x.texto.trim());const list=valid&&format(items)===raw?items.map(x=>({texto:x.texto})):raw.trim()?[{texto:raw}]:[];return {items:list,original:raw,dirty:false};}
function change(state,index,text){const value=String(text??'').trim();if(!value)throw Error('Preencha o item antes de adicionar ou salvar.');const items=state.items.map(x=>({...x}));if(index===null)items.push({texto:value});else{if(!Number.isInteger(index)||index<0||index>=items.length)throw Error('Item não encontrado');items[index]={texto:value};}return {...state,items,dirty:true};}
function remove(state,index){if(!Number.isInteger(index)||index<0||index>=state.items.length)throw Error('Item não encontrado');return {...state,items:state.items.filter((x,i)=>i!==index).map(x=>({...x})),dirty:true};}
function text(state){return state.dirty?format(state.items):state.original;}
return {format,load,change,remove,text};});

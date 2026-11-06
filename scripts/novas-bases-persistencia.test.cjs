const test=require('node:test'),a=require('node:assert/strict'),P=require('../dist/persistencia_rdo'),R=require('../dist/remuneracao_martins'),E=require('../dist/epis_martins'),T=require('../dist/planejamento_periodos');
class Store{constructor(){this.data=new Map}getItem(k){return this.data.has(k)?this.data.get(k):null}setItem(k,v){this.data.set(k,String(v))}removeItem(k){this.data.delete(k)}}
for(const [key,fallback]of [[R.REQUESTS,[]],[E.RETURNS,[]],[T.KEY,structuredClone(T.DEFAULTS)]]){
 test('nova base permitida usa snapshot e gravação recuperável: '+key,()=>{const store=new Store,snap=P.snapshot(store,key,fallback);a.deepEqual(snap.data,fallback);P.commit(store,[{key,value:fallback,expected:snap.raw}],{actor:'QA'});a.deepEqual(JSON.parse(store.getItem(key)),fallback);});
 test('formato incorreto da nova base é preservado: '+key,()=>{const store=new Store,wrong=Array.isArray(fallback)?{}:[];store.setItem(key,JSON.stringify(wrong));a.throws(()=>P.snapshot(store,key,fallback),/Formato/);a.equal(store.getItem(key),JSON.stringify(wrong));});
}

const test=require('node:test'),assert=require('node:assert/strict'),{preview}=require('../dist/frequencia_previa_replicacao');
const origem='2026-11-04',destino='2026-11-05';
const funcionarios=[{id:'a',status:'Ativo'},{id:'b',status:'Ativo'},{id:'c',status:'Ativo'}];
test('prévia não grava nem modifica origem',()=>{const db={[origem]:{a:{status:'presente',obra:'Obra A'},b:{status:'falta'}}};const antes=JSON.stringify(db),p=preview(db,origem,destino,funcionarios);assert.equal(JSON.stringify(db),antes);assert.equal(db[destino],undefined);assert.equal(p.pendentes,3);assert.deepEqual(p.resumo,{presente:1,falta:1});});
test('registros existentes no destino são preservados',()=>{const db={[origem]:{a:{status:'presente'}},[destino]:{a:{status:'atestado'}}};const p=preview(db,origem,destino,funcionarios);assert.equal(p.itens[0].acao,'preservar_existente');assert.equal(p.itens[0].status,'atestado');assert.equal(p.existentes,1);});
test('não presume presença para colaboradores sem origem',()=>{const p=preview({},origem,destino,funcionarios);assert.ok(p.itens.every(x=>x.status==='sem_apontamento'));});
test('colaboradores inativos não entram na prévia',()=>{const p=preview({},origem,destino,[{id:'a',status:'Inativo'}]);assert.equal(p.itens.length,0);});
test('bloqueia IDs duplicados e datas iguais',()=>{assert.throws(()=>preview({},origem,destino,[funcionarios[0],funcionarios[0]]),/duplicado/);assert.throws(()=>preview({},origem,origem,funcionarios),/datas/);});

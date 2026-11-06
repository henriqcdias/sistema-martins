const {spawnSync}=require('node:child_process');
const result=spawnSync(process.env.MARTINS_NFE_PYTHON||'python',['-m','unittest','discover','-s','server/nfe','-p','test_*.py'],{stdio:'inherit',env:{...process.env,...(process.env.MARTINS_NFE_PYTHONPATH?{PYTHONPATH:process.env.MARTINS_NFE_PYTHONPATH}:{})}});if(result.error)throw result.error;process.exitCode=result.status??1;

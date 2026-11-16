UPDATE public.martins_empresas SET razao_social='Construtora Martins', nome_fantasia='Construtora Martins', cnpj='35.951.480/0001-50' WHERE id='4d9b925e-732f-4055-8f52-c40373425dd5' AND cnpj IS NULL AND razao_social='Construtora Martins - cadastro inicial';
INSERT INTO public.martins_empresas(razao_social,nome_fantasia,cnpj)
SELECT v.razao,v.fantasia,v.cnpj FROM (VALUES
('Calhas e Rufos Martins','Calhas e Rufos Martins','60.408.057/0001-56'),
('Aços RR Ltda','Aços RR','48.044.404/0001-03')
) v(razao,fantasia,cnpj) WHERE NOT EXISTS(SELECT 1 FROM public.martins_empresas e WHERE e.cnpj=v.cnpj);
INSERT INTO public.martins_unidades(empresa_id,nome,tipo)
SELECT e.id,v.nome,v.tipo FROM (VALUES
('35.951.480/0001-50','Construtora Martins','operacional'),
('60.408.057/0001-56','Calhas e Rufos Martins','operacional'),
('48.044.404/0001-03','Aços – Telha','operacional'),
('48.044.404/0001-03','Aços – Serralheria','operacional')
) v(cnpj,nome,tipo) JOIN public.martins_empresas e ON e.cnpj=v.cnpj
WHERE NOT EXISTS (SELECT 1 FROM public.martins_unidades u WHERE u.empresa_id=e.id AND u.nome=v.nome);
import copy
import unittest
from datetime import datetime, timedelta, timezone
from lxml import etree
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from signxml import XMLSigner, methods
from validator import validate, schema, NS, DS

class SyntheticLegacySigner(XMLSigner):
    # Apenas fixture legada NF-e; a chave privada é efêmera e nunca é gravada.
    def check_deprecated_methods(self):
        pass

def fixture():
    key = rsa.generate_private_key(public_exponent=65537,key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Certificado fictício QA')])
    now = datetime.now(timezone.utc)
    cert = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=1)).sign(key,hashes.SHA256())
    nfe = etree.fromstring(f'''<NFe xmlns="{NS}"><infNFe Id="NFe3526111122233300018155001000000001100000000199" versao="4.00"><ide><cUF>35</cUF><cNF>00000001</cNF><natOp>TESTE FICTICIO</natOp><mod>55</mod><serie>1</serie><nNF>1</nNF><dhEmi>2026-11-01T10:00:00-03:00</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>3550308</cMunFG><tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>9</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>QA</verProc></ide><emit><CNPJ>11222333000181</CNPJ><xNome>EMITENTE FICTICIO QA</xNome><enderEmit><xLgr>RUA TESTE</xLgr><nro>1</nro><xBairro>TESTE</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01000000</CEP></enderEmit><IE>111111111111</IE><CRT>3</CRT></emit><dest><CNPJ>12345678000195</CNPJ><xNome>DESTINATARIO FICTICIO QA</xNome><enderDest><xLgr>RUA TESTE</xLgr><nro>2</nro><xBairro>TESTE</xBairro><cMun>3550308</cMun><xMun>SAO PAULO</xMun><UF>SP</UF><CEP>01000000</CEP></enderDest><indIEDest>9</indIEDest></dest><det nItem="1"><prod><cProd>QA</cProd><cEAN>SEM GTIN</cEAN><xProd>MATERIAL FICTICIO QA</xProd><NCM>25010020</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>10.0000000000</vUnCom><vProd>10.00</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib><qTrib>1.0000</qTrib><vUnTrib>10.0000000000</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>0.00</vBC><pICMS>0.0000</pICMS><vICMS>0.00</vICMS></ICMS00></ICMS><PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>10.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>10.00</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>90</tPag><vPag>0.00</vPag></detPag></pag></infNFe></NFe>'''.encode())
    # Chave sintética com tamanho/DV coerente, sem consulta de contribuinte.
    inf=nfe.find('{'+NS+'}infNFe');base='35'+'2611'+'11222333000181'+'55'+'001'+'000000001'+'1'+'00000001';s=0;w=2
    for c in reversed(base):s+=int(c)*w;w=2 if w==9 else w+1
    dv=0 if s%11<2 else 11-s%11;access=base+str(dv)
    inf.set('Id','NFe'+access);inf.find('{'+NS+'}ide/{'+NS+'}cDV').text=str(dv)
    signer=SyntheticLegacySigner(method=methods.enveloped,signature_algorithm='rsa-sha1',digest_algorithm='sha1',c14n_algorithm='http://www.w3.org/TR/2001/REC-xml-c14n-20010315')
    signed=signer.sign(nfe,key=key,cert=cert.public_bytes(serialization.Encoding.PEM),reference_uri='#NFe'+access,id_attribute='Id')
    root=etree.Element('{'+NS+'}nfeProc',nsmap={None:NS},versao='4.00');root.append(signed)
    protocol=etree.SubElement(root,'{'+NS+'}protNFe',versao='4.00');p=etree.SubElement(protocol,'{'+NS+'}infProt')
    for tag,value in [('tpAmb','2'),('verAplic','QA'),('chNFe',access),('dhRecbto','2026-11-01T10:01:00-03:00'),('nProt','135260000000001'),('digVal','AAAAAAAAAAAAAAAAAAAAAAAAAAA='),('cStat','100'),('xMotivo','PROTOCOLO FICTICIO SEM CONSULTA OFICIAL')]:etree.SubElement(p,'{'+NS+'}'+tag).text=value
    return root

class TestValidation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.root=fixture()
    def raw(self,node=None):return etree.tostring(self.root if node is None else node)
    def test_valid_schema_and_crypto_separate_from_fiscal(self):
        v,m=schema()
        if not v.validate(self.root):print(v.error_log)
        r=validate(self.raw());self.assertTrue(r['xsd']['valido']);self.assertTrue(r['assinatura']['criptografia_valida']);self.assertFalse(r['fiscal']['consulta_oficial']);self.assertFalse(r['autorizado_para_integracao'])
    def test_tampered_signed_value(self):
        root=copy.deepcopy(self.root);root.find('.//{'+NS+'}xProd').text='ALTERADO';self.assertFalse(validate(self.raw(root))['assinatura']['criptografia_valida'])
    def test_invalid_schema(self):
        root=copy.deepcopy(self.root);node=root.find('.//{'+NS+'}cUF');node.getparent().remove(node);self.assertFalse(validate(self.raw(root))['xsd']['valido'])
    def test_duplicate_signed_element(self):
        root=copy.deepcopy(self.root);nfe=root.find('{'+NS+'}NFe');nfe.append(copy.deepcopy(nfe[0]));self.assertFalse(validate(self.raw(root))['assinatura']['criptografia_valida'])
    def test_external_reference(self):
        root=copy.deepcopy(self.root);root.find('.//{'+DS+'}Reference').set('URI','https://example.invalid/x');self.assertFalse(validate(self.raw(root))['assinatura']['criptografia_valida'])
    def test_protocol_is_not_issuer_signed(self):
        root=copy.deepcopy(self.root);root.find('.//{'+NS+'}cStat').text='101';r=validate(self.raw(root));self.assertTrue(r['assinatura']['criptografia_valida']);self.assertEqual(r['fiscal']['status_declarado_xml'],'101');self.assertFalse(r['autorizado_para_integracao'])
    def test_doctype_rejected(self):
        with self.assertRaises(ValueError):validate(b'<!DOCTYPE x>'+self.raw())
    def test_certificate_not_implicitly_trusted(self):self.assertEqual(validate(self.raw())['assinatura']['confianca_icp_brasil'],'nao_verificada')

if __name__=='__main__':unittest.main()

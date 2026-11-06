"""Validação offline. Não consulta SEFAZ, não atesta ICP-Brasil nem autoriza operações."""
import base64
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from lxml import etree
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from signxml import XMLVerifier, SignatureConfiguration, SignatureMethod, DigestAlgorithm

NS = 'http://www.portalfiscal.inf.br/nfe'
DS = 'http://www.w3.org/2000/09/xmldsig#'
ROOT = Path(__file__).parent / 'schemas'

class OfflineResolver(etree.Resolver):
    def __init__(self, files):
        self.files = files
    def resolve(self, url, public_id, context):
        if url not in self.files:
            raise ValueError('Importação de esquema fora do pacote bloqueada')
        return self.resolve_string(self.files[url], context, base_url=url)

def schema():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    raw = (ROOT / 'PL_010g_subset.zip').read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest['archive_sha256']:
        raise ValueError('Pacote de esquemas adulterado')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if set(archive.namelist()) != set(manifest['files']):
            raise ValueError('Manifesto de esquemas incompatível')
        files = {name: archive.read(name) for name in archive.namelist()}
    for name, content in files.items():
        if hashlib.sha256(content).hexdigest() != manifest['files'][name]:
            raise ValueError('Hash de esquema incompatível')
    parser = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False)
    parser.resolvers.add(OfflineResolver(files))
    return etree.XMLSchema(etree.fromstring(files['procNFe_v4.00.xsd'], parser, base_url='procNFe_v4.00.xsd')), manifest

def validate(raw):
    result = {'sha256': hashlib.sha256(raw).hexdigest(), 'xsd': {'valido': False},
              'assinatura': {'criptografia_valida': False, 'confianca_icp_brasil': 'nao_verificada'},
              'fiscal': {'consulta_oficial': False, 'situacao': 'nao_consultada'},
              'autorizado_para_integracao': False}
    if not isinstance(raw, bytes) or not raw or len(raw) > 524288:
        raise ValueError('Arquivo deve conter até 512 KB')
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('DTD e entidades bloqueadas')
    parser = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False, huge_tree=False)
    root = etree.fromstring(raw, parser)
    if root.tag != '{'+NS+'}nfeProc':
        raise ValueError('Documento processado de NF-e esperado')
    validator, manifest = schema()
    result['xsd'] = {'valido': validator.validate(root), 'pacote': manifest['package'],
                     'pacote_sha256': manifest['archive_sha256'], 'procedencia': manifest['provenance'],
                     'erros': [{'linha': e.line, 'tipo': e.type_name} for e in validator.error_log][:20]}
    nfes = root.findall('{'+NS+'}NFe')
    infs = root.findall('.//{'+NS+'}infNFe')
    signatures = root.findall('.//{'+DS+'}Signature')
    if len(nfes) != 1 or len(infs) != 1 or len(signatures) != 1 or infs[0].getparent() is not nfes[0] or signatures[0].getparent() is not nfes[0]:
        result['assinatura']['erro'] = 'Assinatura/infNFe ausente, duplicada ou em posição inválida'
        return result
    nfe, inf, sig = nfes[0], infs[0], signatures[0]
    target = inf.get('Id', '')
    ids = root.xpath('//@Id | //@ID | //@id')
    refs = sig.findall('{'+DS+'}SignedInfo/{'+DS+'}Reference')
    if not target.startswith('NFe') or len(ids) != len(set(ids)) or len(refs) != 1 or refs[0].get('URI') != '#'+target:
        result['assinatura']['erro'] = 'Referência externa, ambígua ou diferente de infNFe'
        return result
    certificates = sig.findall('{'+DS+'}KeyInfo/{'+DS+'}X509Data/{'+DS+'}X509Certificate')
    if len(certificates) != 1:
        result['assinatura']['erro'] = 'Certificado único esperado'
        return result
    try:
        der = base64.b64decode(''.join(certificates[0].text.split()), validate=True)
        cert = x509.load_der_x509_certificate(der)
        # SHA-1 é aceito exclusivamente para conferir NF-e legada; não é usado para gerar chaves ou provas novas.
        config = SignatureConfiguration(location='./', expect_references=1,
            signature_methods=frozenset([SignatureMethod.RSA_SHA1, SignatureMethod.RSA_SHA256]),
            digest_algorithms=frozenset([DigestAlgorithm.SHA1, DigestAlgorithm.SHA256]))
        verified = XMLVerifier().verify(nfe, x509_cert=cert.public_bytes(serialization.Encoding.PEM),
                                       id_attribute='Id', expect_config=config)
        if verified.signed_xml.tag != '{'+NS+'}infNFe' or verified.signed_xml.get('Id') != target:
            raise ValueError('Elemento assinado inesperado')
        now = datetime.now(timezone.utc)
        result['assinatura'].update({'criptografia_valida': True,
            'certificado_sha256': cert.fingerprint(hashes.SHA256()).hex(),
            'certificado_no_prazo_atual': cert.not_valid_before_utc <= now <= cert.not_valid_after_utc})
        # Protocolo não está coberto pela assinatura do emitente. Não é uma consulta SEFAZ.
        protocol = root.find('{'+NS+'}protNFe/{'+NS+'}infProt')
        if protocol is not None:
            key = protocol.findtext('{'+NS+'}chNFe')
            result['fiscal'].update({'status_declarado_xml': protocol.findtext('{'+NS+'}cStat'),
                'chave_coincide_com_assinado': key == target[3:]})
        result['chave'] = target[3:]
        result['finalidade'] = verified.signed_xml.findtext('{'+NS+'}ide/{'+NS+'}finNFe')
        result['itens_assinados'] = len(verified.signed_xml.findall('{'+NS+'}det'))
    except Exception as exc:
        result['assinatura']['erro'] = type(exc).__name__
    return result

if __name__ == '__main__':
    import sys
    try:
        print(json.dumps(validate(sys.stdin.buffer.read(524289)), ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'valido': False, 'erro': type(exc).__name__, 'autorizado_para_integracao': False}))
        sys.exit(1)

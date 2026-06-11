const crypto = require('crypto');
const fs = require('fs');

const dir = '.identity/authority';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

if (!fs.existsSync(`${dir}/private.pem`) || !fs.existsSync(`${dir}/public.pem`)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(`${dir}/private.pem`, privateKey);
  fs.writeFileSync(`${dir}/public.pem`, publicKey);
  console.log('Generated RSA key pair');
} else {
  console.log('Key pair already exists');
}

const publicKeyPem = fs.readFileSync(`${dir}/public.pem`, 'utf8');
const publicKey = crypto.createPublicKey(publicKeyPem);
const der = publicKey.export({ type: 'spki', format: 'der' });
const hash = crypto.createHash('sha256').update(der).digest('hex');
const key_id = hash.substring(0, 16);
console.log('key_id:', key_id);

const privateKeyPem = fs.readFileSync(`${dir}/private.pem`, 'utf8');

const infiles = fs.readdirSync('lanes/authority/inbox').filter(f => f.endsWith('.json'));
for (const file of infiles) {
  const path = `lanes/authority/inbox/${file}`;
  const msg = JSON.parse(fs.readFileSync(path, 'utf8'));

  // Payload: message without signature field, canonicalized
  const payload = JSON.parse(JSON.stringify(msg));
  delete payload.signature;
  const canonicalPayload = JSON.stringify(payload);

  // JWS header
  const header = JSON.stringify({ alg: 'RS256', kid: key_id });
  const toB64url = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const headerB64 = toB64url(header);
  const payloadB64 = toB64url(canonicalPayload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('sha256');
  sign.update(signingInput);
  const signature = sign.sign({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8'
  });
  const sigB64 = toB64url(signature);

  msg.signature = `${signingInput}.${sigB64}`;
  msg.key_id = key_id;

  fs.writeFileSync(path, JSON.stringify(msg, null, 2) + '\n');
  console.log(`Signed: ${file}`);
}

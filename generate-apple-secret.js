// Generates the client_secret JWT Supabase's Apple provider needs.
// Runs entirely locally with Node's built-in crypto -- no npm install,
// and the private key content never leaves this machine.
//
// Usage:
//   node generate-apple-secret.js <path-to-p8-file> <TeamID> <KeyID> <ClientID>
//
// Example:
//   node generate-apple-secret.js ./AuthKey_ABC123XYZ.p8 W7YK2MZ232 ABC123XYZ com.pumpio.app

const fs = require('fs');
const crypto = require('crypto');

const [, , p8Path, teamId, keyId, clientId] = process.argv;

if (!p8Path || !teamId || !keyId || !clientId) {
  console.error('Usage: node generate-apple-secret.js <path-to-p8-file> <TeamID> <KeyID> <ClientID>');
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path, 'utf8');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const now = Math.floor(Date.now() / 1000);
const header = { alg: 'ES256', kid: keyId };
const payload = {
  iss: teamId,
  iat: now,
  // Apple caps this at 6 months (15777000s). Using the max allowed.
  exp: now + 15777000,
  aud: 'https://appleid.apple.com',
  sub: clientId,
};

const headerEncoded = base64url(JSON.stringify(header));
const payloadEncoded = base64url(JSON.stringify(payload));
const signingInput = `${headerEncoded}.${payloadEncoded}`;

const signer = crypto.createSign('SHA256');
signer.update(signingInput);
signer.end();

// ES256 needs the raw (r,s) signature, not DER -- 'ieee-p1363' gives that
// directly instead of requiring a manual DER-to-raw conversion step.
const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
const signatureEncoded = base64url(signature);

const jwt = `${signingInput}.${signatureEncoded}`;

console.log('\nPaste this into Supabase\'s Apple provider "Secret Key" field:\n');
console.log(jwt);
console.log('\nExpires:', new Date((now + 15777000) * 1000).toISOString(), '(max 6 months allowed by Apple -- set a reminder to regenerate before then)');

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import fetch from 'node-fetch';

const PROJECT_ID = 'dg-proposal-repo';
const SITE_ID = 'dg-proposal-repo';
const DIST_DIR = './dist';
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.error('Usage: node deploy-hosting.mjs <OAUTH_TOKEN>');
  process.exit(1);
}

const BASE = 'https://firebasehosting.googleapis.com/v1beta1';
const HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function getAllFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...getAllFiles(full, base));
    else results.push(full);
  }
  return results;
}

async function main() {
  console.log('🚀 Deploying to Firebase Hosting...\n');

  // Step 1: Create version
  console.log('Step 1/6: Creating new version...');
  const vRes = await fetch(`${BASE}/sites/${SITE_ID}/versions`, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ config: { rewrites: [{ glob: '**', path: '/index.html' }] } })
  });
  const version = await vRes.json();
  if (!vRes.ok) { console.error('❌ Create version failed:', version.error); process.exit(1); }
  const versionName = version.name;
  console.log(`   ✅ Version: ${versionName}\n`);

  // Step 2: Hash all files
  console.log('Step 2/6: Hashing files...');
  const files = getAllFiles(DIST_DIR);
  const fileMap = {}; // hash → gzipped buffer
  const pathMap = {}; // webPath → hash

  for (const filePath of files) {
    const content = readFileSync(filePath);
    const gz = gzipSync(content);
    const hash = createHash('sha256').update(gz).digest('hex');
    const webPath = '/' + relative(DIST_DIR, filePath).replace(/\\/g, '/');
    fileMap[hash] = gz;
    pathMap[webPath] = hash;
    console.log(`   ${webPath}`);
  }

  // Step 3: Populate files list
  console.log('\nStep 3/6: Registering files with Firebase...');
  const pRes = await fetch(`${BASE}/${versionName}:populateFiles`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ files: pathMap })
  });
  const pData = await pRes.json();
  if (!pRes.ok) { console.error('❌ Populate failed:', pData.error); process.exit(1); }
  const uploadUrl = pData.uploadUrl;
  const needed = pData.uploadRequiredHashes || [];
  console.log(`   ✅ ${needed.length} file(s) to upload\n`);

  // Step 4: Upload files
  if (needed.length > 0) {
    console.log('Step 4/6: Uploading files...');
    for (const hash of needed) {
      const uRes = await fetch(`${uploadUrl}/${hash}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/octet-stream' },
        body: fileMap[hash]
      });
      if (!uRes.ok) { console.error(`❌ Upload failed for ${hash}`); process.exit(1); }
      console.log(`   ✅ Uploaded ${hash.slice(0, 12)}...`);
    }
  } else {
    console.log('Step 4/6: All files cached, no upload needed ✅');
  }

  // Step 5: Finalize version
  console.log('\nStep 5/6: Finalizing version...');
  const fRes = await fetch(`${BASE}/${versionName}?update_mask=status`, {
    method: 'PATCH', headers: HEADERS, body: JSON.stringify({ status: 'FINALIZED' })
  });
  if (!fRes.ok) { const e = await fRes.json(); console.error('❌ Finalize failed:', e.error); process.exit(1); }
  console.log('   ✅ Finalized\n');

  // Step 6: Release
  console.log('Step 6/6: Releasing to live channel...');
  const rRes = await fetch(`${BASE}/sites/${SITE_ID}/releases?versionName=${versionName}`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({})
  });
  const rData = await rRes.json();
  if (!rRes.ok) { console.error('❌ Release failed:', rData.error); process.exit(1); }

  console.log('\n🎉 DEPLOYMENT COMPLETE!');
  console.log('────────────────────────────────────────');
  console.log('🌐  https://dg-proposal-repo.web.app');
  console.log('🌐  https://dg-proposal-repo.firebaseapp.com');
  console.log('────────────────────────────────────────');
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });

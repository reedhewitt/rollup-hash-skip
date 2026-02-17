import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

var hashData = null;

function loadHashData(){
  if(hashData !== null) return;

  const rootDir = process.cwd();
  const hashFilePath = path.join(rootDir, '.rollup_hash_skip.json');

  if(!fs.existsSync(hashFilePath)){
    hashData = {};
    return;
  }

  try {
    hashData = JSON.parse(fs.readFileSync(hashFilePath, 'utf8'));
    if(!hashData || typeof hashData !== 'object') hashData = {};
  } catch {
    hashData = {};
  }
}

function save(){
  const rootDir = process.cwd();
  const hashFilePath = path.join(rootDir, '.rollup_hash_skip.json');
  fs.writeFileSync(hashFilePath, JSON.stringify(hashData, null, 2), 'utf8');
}

function getValue(key){
  loadHashData();
  return hashData?.[key] ?? null;
}

function setValue(key, value){
  loadHashData();
  hashData[key] = value;
  save();
}

function getFileModTime(relativeFilePath){
  while(relativeFilePath[0] === '/') relativeFilePath = relativeFilePath.slice(1);
  const rootDir = process.cwd();
  const filePath = path.join(rootDir, relativeFilePath);
  return fs.statSync(filePath)?.mtime ?? null;
}

export default function hashSkip(forceUpdate = false){
  return {
    name: 'hash-skip',

    async generateBundle(options, bundle){
      const hasxxhash = !!execSync('which xxhsum');

      if(!hasxxhash){
        console.log('[hash-skip] This plugin requires xxhash. Install xxhash to enable hash-based skipping of unmodified files.');
        return;
      }

      const rootDir = process.cwd();
      loadHashData();
      let updated = false;

      // Load previous hashes.
      if(!hashData || Object.keys(hashData).length === 0){
        updated = true;
        console.warn('[hash-skip] No existing hash data; starting fresh.');
      }

      for(const [fileName, asset] of Object.entries(bundle)){
        if(!asset || !asset.moduleIds || asset.moduleIds.length === 0) continue;

        // Create a temp file list for xxhash.
        const fileList = asset.moduleIds.filter(fs.existsSync);
        if(fileList.length === 0) continue;

        const hash = execSync(`cat ${fileList.map(f => `'${f}'`).join(' ')} | xxhsum | awk '{print $1}'`, { encoding: 'utf8' }).trim();
        let inputKey = asset.facadeModuleId.replace(rootDir, '') || fileName;
        while(inputKey[0] === '/') inputKey = inputKey.slice(1);
        inputKey += ':hash';
        const prevHash = hashData?.[inputKey];

        if(prevHash === hash && !forceUpdate){
          // Prevent Rollup from emitting.
          delete bundle[fileName];
          console.log(`[hash-skip] No source changes in ${fileName}, skipping output.`);
        } else {
          hashData[inputKey] = hash;
          updated = true;
          console.log(`[hash-skip] Updated hash for ${fileName}.`);
        }
      }

      // Save updated hash file only if something changed.
      if(updated) save();
    },

    // Expose these utility functions for the rollup config script.
    getFileModTime,
    getValue,
    setValue,
  };
}


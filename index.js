import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

var hashData = null;

function hashFromFiles(fileList){
  return fileList.reduce((acc, file) => {
    try {
      return acc.update(fs.readFileSync(file));
    } catch (e) {
      return acc;
    }
  }, createHash('sha256'))
  .digest('hex');
}

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
      const rootDir = process.cwd();
      let updated = false;
      loadHashData();

      // Load previous hashes.
      if(!hashData || Object.keys(hashData).length === 0){
        updated = true;
        console.log('[hash-skip] No existing hash data; starting fresh.');
      }

      for(const [fileName, asset] of Object.entries(bundle)){
        if(!asset || !asset.moduleIds || asset.moduleIds.length === 0) continue;

        // Create a temp file list for xxhash.
        const fileList = asset.moduleIds.filter(fs.existsSync);
        if(fileList.length === 0) continue;

        const hash = hashFromFiles(fileList);
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


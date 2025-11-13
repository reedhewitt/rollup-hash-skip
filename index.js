import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export default function hashSkip() {
  return {
    name: 'hash-skip',

    async generateBundle(options, bundle){
      const hasxxhash = !!execSync('which xxhsum');

      if(!hasxxhash){
        console.log('[hash-skip] This plugin requires xxhash. Install xxhash to enable hash-based skipping of unmodified files.');
        return;
      }

      const rootDir = process.cwd();
      const hashFilePath = path.join(rootDir, '.rollup_hash_skip.json');
      let hashData = {};
      let updated = false;

      // Load previous hashes.
      if(fs.existsSync(hashFilePath)){
        try {
          hashData = JSON.parse(fs.readFileSync(hashFilePath, 'utf8'));
        } catch {
          updated = true;
          console.warn('[hash-skip] Could not parse existing hash file; starting fresh.');
        }
      }

      for(const [fileName, asset] of Object.entries(bundle)){
        if(!asset || !asset.moduleIds || asset.moduleIds.length === 0) continue;

        // Create a temp file list for xxhash.
        const fileList = asset.moduleIds.filter(fs.existsSync);
        if(fileList.length === 0) continue;

        const hash = execSync(`cat ${fileList.map(f => `'${f}'`).join(' ')} | xxhsum | awk '{print $1}'`, { encoding: 'utf8' }).trim();
        const inputKey = asset.facadeModuleId || fileName;
        const prevHash = hashData?.[inputKey];

        if(prevHash === hash){
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
      if(updated){
        fs.writeFileSync(hashFilePath, JSON.stringify(hashData, null, 2), 'utf8');
      }
    }
  };
}


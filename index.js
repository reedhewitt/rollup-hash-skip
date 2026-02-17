import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export default function hashSkip(){
  return {
    name: 'hash-skip',

    hashData: null,

    async generateBundle(options, bundle){
      const hasxxhash = !!execSync('which xxhsum');

      if(!hasxxhash){
        console.log('[hash-skip] This plugin requires xxhash. Install xxhash to enable hash-based skipping of unmodified files.');
        return;
      }

      const rootDir = process.cwd();
      this.loadHashData();
      let updated = false;

      // Load previous hashes.
      if(Object.keys(this.hashData).length === 0){
        updated = true;
        console.warn('[hash-skip] No existing hash data; starting fresh.');
      }

      for(const [fileName, asset] of Object.entries(bundle)){
        if(!asset || !asset.moduleIds || asset.moduleIds.length === 0) continue;

        // Create a temp file list for xxhash.
        const fileList = asset.moduleIds.filter(fs.existsSync);
        if(fileList.length === 0) continue;

        const hash = execSync(`cat ${fileList.map(f => `'${f}'`).join(' ')} | xxhsum | awk '{print $1}'`, { encoding: 'utf8' }).trim();
        const inputKey = asset.facadeModuleId.replace(rootDir, '') || fileName;
        const prevHash = this.hashData?.[inputKey];

        if(prevHash === hash){
          // Prevent Rollup from emitting.
          delete bundle[fileName];
          console.log(`[hash-skip] No source changes in ${fileName}, skipping output.`);
        } else {
          this.hashData[inputKey] = hash;
          updated = true;
          console.log(`[hash-skip] Updated hash for ${fileName}.`);
        }
      }

      // Save updated hash file only if something changed.
      if(updated) this.save();
    },

    loadHashData(){
      if(this.hashData !== null) return;

      const rootDir = process.cwd();
      const hashFilePath = path.join(rootDir, '.rollup_hash_skip.json');

      if(!fs.existsSync(hashFilePath)){
        this.hashData = {};
        return;
      }

      try {
        this.hashData = JSON.parse(fs.readFileSync(hashFilePath, 'utf8'));
        if(!this.hashData || typeof this.hashData !== 'object') this.hashData = {};
      } catch {
        this.hashData = {};
      }
    },

    save(){
      const rootDir = process.cwd();
      const hashFilePath = path.join(rootDir, '.rollup_hash_skip.json');
      fs.writeFileSync(hashFilePath, JSON.stringify(this.hashData, null, 2), 'utf8');
    },

    getValue(key){
      this.loadHashData();
      return this.hashData?.[key] ?? null;
    },

    setValue(key, value){
      this.loadHashData();
      this.hashData[key] = value;
      this.save();
    },

    getFileModTime(relativeFilePath){
      while(relativeFilePath[0] === '/') relativeFilePath = relativeFilePath.slice(1);
      const rootDir = process.cwd();
      const filePath = path.join(rootDir, relativeFilePath);
      return fs.statSync(filePath)?.mtime ?? null;
    }
  };
}


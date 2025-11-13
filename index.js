import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export default function hashSkip() {
  return {
    name: 'hash-skip',

    async generateBundle(options, bundle){
      for(const [fileName, asset] of Object.entries(bundle)){
        if (!asset || !asset.moduleIds || asset.moduleIds.length === 0) continue;

        // Create a temp file list for xxhash
        const fileList = asset.moduleIds.filter(fs.existsSync);
        if (fileList.length === 0) continue;

        const hasxxhash = (() => { try { return !!execSync('xxhsum --version', { stdio: 'ignore' }); } catch { return false; } })();

        if(!hasxxhash){
          console.log('[hash-skip] This plugin requires xxhash. Install xxhash to enable hash-based skipping of unmodified files.');
          continue;
        }

        // Combine all source file contents in one command for hashing
        const catCmd = process.platform === 'win32'
          ? `type ${fileList.map(f => `"${f}"`).join(' ')}`
          : `cat ${fileList.map(f => `'${f}'`).join(' ')}`;

        const hash = execSync(`${catCmd} | xxhsum | awk '{print $1}'`, { encoding: 'utf8' }).trim();

        const sourcePath = asset.facadeModuleId || fileName;
        const dotFile = path.resolve(path.dirname(sourcePath), `.${path.basename(sourcePath)}.hash`);

        let prevHash = null;
        if (fs.existsSync(dotFile)) {
          prevHash = fs.readFileSync(dotFile, 'utf8').trim();
        }

        if (prevHash === hash) {
          console.log(`[hash-skip] No source changes in ${fileName}, skipping output.`);
          delete bundle[fileName]; // prevent Rollup from emitting
        } else {
          fs.writeFileSync(dotFile, hash, 'utf8');
          console.log(`[hash-skip] Updated hash for ${fileName}.`);
        }
      }
    }
  };
}


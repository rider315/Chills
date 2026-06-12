/**
 * Postinstall script to patch pdf-img-convert's package.json with "type": "module".
 * This is needed because the package uses ESM import syntax in .js files
 * but doesn't declare itself as an ESM module.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'node_modules', 'pdf-img-convert', 'package.json');
try {
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.type !== 'module') {
      pkg.type = 'module';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      console.log('[postinstall] Patched pdf-img-convert with "type": "module"');
    }
  }
} catch (err) {
  console.warn('[postinstall] Could not patch pdf-img-convert:', err.message);
}

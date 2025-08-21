#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying asset consistency...\n');

// Check all client directories
const dirs = [
  { name: 'client-build', path: './client-build' },
  { name: 'pre-built-client', path: './pre-built-client' },
  { name: 'dist/client-static', path: './dist/client-static' }
];

const results = {};

for (const dir of dirs) {
  const indexPath = path.join(dir.path, 'index.html');
  const assetsPath = path.join(dir.path, 'assets');
  
  if (fs.existsSync(indexPath) && fs.existsSync(assetsPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const assetFiles = fs.readdirSync(assetsPath);
    
    // Extract referenced assets from index.html
    const jsMatch = indexContent.match(/src="\/assets\/(.*?\.js)"/);
    const cssMatch = indexContent.match(/href="\/assets\/(.*?\.css)"/);
    
    results[dir.name] = {
      exists: true,
      referencedJS: jsMatch ? jsMatch[1] : 'none',
      referencedCSS: cssMatch ? cssMatch[1] : 'none',
      actualFiles: assetFiles,
      consistent: false
    };
    
    // Check if referenced files exist
    const jsExists = jsMatch && assetFiles.includes(jsMatch[1]);
    const cssExists = cssMatch && assetFiles.includes(cssMatch[1]);
    results[dir.name].consistent = jsExists && cssExists;
    
    console.log(`📁 ${dir.name}:`);
    console.log(`   Referenced JS:  ${results[dir.name].referencedJS}`);
    console.log(`   Referenced CSS: ${results[dir.name].referencedCSS}`);
    console.log(`   Actual files:   ${assetFiles.join(', ')}`);
    console.log(`   Consistent:     ${results[dir.name].consistent ? '✅' : '❌'}`);
    console.log('');
  } else {
    results[dir.name] = { exists: false };
    console.log(`📁 ${dir.name}: ❌ Missing`);
    console.log('');
  }
}

// Summary
const allConsistent = Object.values(results)
  .filter(r => r.exists)
  .every(r => r.consistent);

console.log(`🎯 Overall Status: ${allConsistent ? '✅ All directories consistent' : '❌ Inconsistencies found'}`);

if (allConsistent) {
  console.log('\n🚀 Ready for deployment!');
} else {
  console.log('\n⚠️  Run npm run build:client to fix inconsistencies');
}

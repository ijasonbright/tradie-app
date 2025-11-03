const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all route files
const apiDir = path.join(__dirname, 'apps/web/app/api');
const routeFiles = execSync(`find "${apiDir}" -name "route.ts" -o -name "route.tsx"`, { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${routeFiles.length} route files`);

let fixedCount = 0;
let alreadyHadIt = 0;

routeFiles.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');

  // Check if it already has export const dynamic
  if (content.includes('export const dynamic')) {
    alreadyHadIt++;
    return;
  }

  // Check if it has any export async function
  if (!content.match(/export async function (GET|POST|PUT|DELETE|PATCH)/)) {
    console.log(`Skipping ${file} - no export async function found`);
    return;
  }

  // Find the first import statement or the beginning of the file
  const lines = content.split('\n');
  let insertIndex = 0;

  // Find last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim().startsWith('const ') || lines[i].trim().startsWith('export ')) {
      break;
    }
  }

  // Insert the dynamic export after imports
  lines.splice(insertIndex, 0, '', 'export const dynamic = \'force-dynamic\'');

  const newContent = lines.join('\n');
  fs.writeFileSync(file, newContent, 'utf8');

  fixedCount++;
  console.log(`✅ Fixed: ${path.relative(apiDir, file)}`);
});

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log(`ℹ️  ${alreadyHadIt} files already had dynamic export`);
console.log(`📝 Total: ${routeFiles.length} route files`);

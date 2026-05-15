const fs = require('fs');
const path = require('path');

const FILES = [
  'src/app/api/auth/forgot-password/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/reset-password/route.ts',
  'src/app/api/convoy/[id]/invite/route.ts',
  'src/app/api/convoy/[id]/route.ts',
  'src/app/api/friends/requests/[id]/route.ts',
  'src/app/api/fuel/[id]/price/route.ts',
  'src/app/api/fuel/route.ts',
  'src/app/api/reports/[id]/vote/route.ts',
  'src/app/api/routes/[id]/route.ts',
  'src/app/api/routes/route.ts',
  'src/app/api/spots/auto-check/route.ts',
  'src/app/api/spots/route.ts',
  'src/app/api/users/me/location/route.ts',
  'src/app/api/users/me/password/route.ts',
  'src/app/api/users/me/route.ts',
  'src/app/api/users/route.ts',
];

for (const rel of FILES) {
  const filePath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Find the actual param name used in the method that was patched
  // Look for POST/PUT/PATCH handler and its first param name
  const match = content.match(/export async function (?:POST|PUT|PATCH)\s*\(\s*(\w+)/);
  if (!match) { console.log(`SKIP (no handler): ${rel}`); continue; }

  const paramName = match[1];
  if (paramName === 'req') { console.log(`OK (already req): ${rel}`); continue; }

  // Replace the wrong 'req' with the actual parameter name in the CT guard
  const wrongGuard = `  const ct = req.headers.get('content-type') ?? '';`;
  const correctGuard = `  const ct = ${paramName}.headers.get('content-type') ?? '';`;

  if (content.includes(wrongGuard)) {
    content = content.replace(wrongGuard, correctGuard);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`FIXED ${paramName}: ${rel}`);
  } else {
    console.log(`SKIP (guard not found): ${rel}`);
  }
}

const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
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

// Patterns that indicate a POST/PUT/PATCH handler body parsing
const BODY_PARSE_RE = /await req\.json\(\)|await request\.json\(\)/;
// Pattern to check if CT validation already exists
const CT_CHECK_RE = /Unsupported Media Type|content-type.*415|415.*content-type/i;

const CT_GUARD = `  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });
`;

// Find POST/PUT/PATCH functions that parse body but don't have CT check
const HANDLER_RE = /export async function (POST|PUT|PATCH)\s*\(([^)]+)\)[^{]*\{/g;

let totalPatched = 0;

for (const rel of TARGET_FILES) {
  const filePath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(filePath)) { console.log(`SKIP (not found): ${rel}`); continue; }

  let content = fs.readFileSync(filePath, 'utf8');

  if (CT_CHECK_RE.test(content)) { console.log(`SKIP (already has CT check): ${rel}`); continue; }
  if (!BODY_PARSE_RE.test(content)) { console.log(`SKIP (no json() call): ${rel}`); continue; }

  // Find each POST/PUT/PATCH handler and insert CT guard after opening brace
  let patched = false;
  content = content.replace(/export async function (POST|PUT|PATCH)([^{]*)\{/, (match) => {
    patched = true;
    return match + '\n' + CT_GUARD;
  });

  if (patched) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`PATCHED: ${rel}`);
    totalPatched++;
  }
}

console.log(`\nTotal patched: ${totalPatched}`);

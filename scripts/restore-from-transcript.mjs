import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.join(__dirname, '..');
const transcriptPath =
  'C:/Users/RYZEN 5/.cursor/projects/c-world-of-mirror/agent-transcripts/d8c43d45-4a00-4ddb-b749-ba83cf6b4d5f/d8c43d45-4a00-4ddb-b749-ba83cf6b4d5f.jsonl';

/** Finance removal started around this transcript line. */
const DELETION_LINE = 2228;

const standaloneTargets = new Set([
  'src/utils/exportFinanceReport.ts',
  'src/utils/financeSearch.ts',
  'src/components/employee-home/EmployeeHomeBalanceCard.tsx',
  'src/stores/financeNotificationStore.ts',
  'src/utils/financeNotificationMessage.ts',
  'src/services/notifications.service.ts',
  'src/hooks/useAdminFinanceNotifications.ts',
  'src/components/notifications/FinanceInAppNotificationBanner.tsx',
  'src/components/notifications/AdminFinanceNotificationsBridge.tsx',
]);

const integrationTargets = {
  'src/navigation/MainTabNavigator.tsx': ['FinanceTab', 'canAccessModule'],
  'src/screens/dashboard/AdminDashboardScreen.tsx': ['FinanceSummaryCards'],
  'src/screens/dashboard/EmployeeHomeScreen.tsx': ['EmployeeHomeBalanceCard'],
  'src/utils/employeePermissions.ts': ['canAccessModule'],
  'src/hooks/useAdminDashboardData.ts': ['globalBalance'],
  'src/hooks/useEmployeeHomeData.ts': ['showFinance'],
};

function toRelPath(p) {
  const normalized = p.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const marker = 'world-of-mirror/';
  const idx = lower.indexOf(marker);
  if (idx >= 0) {
    return normalized.slice(idx + marker.length);
  }
  const srcIdx = lower.indexOf('/src/');
  if (srcIdx >= 0) {
    return normalized.slice(srcIdx + 1);
  }
  return normalized;
}

function matchesMarkers(contents, markers) {
  return markers.every((m) => contents.includes(m));
}

const lastWrites = new Map();
const lines = fs.readFileSync(transcriptPath, 'utf8').split(/\r?\n/).filter(Boolean);

let lineNum = 0;
for (const line of lines) {
  lineNum++;
  if (lineNum >= DELETION_LINE) break;

  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    continue;
  }

  const content = obj?.message?.content;
  if (!Array.isArray(content)) continue;

  for (const block of content) {
    if (block?.type !== 'tool_use' || block?.name !== 'Write') continue;
    const rel = toRelPath(block.input?.path || '');
    const fileContents = block.input?.contents;
    if (!fileContents) continue;

    const relLower = rel.toLowerCase();

    for (const target of standaloneTargets) {
      if (relLower === target.toLowerCase()) {
        lastWrites.set(target, fileContents);
      }
    }

    for (const [target, markers] of Object.entries(integrationTargets)) {
      if (relLower === target.toLowerCase() && matchesMarkers(fileContents, markers)) {
        lastWrites.set(target, fileContents);
      }
    }
  }
}

const restored = [];
const missing = [];

function writeTarget(rel, contents) {
  const dest = path.join(workspace, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents, 'utf8');
  restored.push(rel);
}

for (const rel of [...standaloneTargets, ...Object.keys(integrationTargets)].sort()) {
  const contents = lastWrites.get(rel);
  if (!contents) {
    missing.push(rel);
    continue;
  }
  writeTarget(rel, contents);
}

// AppNavigator: bridge was added via StrReplace (no full Write). Patch current file.
const appNavPath = path.join(workspace, 'src/navigation/AppNavigator.tsx');
let appNav = fs.readFileSync(appNavPath, 'utf8');
if (!appNav.includes('AdminFinanceNotificationsBridge')) {
  if (!appNav.includes("import AdminFinanceNotificationsBridge")) {
    appNav = appNav.replace(
      "import {useAuthStore} from '@app/stores/authStore';",
      "import AdminFinanceNotificationsBridge from '@app/components/notifications/AdminFinanceNotificationsBridge';\nimport {useAuthStore} from '@app/stores/authStore';",
    );
  }
  if (!appNav.includes('<AdminFinanceNotificationsBridge')) {
    appNav = appNav.replace(
      '<Stack.Navigator screenOptions={{headerShown: false}}>',
      '<AdminFinanceNotificationsBridge />\n      <Stack.Navigator screenOptions={{headerShown: false}}>',
    );
  }
  fs.writeFileSync(appNavPath, appNav, 'utf8');
  restored.push('src/navigation/AppNavigator.tsx (patched bridge)');
}

console.log(JSON.stringify({ restored, missing }, null, 2));

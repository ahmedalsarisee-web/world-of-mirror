import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';

const ROOT = path.resolve('.');
const TRANSCRIPT_DIR = path.resolve(
  process.env.TRANSCRIPT_DIR ||
    'C:/Users/RYZEN 5/.cursor/projects/c-world-of-mirror/agent-transcripts',
);
const STOP_TRANSCRIPT_SUFFIX = '903aa589-4718-4cff-a203-f96b78ce6ff6.jsonl';
const STOP_LINE = 127;

const EXPERIMENTAL_FILES = new Set(
  [
    'FinanceAdvanceSummary.tsx',
    'EmployeeFinanceTotalCard.tsx',
    'EmployeeFinanceHubPanel.tsx',
    'FinanceBalanceHeroCard.tsx',
    'FinanceAccountSection.tsx',
    'useFinanceCardHeaderMenu.ts',
  ].map((f) => f.toLowerCase()),
);

const FINANCE_PATTERNS = [
  '/components/finance/',
  '/screens/finance/financehome',
  '/screens/finance/employeeaccount',
  '/screens/finance/employeeadvance',
  '/screens/finance/employeecustomledger',
  '/navigation/financenavigator',
  '/hooks/usefinance',
  '/utils/exportfinancereport',
  '/utils/financecardframe',
  '/utils/financesearch',
  '/utils/financetotals',
  '/utils/financepermissions',
  '/utils/financeledgers',
  '/hooks/useadmindashboarddata',
  '/hooks/useemployeehomedata',
  '/screens/dashboard/admindashboard',
  '/screens/dashboard/employeehome',
  '/navigation/maintabnavigator',
  '/navigation/tabpressresettoroot',
  '/types/navigation.ts',
];

function normalize(p) {
  return p.replace(/\\/g, '/').toLowerCase();
}

function isFinanceFile(filePath) {
  const norm = normalize(filePath);
  const base = path.basename(norm);
  if (EXPERIMENTAL_FILES.has(base)) return false;
  if (!norm.includes('/src/')) return false;
  return FINANCE_PATTERNS.some((pattern) => norm.includes(pattern));
}

function listTranscripts(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTranscripts(full));
    } else if (entry.name.endsWith('.jsonl')) {
      out.push(full);
    }
  }
  return out.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function gitShow(relPath) {
  try {
    return execSync(`git show HEAD:${relPath.replace(/\\/g, '/')}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

const GIT_SEED = [
  'src/components/finance/FinanceAccountsList.tsx',
  'src/components/finance/FinanceCardOverflowMenu.tsx',
  'src/components/finance/FinanceCardScreen.tsx',
  'src/components/finance/FinanceCustomLedgersList.tsx',
  'src/components/finance/FinanceCustomLedgersSection.tsx',
  'src/components/finance/FinanceGroupedListCard.tsx',
  'src/components/finance/FinanceLedgerVisibilityPicker.tsx',
  'src/components/finance/FinanceListRow.tsx',
  'src/components/finance/FinanceSearchBar.tsx',
  'src/components/finance/FinanceSectionHeader.tsx',
  'src/components/finance/FinanceSummaryCards.tsx',
  'src/components/finance/FinanceTransactionRow.tsx',
  'src/components/finance/SharedFinanceLedgersSection.tsx',
  'src/components/finance/AddFinanceLedgerSheet.tsx',
  'src/components/finance/EditFinanceTransactionSheet.tsx',
  'src/components/finance/AccountStatementExportButton.tsx',
  'src/components/finance/EmployeeFinanceQuickCard.tsx',
  'src/hooks/useFinanceCardHeaderMenu.tsx',
  'src/hooks/useFinanceTransactionNow.ts',
  'src/navigation/FinanceNavigator.tsx',
  'src/screens/finance/FinanceHomeScreen.tsx',
  'src/screens/finance/EmployeeAccountScreen.tsx',
  'src/screens/finance/EmployeeAdvanceScreen.tsx',
  'src/screens/finance/EmployeeCustomLedgerScreen.tsx',
  'src/screens/finance/AdminDetailScreen.tsx',
  'src/screens/finance/EmployeeAttendanceScreen.tsx',
  'src/utils/exportFinanceReport.ts',
  'src/utils/financeSearch.ts',
  'src/utils/financeTotals.ts',
  'src/utils/financeLedgers.ts',
  'src/hooks/useAdminDashboardData.ts',
  'src/hooks/useEmployeeHomeData.ts',
  'src/screens/dashboard/AdminDashboardScreen.tsx',
  'src/screens/dashboard/EmployeeHomeScreen.tsx',
  'src/types/navigation.ts',
  'src/navigation/tabPressResetToRoot.ts',
];

const NO_GIT_SEED = new Set([
  normalize(path.join(ROOT, 'src/utils/financePermissions.ts')),
  normalize(path.join(ROOT, 'src/navigation/MainTabNavigator.tsx')),
]);

const files = new Map();

for (const rel of GIT_SEED) {
  const abs = normalize(path.join(ROOT, rel));
  if (NO_GIT_SEED.has(abs)) continue;
  const content = gitShow(rel);
  if (content != null) {
    files.set(abs, {rel, content});
  }
}

function setFile(filePath, content) {
  files.set(normalize(filePath), {
    rel: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    content,
  });
}

function getFile(filePath) {
  return files.get(normalize(filePath))?.content;
}

function applyTranscript(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const limit = filePath.endsWith(STOP_TRANSCRIPT_SUFFIX) ? STOP_LINE : lines.length;

  for (let i = 0; i < limit; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const content = obj.message?.content;
    if (!Array.isArray(content)) continue;

    for (const item of content) {
      if (!item.input?.path || !isFinanceFile(item.input.path)) continue;

      if (item.name === 'Write' && item.input.contents != null) {
        setFile(item.input.path, item.input.contents);
        continue;
      }

      if (item.name === 'StrReplace' && item.input.old_string != null && item.input.new_string != null) {
        let current = getFile(item.input.path);
        if (current == null) {
          const rel = path.relative(ROOT, item.input.path).replace(/\\/g, '/');
          current = gitShow(rel);
        }
        if (current == null) continue;
        if (!current.includes(item.input.old_string)) continue;
        setFile(item.input.path, current.replace(item.input.old_string, item.input.new_string));
      }
    }
  }
}

for (const transcript of listTranscripts(TRANSCRIPT_DIR)) {
  applyTranscript(transcript);
}

for (const {rel, content} of files.values()) {
  const outPath = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, content);
  console.log(`restored ${rel} (${content.length} chars)`);
}

console.log(`\nDone. ${files.size} files written.`);

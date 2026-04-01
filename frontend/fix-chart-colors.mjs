import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const replacements = [
  // Chart fill colors -> CSS vars
  ['hsl(14, 100%, 57%)',    'var(--chart-1)'],
  ['hsl(217, 91%, 60%)',    'var(--chart-2)'],
  ['hsl(142, 76%, 36%)',    'var(--chart-3)'],
  ['hsl(50, 100%, 50%)',    'var(--chart-6)'],
  ['hsl(291, 100%, 49%)',   'var(--chart-4)'],
  ['hsl(0, 78%, 40%)',      'var(--chart-5)'],
  // Grid/axis that used old hsl vars
  ["hsl(var(--border))",    'var(--chart-grid)'],
  ["hsl(var(--muted-foreground))", 'var(--chart-text)'],
  // Semantic success/destructive/warning used as chart fills
  ["hsl(var(--success))",       'var(--chart-3)'],
  ["hsl(var(--destructive))",   'var(--chart-5)'],
  ["hsl(var(--warning))",       'var(--chart-6)'],
  // Tooltip bg
  ["cursor={{ fill: '#f5f5f5' }}", "cursor={{ fill: 'var(--chart-bg)' }}"],
  // Old muted-foreground tick fills in axis props
  ["fill: 'hsl(var(--muted-foreground))'", "fill: 'var(--chart-text)'"],
  // Hardcoded border color in charts
  ["stroke=\"#eee\"", 'stroke="var(--chart-grid)"'],
  // Hardcoded status badge backgrounds still using slate-*
  ['bg-success/10 text-success', 'badge-success'],
  ['bg-destructive/10 text-destructive', 'badge-error'],
  ['bg-warning/10 text-warning', 'badge-warning'],
  ['bg-info/10 text-info', 'badge-info'],
];

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) walk(full);
    else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')) processFile(full);
  }
}

walk('src');
console.log('Done.');

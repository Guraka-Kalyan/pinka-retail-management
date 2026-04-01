import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Replace hardcoded Tailwind slate colors in className strings with CSS-var based ones.
// We target the most common patterns used as heading/body text.
const replacements = [
  // Page headings
  ['text-slate-900', 'text-foreground'],
  ['text-slate-800', 'text-foreground'],
  // Secondary / label text  
  ['text-slate-500', 'text-muted-foreground'],
  ['text-slate-600', 'text-muted-foreground'],
  ['text-slate-400', 'text-muted-foreground'],
  ['text-slate-300', 'text-muted-foreground'],
  // Backgrounds that should adapt
  ['bg-slate-50',  'bg-muted'],
  // Border colors
  ['border-slate-200', 'border-[var(--border)]'],
  ['border-slate-300', 'border-[var(--border)]'],
];

const PAGE_DIR = 'src/pages';
const COMP_DIR = 'src/components';

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    // Only replace inside className strings (rough heuristic: surrounded by quote or space)
    const re = new RegExp(`(?<=["' ])${from}(?=["' ])`, 'g');
    if (re.test(content)) {
      content = content.replace(new RegExp(`(?<=["' ])${from}(?=["' ])`, 'g'), to);
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
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) processFile(full);
  }
}

walk(PAGE_DIR);
walk(COMP_DIR);
console.log('Done.');

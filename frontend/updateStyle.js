import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function replaceColors(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      replaceColors(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Colors mapping
      content = content.replace(/bg-\[#B71C1C\]/g, 'bg-primary');
      content = content.replace(/hover:bg-\[#8e1616\]/g, 'hover:bg-primary\/80');
      content = content.replace(/text-\[#B71C1C\]/g, 'text-primary');
      content = content.replace(/border-\[#B71C1C\]/g, 'border-primary');
      content = content.replace(/text-red-500/g, 'text-destructive');
      content = content.replace(/text-red-600/g, 'text-destructive');
      content = content.replace(/bg-red-600/g, 'bg-destructive');
      content = content.replace(/bg-red-700/g, 'bg-destructive');
      
      content = content.replace(/text-green-600/g, 'text-success');
      content = content.replace(/bg-gray-100/g, 'bg-secondary');
      content = content.replace(/border-gray-200/g, 'border-border');
      
      // Structure UI
      content = content.replace(/zinc-900/g, 'foreground'); 
      content = content.replace(/zinc-500/g, 'muted-foreground');
      content = content.replace(/zinc-400/g, 'muted-foreground');
      content = content.replace(/zinc-100/g, 'secondary');
      content = content.replace(/bg-zinc-50\/50/g, 'bg-card');
      content = content.replace(/bg-zinc-50\/80/g, 'bg-card');
      content = content.replace(/bg-zinc-50/g, 'bg-card');
      content = content.replace(/bg-white/g, 'bg-card');
      
      // Card shadows
      content = content.replace(/shadow-sm/g, 'shadow-md');
      
      // Responsive modifications required safely directly injected
      content = content.replace(/max-w-4xl/g, 'w-full max-w-full');
      content = content.replace(/max-w-5xl/g, 'w-full max-w-full');
      content = content.replace(/sm:max-w-\[450px\]/g, 'w-[95%] sm:max-w-[450px]'); 
      
      fs.writeFileSync(filePath, content);
    }
  }
}

replaceColors(path.join(__dirname, 'src', 'pages'));
replaceColors(path.join(__dirname, 'src', 'components'));
console.log('Styles formatted successfully.');

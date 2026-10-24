// Regenera la carpeta fuente del bundle de deploy (el zip final se crea con PowerShell).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = 'C:/Users/santiherrera/Documents/club-pintureria';
const tmp = 'C:/Users/santiherrera/AppData/Local/Temp/opencode/deploy-bundle';
const zip = path.join(root, 'club-pintureria-deploy.zip');

fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

// 1) .env de producción (del zip anterior, NUNCA el backend/.env local)
execSync(
  `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${zip}'); $e=$z.Entries | Where-Object { $_.FullName -eq '.env' }; [IO.File]::WriteAllText('${tmp}/.env', (New-Object IO.StreamReader($e.Open())).ReadToEnd()); $z.Dispose()"`,
  { stdio: 'inherit' }
);

// 2) Backend: package/lock/tsconfig, dist compilado, prisma y src
for (const f of ['package.json', 'package-lock.json', 'tsconfig.json']) {
  fs.copyFileSync(path.join(root, 'backend', f), path.join(tmp, f));
}
fs.cpSync(path.join(root, 'backend', 'dist'), path.join(tmp, 'dist'), { recursive: true });
fs.cpSync(path.join(root, 'backend', 'prisma'), path.join(tmp, 'prisma'), { recursive: true });
fs.cpSync(path.join(root, 'backend', 'src'), path.join(tmp, 'src'), { recursive: true });

// 3) Frontend compilado -> frontend-dist/
fs.cpSync(path.join(root, 'frontend', 'dist'), path.join(tmp, 'frontend-dist'), { recursive: true });

console.log('Bundle source listo en', tmp);

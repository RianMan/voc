import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 递归遍历目录并重命名文件
function renameFiles(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            renameFiles(fullPath);
        } else {
            const ext = path.extname(file);
            if (ext === '.tsx') {
                const newPath = fullPath.replace(/\.tsx$/, '.jsx');
                fs.renameSync(fullPath, newPath);
                console.log(`Renamed: ${file} -> ${path.basename(newPath)}`);
            } else if (ext === '.ts' && file !== 'vite.config.ts') { // vite config 单独处理
                const newPath = fullPath.replace(/\.ts$/, '.js');
                fs.renameSync(fullPath, newPath);
                console.log(`Renamed: ${file} -> ${path.basename(newPath)}`);
            }
        }
    });
}

// 1. 删除 tsconfig.json
const tsconfigPath = path.join(__dirname, 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
    fs.unlinkSync(tsconfigPath);
    console.log('🗑️  Deleted tsconfig.json');
}

// 2. 重命名 vite.config.ts -> vite.config.js
const viteConfigPath = path.join(__dirname, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
    const newViteConfigPath = path.join(__dirname, 'vite.config.js');
    fs.renameSync(viteConfigPath, newViteConfigPath);
    console.log('Renamed vite.config.ts -> vite.config.js');
}

// 3. 修改 index.html 中的引用
const htmlPath = path.join(__dirname, 'index.html');
if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    if (html.includes('index.tsx')) {
        html = html.replace('src="/index.tsx"', 'src="/index.jsx"');
        fs.writeFileSync(htmlPath, html);
        console.log('✏️  Updated index.html source to .jsx');
    }
}

// 4. 批量重命名 src 目录下的文件
renameFiles(path.join(__dirname, 'src'));
// 根目录下的 App.tsx 和 index.tsx 也处理一下 (如果你的结构是在根目录)
['App.tsx', 'index.tsx'].forEach(f => {
    const p = path.join(__dirname, f);
    if(fs.existsSync(p)) {
        const newP = p.replace('.tsx', '.jsx');
        fs.renameSync(p, newP);
        console.log(`Renamed: ${f} -> ${path.basename(newP)}`);
    }
});

console.log('\n🎉 TS 移除完成！现在是纯 JS 项目了。');
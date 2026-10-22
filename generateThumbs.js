// generateThumbs.js — Node 18+, ESM ("type":"module" в package.json)
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ADS_DIR     = 'ads';
const THUMBS_DIR  = 'thumbs';
const MANIFEST_FN = 'manifest.json';
const VIEWPORT    = { width: 480, height: 960 };
const RENDER_WAIT = 3500; // мс — чтобы успел отрисоваться первый кадр

// Желаемый порядок отображения групп на сайте
const FOLDER_ORDER = [
    'tower-defence',
    'puzzles',
    'merge-2',
    'roguelike',
    'other-mechanics',
    '3D',
    'iterations-example' 
];

/* ╭─────────────────── helpers ───────────────────╮ */
const prettify = slug =>
    slug
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());

async function walkHtml(dir, out = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory())      await walkHtml(full, out);
        else if (e.isFile() && e.name.endsWith('.html')) out.push(full);
    }
    return out;
}
/* ╰───────────────────────────────────────────────╯ */

await fs.mkdir(THUMBS_DIR, { recursive: true });

// ---- читаем старый манифест (чтобы сохранить ручные title/tags) ----
let oldManifest = [];
try { oldManifest = JSON.parse(await fs.readFile(MANIFEST_FN, 'utf8')); }
catch { /* файла нет — ок */ }

const oldItemsByKey  = new Map();
const oldGroupTitles = new Map();
for (const g of oldManifest) {
    oldGroupTitles.set(g.folder, g.title);
    for (const it of g.items) {
        oldItemsByKey.set(`${g.folder}/${it.file}`, it);
    }
}

// ---- собираем свежий манифест с нуля ----
const htmlFiles = await walkHtml(ADS_DIR);
const groups    = new Map(); // folder -> { title, folder, items[] }

const browser = await puppeteer.launch({
    defaultViewport: VIEWPORT,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0); // навигация без таймаута

    for (const fileAbs of htmlFiles) {
        const relPath   = path.relative(ADS_DIR, fileAbs);
        const [folder]  = relPath.split(path.sep);
        const baseName  = path.parse(fileAbs).name;
        const thumbName = `${folder}_${baseName}.jpg`;
        const thumbRel  = `thumbs/${thumbName}`;
        const adsRel    = `${ADS_DIR}/${relPath}`.replace(/\\/g, '/');

        const key = `${folder}/${path.basename(fileAbs)}`;
        const old = oldItemsByKey.get(key);

        // ---- рендер превью (один упавший плеебл не валит всё) ----
        try {
            const url = `file://${process.cwd()}/${adsRel}`;

            // 1) ждём только DOM — быстро, без ожидания «тихой сети»
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

            // 2) если есть <canvas> — ждём его появления (Cocos/Phaser/Three)
            await page.waitForSelector('canvas', { timeout: 15_000 }).catch(() => {});

            // 3) фиксированная пауза, чтобы успел отрисоваться первый кадр
            await new Promise(r => setTimeout(r, RENDER_WAIT));

            const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
            await fs.writeFile(path.join(THUMBS_DIR, thumbName), buf);
        } catch (err) {
            console.error(`✖ render failed: ${adsRel}\n  ${err.message}`);
            // если превью не сгенерировалось — пропускаем этот плеебл
            continue;
        }

        // ---- обновляем манифест ----
        if (!groups.has(folder)) {
            groups.set(folder, {
                title : oldGroupTitles.get(folder) ?? prettify(folder),
                folder,
                items : []
            });
        }
        groups.get(folder).items.push({
            file : path.basename(fileAbs),
            title: old?.title ?? prettify(baseName),
            tags : old?.tags  ?? [],
            src  : adsRel,
            thumb: thumbRel
        });
    }
} finally {
    await browser.close();
}

// ---- Сортируем группы по кастомному списку FOLDER_ORDER ----
const manifest = [...groups.values()];

manifest.sort((a, b) => {
    const indexA = FOLDER_ORDER.indexOf(a.folder);
    const indexB = FOLDER_ORDER.indexOf(b.folder);

    // 1. Если обе папки есть в списке порядка — сортируем по их индексам
    if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
    }
    // 2. Если папка есть в списке, а другая нет — папка из списка идет первой
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // 3. Если обеих папок нет в списке (добавили новые) — падают в конец по алфавиту
    return a.folder.localeCompare(b.folder);
});

// Внутри каждой группы файлы оставляем по алфавиту
for (const g of manifest) {
    g.items.sort((a, b) => a.file.localeCompare(b.file));
}

// ---- Записываем манифест ----
await fs.writeFile(MANIFEST_FN, JSON.stringify(manifest, null, 2) + '\n');

// ---- Подчищаем осиротевшие thumbnails ----
const usedThumbs = new Set(
    manifest.flatMap(g => g.items.map(i => path.basename(i.thumb)))
);
for (const f of await fs.readdir(THUMBS_DIR)) {
    if (!usedThumbs.has(f)) await fs.unlink(path.join(THUMBS_DIR, f));
}

console.log(`✔ thumbs & manifest.json updated (${htmlFiles.length} playables)`);

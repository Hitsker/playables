// generateThumbs.js  —  Node 18+, ESM ( "type":"module" в package.json )
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ADS_DIR     = 'ads';
const THUMBS_DIR  = 'thumbs';
const MANIFEST_FN = 'manifest.json';
const VIEWPORT    = { width: 480, height: 960 };

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

let manifest = [];
try { manifest = JSON.parse(await fs.readFile(MANIFEST_FN, 'utf8')); }
catch {  }

const ensureGroup = folder => {
    let g = manifest.find(g => g.folder === folder);
    if (!g) {
        g = { title: prettify(folder), folder, items: [] };
        manifest.push(g);
    }
    return g;
};

const htmlFiles = await walkHtml(ADS_DIR);
const browser = await puppeteer.launch({
    defaultViewport: VIEWPORT,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page      = await browser.newPage();

for (const fileAbs of htmlFiles) {
    const relPath   = path.relative(ADS_DIR, fileAbs);
    const [folder]  = relPath.split(path.sep);
    const baseName  = path.parse(fileAbs).name;
    const thumbName = `${folder}_${baseName}.jpg`;
    const thumbRel  = `thumbs/${thumbName}`;
    const adsRel    = `${ADS_DIR}/${relPath}`.replace(/\\/g,'/');

    const url = `file://${process.cwd()}/${adsRel}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
    await new Promise(r => setTimeout(r, 3000));
    const buf = await page.screenshot({ type: 'jpeg', quality: 80 });
    await fs.writeFile(path.join(THUMBS_DIR, thumbName), buf);

    const group = ensureGroup(folder);
    let item = group.items.find(i => i.file === path.basename(fileAbs));
    if (!item) {
        item = {
            file : path.basename(fileAbs),
            title: prettify(baseName),
            tags : [],
        };
        group.items.push(item);
    }
    item.src   = adsRel;
    item.thumb = thumbRel;
}

await fs.writeFile(MANIFEST_FN, JSON.stringify(manifest, null, 2));
await browser.close();
console.log('✔  thumbs & manifest.json updated');

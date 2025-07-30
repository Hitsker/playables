
const grid     = document.querySelector('.grid');
const manifest = await fetch('manifest.json').then(r => r.json());

for (const group of manifest) {
    grid.insertAdjacentHTML('beforeend', `<h2 class="group">${group.title}</h2>`);

    for (const item of group.items) {
        const card = document.createElement('article');
        card.className = 'card';

        const phone = document.createElement('div');
        phone.className = 'phone lazy';
        phone.dataset.src   = item.src;
        phone.dataset.thumb = item.thumb;

        phone.innerHTML = `
      <img src="${item.thumb}" alt="${item.title} preview">
      <button class="play-btn" aria-label="Play demo">▶</button>
    `;

        const h3 = document.createElement('h3');
        h3.textContent = item.title;

        const ul = document.createElement('ul');
        ul.className = 'meta';
        (item.tags || []).forEach(t => {
            const li = document.createElement('li');
            li.textContent = t;
            ul.appendChild(li);
        });

        const actions = document.createElement('div');
        actions.className = 'actions';

        const fsBtn = document.createElement('a');
        fsBtn.className = 'fs-btn';
        fsBtn.href   = item.src;
        fsBtn.target = '_blank';
        fsBtn.rel    = 'noopener';
        fsBtn.textContent = '↗ Full screen';
        actions.appendChild(fsBtn);

        card.append(phone, h3, ul, actions);
        grid.appendChild(card);
    }
}

let current = null;

grid.addEventListener('click', e => {
    const phone = e.target.closest('.phone');
    if (!phone) return;

    if (current === phone) {
        unload(phone);
        current = null;
        return;
    }
    if (current) unload(current);

    load(phone);
    current = phone;
}, { passive: true });

function load(phone) {
    const iframe = document.createElement('iframe');
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none';

    iframe.onload = () => {
        const cw = iframe.contentWindow;
        if (cw?.console) ['log','info','debug','warn','error'].forEach(m => cw.console[m] = () => {});
        iframe.style.pointerEvents = 'auto';
    };

    iframe.src = phone.dataset.src;

    phone.innerHTML = '';
    phone.appendChild(iframe);
    phone.classList.replace('lazy', 'playing');
    
    const fsBtn = phone.parentElement.querySelector('.fs-btn');
    if (fsBtn) {
        fsBtn.href   = '#';
        fsBtn.target = '';
        fsBtn.onclick = e => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                iframe.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        };
    }
}

function unload(phone) {
    phone.innerHTML = `
    <img src="${phone.dataset.thumb}" alt="preview">
    <button class="play-btn" aria-label="Play demo">▶</button>
  `;
    phone.classList.replace('playing', 'lazy');

    const fsBtn = phone.parentElement.querySelector('.fs-btn');
    if (fsBtn) {
        fsBtn.href = phone.dataset.src;
        fsBtn.target = '_blank';
        fsBtn.onclick = null;
    }
}

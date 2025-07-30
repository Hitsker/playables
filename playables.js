const grid     = document.querySelector('.grid');
const manifest = await fetch('manifest.json').then(r => r.json());

for (const group of manifest) {
    grid.insertAdjacentHTML('beforeend', `<h2 class="group">${group.title}</h2>`);

    for (const item of group.items) {
        grid.insertAdjacentHTML(
            'beforeend',
            `<article class="card">
         <div class="phone lazy"
              data-src="${item.src}"
              data-thumb="${item.thumb}">
           <img src="${item.thumb}" alt="${item.title} preview">
           <button class="play-btn" aria-label="Play demo">▶</button>
         </div>
         <h3>${item.title}</h3>
         <ul class="meta">${(item.tags||[]).map(t=>`<li>${t}</li>`).join('')}</ul>
       </article>`
        );
    }
}

let current = null;

grid.addEventListener('click', e=>{
    const phone = e.target.closest('.phone');
    if (!phone) return;

    if (current === phone){ unload(phone); current = null; return; }
    if (current) unload(current);

    load(phone);
    current = phone;
},{passive:true});


function load(phone){
    const iframe = document.createElement('iframe');
    iframe.loading = 'lazy';
    iframe.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none';

    iframe.onload = () => {
        const cw = iframe.contentWindow;
        if (cw && cw.console){
            ['log','info','debug','warn','error'].forEach(m=>cw.console[m]=()=>{});
        }
        iframe.style.pointerEvents = 'auto';
    };

    iframe.src = phone.dataset.src;
    phone.innerHTML = '';
    phone.appendChild(iframe);
    phone.classList.replace('lazy','playing');
}

function unload(phone){
    phone.innerHTML = `
    <img src="${phone.dataset.thumb}" alt="preview">
    <button class="play-btn" aria-label="Play demo">▶</button>
  `;
    phone.classList.replace('playing','lazy');
}

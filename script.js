const $ = id => document.getElementById(id);
const imageInput = $('imageInput'), btnUpload = $('btnUpload'), imagePreview = $('imagePreview'),
      placeholderText = $('placeholderText'), btnCapturar = $('btnCapturar'),
      scriptTemplate = $('scriptTemplate'), statusBar = $('statusBar'), statusMsg = $('statusMsg'),
      progressWrap = $('progressWrap'), progressBar = $('progressBar'),
      resultBox = $('resultBox'), resultFields = $('resultFields'), resultBadge = $('resultBadge'),
      btnCopyResult = $('btnCopyResult'), rawToggle = $('rawToggle'), rawContent = $('rawContent'),
      dropZone = $('dropZone');

let scriptFinal = '';

const setStatus = (msg, type = '') => {
  statusMsg.textContent = msg;
  statusBar.className = 'status-bar' + (type ? ' ' + type : '');
};

const loadFile = file => {
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = 'block';
  placeholderText.style.display = 'none';
  btnCapturar.disabled = false;
  resultBox.style.display = 'none';
  setStatus('Imagem carregada. Clique em Extrair.', 'ready');
};

btnUpload.addEventListener('click', () => imageInput.click());
dropZone.addEventListener('click', () => imageInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f?.type.startsWith('image/')) loadFile(f);
});
imageInput.addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });

const preprocessCanvas = img => {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  const s = Math.max(1, 1200 / img.naturalWidth);
  c.width = img.naturalWidth * s; c.height = img.naturalHeight * s;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const g = d.data[i] * .299 + d.data[i+1] * .587 + d.data[i+2] * .114;
    d.data[i] = d.data[i+1] = d.data[i+2] = g;
  }
  ctx.putImageData(d, 0, 0);
  const c2 = document.createElement('canvas'), ctx2 = c2.getContext('2d');
  c2.width = c.width; c2.height = c.height;
  ctx2.filter = 'contrast(180%) brightness(110%)';
  ctx2.drawImage(c, 0, 0);
  return c2;
};

const matchFirst = (text, patterns) => {
  for (const p of patterns) { const m = text.match(p); if (m) return (m[1] ?? m[0]).trim(); }
  return null;
};

const extractData = text => {
  const t = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');
  const tn = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const modelo = matchFirst(t, [
    /Nome\s+do\s+produto\s+([^\n]{3,40})/i,
    /Nome\s+do\s+modelo\s+([^\n]{3,40})/i,
    /Product\s+name\s+([^\n]{3,40})/i,
    /Galaxy\s+[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,2}/i,
    /SM-[A-Z0-9/]+/i,
    /iPhone\s+[A-Za-z0-9\s]+(?:Pro|Max|Plus|Mini)?/i,
    /(?:Redmi|POCO|Xiaomi|Motorola)\s+[A-Za-z0-9\s]+/i,
  ])?.substring(0, 40).replace(/\s+/g, ' ') ?? null;

  const sn = (
    matchFirst(tn, [
      /n[^\s]*\s+de\s+serie\s+([a-z0-9]{5,20})/i,
      /serial\s*(?:number|no\.?)?\s*[:\-]?\s*([a-z0-9]{5,20})/i,
      /s\/n\s*[:\-]?\s*([a-z0-9]{5,20})/i,
      /\bsn\s*[:\-]\s*([a-z0-9]{5,20})/i,
    ]) ??
    matchFirst(t, [
      /N[uúü][^\s]*\s+de\s+s[eé]rie[\s:]*([A-Z0-9]{5,20})/i,
      /S[eé]rie[\s:]*([A-Z0-9]{5,20})/i,
      /S\/N[\s:]*([A-Z0-9]{5,20})/i,
    ])
  )?.toUpperCase() ?? null;

  let imei1 = t.match(/IMEI\s*1[\s:.\-]*(\d[\d\s]{13,16}\d)/i)?.[1].replace(/\s/g,'').slice(0,15) ?? null;
  let imei2 = t.match(/IMEI\s*2[\s:.\-]*(\d[\d\s]{13,16}\d)/i)?.[1].replace(/\s/g,'').slice(0,15) ?? null;

  if (!imei1 || !imei2) {
    const all = [...t.matchAll(/\b(\d[\d ]{13,16}\d)\b/g)]
      .map(m => m[1].replace(/\s/g,'')).filter((d,_,a) => d.length===15 && a.indexOf(d)===a.lastIndexOf(d));
    if (!imei1) imei1 = all[0] ?? null;
    if (!imei2) imei2 = all[1] ?? null;
  }

  return { modelo, sn, imei1, imei2 };
};

const renderResult = (dados, rawText) => {
  resultFields.innerHTML = '';
  const fields = [
    ['modelo','Modelo'], ['sn','Número de Série (SN)'], ['imei1','IMEI 1'], ['imei2','IMEI 2']
  ];
  let found = 0;
  for (const [key, label] of fields) {
    const val = dados[key];
    if (val) found++;
    resultFields.insertAdjacentHTML('beforeend', `
      <div class="result-field">
        <div class="result-field-name">${label}</div>
        <div class="result-field-value ${val ? 'found' : 'not-found'}">${val || 'Não encontrado'}</div>
      </div>`);
  }
  resultBadge.textContent = found >= 3 ? '✓ OK' : `⚠ ${found}/4`;
  resultBadge.className = 'result-badge ' + (found >= 3 ? 'ok' : 'fail');
  scriptFinal = scriptTemplate.value
    .replace('{MODELO DO CELULAR}', dados.modelo || '[NÃO ENCONTRADO]')
    .replace('{SERIE}',             dados.sn     || '[NÃO ENCONTRADO]')
    .replace('{IMEI 1}',            dados.imei1  || '[NÃO ENCONTRADO]')
    .replace('{IMEI 2}',            dados.imei2  || '[NÃO ENCONTRADO]');
  rawContent.textContent = rawText;
  rawContent.style.display = 'none';
  rawToggle.textContent = '▶ Ver texto bruto do OCR';
  resultBox.style.display = 'block';
};

rawToggle.addEventListener('click', () => {
  const open = rawContent.style.display === 'block';
  rawContent.style.display = open ? 'none' : 'block';
  rawToggle.textContent = open ? '▶ Ver texto bruto do OCR' : '▼ Ocultar texto bruto';
});

btnCopyResult.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(scriptFinal); }
  catch { const ta = Object.assign(document.createElement('textarea'), {value: scriptFinal});
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  btnCopyResult.textContent = '✅ Copiado!';
  setTimeout(() => { btnCopyResult.textContent = '📋 Copiar Script Preenchido'; }, 2000);
});

btnCapturar.addEventListener('click', async () => {
  btnCapturar.disabled = btnUpload.disabled = true;
  resultBox.style.display = 'none';
  progressWrap.classList.add('visible');
  progressBar.style.width = '0%';
  setStatus('Pré-processando imagem...', 'active');
  try {
    const canvas = preprocessCanvas(imagePreview);
    progressBar.style.width = '15%';
    setStatus('Executando OCR...', 'active');
    const worker = await Tesseract.createWorker(['eng', 'por'], 1, {
      logger: m => { if (m.status === 'recognizing text')
        progressBar.style.width = (15 + Math.round(m.progress * 75)) + '%'; }
    });
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÉÊÍÓÔÕÚÇàáâãäéêíóôõúç0123456789 /-:.\n',
      preserve_interword_spaces: '1',
    });
    const { data: { text } } = await worker.recognize(canvas);
    await worker.terminate();
    progressBar.style.width = '95%';
    const dados = extractData(text);
    renderResult(dados, text);
    const count = Object.values(dados).filter(Boolean).length;
    if (count >= 3)     setStatus(`Concluído — ${count}/4 campos encontrados.`, 'success');
    else if (count > 0) setStatus(`Parcial — ${count}/4 encontrados. Tente foto mais nítida.`, 'ready');
    else                setStatus('Nenhum dado encontrado. Use foto mais nítida.', 'error');
    progressBar.style.width = '100%';
    setTimeout(() => progressWrap.classList.remove('visible'), 800);
  } catch {
    setStatus('Erro no OCR. Tente novamente.', 'error');
    progressWrap.classList.remove('visible');
  } finally {
    btnCapturar.disabled = btnUpload.disabled = false;
  }
});
const video = document.getElementById('camera');
const canvas = document.getElementById('canvas');
const btnCapturar = document.getElementById('btnCapturar');
const scriptTemplate = document.getElementById('scriptTemplate');
const resultadoDiv = document.getElementById('resultado');
const statusMsg = document.getElementById('statusMsg');

// 1. INICIAR A CÂMERA (Usa a câmera traseira no celular)
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function(stream) {
        video.srcObject = stream;
        statusMsg.style.color = 'green';
        statusMsg.innerText = "Câmera pronta! Aponte para a tela.";
    })
    .catch(function(err) {
        statusMsg.innerText = "Erro ao acessar câmera. Verifique as permissões.";
        console.error(err);
    });

// 2. AÇÃO DO BOTÃO
btnCapturar.addEventListener('click', async () => {
    // Muda o visual do botão para mostrar que está carregando
    btnCapturar.innerText = "⏳ Lendo imagem... Aguarde!";
    btnCapturar.disabled = true;
    resultadoDiv.style.display = 'none';

    // Tira uma "foto" do vídeo e joga no canvas invisível
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
        // 3. O CÉREBRO: O Tesseract.js lê o texto da imagem em português ('por')
        const { data: { text } } = await Tesseract.recognize(canvas, 'por');
        console.log("Texto lido:", text);

        // 4. FILTRAR OS DADOS (Regex)
        const modeloMatch = text.match(/(?:Galaxy\s+[A-Za-z0-9\s\-]+)/i);
        const modelo = modeloMatch ? modeloMatch[0].trim() : "[MODELO NÃO ENCONTRADO]";

        const snMatch = text.match(/s[ée]rie[\s\n]*([A-Za-z0-9]+)/i);
        const sn = snMatch ? snMatch[1] : "[SN NÃO ENCONTRADO]";

        const imei1Match = text.match(/IMEI\s*1[\s\n]*(\d{15})/i);
        const imei1 = imei1Match ? imei1Match[1] : "[IMEI 1 NÃO ENCONTRADO]";

        const imei2Match = text.match(/IMEI\s*2[\s\n]*(\d{15})/i);
        const imei2 = imei2Match ? imei2Match[1] : "[IMEI 2 NÃO ENCONTRADO]";

        // 5. SUBSTITUIR NO SCRIPT
        let textoPronto = scriptTemplate.value
            .replace('{MODELO DO CELULAR}', modelo)
            .replace('{SERIE}', sn)
            .replace('{IMEI 1}', imei1)
            .replace('{IMEI 2}', imei2);

        // 6. COPIAR PARA A ÁREA DE TRANSFERÊNCIA
        await navigator.clipboard.writeText(textoPronto);

        // Mostra o resultado na tela
        resultadoDiv.innerText = "✅ TEXTO COPIADO COM SUCESSO!\n\n" + textoPronto;
        resultadoDiv.style.display = 'block';
        resultadoDiv.style.backgroundColor = '#d4edda';
        resultadoDiv.style.borderColor = '#c3e6cb';

    } catch (error) {
        resultadoDiv.innerText = "❌ Ocorreu um erro ao processar a imagem.";
        resultadoDiv.style.display = 'block';
        resultadoDiv.style.backgroundColor = '#f8d7da';
        console.error(error);
    } finally {
        // Restaura o botão
        btnCapturar.innerText = "📸 Capturar e Copiar Texto";
        btnCapturar.disabled = false;
    }
});
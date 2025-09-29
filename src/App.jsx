import React, { useState, useEffect, useRef } from 'react';

const App = () => {
    const [transcripciones, setTranscripciones] = useState([]);
    const [transcripcionParcial, setTranscripcionParcial] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [error, setError] = useState('');
    const [nuevaPalabra, setNuevaPalabra] = useState('');
    
    const configRef = useRef({
        palabrasClave: ['importante', 'examen', 'tarea', 'deben', 'debe', 'recuerden', 'atención'],
        colorProfesor: '#e74c3c',
        sensibilidadPausa: 2000,
        minPalabrasCambio: 2,
        sensibilidadPalabrasClave: 1
    });
    
    const [configInput, setConfigInput] = useState({
        palabrasClave: configRef.current.palabrasClave.join(', '),
        colorProfesor: configRef.current.colorProfesor
    });

    const ultimoHablanteRef = useRef(0);
    const ultimoTiempoRef = useRef(Date.now());
    const recognitionRef = useRef(null);
    const mismoHablanteCountRef = useRef(0);
    const transcripcionBufferRef = useRef('');
    const pausaCountRef = useRef(0);

    const isCompatible = () => {
        return ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
    };

    const getColor = (speaker) => {
        const colores = [
            configRef.current.colorProfesor,
            '#2980b9',
            '#27ae60',
            '#8e44ad',
            '#f39c12',
            '#16a085'
        ];
        return colores[speaker % colores.length];
    }

    const detectarHablante = (texto) => {
        const ahora = Date.now();
        const pausa = ahora - ultimoTiempoRef.current;
        const palabras = texto.trim().split(/\s+/).length;
        
        if (palabras < configRef.current.minPalabrasCambio) {
            ultimoTiempoRef.current = ahora;
            return ultimoHablanteRef.current;
        }
        
        const textoLower = texto.toLowerCase();
        const esProfesor = configRef.current.palabrasClave.some(palabra => 
            textoLower.includes(palabra.toLowerCase())
        );
        
        if (esProfesor) {
            ultimoHablanteRef.current = 0;
            mismoHablanteCountRef.current = 0;
            pausaCountRef.current = 0;
            ultimoTiempoRef.current = ahora;
            return 0;
        }
        
        if (pausa > configRef.current.sensibilidadPausa) {
            pausaCountRef.current++;
            
            if (pausaCountRef.current >= 2) {
                let nuevoHablante = (ultimoHablanteRef.current + 1) % 5;
                if (nuevoHablante === 0) nuevoHablante = 1;
                ultimoHablanteRef.current = nuevoHablante;
                mismoHablanteCountRef.current = 0;
                pausaCountRef.current = 0;
            }
        } else {
            pausaCountRef.current = 0;
        }
        
        if (mismoHablanteCountRef.current > 8) {
            let nuevoHablante = (ultimoHablanteRef.current + 1) % 5;
            if (nuevoHablante === 0) nuevoHablante = 1;
            ultimoHablanteRef.current = nuevoHablante;
            mismoHablanteCountRef.current = 0;
        } else {
            mismoHablanteCountRef.current++;
        }
        
        ultimoTiempoRef.current = ahora;
        return ultimoHablanteRef.current;
    };

    const agregarPalabraClave = () => {
        if (nuevaPalabra.trim() && !configRef.current.palabrasClave.includes(nuevaPalabra.trim().toLowerCase())) {
            const nuevasPalabras = [...configRef.current.palabrasClave, nuevaPalabra.trim().toLowerCase()];
            configRef.current.palabrasClave = nuevasPalabras;
            setConfigInput(prev => ({ ...prev, palabrasClave: nuevasPalabras.join(', ') }));
            setNuevaPalabra('');
        }
    };

    const eliminarPalabraClave = (palabra) => {
        const nuevasPalabras = configRef.current.palabrasClave.filter(p => p !== palabra);
        configRef.current.palabrasClave = nuevasPalabras;
        setConfigInput(prev => ({ ...prev, palabrasClave: nuevasPalabras.join(', ') }));
    };

    const actualizarConfig = () => {
        const nuevasPalabras = configInput.palabrasClave
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
        
        configRef.current = {
            ...configRef.current,
            palabrasClave: nuevasPalabras.length > 0 ? nuevasPalabras : ['importante'],
            colorProfesor: configInput.colorProfesor
        };
        
        setShowConfig(false);
    };

    const resaltarPalabrasClave = (texto) => {
        let resultado = texto;
        configRef.current.palabrasClave.forEach(palabra => {
            if (palabra.length > 1) {
                const regex = new RegExp(`\\b${palabra}\\b`, 'gi');
                resultado = resultado.replace(regex, match => 
                    `<mark style="background: #FFEB3B; padding: 2px 4px; border-radius: 3px; font-weight: bold;">${match}</mark>`
                );
            }
        });
        return resultado;
    };

    useEffect(() => {
        if (!isCompatible()) {
            setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome en Android o Safari en iOS.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!recognitionRef.current) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'es-ES';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript + ' ';
                    }
                }

                if (interimTranscript !== '') {
                    const hablante = detectarHablante(interimTranscript);
                    setTranscripcionParcial(interimTranscript);
                    transcripcionBufferRef.current = interimTranscript;
                }

                if (finalTranscript !== '') {
                    const hablante = detectarHablante(finalTranscript);
                    
                    setTranscripciones(prev => {
                        const nuevaTranscripcion = {
                            texto: finalTranscript.trim(),
                            speaker: hablante,
                            timestamp: new Date().toLocaleTimeString()
                        };
                        
                        return [...prev, nuevaTranscripcion];
                    });
                    
                    setTranscripcionParcial('');
                    transcripcionBufferRef.current = '';
                }
            };

            recognition.onerror = (event) => {
                console.error('Error reconocimiento:', event.error);
                if (event.error === 'not-allowed') {
                    setError('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono en tu navegador.');
                } else if (event.error === 'audio-capture') {
                    setError('No se detectó ningún micrófono. Conecta un micrófono e intenta nuevamente.');
                }
            };

            recognition.onend = () => {
                if (isListening) {
                    setTimeout(() => {
                        try {
                            if (recognitionRef.current && isListening) {
                                recognitionRef.current.start();
                            }
                        } catch (e) {
                            console.log('Error al reiniciar reconocimiento:', e);
                        }
                    }, 500);
                }
            };

            recognitionRef.current = recognition;
        }
    }, []);

    useEffect(() => {
        if (isListening && recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setError('');
            } catch (e) {
                setError('Error al iniciar el reconocimiento: ' + e.message);
            }
        } else if (!isListening && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.log('Error al detener:', e);
            }
        }
    }, [isListening]);

    const toggleListening = () => {
        if (!isCompatible()) {
            setError('Navegador no compatible con reconocimiento de voz');
            return;
        }
        
        setIsListening(!isListening);
        if (!isListening) {
            ultimoTiempoRef.current = Date.now();
            ultimoHablanteRef.current = 0;
            mismoHablanteCountRef.current = 0;
            pausaCountRef.current = 0;
            transcripcionBufferRef.current = '';
            setError('');
        } else {
            setTranscripcionParcial('');
            transcripcionBufferRef.current = '';
        }
    };

    const limpiarTranscripciones = () => {
        setTranscripciones([]);
        setTranscripcionParcial('');
        transcripcionBufferRef.current = '';
        ultimoHablanteRef.current = 0;
        mismoHablanteCountRef.current = 0;
        pausaCountRef.current = 0;
        setError('');
    };

    const getNombreHablante = (speakerId) => {
        const nombres = [
            '👨‍🏫 PROFESOR',
            '👤 Estudiante 1',
            '👤 Estudiante 2', 
            '👤 Estudiante 3',
            '👤 Estudiante 4',
            '👤 Estudiante 5'
        ];
        return nombres[speakerId] || `👤 Hablante ${speakerId + 1}`;
    };

    return (
        <div className="app-container">
            {/* Header con color y ancho completo - BORDER CORREGIDO */}
            <div className="header-fixed">
                <div className="header-content">
                    <div className="header-title">
                        <h1>VOZ A TEXTO</h1>
                        <p>Detección inteligente de hablantes</p>
                    </div>
                    
                    <div className="header-buttons">
                        <button 
                            onClick={toggleListening}
                            className={`btn ${isListening ? 'btn-stop' : 'btn-primary'}`}
                            disabled={!isCompatible()}
                        >
                            {isListening ? '⏹️ Detener' : '🎤 Iniciar'}
                        </button>
                        
                        <button 
                            onClick={limpiarTranscripciones}
                            className="btn btn-secondary"
                        >
                            🧹 Limpiar
                        </button>
                        
                        <button 
                            onClick={() => setShowConfig(!showConfig)}
                            className="btn btn-config"
                        >
                            ⚙️ Config
                        </button>

                        {isListening && (
                            <div className="recording-indicator">
                                ● GRABANDO
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="error-message">
                        {error}
                    </div>
                )}

                {!isCompatible() && (
                    <div className="error-message">
                        ⚠️ Tu navegador no soporta reconocimiento de voz
                    </div>
                )}
            </div>

            {/* Panel de Configuración */}
            {showConfig && (
                <div className="config-panel">
                    <h3>Configuración de Detección</h3>
                    
                    <div className="config-info">
                        <h4>🔊 Modo Sensible Activado</h4>
                        <p>• Cambia de hablante con pausas de 2 segundos<br/>
                           • Detecta profesor con 1 palabra clave<br/>
                           • Soporta hasta 6 hablantes diferentes</p>
                    </div>
                    
                    <div className="config-section">
                        <label>Palabras clave para profesor:</label>
                        <div className="agregar-palabra">
                            <input 
                                type="text" 
                                value={nuevaPalabra}
                                onChange={(e) => setNuevaPalabra(e.target.value)}
                                className="input-field input-small"
                                placeholder="Agregar palabra clave..."
                                onKeyPress={(e) => e.key === 'Enter' && agregarPalabraClave()}
                            />
                            <button 
                                onClick={agregarPalabraClave}
                                className="btn btn-primary btn-small"
                            >
                                ➕
                            </button>
                        </div>
                    </div>

                    <div className="config-section">
                        <label>Palabras clave actuales:</label>
                        <div className="palabras-lista">
                            {configRef.current.palabrasClave.map((palabra, index) => (
                                <span key={index} className="palabra-item">
                                    {palabra}
                                    <button 
                                        onClick={() => eliminarPalabraClave(palabra)}
                                        className="remove-palabra"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="config-section">
                        <label>
                            Color del profesor:
                            <span 
                                className="color-preview"
                                style={{ backgroundColor: configInput.colorProfesor }}
                            ></span>
                        </label>
                        <input 
                            type="color" 
                            value={configInput.colorProfesor}
                            onChange={(e) => setConfigInput(prev => ({ ...prev, colorProfesor: e.target.value }))}
                            className="color-input"
                        />
                    </div>

                    <div className="config-buttons">
                        <button 
                            onClick={actualizarConfig}
                            className="btn btn-primary"
                        >
                            💾 Guardar
                        </button>
                        <button 
                            onClick={() => setShowConfig(false)}
                            className="btn btn-secondary"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Área de Transcripción - Más cerca del header */}
            <div className="transcription-area">
                {transcripciones.length === 0 && !transcripcionParcial ? (
                    <div className="message">
                        {isListening ? '🎧 Habla ahora...' : '👆 Presiona "Iniciar" para comenzar'}
                    </div>
                ) : (
                    <div className="transcription-content">
                        {transcripciones.map((item, idx) => (
                            <div 
                                key={idx} 
                                className="transcription-item"
                                style={{ borderLeftColor: getColor(item.speaker) }}
                            >
                                <div className="speaker-label" style={{ color: getColor(item.speaker) }}>
                                    {getNombreHablante(item.speaker)}
                                    <span className="timestamp">{item.timestamp}</span>
                                </div>
                                <div 
                                    className="transcription-text"
                                    dangerouslySetInnerHTML={{ __html: resaltarPalabrasClave(item.texto) }}
                                />
                            </div>
                        ))}

                        {transcripcionParcial && (
                            <div 
                                className="transcription-item live-transcription"
                                style={{ 
                                    borderLeftColor: getColor(ultimoHablanteRef.current),
                                    backgroundColor: '#fff9c4'
                                }}
                            >
                                <div className="speaker-label" style={{ color: getColor(ultimoHablanteRef.current) }}>
                                    {getNombreHablante(ultimoHablanteRef.current)}
                                    <span className="live-indicator">EN VIVO</span>
                                </div>
                                <div className="transcription-text">
                                    {transcripcionParcial}
                                    <span className="blink">|</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer con el mismo color del header y tamaño consistente */}
            <div className="footer">
                <div className="footer-content">
                    <div className="footer-logo">
                        <img 
                            src="/logo-omestec.png" 
                            alt="OmesTec Logo" 
                        />
                    </div>
                    <div className="footer-info">
                        <div className="footer-company">OmesTec</div>
                        <div className="footer-author">Elaborado por: Oscar Marquez Vanegas</div>
                        <div className="footer-rights">© 2025</div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .app-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 15px;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                }
                
                /* HEADER CON COLOR Y ANCHO COMPLETO - BORDER CORREGIDO */
                .header-fixed {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 25px 20px;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    width: 100%;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    height: 120px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    border-radius: 0 0 10px 10px;
                }
                
                .header-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 15px;
                }
                
                .header-title {
                    color: white;
                }
                
                .header-title h1 {
                    font-size: 2rem;
                    margin-bottom: 5px;
                    color: white;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                
                .header-title p {
                    font-size: 1rem;
                    opacity: 0.9;
                    margin: 0;
                    color: white;
                }
                
                .header-buttons {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                
                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .btn-primary {
                    background: #4CAF50;
                    color: white;
                }
                
                .btn-stop {
                    background: #f44336;
                    color: white;
                }
                
                .btn-secondary {
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .btn-config {
                    background: #ff9800;
                    color: white;
                }
                
                .btn:hover {
                    transform: translateY(-1px);
                }
                
                .btn-small {
                    padding: 8px 16px;
                    font-size: 12px;
                }
                
                .recording-indicator {
                    background: #f44336;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 15px;
                    font-size: 12px;
                    font-weight: bold;
                    animation: pulse 1s infinite;
                }
                
                .error-message {
                    background: #ffebee;
                    color: #c62828;
                    padding: 12px;
                    border-radius: 6px;
                    margin-top: 10px;
                    border-left: 4px solid #c62828;
                    font-size: 14px;
                    max-width: 1200px;
                    margin: 10px auto 0;
                }
                
                .config-panel {
                    background: white;
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    margin-top: 140px;
                }
                
                .config-panel h3 {
                    margin-bottom: 20px;
                    color: #2c3e50;
                    font-size: 1.5rem;
                }
                
                .config-info {
                    background: #e8f4fd;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                
                .config-info h4 {
                    margin: 0 0 8px 0;
                    color: #0066cc;
                    font-size: 1.1rem;
                }
                
                .config-info p {
                    margin: 0;
                    font-size: 14px;
                    color: #333;
                }
                
                .config-section {
                    margin-bottom: 20px;
                }
                
                .config-section label {
                    display: block;
                    margin-bottom: 10px;
                    font-weight: bold;
                    font-size: 1rem;
                }
                
                .input-field {
                    padding: 10px 14px;
                    border: 2px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 14px;
                }
                
                .input-small {
                    width: 200px;
                }
                
                .agregar-palabra {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .palabras-lista {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                
                .palabra-item {
                    background: #2196F3;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 15px;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                }
                
                .remove-palabra {
                    background: none;
                    border: none;
                    color: white;
                    margin-left: 8px;
                    cursor: pointer;
                    font-weight: bold;
                }
                
                .color-preview {
                    display: inline-block;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    margin-left: 10px;
                    border: 2px solid #ddd;
                    vertical-align: middle;
                }
                
                .color-input {
                    width: 70px;
                    height: 40px;
                    cursor: pointer;
                }
                
                .config-buttons {
                    display: flex;
                    gap: 15px;
                }
                
                /* ÁREA DE TRANSCRIPCIÓN - MÁS CERCA DEL HEADER */
                .transcription-area {
                    background: white;
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    flex-grow: 1;
                    margin-bottom: 20px;
                    min-height: 400px;
                    margin-top: 140px;
                }
                
                .message {
                    text-align: center;
                    color: #666;
                    font-size: 18px;
                    padding: 60px 20px;
                }
                
                .transcription-content {
                    max-height: 500px;
                    overflow-y: auto;
                    padding-right: 10px;
                }
                
                .transcription-item {
                    background: #f8f9fa;
                    padding: 20px;
                    margin-bottom: 15px;
                    border-radius: 8px;
                    border-left: 5px solid #2196F3;
                }
                
                .live-transcription {
                    background: #fff9c4;
                    animation: glow 1.5s ease-in-out infinite alternate;
                }
                
                .speaker-label {
                    font-weight: bold;
                    margin-bottom: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 15px;
                }
                
                .live-indicator {
                    background: #f44336;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    animation: blink 1s infinite;
                }
                
                .timestamp {
                    font-size: 12px;
                    color: #666;
                    font-weight: normal;
                }
                
                .transcription-text {
                    font-size: 16px;
                    line-height: 1.5;
                }
                
                .blink {
                    animation: blink 1s infinite;
                }
                
                /* FOOTER CON EL MISMO COLOR Y TAMAÑO CONSISTENTE */
                .footer {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 25px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    height: 120px;
                    display: flex;
                    align-items: center;
                }
                
                .footer-content {
                    display: flex;
                    align-items: center;
                    gap: 25px;
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                }
                
                /* LOGO CORREGIDO - SIN FONDO */
                .footer-logo {
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    border: none !important;
                }
                
                .footer-logo img {
                    width: 80px;
                    height: 80px;
                    object-fit: contain;
                    display: block;
                    background: transparent !important;
                    border: none !important;
                }
                
                .footer-info {
                    color: white;
                    flex-grow: 1;
                }
                
                .footer-company {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: white;
                    margin-bottom: 5px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                }
                
                .footer-author {
                    color: rgba(255, 255, 255, 0.9);
                    margin-bottom: 5px;
                    font-size: 15px;
                }
                
                .footer-rights {
                    color: rgba(255, 255, 255, 0.7);
                    font-size: 13px;
                }
                
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
                
                @keyframes glow {
                    from { box-shadow: 0 0 5px #ffeb3b; }
                    to { box-shadow: 0 0 10px #ffeb3b; }
                }
                
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.3; }
                }
                
                @media (max-width: 768px) {
                    .header-content {
                        flex-direction: column;
                        text-align: center;
                        padding: 0 10px;
                    }
                    
                    .header-fixed {
                        height: auto;
                        padding: 20px 15px;
                        border-radius: 0 0 10px 10px;
                    }
                    
                    .header-buttons {
                        justify-content: center;
                    }
                    
                    .transcription-area {
                        margin-top: 180px;
                    }
                    
                    .config-panel {
                        margin-top: 180px;
                    }
                    
                    .footer {
                        height: auto;
                        padding: 20px;
                    }
                    
                    .footer-content {
                        flex-direction: column;
                        text-align: center;
                        gap: 15px;
                    }
                }
            `}</style>
        </div>
    );
};

export default App;
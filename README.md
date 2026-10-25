# VozPDF - Lector de PDF a Audio en el Navegador

Una aplicación web moderna (React + TypeScript, 100% en el cliente, sin backend) que convierte documentos PDF en audiolibros interactivos con texto sincronizado en tiempo real, navegación por oraciones y exportación a MP3/WAV.

---

## 🚀 Características Principales

1. **Subida y Extracción de PDF:**
   - Arrastrar y soltar o selector de archivo local.
   - Extracción de texto página por página con `pdfjs-dist`.
   - Detección de PDFs escaneados (sin capa de texto digital) con soporte de OCR local usando `Tesseract.js`.
   - Carga con 1 clic de documento de prueba (*Don Quijote de la Mancha*).

2. **Limpieza Inteligente de Texto:**
   - Unificación de palabras partidas con guión a final de línea (silabificación e.g. `palabra- \ncontinuación` $\to$ `palabracontinuación`).
   - Eliminación de encabezados y pies de página recurrentes en el documento.
   - Filtro de números de página aislados (`Página 12`, `12 / 40`).
   - Unión de saltos de línea suaves dentro de párrafos.
   - Segmentación en oraciones con preservación de abreviaturas (*Dr.*, *Sr.*, *ej.*, *pág.*, *etc.*) y decimales.

3. **Dos Motores de Síntesis de Voz (TTS):**
   - **Rápido (Web Speech API):** Lectura instantánea utilizando las voces nativas del sistema operativo (Google, Microsoft, Apple) sin descargar ningún modelo.
   - **Alta Calidad (Kokoro-82M):** Red neuronal de 82 millones de parámetros ejecutada en un Web Worker dedicado mediante ONNX Runtime con aceleración WebGPU y fallback automático a WebAssembly (WASM).

4. **Reproductor de Audio Avanzado:**
   - Play/Pausa, anterior/siguiente oración, retroceso/avance de 10 segundos.
   - Barra de progreso interactiva (seekable) con tiempo transcurrido y duración total estimada.
   - **Resaltado en tiempo real:** la frase que se lee se resalta en el texto con desplazamiento automático suave (*auto-scroll*).
   - **Navegación interactiva:** Haz clic en cualquier frase del documento para comenzar a escuchar inmediatamente desde esa posición.

5. **Configuración y Personalización:**
   - Selector de velocidad de lectura (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x) con memoria en `localStorage`.
   - Selector de volumen y tono (*pitch*).
   - Selector de rango de páginas a narrar (ej. de la página 1 a la 5).
   - Modo oscuro y modo claro con persistencia.

6. **Exportación a MP3 y WAV:**
   - Codificación a MP3 100% en el cliente mediante `@breezystack/lamejs` y generación de WAV PCM 16-bit.
   - Barra de progreso de generación y botón para cancelar el proceso.
   - Descarga directa al navegador sin necesidad de servidores ni créditos.

---

## 🛠️ Arquitectura Técnica

```text
/src
  ├── types.ts                    # Modelos de datos TypeScript
  ├── services/
  │   ├── pdfExtractor.ts         # Extracción de texto con pdfjs-dist y worker
  │   ├── textCleaner.ts          # Normalización y segmentación de texto
  │   ├── webSpeechEngine.ts      # Controlador de SpeechSynthesis del navegador
  │   ├── kokoroWorker.ts         # Web Worker para inferencia ONNX de Kokoro-82M
  │   ├── kokoroService.ts        # Gestor de Web Audio API, caché y buffers
  │   ├── audioExporter.ts        # Codificador MP3 (lamejs) y exportador WAV
  │   └── ocrService.ts           # Reconocimiento óptico OCR con Tesseract.js
  ├── components/
  │   ├── Header.tsx              # Barra superior con navegación y selector de tema
  │   ├── Dropzone.tsx            # Zona de arrastre de PDF y carga de ejemplo
  │   ├── TextReaderView.tsx      # Vista de lectura con oraciones resaltadas
  │   ├── AudioPlayerBar.tsx      # Barra de reproducción inferior con barra de progreso
  │   ├── SettingsModal.tsx       # Modal de configuración de voz y motores
  │   ├── ExportModal.tsx         # Modal de exportación a MP3 / WAV
  │   └── ScannedAlert.tsx        # Alerta y acción para PDFs escaneados
  ├── App.tsx                     # Orquestador principal de estado y vista
  └── main.tsx                    # Punto de entrada React 19
```

---

## 💻 Instalación y Ejecución Local

### Prerrequisitos
- Node.js 18+ o superior.
- npm, pnpm o yarn.

### Pasos
1. Clona o descarga el repositorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd vozpdf
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo en local:
   ```bash
   npm run dev
   ```

4. Abre en tu navegador recomendado:
   ```text
   http://localhost:3000
   ```

---

## 🌐 Compatibilidad de Navegadores

| Navegador | Motor Web Speech | Motor Kokoro-82M | Rendimiento Recomendado |
| :--- | :---: | :---: | :--- |
| **Google Chrome / Edge** | ✅ Completo | ✅ WebGPU + WASM | **Óptimo** (WebGPU acelera la inferencia neuronal a tiempo real). |
| **Brave / Opera** | ✅ Completo | ✅ WebGPU + WASM | **Óptimo** |
| **Mozilla Firefox** | ✅ Soportado | ⚠️ Fallback WASM | Bueno (WebGPU está en fase experimental en Firefox; opera en CPU/WASM). |
| **Apple Safari** | ✅ Soportado | ⚠️ Fallback WASM | Bueno (Web Speech funcional; Kokoro opera en CPU/WASM). |

---

## 📦 Despliegue Estático y Cabeceras COOP/COEP

La aplicación está diseñada para desplegarse como **sitio estático** en cualquier proveedor (Vercel, Cloudflare Pages, Netlify, GitHub Pages, Firebase Hosting o Google Cloud Storage).

### Compilar para producción
```bash
npm run build
```
Los archivos estáticos generados se ubicarán en la carpeta `dist/`.

### Despliegue en Hostinger (Node.js / Express)
Hostinger detecta el proyecto como aplicación Node.js/Express y busca un archivo de entrada `server.js`.
1. **Archivo de entrada:** `server.js` (ya incluido en la raíz del proyecto).
2. **Comando de construcción:** `npm run build`
3. **Comando de inicio:** `npm start` (ejecuta `node server.js`).
4. El servidor Express sirve automáticamente la carpeta `dist/` en el puerto asignado por Hostinger con las cabeceras COOP/COEP configuradas.

### Cabeceras de Aislamiento de Origen Cruzado (Opcional)
Para maximizar el uso de hilos multithreading en WebAssembly o `SharedArrayBuffer` en producción si se utiliza `ffmpeg.wasm`, configura las siguientes cabeceras HTTP en tu servidor o CDN:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

*Ejemplo en `vercel.json`:*
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

*Ejemplo en `netlify.toml`:*
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

*(Nota: En VozPDF, la codificación de MP3 utiliza `@breezystack/lamejs`, por lo que **no** requiere de forma obligatoria COOP/COEP para exportar archivos MP3).*

---

## 🔒 Privacidad y Seguridad
- **Sin telemetría ni servidores remotos:** El texto de tus documentos PDF se analiza y almacena exclusivamente en la memoria RAM y caché local de tu navegador.
- **Sin claves API:** Todo el software es de código abierto y utiliza modelos disponibles públicamente en Hugging Face / onnx-community.

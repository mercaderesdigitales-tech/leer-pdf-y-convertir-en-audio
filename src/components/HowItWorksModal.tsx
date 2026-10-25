import React from 'react';
import { X, HelpCircle, FileText, Sparkles, Volume2, Download, ShieldCheck, Check } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              ¿Cómo funciona VozPDF?
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
          <p className="leading-relaxed text-slate-700 dark:text-slate-200">
            VozPDF transforma cualquier documento PDF en un audiolibro interactivo con texto sincronizado, ejecutándose íntegramente en tu navegador sin requerir servidores, cuentas ni créditos de pago.
          </p>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                1
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                  Subida y extracción de texto
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Arrastra tu archivo PDF. La biblioteca <code>pdfjs-dist</code> procesa el documento página por página de forma local. Si el PDF es un escaneo sin texto seleccionable, puedes activar OCR con Tesseract.js.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                2
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                  Limpieza y segmentación inteligente
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Se corrigen automáticamente las palabras partidas con guión a final de línea, se omiten números de página y encabezados repetidos, y se divide el contenido en oraciones para una navegación fluida.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                3
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                  Dos motores de voz seleccionables
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong>Rápido (Web Speech API):</strong> Utiliza al instante las voces nativas instaladas en tu sistema operativo.<br />
                  <strong>Alta Calidad (Kokoro-82M):</strong> Modelo neuronal ONNX ejecutado en un Web Worker en tu dispositivo (con aceleración WebGPU o WASM) para una entonación natural.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                4
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                  Lectura sincronizada y salto interactivo
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  La frase que se está narrando se resalta en pantalla con desplazamiento automático. Puedes hacer clic en cualquier frase del texto para que la voz salte y comience a leer desde ahí de inmediato.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                5
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">
                  Historial, reanudación y exportación a MP3
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tus documentos recientes se guardan localmente para que puedas reanudar la lectura exactamente donde la dejaste. Con el motor Kokoro, puedes descargar el audiolibro completo en formato MP3 o WAV.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy badge */}
          <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>100% Confidencial:</strong> Ningún documento, texto ni archivo de audio sale de tu ordenador.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

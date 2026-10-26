import React, { useState } from 'react';
import { X, Smartphone, Download, CheckCircle2, Share, PlusSquare, ShieldCheck, Sparkles, ExternalLink, Copy, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, isInAppBrowser, install } = usePWAInstall();
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      onClose();
    }
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleOpenInChrome = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Instalar VozPDF en tu Móvil
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aplicación nativa para Android (APK / WebAPK) e iOS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Iframe / In-App Browser Warning & Direct Launch Button */}
          {(isInIframe || isInAppBrowser) && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ExternalLink className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-bold mb-1">
                    ¿No te deja instalar la APK?
                  </p>
                  <p className="leading-relaxed">
                    Estás visualizando la app dentro de un visor web o red social. Google Chrome solo permite generar e instalar el APK de la aplicación cuando se abre directamente en el navegador.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenInChrome}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en Google Chrome externo</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 text-xs font-medium hover:bg-amber-100/50 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar enlace'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Banner */}
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  ¡VozPDF ya está instalada en tu dispositivo!
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Puedes abrirla directamente desde tu pantalla de inicio o cajón de aplicaciones en modo nativo sin barras de navegador.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                  Instalador oficial WebAPK para Android
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5 leading-relaxed">
                  Android genera automáticamente un paquete APK firmado sin necesidad de activar "Orígenes desconocidos" ni descargar archivos sospechosos de internet.
                </p>
              </div>
            </div>
          )}

          {/* Direct Android / Chromium WebAPK Install Button */}
          {!isInstalled && isInstallable && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Instalar App ahora (Generar APK)</span>
              </button>
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Android integrará el paquete WebAPK en tu cajón de aplicaciones con icono propio.
              </p>
            </div>
          )}

          {/* Guide Section: Android instructions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
              <Smartphone className="w-4 h-4 text-emerald-500" />
              <span>Pasos para instalar en Android (APK / WebAPK)</span>
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside pl-1 leading-relaxed">
              <li>
                Abre esta dirección en tu navegador <strong>Google Chrome</strong> en el móvil.
              </li>
              <li>
                Pulsa el botón de menú de <strong>tres puntos (⋮)</strong> situado en la esquina superior derecha de Chrome.
              </li>
              <li>
                Toca en <strong>"Instalar aplicación"</strong> (o <strong>"Añadir a la pantalla de inicio"</strong>).
              </li>
              <li>
                El servicio de Android descargará el <strong>WebAPK oficial</strong> y creará el acceso de aplicación en tu móvil.
              </li>
            </ol>
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% seguro: Verificado y firmado por el gestor de paquetes de Android.</span>
            </div>
          </div>

          {/* Guide Section: iOS / Safari */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
              <Share className="w-4 h-4 text-blue-500" />
              <span>Instrucciones para iPhone y iPad (iOS Safari)</span>
            </div>
            <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside pl-1 leading-relaxed">
              <li>
                Abre esta página en el navegador <strong>Safari</strong> de iOS.
              </li>
              <li>
                Pulsa el botón de <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en la barra inferior.
              </li>
              <li>
                Baja por las opciones y pulsa en <strong>"Añadir a pantalla de inicio"</strong> (<PlusSquare className="w-3 h-3 inline text-slate-500 mx-0.5" />).
              </li>
              <li>
                Pulsa <strong>"Añadir"</strong> en la esquina superior derecha.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

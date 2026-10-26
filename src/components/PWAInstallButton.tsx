import React, { useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallAppModal } from './InstallAppModal';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'hero' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstalled, isInstallable, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState<boolean>(false);

  // If already running in standalone mode, hide button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    // If browser supports direct install prompt, prompt immediately or show modal with details
    if (isInstallable) {
      const res = await install();
      if (!res) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  if (variant === 'hero') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs shadow-xs transition-all cursor-pointer ${className}`}
          title="Instalar VozPDF como app móvil o de escritorio"
        >
          <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Instalar App móvil / APK</span>
        </button>

        <InstallAppModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ${className}`}
          title="Instalar aplicación en tu móvil"
          aria-label="Instalar App"
        >
          <Smartphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </button>

        <InstallAppModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  // Header default variant
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${className}`}
        title="Instalar VozPDF como aplicación nativa en tu móvil"
      >
        <Smartphone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">App</span>
      </button>

      <InstallAppModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

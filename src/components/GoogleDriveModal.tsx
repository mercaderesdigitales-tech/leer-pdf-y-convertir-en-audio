import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Download, LogOut, RefreshCw, AlertCircle, HardDrive, ExternalLink } from 'lucide-react';
import {
  initGoogleDriveAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  listDrivePDFs,
  downloadDrivePDF,
  DrivePDFItem,
  GoogleDriveUser,
  isRunningInIframe,
} from '../services/googleDriveService';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  onFileSelected,
}) => {
  const [user, setUser] = useState<GoogleDriveUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [files, setFiles] = useState<DrivePDFItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = initGoogleDriveAuth(
      (authUser, authToken) => {
        setUser(authUser);
        setToken(authToken);
        fetchFiles(authToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setFiles([]);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  const fetchFiles = async (currentToken?: string, search?: string) => {
    setIsLoadingFiles(true);
    setAuthError(null);
    try {
      const items = await listDrivePDFs(search);
      setFiles(items);
    } catch (err: any) {
      console.error('Error fetching Drive files:', err);
      setAuthError(err.message || 'Error al obtener archivos de Google Drive');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await signInWithGoogleDrive();
      setUser(result.user);
      setToken(result.accessToken);
      await fetchFiles(result.accessToken);
    } catch (err: any) {
      const isCancelled =
        err.code === 'auth/popup-closed-by-user' ||
        err.message === 'auth/popup-closed-by-user' ||
        err.message?.includes('popup-closed') ||
        err.message?.includes('cancelado');

      if (!isCancelled) {
        setAuthError(
          err.message ||
            'Error al iniciar sesión con Google en Chrome. Asegúrate de permitir ventanas emergentes o abre en ventana nueva.'
        );
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogleDrive();
      setUser(null);
      setToken(null);
      setFiles([]);
    } catch (err: any) {
      console.error('Error signing out:', err);
    }
  };

  const handleSelectFile = async (item: DrivePDFItem) => {
    setSelectedFileId(item.id);
    setDownloadProgress(0);
    setAuthError(null);
    try {
      const file = await downloadDrivePDF(item.id, item.name, (percent) => {
        setDownloadProgress(percent);
      });
      onFileSelected(file);
      onClose();
    } catch (err: any) {
      console.error('Error downloading Drive PDF:', err);
      setAuthError(err.message || 'Error al descargar el PDF desde Google Drive');
      setSelectedFileId(null);
      setDownloadProgress(null);
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '';
    const b = parseInt(bytes, 10);
    if (isNaN(b)) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Importar PDF desde Google Drive
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona cualquier documento almacenado en tu nube
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
        <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-0">
          {/* Error notification if any */}
          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-rose-800 dark:text-rose-300 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{authError}</div>
              </div>
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="self-end sm:self-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Abrir en ventana nueva</span>
              </button>
            </div>
          )}

          {!user || !token ? (
            /* Unauthenticated state: Official Sign in with Google Button */
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center my-auto">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <HardDrive className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Conecta tu cuenta de Google
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
                Autoriza el acceso de lectura a tus archivos PDF para importarlos y convertirlos en audiolibros interactivos sin salir de la app.
              </p>

              {/* Official Google Sign-In button per guidelines */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="inline-flex items-center gap-3 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs text-sm font-medium text-slate-700 dark:text-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isAuthenticating ? 'Conectando...' : 'Iniciar sesión con Google'}</span>
              </button>

              {isRunningInIframe() && (
                <div className="mt-6 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col items-center gap-2 text-center max-w-md">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    <strong>¿Estás en un móvil o visor integrado?</strong> Los navegadores bloquean ventanas de Google dentro de iframes. Si no abre el login, usa el botón directo:
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en navegador completo</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Authenticated state: User header + Search input + PDF File list */
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              {/* Account summary bar */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                      {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchFiles(token, searchQuery)}
                    disabled={isLoadingFiles}
                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Actualizar lista de archivos"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Cerrar sesión de Google Drive"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                </div>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar archivos PDF en tu Google Drive..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      fetchFiles(token, searchQuery);
                    }
                  }}
                  className="w-full pl-9 pr-20 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => fetchFiles(token, searchQuery)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                >
                  Buscar
                </button>
              </div>

              {/* Files list */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-[220px]">
                {isLoadingFiles ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2" />
                    <span className="text-xs">Buscando documentos PDF en Drive...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      No se encontraron documentos PDF
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Prueba con otro término de búsqueda'
                        : 'Sube un archivo PDF a tu Google Drive para verlo aquí'}
                    </p>
                  </div>
                ) : (
                  files.map((file) => {
                    const isDownloadingThis = selectedFileId === file.id;

                    return (
                      <div
                        key={file.id}
                        onClick={() => !selectedFileId && handleSelectFile(file)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isDownloadingThis
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                            : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={file.name}>
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                              {file.size && <span>{formatFileSize(file.size)}</span>}
                              {file.size && file.modifiedTime && <span>·</span>}
                              {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isDownloadingThis ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium">
                              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              <span>{downloadProgress !== null ? `${downloadProgress}%` : 'Cargando...'}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Importar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-400">
            Conexión segura mediante Google Workspace Drive API
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

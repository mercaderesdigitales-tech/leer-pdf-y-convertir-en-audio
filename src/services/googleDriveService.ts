import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Required Drive read-only scope for PDF selection and download
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({ prompt: 'select_account' });

export interface GoogleDriveUser {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface DrivePDFItem {
  id: string;
  name: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

// In-memory token cache (DO NOT store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let cachedUserInfo: GoogleDriveUser | null = null;
let isSigningIn = false;

/**
 * Check if the app is currently running inside an iframe or preview frame
 */
export const isRunningInIframe = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
};

/**
 * Listen for auth state changes and manage cached token in memory.
 */
export const initGoogleDriveAuth = (
  onAuthSuccess?: (user: GoogleDriveUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(
        {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        },
        cachedAccessToken
      );
    } else if (cachedAccessToken && cachedUserInfo) {
      onAuthSuccess?.(cachedUserInfo, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      cachedUserInfo = null;
      onAuthFailure?.();
    }
  });
};

/**
 * Ensure Google Identity Services (GIS) client script is ready
 */
export const ensureGisLoaded = (): Promise<any> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const google = (window as any).google;
    if (google?.accounts?.oauth2) {
      return resolve(google);
    }

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).google));
      // Fallback timeout in case load event already fired
      setTimeout(() => resolve((window as any).google || null), 1500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
};

/**
 * Sign in using Google Identity Services (GIS) Token Client
 */
export const signInWithGIS = async (): Promise<{ user: GoogleDriveUser; accessToken: string }> => {
  const google = await ensureGisLoaded();
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services no está listo. Abre la app en una ventana nueva de Chrome.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope:
          'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            if (tokenResponse.error === 'popup_closed' || tokenResponse.error === 'access_denied') {
              return reject(new Error('auth/popup-closed-by-user'));
            }
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }
          if (!tokenResponse.access_token) {
            return reject(new Error('No se recibió token de acceso de Google'));
          }

          const token = tokenResponse.access_token;
          cachedAccessToken = token;

          // Fetch basic profile info
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (userRes.ok) {
              const profile = await userRes.json();
              cachedUserInfo = {
                displayName: profile.name || profile.given_name,
                email: profile.email,
                photoURL: profile.picture,
              };
            }
          } catch {
            cachedUserInfo = { displayName: 'Usuario de Google', email: '' };
          }

          resolve({
            user: cachedUserInfo || { displayName: 'Usuario de Google', email: '' },
            accessToken: token,
          });
        },
        error_callback: (err: any) => {
          console.warn('GIS error_callback received:', err);
          if (err.type === 'popup_closed') {
            reject(new Error('auth/popup-closed-by-user'));
          } else if (err.type === 'popup_failed_to_open') {
            reject(
              new Error(
                'Chrome bloqueó la ventana emergente de autenticación. Permite las ventanas emergentes en Chrome para este sitio.'
              )
            );
          } else {
            reject(new Error(err.message || 'Error en el servicio de inicio de sesión de Google'));
          }
        },
      });

      // Pass prompt parameter directly to requestAccessToken, not initTokenClient
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      reject(err);
    }
  });
};

/**
 * Sign in with Google using popup and request Drive readonly scope
 */
export const signInWithGoogleDrive = async (): Promise<{ user: GoogleDriveUser; accessToken: string }> => {
  try {
    isSigningIn = true;

    // Check if in iframe: if in iframe, GIS is often much more reliable than Firebase Auth iframe handler in Chrome
    const inIframe = isRunningInIframe();

    if (inIframe) {
      try {
        return await signInWithGIS();
      } catch (gisError: any) {
        if (gisError.message === 'auth/popup-closed-by-user') {
          throw gisError;
        }
        console.warn('GIS in iframe failed, trying Firebase popup fallback...', gisError);
      }
    }

    // Try Firebase signInWithPopup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('No se pudo obtener el token de acceso de Google Drive');
      }

      cachedAccessToken = credential.accessToken;
      const authedUser: GoogleDriveUser = {
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
      };
      cachedUserInfo = authedUser;

      return {
        user: authedUser,
        accessToken: cachedAccessToken,
      };
    } catch (fbError: any) {
      console.warn('Firebase signInWithPopup failed, attempting Google Identity Services fallback...', fbError);

      // If user cancelled, don't fall back, rethrow
      if (fbError.code === 'auth/popup-closed-by-user') {
        throw fbError;
      }

      // Check if Google Identity Services is available or can be loaded
      try {
        return await signInWithGIS();
      } catch (gisFallbackError: any) {
        if (gisFallbackError.message === 'auth/popup-closed-by-user') {
          throw gisFallbackError;
        }

        // If both failed, clarify error for Google Chrome
        if (fbError.code === 'auth/popup-blocked') {
          throw new Error(
            'La ventana emergente fue bloqueada por Google Chrome. Por favor permite las ventanas emergentes en los ajustes de Chrome para este sitio.'
          );
        } else if (fbError.code === 'auth/unauthorized-domain') {
          throw new Error(
            'Chrome bloqueó la autorización por políticas de dominio y cookies. Abre la app en una pestaña nueva para iniciar sesión con Drive.'
          );
        }

        throw gisFallbackError || fbError;
      }
    }
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve cached in-memory access token
 */
export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Sign out and clear in-memory credentials
 */
export const signOutGoogleDrive = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch {
    // ignore
  }
  cachedAccessToken = null;
  cachedUserInfo = null;
};

/**
 * Search and list PDF files from the authenticated user's Google Drive
 */
export const listDrivePDFs = async (searchTerm?: string): Promise<DrivePDFItem[]> => {
  if (!cachedAccessToken) {
    throw new Error('Usuario no autenticado en Google Drive');
  }

  let query = "mimeType = 'application/pdf' and trashed = false";
  if (searchTerm && searchTerm.trim()) {
    const escaped = searchTerm.replace(/'/g, "\\'");
    query += ` and name contains '${escaped}'`;
  }

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id, name, size, modifiedTime, thumbnailLink, iconLink)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Error al consultar Google Drive (${response.status})`);
  }

  const data = await response.json();
  return (data.files || []) as DrivePDFItem[];
};

/**
 * Download a PDF file from Google Drive as a File object ready for VozPDF processing
 */
export const downloadDrivePDF = async (
  fileId: string,
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<File> => {
  if (!cachedAccessToken) {
    throw new Error('Token no disponible');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error al descargar PDF de Google Drive (${response.status})`);
  }

  // Handle stream reader if content-length is present for progress
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (total > 0 && response.body && onProgress) {
    const reader = response.body.getReader();
    let loaded = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        onProgress(Math.min(99, Math.round((loaded / total) * 100)));
      }
    }

    const blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' });
    onProgress(100);
    return new File([blob], fileName, { type: 'application/pdf' });
  }

  const blob = await response.blob();
  onProgress?.(100);
  return new File([blob], fileName, { type: 'application/pdf' });
};

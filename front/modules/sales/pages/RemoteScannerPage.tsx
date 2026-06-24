/**
 * RemoteScannerPage — abre no telemóvel para scan remoto
 * URL: /scanner-remoto?session=XXXXX
 *
 * Modos de scan:
 * 1. BarcodeDetector + vídeo contínuo → Chrome Android, Safari 17+ iOS
 * 2. Captura de foto + BarcodeDetector/jsQR → iOS antigo, Desktop Chrome, Firefox
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 Camera, CheckCircle2, AlertTriangle, WifiOff,
 ScanLine, RefreshCw, X, Wifi, Upload, Loader2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3060/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────
declare class BarcodeDetector {
 constructor(options?: { formats?: string[] });
 detect(src: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
 static getSupportedFormats?(): Promise<string[]>;
}

type ScanStatus = 'idle' | 'starting' | 'scanning' | 'sending' | 'ok' | 'notFound' | 'error' | 'expired';
type ScanMode = 'unknown' | 'video' | 'photo';

// ── Helpers ────────────────────────────────────────────────────────────────────
function playScanBeep(type: 'ok' | 'error' = 'ok') {
 try {
 const Ctx = window.AudioContext || (window as any).webkitAudioContext;
 if (!Ctx) return;
 const ctx = new Ctx();
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.connect(gain); gain.connect(ctx.destination);
 if (type === 'ok') {
 osc.type = 'sine';
 osc.frequency.setValueAtTime(1850, ctx.currentTime);
 gain.gain.setValueAtTime(0.4, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
 osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
 } else {
 osc.type = 'square';
 osc.frequency.setValueAtTime(500, ctx.currentTime);
 gain.gain.setValueAtTime(0.2, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
 osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
 }
 osc.onended = () => ctx.close();
 } catch {}
}

// ZXing — suporta EAN-13, QR, Code128, etc. (fallback para iOS < 17 e Firefox)
let _zxing: any = null;
async function getZXing() {
 if (_zxing) return _zxing;
 const lib = await import('@zxing/library');
 const hints = new Map();
 hints.set(lib.DecodeHintType.POSSIBLE_FORMATS, [
 lib.BarcodeFormat.EAN_13, lib.BarcodeFormat.EAN_8,
 lib.BarcodeFormat.CODE_128, lib.BarcodeFormat.CODE_39,
 lib.BarcodeFormat.QR_CODE, lib.BarcodeFormat.UPC_A, lib.BarcodeFormat.UPC_E,
 lib.BarcodeFormat.DATA_MATRIX, lib.BarcodeFormat.PDF_417,
 ]);
 hints.set(lib.DecodeHintType.TRY_HARDER, true);
 const reader = new lib.MultiFormatReader();
 reader.setHints(hints);
 _zxing = { reader, lib };
 return _zxing;
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a', 'upc_e', 'data_matrix', 'pdf417'];

// Fallback progressivo de constraints — iOS rejeita constraints muito específicas
async function openCamera(): Promise<MediaStream> {
 const tries: MediaStreamConstraints[] = [
 { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
 { video: { facingMode: 'environment' } },
 { video: { facingMode: 'user' } },
 { video: true },
 ];
 for (const c of tries) {
 try { return await navigator.mediaDevices.getUserMedia(c); }
 catch (e: any) {
 if (e?.name === 'NotAllowedError' || e?.name === 'NotFoundError') throw e;
 }
 }
 throw new Error('Câmera não acessível');
}

// Aguarda frames reais com timeout de 8 s
function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
 return new Promise((resolve, reject) => {
 const t = setTimeout(() => reject(new Error('Camera timeout')), 8000);
 const done = () => { clearTimeout(t); resolve(); };
 if (video.readyState >= 2 && video.videoWidth > 0) { done(); return; }
 const check = () => {
 if (video.readyState >= 2 && video.videoWidth > 0) { done(); return; }
 requestAnimationFrame(check);
 };
 video.onloadeddata = check;
 video.oncanplay = check;
 requestAnimationFrame(check);
 });
}

// ── Componente ────────────────────────────────────────────────────────────────
export const RemoteScannerPage: React.FC = () => {
 const sessionId = new URLSearchParams(window.location.search).get('session') || '';

 const videoRef = useRef<HTMLVideoElement>(null);
 const streamRef = useRef<MediaStream | null>(null);
 const rafRef = useRef<number>(0);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const lastCodeRef = useRef('');
 const lastTimeRef = useRef(0);
 const loopActiveRef = useRef(false);

 const [status, setStatus] = useState<ScanStatus>('idle');
 const [scanMode, setScanMode] = useState<ScanMode>('unknown');
 const [lastCode, setLastCode] = useState('');
 const [totalScanned, setTotalScanned] = useState(0);
 const [errorMsg, setErrorMsg] = useState('');
 const [photoPreview, setPhotoPreview] = useState<string | null>(null);

 // ── Enviar código ao servidor ──────────────────────────────────────────────
 const sendCode = useCallback(async (code: string) => {
 if (!code) return;
 setStatus('sending');
 try {
 const res = await fetch(`${API_BASE}/pos/scan-relay/${sessionId}`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ code })
 });
 if (res.status === 404) {
 playScanBeep('error');
 setStatus('expired');
 stopVideo();
 return;
 }
 playScanBeep('ok');
 setLastCode(code);
 setTotalScanned(n => n + 1);
 setStatus('ok');
 setTimeout(() => {
 setPhotoPreview(null);
 // No modo vídeo o loop continua sozinho; no modo foto volta a idle
 setStatus(scanMode === 'photo' ? 'idle' : 'scanning');
 }, 1200);
 } catch {
 playScanBeep('error');
 setStatus('error');
 setTimeout(() => setStatus(scanMode === 'photo' ? 'idle' : 'scanning'), 1500);
 }
 }, [sessionId, scanMode]);

 // ── Parar câmera ──────────────────────────────────────────────────────────
 const stopVideo = () => {
 loopActiveRef.current = false;
 cancelAnimationFrame(rafRef.current);
 streamRef.current?.getTracks().forEach(t => t.stop());
 streamRef.current = null;
 };

 // ── Modo 1: vídeo contínuo + BarcodeDetector ──────────────────────────────
 const startVideoScanner = useCallback(async () => {
 setScanMode('video');
 setStatus('starting');
 loopActiveRef.current = false;
 try {
 streamRef.current?.getTracks().forEach(t => t.stop());
 const stream = await openCamera();
 streamRef.current = stream;
 const video = videoRef.current!;
 video.srcObject = stream;
 video.setAttribute('playsinline', 'true');
 video.setAttribute('webkit-playsinline', 'true');
 video.muted = true;

 // iOS pode não iniciar o vídeo fora de gesto do utilizador — não bloquear aqui
 video.play().catch(() => {});

 setStatus('scanning');
 loopActiveRef.current = true;

 const hasNative = 'BarcodeDetector' in window;

 if (hasNative) {
 // ── Modo A: BarcodeDetector nativo (Chrome Android, Safari 17+ iOS) ──
 // Safari ignora detect() em <video> diretamente — snapshot para canvas primeiro
 const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
 const snapCanvas = document.createElement('canvas');
 const snapCtx = snapCanvas.getContext('2d')!;
 const scan = async () => {
 if (!loopActiveRef.current || !video) return;
 try {
 if (video.readyState >= 2 && video.videoWidth > 0) {
 if (snapCanvas.width !== video.videoWidth) snapCanvas.width = video.videoWidth;
 if (snapCanvas.height !== video.videoHeight) snapCanvas.height = video.videoHeight;
 snapCtx.drawImage(video, 0, 0);
 const barcodes = await detector.detect(snapCanvas);
 if (barcodes.length > 0) {
 const code = barcodes[0].rawValue.trim();
 const now = Date.now();
 if (code && (code !== lastCodeRef.current || now - lastTimeRef.current > 2000)) {
 lastCodeRef.current = code;
 lastTimeRef.current = now;
 sendCode(code);
 }
 }
 }
 } catch {}
 rafRef.current = requestAnimationFrame(scan);
 };
 rafRef.current = requestAnimationFrame(scan);
 } else {
 // ── Modo B: ZXing (EAN-13, QR, Code128, etc.) — iOS < 17, Firefox
 try {
 const { reader, lib } = await getZXing();
 const canvas = document.createElement('canvas');
 const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
 const scan = () => {
 if (!loopActiveRef.current || !video) return;
 if (video.readyState >= 2 && video.videoWidth > 0) {
 if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
 if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
 ctx.drawImage(video, 0, 0);
 try {
 const lum = new lib.HTMLCanvasElementLuminanceSource(canvas);
 const bmp = new lib.BinaryBitmap(new lib.HybridBinarizer(lum));
 const result = reader.decode(bmp);
 const code = result.getText().trim();
 const now = Date.now();
 if (code && (code !== lastCodeRef.current || now - lastTimeRef.current > 2000)) {
 lastCodeRef.current = code;
 lastTimeRef.current = now;
 sendCode(code);
 }
 } catch { /* NotFoundException = sem código no frame */ }
 }
 rafRef.current = requestAnimationFrame(scan);
 };
 rafRef.current = requestAnimationFrame(scan);
 } catch {
 // ZXing falhou — modo foto como último recurso
 setStatus('idle');
 setScanMode('photo');
 }
 }
 } catch (e: any) {
 loopActiveRef.current = false;
 const name = e?.name || '';
 const msg = name === 'NotAllowedError'
 ? 'Permissão negada. Vai a Definições → Safari/Chrome → Câmera e permite o acesso.'
 : name === 'NotFoundError'
 ? 'Nenhuma câmera encontrada.'
 : name === 'NotReadableError'
 ? 'Câmera em uso por outra app. Fecha outras apps e tenta novamente.'
 : 'Câmera indisponível. Verifica as permissões e tenta novamente.';
 setErrorMsg(msg);
 setStatus('error');
 }
 }, [sendCode]);

 // ── Modo 2: captura de foto (iOS / sem BarcodeDetector) ───────────────────
 const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 // Limpar o input para permitir re-scan do mesmo código
 if (fileInputRef.current) fileInputRef.current.value = '';

 setStatus('sending');
 const objectUrl = URL.createObjectURL(file);
 setPhotoPreview(objectUrl);

 try {
 // Carregar imagem
 const img = new Image();
 await new Promise<void>((res, rej) => {
 img.onload = () => res();
 img.onerror = rej;
 img.src = objectUrl;
 });

 // Desenhar em canvas
 const canvas = document.createElement('canvas');
 canvas.width = img.naturalWidth;
 canvas.height = img.naturalHeight;
 const ctx = canvas.getContext('2d')!;
 ctx.drawImage(img, 0, 0);

 // 1º: BarcodeDetector no canvas (iOS 16.4+, algumas versões Desktop)
 if ('BarcodeDetector' in window) {
 try {
 const detector = new BarcodeDetector({ formats: BARCODE_FORMATS });
 const codes = await detector.detect(canvas);
 if (codes.length > 0) {
 URL.revokeObjectURL(objectUrl);
 await sendCode(codes[0].rawValue.trim());
 return;
 }
 } catch {}
 }

 // 2º: ZXing (EAN-13, QR, Code128, etc.)
 try {
 const { reader, lib } = await getZXing();
 const lum = new lib.HTMLCanvasElementLuminanceSource(canvas);
 const bmp = new lib.BinaryBitmap(new lib.HybridBinarizer(lum));
 const result = reader.decode(bmp);
 if (result?.getText()) {
 URL.revokeObjectURL(objectUrl);
 await sendCode(result.getText().trim());
 return;
 }
 } catch {}

 // Não encontrou nenhum código
 playScanBeep('error');
 setStatus('notFound');
 setTimeout(() => { setPhotoPreview(null); setStatus('idle'); }, 2500);
 } catch {
 playScanBeep('error');
 setStatus('error');
 setTimeout(() => { setPhotoPreview(null); setStatus('idle'); }, 2000);
 }
 }, [sendCode]);

 // ── Inicialização ─────────────────────────────────────────────────────────
 useEffect(() => {
 if (!sessionId) { setStatus('expired'); return; }

 // startVideoScanner trata ambos os casos: BarcodeDetector nativo E fallback jsQR
 startVideoScanner();
 return () => stopVideo();
 }, []);

 // ── Reiniciar scanner ──────────────────────────────────────────────────────
 const handleRestart = () => {
 stopVideo();
 setErrorMsg('');
 setPhotoPreview(null);
 startVideoScanner(); // handles BarcodeDetector, jsQR fallback, and photo mode fallback
 };

 // ── Ecrãs especiais ────────────────────────────────────────────────────────
 if (status === 'expired') {
 return (
 <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
 <div className="text-center text-white max-w-xs">
 <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
 <h2 className="text-xl font-bold mb-2">Sessão Expirada</h2>
 <p className="text-content-muted text-sm">Gera um novo código de scanner no POS do computador e usa o novo link.</p>
 </div>
 </div>
 );
 }

 // ── Modo foto (iOS / sem BarcodeDetector nativo) ───────────────────────────
 if (scanMode === 'photo') {
 return (
 <div className="min-h-screen bg-gray-950 flex flex-col text-white">
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 bg-black/80">
 <div className="flex items-center gap-2">
 <Camera className="w-5 h-5 text-brand-400" />
 <span className="font-semibold text-sm">Scanner Remoto</span>
 </div>
 <div className="flex items-center gap-1.5">
 <Wifi className="w-4 h-4 text-green-400" />
 <span className="text-green-400 text-xs font-medium">{totalScanned} scan{totalScanned !== 1 ? 's' : ''}</span>
 </div>
 </div>

 {/* Área principal */}
 <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
 {/* Preview da foto */}
 {photoPreview && (
 <div className="relative w-full max-w-xs rounded-xl overflow-hidden border-2 border-brand-400">
 <img src={photoPreview} alt="Captura" className="w-full h-48 object-cover" />
 {status === 'sending' && (
 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
 <Loader2 className="w-8 h-8 text-white animate-spin" />
 </div>
 )}
 {status === 'ok' && (
 <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
 <CheckCircle2 className="w-12 h-12 text-white" />
 </div>
 )}
 {status === 'notFound' && (
 <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
 <X className="w-12 h-12 text-white" />
 </div>
 )}
 </div>
 )}

 {/* Estado feedback */}
 {status === 'ok' && (
 <div className="text-center">
 <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
 <p className="text-green-400 font-bold">Enviado para o POS!</p>
 <p className="text-content-muted text-xs font-mono mt-1">{lastCode}</p>
 </div>
 )}
 {status === 'notFound' && (
 <div className="text-center">
 <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
 <p className="text-yellow-400 font-medium">Código não detectado</p>
 <p className="text-content-muted text-xs mt-1">Tenta novamente com melhor iluminação</p>
 </div>
 )}
 {status === 'error' && !photoPreview && (
 <div className="text-center">
 <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
 <p className="text-red-400 font-medium">Erro de ligação</p>
 </div>
 )}
 {!photoPreview && status === 'idle' && (
 <div className="text-center">
 <div className="w-24 h-24 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 mx-auto border-2 border-dashed border-gray-600">
 <ScanLine className="w-10 h-10 text-content-muted" />
 </div>
 <p className="text-content-muted text-sm">Aponta a câmera ao código de barras ou QR</p>
 </div>
 )}

 {/* Botão de scan */}
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 capture="environment"
 onChange={handlePhotoCapture}
 className="hidden"
 />
 {(status === 'idle' || status === 'ok' || status === 'notFound' || status === 'error') && (
 <button
 onClick={() => { setPhotoPreview(null); setStatus('idle'); fileInputRef.current?.click(); }}
 className="flex items-center gap-3 px-8 py-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold text-lg rounded-2xl transition-colors shadow-xl w-full max-w-xs justify-center"
 >
 <Camera className="w-6 h-6" />
 {status === 'ok' ? 'Scan Seguinte' : 'Scan Código'}
 </button>
 )}
 {status === 'sending' && !photoPreview && (
 <button disabled className="flex items-center gap-3 px-8 py-4 bg-gray-600 text-white font-bold text-lg rounded-2xl w-full max-w-xs justify-center opacity-60">
 <Loader2 className="w-6 h-6 animate-spin" />
 A enviar...
 </button>
 )}
 </div>

 {/* Footer */}
 <div className="bg-black/80 px-4 py-4 text-center shrink-0">
 {lastCode && <p className="text-green-400 text-xs font-mono mb-1">Último: {lastCode}</p>}
 <p className="text-content-muted text-xs">Tira uma foto clara do código • Suporta QR, EAN, Code128</p>
 </div>
 </div>
 );
 }

 // ── Modo vídeo (Chrome Android + Safari 17+ iOS) ───────────────────────────
 return (
 <div className="min-h-screen bg-gray-950 flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0">
 <div className="flex items-center gap-2 text-white">
 <Camera className="w-5 h-5 text-brand-400" />
 <span className="font-semibold text-sm">Scanner Remoto</span>
 </div>
 <div className="flex items-center gap-2">
 {status === 'scanning' && <Wifi className="w-4 h-4 text-green-400" />}
 <span className="text-green-400 text-xs font-medium">{totalScanned} scan{totalScanned !== 1 ? 's' : ''}</span>
 </div>
 </div>

 {/* Camera / Error */}
 <div className="flex-1 relative overflow-hidden bg-black">
 {/* Vídeo sempre montado no DOM — videoRef nunca fica null durante startVideoScanner */}
 <video
 ref={videoRef}
 className="absolute inset-0 w-full h-full object-cover"
 playsInline
 muted
 autoPlay
 />

 {/* Overlay: a iniciar câmera */}
 {status === 'starting' && (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white bg-black">
 <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
 <p className="text-sm text-content-muted">A iniciar câmera...</p>
 </div>
 )}

 {/* Overlay: erro de câmera */}
 {(status === 'error' || !!errorMsg) && (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center bg-black">
 <AlertTriangle className="w-14 h-14 text-red-400" />
 <p className="text-white/80 text-sm leading-relaxed">{errorMsg || 'Erro ao aceder à câmera.'}</p>
 <button
 onClick={handleRestart}
 className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-colors"
 >
 <RefreshCw className="w-4 h-4" />
 Tentar novamente
 </button>
 <button
 onClick={() => { stopVideo(); setScanMode('photo'); setStatus('idle'); setErrorMsg(''); }}
 className="flex items-center gap-2 px-6 py-2.5 border border-gray-600 text-content-muted rounded-xl text-sm transition-colors"
 >
 <Upload className="w-4 h-4" />
 Usar captura de foto
 </button>
 </div>
 )}

 {/* Mira + status overlays (apenas quando câmera ativa) */}
 {status !== 'starting' && status !== 'error' && !errorMsg && (
 <>

 {/* Mira de scan */}
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 <div className="relative w-72 h-44">
 {/* Cantos */}
 {[
 'top-0 left-0 border-t border-l rounded-tl',
 'top-0 right-0 border-t border-r rounded-tr',
 'bottom-0 left-0 border-b border-l rounded-bl',
 'bottom-0 right-0 border-b border-r rounded-br'
 ].map((cls, i) => (
 <span key={i} className={`absolute w-7 h-7 ${cls} border-brand-400`} style={{ borderWidth: 3 }} />
 ))}
 {/* Linha de scan */}
 {status === 'scanning' && (
 <div className="absolute inset-x-2 h-0.5 bg-brand-400/80"
 style={{ top: '50%', animation: 'scanline 2s ease-in-out infinite alternate' }} />
 )}
 </div>
 </div>

 {/* Overlays de estado */}
 {status === 'ok' && (
 <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center pointer-events-none">
 <div className="bg-green-600 rounded-2xl px-7 py-5 text-center shadow-2xl">
 <CheckCircle2 className="w-10 h-10 text-white mx-auto mb-2" />
 <p className="text-white font-bold text-base">Enviado!</p>
 <p className="text-green-200 text-xs mt-0.5 font-mono">{lastCode}</p>
 </div>
 </div>
 )}
 {status === 'sending' && (
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 <div className="bg-black/70 rounded-2xl px-6 py-3 flex items-center gap-2">
 <Loader2 className="w-5 h-5 text-white animate-spin" />
 <p className="text-white text-sm">A enviar...</p>
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Footer */}
 <div className="bg-black/80 px-4 py-4 text-center shrink-0">
 <p className="text-white/60 text-sm">Aponta a câmera ao código de barras</p>
 <p className="text-white/30 text-xs mt-0.5">EAN-8 · EAN-13 · QR Code · Code 128 · UPC</p>
 {lastCode && <p className="text-green-400 text-xs mt-1.5 font-mono">Último: {lastCode}</p>}
 </div>

 {/* CSS para animação da linha de scan */}
 <style>{`
 @keyframes scanline {
 from { transform: translateY(-40px); opacity: 0.6; }
 to { transform: translateY(40px); opacity: 1; }
 }
 `}</style>
 </div>
 );
};

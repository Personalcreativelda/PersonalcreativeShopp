import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ScanLine, Keyboard, Loader2, AlertCircle } from 'lucide-react';

interface Props {
 onScan: (code: string) => void;
 onClose: () => void;
}

declare class BarcodeDetector {
 constructor(options?: { formats?: string[] });
 detect(src: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{ rawValue: string }>>;
}

const FORMATS = ['ean_13', 'ean_8', 'qr_code', 'code_128', 'code_39', 'upc_a', 'upc_e'];

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
 // OverconstrainedError, AbortError, etc → tentar próxima constraint
 }
 }
 throw new Error('Nenhuma câmera acessível');
}

// Aguarda frames reais com timeout de 8 s
function waitForVideoReady(v: HTMLVideoElement): Promise<void> {
 return new Promise((resolve, reject) => {
 const timeout = setTimeout(() => reject(new Error('Camera timeout')), 8000);
 const done = () => { clearTimeout(timeout); resolve(); };
 if (v.readyState >= 2 && v.videoWidth > 0) { done(); return; }
 const check = () => {
 if (v.readyState >= 2 && v.videoWidth > 0) { done(); return; }
 requestAnimationFrame(check);
 };
 v.onloadeddata = check;
 v.oncanplay = check;
 requestAnimationFrame(check);
 });
}

function playScanBeep() {
 try {
 const Ctx = window.AudioContext || (window as any).webkitAudioContext;
 if (!Ctx) return;
 const ctx = new Ctx();
 const osc = ctx.createOscillator();
 const gain = ctx.createGain();
 osc.connect(gain); gain.connect(ctx.destination);
 osc.type = 'sine';
 osc.frequency.setValueAtTime(1850, ctx.currentTime);
 gain.gain.setValueAtTime(0.4, ctx.currentTime);
 gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
 osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
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

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
 const videoRef = useRef<HTMLVideoElement>(null);
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const streamRef = useRef<MediaStream | null>(null);
 const rafRef = useRef<number>(0);
 const activeRef = useRef(false);
 const textInputRef = useRef<HTMLInputElement>(null);

 const [status, setStatus] = useState<'starting' | 'scanning' | 'error' | 'manual'>('starting');
 const [errorMsg, setErrorMsg] = useState('');
 const [textVal, setTextVal] = useState('');
 const [showManual, setShowManual] = useState(false);

 const stopAll = () => {
 activeRef.current = false;
 cancelAnimationFrame(rafRef.current);
 streamRef.current?.getTracks().forEach(t => t.stop());
 streamRef.current = null;
 };

 const handleFound = useCallback((code: string) => {
 if (!code.trim()) return;
 playScanBeep();
 stopAll();
 onScan(code.trim());
 }, [onScan]);

 // ── Iniciar câmera ────────────────────────────────────────────────────────
 const startCamera = useCallback(async () => {
 setStatus('starting');
 setErrorMsg('');
 activeRef.current = false;
 cancelAnimationFrame(rafRef.current);

 try {
 // Fechar stream anterior se existir
 streamRef.current?.getTracks().forEach(t => t.stop());

 // openCamera() tenta várias constraints até conseguir acesso
 const stream = await openCamera();
 streamRef.current = stream;

 const video = videoRef.current!;
 video.srcObject = stream;
 video.setAttribute('playsinline', 'true');
 video.setAttribute('webkit-playsinline', 'true');
 video.muted = true;

 // iOS bloqueia autoplay fora de gesto — não bloquear a thread aqui
 video.play().catch(() => {});

 setStatus('scanning');
 activeRef.current = true;

 const hasNative = 'BarcodeDetector' in window;

 if (hasNative) {
 // ── Modo A: BarcodeDetector nativo (Chrome Android, Safari 17+) ──────
 // Safari ignora detect() em <video> diretamente — snapshot para canvas primeiro
 const detector = new BarcodeDetector({ formats: FORMATS });
 const lastSeen = { code: '', time: 0 };
 const snap = canvasRef.current!;
 const snapCtx = snap.getContext('2d', { willReadFrequently: true })!;

 const scanNative = async () => {
 if (!activeRef.current || !video) return;
 try {
 if (video.readyState >= 2 && video.videoWidth > 0) {
 if (snap.width !== video.videoWidth) snap.width = video.videoWidth;
 if (snap.height !== video.videoHeight) snap.height = video.videoHeight;
 snapCtx.drawImage(video, 0, 0);
 const results = await detector.detect(snap);
 if (results.length > 0) {
 const code = results[0].rawValue.trim();
 const now = Date.now();
 if (code && (code !== lastSeen.code || now - lastSeen.time > 2000)) {
 lastSeen.code = code;
 lastSeen.time = now;
 handleFound(code);
 return;
 }
 }
 }
 } catch {}
 rafRef.current = requestAnimationFrame(scanNative);
 };
 rafRef.current = requestAnimationFrame(scanNative);

 } else {
 // ── Modo B: ZXing (EAN-13, QR, Code128, etc.) — iOS < 17, Firefox
 const canvas = canvasRef.current!;
 const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
 const lastSeen = { code: '', time: 0 };

 try {
 const { reader, lib } = await getZXing();

 const scanZXing = () => {
 if (!activeRef.current || !video) return;
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
 if (code && (code !== lastSeen.code || now - lastSeen.time > 2000)) {
 lastSeen.code = code;
 lastSeen.time = now;
 handleFound(code);
 return;
 }
 } catch { /* NotFoundException = sem código no frame */ }
 }
 rafRef.current = requestAnimationFrame(scanZXing);
 };
 rafRef.current = requestAnimationFrame(scanZXing);
 } catch {
 // ZXing falhou a carregar (improvável) → mostrar input manual
 setShowManual(true);
 }
 }

 } catch (e: any) {
 activeRef.current = false;
 const name = e?.name || '';
 const msg = name === 'NotAllowedError'
 ? 'Permissão negada. Vai a Definições → Safari/Chrome → Câmera e permite o acesso.'
 : name === 'NotFoundError'
 ? 'Nenhuma câmera encontrada neste dispositivo.'
 : name === 'NotReadableError'
 ? 'Câmera em uso por outra app. Fecha outras apps e tenta novamente.'
 : 'Não foi possível iniciar câmera. Tenta novamente ou usa o campo de texto.';
 setErrorMsg(msg);
 setStatus('error');
 }
 }, [handleFound]);

 useEffect(() => {
 startCamera();
 return stopAll;
 }, []);

 // Focus no input manual
 useEffect(() => {
 if (showManual) setTimeout(() => textInputRef.current?.focus(), 150);
 }, [showManual]);

 const submitText = (e?: React.FormEvent) => {
 e?.preventDefault();
 if (textVal.trim()) handleFound(textVal.trim());
 };

 return (
 <div className="fixed inset-0 bg-black z-[70] flex flex-col">

 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 bg-black/80 shrink-0 z-10">
 <div className="flex items-center gap-2 text-white">
 <ScanLine className="w-5 h-5 text-brand-400" />
 <span className="font-medium text-sm">Escanear Código de Barras</span>
 </div>
 <button onClick={() => { stopAll(); onClose(); }}
 className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-surface-raised/10 transition-colors">
 <X className="w-6 h-6" />
 </button>
 </div>

 {/* Área de câmera */}
 <div className="flex-1 relative overflow-hidden bg-black">

 {/* Vídeo — sempre presente para manter o feed */}
 <video
 ref={videoRef}
 className="absolute inset-0 w-full h-full object-cover"
 playsInline
 muted
 autoPlay
 />
 {/* Canvas oculto para modo jsQR */}
 <canvas ref={canvasRef} className="hidden" />

 {/* Estado: a iniciar */}
 {status === 'starting' && (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
 <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
 <p className="text-white/70 text-sm">A iniciar câmera...</p>
 </div>
 )}

 {/* Estado: erro de câmera */}
 {status === 'error' && (
 <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-black">
 <AlertCircle className="w-12 h-12 text-red-400" />
 <p className="text-white/80 text-sm leading-relaxed">{errorMsg}</p>
 <button onClick={startCamera}
 className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-colors">
 Tentar novamente
 </button>
 </div>
 )}

 {/* Mira de scan — visível quando a câmera está a funcionar */}
 {status === 'scanning' && (
 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
 {/* Fundo escuro nas bordas */}
 <div className="absolute inset-0">
 <div className="absolute inset-0 bg-black/40" />
 {/* Janela transparente no centro */}
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-40 bg-transparent"
 style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
 </div>
 {/* Cantos da mira */}
 <div className="relative w-72 h-40">
 {[
 'top-0 left-0 border-t-2 border-l-2 rounded-tl',
 'top-0 right-0 border-t-2 border-r-2 rounded-tr',
 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl',
 'bottom-0 right-0 border-b-2 border-r-2 rounded-br',
 ].map((cls, i) => (
 <span key={i} className={`absolute w-7 h-7 ${cls} border-brand-400`} />
 ))}
 {/* Linha de scan animada */}
 <div className="absolute inset-x-1 h-0.5 bg-brand-400/80 rounded"
 style={{ top: '50%', animation: 'scanline 2s ease-in-out infinite alternate' }} />
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="shrink-0 bg-black/80 px-4 py-3">
 {!showManual ? (
 <div className="flex items-center justify-between">
 <p className="text-white/50 text-xs">
 {status === 'scanning'
 ? 'Aponta ao código · EAN-13 · QR · Code 128'
 : status === 'starting' ? 'A iniciar...' : ''}
 </p>
 {status !== 'error' && (
 <button
 onClick={() => setShowManual(v => !v)}
 className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors">
 <Keyboard className="w-3.5 h-3.5" />
 Digitar código
 </button>
 )}
 </div>
 ) : (
 /* Input manual / scanner USB */
 <form onSubmit={submitText} className="flex gap-2">
 <input
 ref={textInputRef}
 value={textVal}
 onChange={e => setTextVal(e.target.value)}
 placeholder="Código de barras / QR..."
 className="flex-1 px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
 autoComplete="off"
 />
 <button type="submit" disabled={!textVal.trim()}
 className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
 OK
 </button>
 <button type="button" onClick={() => setShowManual(false)}
 className="px-3 py-2.5 border border-gray-600 text-content-muted hover:text-white rounded-xl text-sm transition-colors">
 <X className="w-4 h-4" />
 </button>
 </form>
 )}
 </div>

 <style>{`
 @keyframes scanline {
 from { transform: translateY(-30px); opacity: 0.5; }
 to { transform: translateY(30px); opacity: 1; }
 }
 `}</style>
 </div>
 );
};

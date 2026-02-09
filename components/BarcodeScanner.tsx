'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

const SUPPORTED_FORMATS = [
    Html5QrcodeSupportedFormats.EAN_13, // JAN
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.QR_CODE
];

type ScanFeedback = 'success' | 'error' | null;

function isNumeric(value: string): boolean {
    return /^[0-9]+$/.test(value);
}

function calculateMod10CheckDigit(digits: string, oddWeight: number, evenWeight: number): number | null {
    if (!isNumeric(digits)) {
        return null;
    }

    const total = digits
        .split('')
        .map((digit) => Number(digit))
        .reduce((sum, digit, index) => {
            const isOddPosition = index % 2 === 0;
            const weight = isOddPosition ? oddWeight : evenWeight;
            return sum + digit * weight;
        }, 0);

    return (10 - (total % 10)) % 10;
}

function validateEan13(value: string): boolean {
    if (value.length !== 13 || !isNumeric(value)) {
        return false;
    }
    const checkDigit = Number(value[value.length - 1]);
    const expected = calculateMod10CheckDigit(value.slice(0, -1), 1, 3);
    return expected !== null && checkDigit === expected;
}

function validateEan8(value: string): boolean {
    if (value.length !== 8 || !isNumeric(value)) {
        return false;
    }
    const checkDigit = Number(value[value.length - 1]);
    const expected = calculateMod10CheckDigit(value.slice(0, -1), 3, 1);
    return expected !== null && checkDigit === expected;
}

function validateUpcA(value: string): boolean {
    if (value.length !== 12 || !isNumeric(value)) {
        return false;
    }
    const checkDigit = Number(value[value.length - 1]);
    const expected = calculateMod10CheckDigit(value.slice(0, -1), 3, 1);
    return expected !== null && checkDigit === expected;
}

function expandUpcE(value: string): string | null {
    if (value.length !== 8 || !isNumeric(value)) {
        return null;
    }

    const numberSystem = value[0];
    const data = value.slice(1, 7);
    const checkDigit = value[7];
    const last = data[5];
    const [d1, d2, d3, d4, d5] = data;

    let manufacturer = '';
    let product = '';

    if (['0', '1', '2'].includes(last)) {
        manufacturer = `${d1}${d2}${last}00`;
        product = `00${d3}${d4}${d5}`;
    } else if (last === '3') {
        manufacturer = `${d1}${d2}${d3}00`;
        product = `000${d4}${d5}`;
    } else if (last === '4') {
        manufacturer = `${d1}${d2}${d3}${d4}0`;
        product = `0000${d5}`;
    } else {
        manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
        product = `0000${last}`;
    }

    return `${numberSystem}${manufacturer}${product}${checkDigit}`;
}

function validateUpcE(value: string): boolean {
    const expanded = expandUpcE(value);
    if (!expanded) {
        return false;
    }
    return validateUpcA(expanded);
}

function validateItf(value: string): boolean {
    if (value.length < 2 || value.length % 2 !== 0 || !isNumeric(value)) {
        return false;
    }
    const checkDigit = Number(value[value.length - 1]);
    const expected = calculateMod10CheckDigit(value.slice(0, -1), 3, 1);
    return expected !== null && checkDigit === expected;
}

function validateBarcode(value: string, format?: Html5QrcodeSupportedFormats): boolean {
    switch (format) {
        case Html5QrcodeSupportedFormats.EAN_13:
            return validateEan13(value);
        case Html5QrcodeSupportedFormats.EAN_8:
            return validateEan8(value);
        case Html5QrcodeSupportedFormats.UPC_A:
            return validateUpcA(value);
        case Html5QrcodeSupportedFormats.UPC_E:
            return validateUpcE(value);
        case Html5QrcodeSupportedFormats.ITF:
            return validateItf(value);
        case Html5QrcodeSupportedFormats.CODE_128:
        case Html5QrcodeSupportedFormats.CODE_39:
        case Html5QrcodeSupportedFormats.CODE_93:
        case Html5QrcodeSupportedFormats.CODABAR:
        case Html5QrcodeSupportedFormats.QR_CODE:
        default:
            return value.length > 0;
    }
}

export function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const regionId = 'html5qr-code-full-region';
    const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
    const feedbackTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (scannerRef.current) {
                try {
                    const state = scannerRef.current.getState();
                    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                        scannerRef.current.stop().catch(console.debug);
                    }
                } catch {
                    // Ignore errors during cleanup
                }
            }
            if (feedbackTimeoutRef.current !== null) {
                window.clearTimeout(feedbackTimeoutRef.current);
            }
        };
    }, []);

    const triggerFeedback = (status: ScanFeedback) => {
        setScanFeedback(status);
        if (feedbackTimeoutRef.current !== null) {
            window.clearTimeout(feedbackTimeoutRef.current);
        }
        feedbackTimeoutRef.current = window.setTimeout(() => {
            setScanFeedback(null);
        }, 300);
    };

    const startScanning = async () => {
        try {
            const html5QrCode = new Html5Qrcode(regionId, {
                formatsToSupport: SUPPORTED_FORMATS,
                verbose: false
            });
            scannerRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' }, // Prefer back camera
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText, result) => {
                    const detectedFormat = result?.result?.format?.format;
                    const isValid = validateBarcode(decodedText, detectedFormat);
                    if (!isValid) {
                        triggerFeedback('error');
                        return;
                    }

                    triggerFeedback('success');
                    stopScanning();
                    onScanSuccess(decodedText);
                },
                () => {
                    // parse error, ignore it.
                }
            );
        } catch (err) {
            console.error(err);
            toast.error('カメラの起動に失敗しました。カメラへのアクセスを許可してください。');
            onClose();
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                    await scannerRef.current.stop();
                }
            } catch (err) {
                // Ignore error if scanner is not running
                console.debug('Scanner stop:', err);
            }
        }
    };

    // Auto-start on mount
    useEffect(() => {
        startScanning();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-background rounded-lg overflow-hidden relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => {
                        stopScanning();
                        onClose();
                    }}
                >
                    <X className="h-6 w-6" />
                </Button>

                <div className="p-4 text-center">
                    <h3 className="font-semibold mb-2">バーコードをスキャン</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        JAN/EAN/UPC/Code128/ITFなどに対応しています
                    </p>
                    <div
                        id={regionId}
                        className={`w-full overflow-hidden rounded-md bg-black min-h-[300px] transition-shadow ${
                            scanFeedback === 'success'
                                ? 'ring-4 ring-green-400 ring-offset-2 ring-offset-black shadow-[0_0_18px_rgba(74,222,128,0.9)]'
                                : scanFeedback === 'error'
                                  ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-black shadow-[0_0_18px_rgba(239,68,68,0.9)]'
                                  : ''
                        }`}
                    />
                </div>
            </div>
        </div>
    );
}

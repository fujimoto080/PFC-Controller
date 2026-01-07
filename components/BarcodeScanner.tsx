'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

export function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const regionId = 'html5qr-code-full-region';

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (scannerRef.current && isScanning) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, [isScanning]);

    const startScanning = async () => {
        try {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(regionId);
            }

            await scannerRef.current.start(
                { facingMode: 'environment' }, // Prefer back camera
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13] // JAN code is EAN-13
                },
                (decodedText) => {
                    // Success callback
                    stopScanning();
                    onScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // parse error, ignore it.
                }
            );
            setIsScanning(true);
        } catch (err) {
            console.error(err);
            toast.error('カメラの起動に失敗しました。カメラへのアクセスを許可してください。');
            onClose();
        }
    };

    const stopScanning = async () => {
        if (scannerRef.current && isScanning) {
            try {
                await scannerRef.current.stop();
                setIsScanning(false);
            } catch (err) {
                console.error('Failed to stop scanner', err);
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
                        商品のJANコードをカメラに向けてください
                    </p>
                    <div id={regionId} className="w-full overflow-hidden rounded-md bg-black min-h-[300px]" />
                </div>
            </div>
        </div>
    );
}

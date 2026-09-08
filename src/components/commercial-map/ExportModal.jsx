import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileImage, FileSpreadsheet, FileJson, FileType } from 'lucide-react';
import { exportSVGFile, exportPNGFile, exportGeoJSONFile, exportExcelFile } from '@/lib/commercialMapUtils';

export default function ExportModal({ open, onClose, overlays, geoData, title, accent }) {
  const opts = { title: title || 'Carte Secteurs Commerciaux', accent: accent || '#f43f5e' };
  const hasData = overlays.some(o => Object.keys(o.cV || {}).length > 0);

  const doExport = (fn) => { if (hasData) fn(); };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter la carte</DialogTitle>
        </DialogHeader>
        {!hasData && (
          <p className="text-sm text-muted-foreground">Aucune donnée à exporter. Importez ou assignez des communes d'abord.</p>
        )}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button variant="outline" disabled={!hasData} onClick={() => doExport(() => exportSVGFile(overlays, geoData, opts))} className="h-20 flex-col gap-2">
            <FileType className="w-5 h-5" /> <span className="text-xs">SVG vectoriel</span>
          </Button>
          <Button variant="outline" disabled={!hasData} onClick={() => doExport(() => exportPNGFile(overlays, geoData, opts))} className="h-20 flex-col gap-2">
            <FileImage className="w-5 h-5" /> <span className="text-xs">PNG haute définition</span>
          </Button>
          <Button variant="outline" disabled={!hasData} onClick={() => doExport(() => exportGeoJSONFile(overlays, geoData))} className="h-20 flex-col gap-2">
            <FileJson className="w-5 h-5" /> <span className="text-xs">GeoJSON</span>
          </Button>
          <Button variant="outline" disabled={!hasData} onClick={() => doExport(() => exportExcelFile(overlays, geoData))} className="h-20 flex-col gap-2">
            <FileSpreadsheet className="w-5 h-5" /> <span className="text-xs">Excel (.xlsx)</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
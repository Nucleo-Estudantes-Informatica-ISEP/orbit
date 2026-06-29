'use client';

import { useRef, useState } from 'react';
import { Upload, X, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api, API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/locale-context';

interface UploadResult {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  currentKey?: string;
  currentName?: string;
  onUpload: (result: UploadResult) => void;
  onClear: () => void;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  accept,
  maxSizeMB = 10,
  currentKey,
  currentName,
  onUpload,
  onClear,
  className,
  disabled,
}: FileUploadProps) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadedKey, setUploadedKey] = useState<string | null>(currentKey ?? null);

  const isImage = (mimeType?: string, name?: string) => {
    if (mimeType?.startsWith('image/')) return true;
    if (name) return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name);
    return false;
  };

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(t('fileUpload.sizeLimit', `Ficheiro excede o limite de ${maxSizeMB}MB`));
      return;
    }
    if (isImage(file.type)) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
    setUploading(true);
    try {
      const result = await api.upload<UploadResult>('/files/upload', file);
      setUploadedName(file.name);
      setUploadedKey(result.key);
      onUpload(result);
      toast.success(t('fileUpload.uploadSuccess', 'Ficheiro carregado com sucesso'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('fileUpload.uploadError', 'Erro ao carregar ficheiro'));
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleClear = () => {
    setPreview(null);
    setUploadedName(null);
    setUploadedKey(null);
    onClear();
  };

  const displayKey = uploadedKey ?? currentKey;
  const displayName = uploadedName ?? currentName;
  const hasFile = !!displayKey;

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled || uploading}
      />

      {hasFile ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/40 p-3">
          {preview ? (
            <img src={preview} alt="preview" className="h-12 w-12 rounded object-cover shrink-0" />
          ) : displayKey && isImage(undefined, displayName ?? displayKey) ? (
            <img
              src={`${API_BASE}/files/${displayKey}`}
              alt="preview"
              className="h-12 w-12 rounded object-cover shrink-0"
            />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName ?? displayKey}</p>
            {displayKey && !preview && (
              <a
                href={`${API_BASE}/files/${displayKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                {t('fileUpload.viewFile', 'Ver ficheiro')} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/40 bg-muted/20 p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/40 transition-colors"
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {uploading ? t('common.loading') : t('fileUpload.dropHere', 'Clique ou arraste o ficheiro aqui')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {accept ? accept.replace(/,/g, ', ') : t('fileUpload.anyFile', 'Qualquer ficheiro')} · Máx. {maxSizeMB}MB
          </p>
        </div>
      )}

      {!hasFile && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? t('common.loading') : t('fileUpload.selectFile', 'Selecionar ficheiro')}
        </Button>
      )}
    </div>
  );
}

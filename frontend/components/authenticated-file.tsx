'use client';

import { useEffect, useRef, useState } from 'react';
import Image, { type ImageProps } from 'next/image';
import { fetchFileBlob } from '@/lib/api';
import { useLocale } from '@/lib/locale-context';
import { Button } from '@/components/ui/button';

function useFileBlob(fileKey: string, attempt = 0) {
  const [file, setFile] = useState<{
    key: string;
    attempt: number;
    url?: string;
    type?: string;
    error?: boolean;
  }>();

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    fetchFileBlob(fileKey, controller.signal)
      .then(async (blob) => {
        const type = blob.type.split(';')[0].trim();
        const preview = type.startsWith('image/') || type === 'application/pdf';
        const svg = type === 'image/svg+xml' ? await blob.text() : null;
        if (controller.signal.aborted) return;
        // SVG image documents use an opaque data origin if opened in a new tab.
        // Other active content must remain a download, even if its URL is copied.
        url = svg !== null
          ? `data:image/svg+xml,${encodeURIComponent(svg)}`
          : URL.createObjectURL(preview ? blob : new Blob([blob], { type: 'application/octet-stream' }));
        setFile({ key: fileKey, attempt, url, type });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFile({ key: fileKey, attempt, error: true });
        }
      });
    return () => {
      controller.abort();
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [fileKey, attempt]);

  return file?.key === fileKey && file.attempt === attempt ? file : undefined;
}

export function FileImage({ fileKey, alt, ...props }: Omit<ImageProps, 'src'> & { fileKey: string }) {
  const file = useFileBlob(fileKey);
  if (!file?.url) {
    return <span role="img" aria-label={alt} className={props.className} />;
  }
  return <Image {...props} src={file.url} alt={alt} unoptimized />;
}

export function FileViewer({ fileKey }: { fileKey: string }) {
  const { t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  const file = useFileBlob(fileKey, attempt);
  const download = useRef<HTMLAnchorElement>(null);
  const name = fileKey.split('/').at(-1) || t('files.title');
  const image = file?.type?.startsWith('image/');
  const pdf = file?.type === 'application/pdf';

  useEffect(() => {
    // Only images and PDFs are previewed. HTML and other active content must
    // download rather than execute as a blob document on the application's origin.
    if (file?.url && !image && !pdf) download.current?.click();
  }, [file?.url, image, pdf]);

  if (file?.error) {
    return (
      <main className="m-auto flex flex-col items-center gap-4 p-6">
        <p role="alert">{t('files.loadError')}</p>
        <Button onClick={() => setAttempt((value) => value + 1)}>{t('files.retry')}</Button>
      </main>
    );
  }
  if (!file?.url) return <p role="status" className="m-auto p-6">{t('common.loading')}</p>;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b p-4">
        <h1 className="truncate text-sm font-medium">{name}</h1>
        <a ref={download} href={file.url} download={name} className="text-primary underline">
          {t('files.download')}
        </a>
      </header>
      {image && <Image src={file.url} alt={name} width={1600} height={1200} unoptimized className="m-auto h-auto max-h-[calc(100vh-5rem)] w-auto max-w-full object-contain" />}
      {pdf && <iframe src={file.url} title={name} className="min-h-[calc(100vh-5rem)] w-full flex-1 border-0" />}
    </main>
  );
}

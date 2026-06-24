import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => (data += chunk));
      req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({});
        }
      });
      req.on('error', reject);
    });

    if (body.type === 'blob.upload-completed') {
      return res.status(200).json({ ok: true });
    }

    const pathname = body?.payload?.pathname || `upload-${Date.now()}.pdf`;

    const blobToken =
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB2_READ_WRITE_TOKEN;

    if (!blobToken) {
      return res.status(500).json({
        error: 'Blob token ontbreekt. Voeg BLOB_READ_WRITE_TOKEN of BLOB2_READ_WRITE_TOKEN toe aan Vercel Environment Variables.',
      });
    }

    const clientToken = await generateClientTokenFromReadWriteToken({
      token: blobToken,
      pathname,
      maximumSizeInBytes: 50 * 1024 * 1024,
      allowedContentTypes: ['application/pdf', 'application/octet-stream'],
      addRandomSuffix: true,
    });

    return res.status(200).json({ clientToken });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Token genereren mislukt' });
  }
}

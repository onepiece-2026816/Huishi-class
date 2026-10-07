import https from 'node:https';
import { writeFile } from 'node:fs/promises';

function download(url, tls12, redirects = 0) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      !/\.(tencentcos\.cn|myqcloud\.com)$/.test(parsed.hostname)) {
    throw new Error('Untrusted model download host');
  }
  return new Promise((resolve, reject) => {
    const request = https.get(parsed, {
      headers: { Accept: 'application/octet-stream', Connection: 'close' },
      ...(tls12 ? { minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' } : {}),
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location || redirects >= 3) return reject(new Error('Invalid redirect'));
        try { resolve(download(new URL(response.headers.location, parsed).href, tls12, redirects + 1)); }
        catch (error) { reject(error); }
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Model download HTTP ${response.statusCode}`));
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const data = Buffer.concat(chunks);
        if (process.env.HUNYUAN_DOWNLOAD_FORMAT === 'zip') {
          if (data.length < 4 || data.toString('ascii', 0, 2) !== 'PK') return reject(new Error('Invalid OBJ archive'));
          return resolve(data);
        }
        if (data.length < 12 || data.toString('ascii', 0, 4) !== 'glTF' ||
            data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) {
          return reject(new Error('Invalid or incomplete GLB'));
        }
        resolve(data);
      });
    });
    request.setTimeout(60000, () => request.destroy(new Error('Model download timed out')));
    request.on('error', reject);
  });
}

try {
  let data;
  try { data = await download(process.env.HUNYUAN_DOWNLOAD_URL, false); }
  catch { data = await download(process.env.HUNYUAN_DOWNLOAD_URL, true); }
  await writeFile(process.env.HUNYUAN_DOWNLOAD_OUT, data);
} catch (error) {
  // Do not print the signed URL or provider credentials.
  console.error(error.code || error.message);
  process.exitCode = 1;
}

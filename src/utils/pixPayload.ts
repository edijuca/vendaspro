import QRCode from 'qrcode';

/**
 * Remove acentos e caracteres fora do padrão EMVCo / BACEN
 */
export function sanitizeText(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, maxLength);
}

/**
 * Monta um bloco TLV (Tag-Length-Value)
 */
function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/**
 * CRC16 CCITT (polinômio 0x1021)
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  const bytes = new TextEncoder().encode(payload);

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    for (let j = 0; j < 8; j++) {
      const bit = ((b >> (7 - j)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadOptions {
  key: string;
  name: string;
  city: string;
  amount?: number;
  txid?: string;
  description?: string;
}

/**
 * Gera o BR Code oficial do PIX (Copia e Cola) no padrão EMVCo
 */
export function generatePixPayload({
  key,
  name,
  city,
  amount,
  txid = '***',
}: PixPayloadOptions): string {
  const cleanKey = key.trim();
  const cleanName = sanitizeText(name || 'VENDASPRO', 25) || 'RECEBEDOR';
  const cleanCity = sanitizeText(city || 'SAO PAULO', 15) || 'SAO PAULO';
  const cleanTxid = (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  const gui = formatTLV('00', 'br.gov.bcb.pix');
  const pixKeyField = formatTLV('01', cleanKey);
  const merchantAccountInfo = formatTLV('26', `${gui}${pixKeyField}`);

  let payload =
    formatTLV('00', '01') +
    merchantAccountInfo +
    formatTLV('52', '0000') +
    formatTLV('53', '986');

  if (amount && amount > 0) {
    payload += formatTLV('54', amount.toFixed(2));
  }

  payload += formatTLV('58', 'BR') + formatTLV('59', cleanName) + formatTLV('60', cleanCity);

  const txidField = formatTLV('05', cleanTxid);
  payload += formatTLV('62', txidField);

  const payloadWithCRCHeader = `${payload}6304`;
  const crc = calculateCRC16(payloadWithCRCHeader);

  return `${payloadWithCRCHeader}${crc}`;
}

/**
 * Gera a imagem do QR Code (data URL PNG)
 */
export async function generateQrCodeDataUrl(content: string): Promise<string> {
  try {
    return await QRCode.toDataURL(content, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Falha ao gerar QR Code:', err);
    return '';
  }
}

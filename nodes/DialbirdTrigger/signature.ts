import { createHmac, timingSafeEqual } from 'crypto';

/** Deliveries signed longer ago than this are rejected as possible replays. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

interface ParsedSignature {
	timestamp: number;
	signatures: string[];
}

/** Parses `X-Dialbird-Signature: t=<unix seconds>,v1=<hex hmac>`. */
function parseSignatureHeader(header: string): ParsedSignature | null {
	let timestamp = NaN;
	const signatures: string[] = [];

	for (const part of header.split(',')) {
		const [key, value] = part.trim().split('=', 2);
		if (key === 't') {
			timestamp = Number(value);
		} else if (key === 'v1' && value) {
			signatures.push(value);
		}
	}

	if (!Number.isInteger(timestamp) || signatures.length === 0) {
		return null;
	}
	return { timestamp, signatures };
}

function safeEqualHex(a: string, b: string): boolean {
	const left = Buffer.from(a, 'hex');
	const right = Buffer.from(b, 'hex');
	return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/**
 * Checks a delivery against one signing secret: HMAC-SHA256 over `${t}.${rawBody}`, compared in
 * constant time, with `t` no older (or further in the future) than the tolerance.
 */
export function isValidSignature(
	secret: string,
	header: string | undefined,
	rawBody: string,
	nowSeconds: number,
): boolean {
	if (!header) {
		return false;
	}
	const parsed = parseSignatureHeader(header);
	if (!parsed || Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
		return false;
	}

	const expected = createHmac('sha256', secret)
		.update(`${parsed.timestamp}.${rawBody}`)
		.digest('hex');
	return parsed.signatures.some((signature) => safeEqualHex(signature, expected));
}

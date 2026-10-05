import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/** Shared by both nodes; picks the credential type used for every request. */
export const authenticationProperty: INodeProperties = {
	displayName: 'Authentication',
	name: 'authentication',
	type: 'options',
	options: [
		{
			name: 'API Key',
			value: 'apiKey',
			description: 'Works on any n8n, including self-hosted',
		},
		{
			name: 'Sign In With Dialbird',
			value: 'oAuth2',
			description: 'For n8n Cloud. Log in to Dialbird instead of pasting a key.',
		},
	],
	default: 'apiKey',
};

type DialbirdContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

interface DialbirdRequest {
	method: IHttpRequestMethods;
	/** Path under `/api/v1`, e.g. `/contacts`. */
	path: string;
	body?: IDataObject;
	/** Sent as `Idempotency-Key` so a retried write is not applied twice. */
	idempotencyKey?: string;
	/** Resolve with `{}` instead of failing when Dialbird answers 404. */
	ignoreNotFound?: boolean;
}

/** Dialbird's error body: `{ error: { code, message, field?, request_id } }`. */
interface DialbirdErrorBody {
	error?: { message?: string };
}

/**
 * The failed request's details. n8n may hand back the raw HTTP error or one it has already
 * wrapped in a `NodeApiError` (which keeps the response body in `context.data`).
 */
interface FailedRequest {
	httpCode?: string | null;
	statusCode?: number;
	response?: { status?: number; data?: DialbirdErrorBody; body?: DialbirdErrorBody };
	context?: { data?: DialbirdErrorBody };
}

function httpStatusOf(error: unknown): number | undefined {
	const { response, statusCode, httpCode } = error as FailedRequest;
	return response?.status ?? statusCode ?? (httpCode ? Number(httpCode) : undefined);
}

function dialbirdErrorMessage(error: unknown): string | undefined {
	const { response, context } = error as FailedRequest;
	return (response?.data ?? response?.body ?? context?.data)?.error?.message;
}

/** Wraps a failed request so n8n shows Dialbird's own message, e.g. "Invalid API key." */
function toDialbirdApiError(node: INode, error: unknown): NodeApiError {
	const message = dialbirdErrorMessage(error);
	if (error instanceof NodeApiError) {
		if (message) {
			error.message = message;
		}
		return error;
	}
	return new NodeApiError(node, error as JsonObject, message ? { message } : {});
}

/** The credential type picked by the node's "Authentication" parameter. */
function credentialTypeOf(this: DialbirdContext): string {
	return this.getNodeParameter('authentication', 0) === 'oAuth2'
		? 'dialbirdOAuth2Api'
		: 'dialbirdApi';
}

/** Calls the Dialbird public API (`/api/v1`) with the node's credential. */
export async function dialbirdApiRequest(
	this: DialbirdContext,
	{ method, path, body, idempotencyKey, ignoreNotFound }: DialbirdRequest,
): Promise<IDataObject> {
	const credentialType = credentialTypeOf.call(this);
	const { baseUrl } = await this.getCredentials(credentialType);
	const options: IHttpRequestOptions = {
		method,
		url: `${String(baseUrl).replace(/\/+$/, '')}/api/v1${path}`,
		json: true,
		...(body ? { body } : {}),
		...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
	};

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			credentialType,
			options,
		)) as IDataObject;
	} catch (error) {
		if (ignoreNotFound && httpStatusOf(error) === 404) {
			return {};
		}
		throw toDialbirdApiError(this.getNode(), error);
	}
}

/** Tags an error with the item it failed on, keeping Dialbird's details when it has them. */
export function toItemError(
	node: INode,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (error instanceof NodeApiError || error instanceof NodeOperationError) {
		error.context.itemIndex = itemIndex;
		return error;
	}
	return new NodeOperationError(node, error as Error, { itemIndex });
}

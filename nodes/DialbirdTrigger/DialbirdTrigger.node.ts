import {
	NodeConnectionTypes,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { authenticationProperty, dialbirdApiRequest } from '../shared/transport';
import { isValidSignature } from './signature';

interface DialbirdSubscription {
	id: string;
	event_type: string;
	target_url: string;
	status: 'active' | 'failing' | 'disabled';
}

interface StoredSubscription {
	id: string;
	signingSecret: string;
}

/**
 * Subscriptions this node created, keyed by webhook URL. The test URL (used while building) and
 * the production URL (used once published) each get their own Dialbird subscription, and they
 * share this node's static data, so keying by URL keeps one from overwriting the other.
 */
type StoredSubscriptions = Record<string, StoredSubscription>;

function storedSubscriptions(context: IHookFunctions | IWebhookFunctions): StoredSubscriptions {
	const staticData = context.getWorkflowStaticData('node');
	staticData.subscriptions ??= {};
	return staticData.subscriptions as StoredSubscriptions;
}

async function deleteSubscription(this: IHookFunctions, id: string): Promise<void> {
	// A 404 means it's already gone on the Dialbird side, which is the outcome we want.
	await dialbirdApiRequest.call(this, {
		method: 'DELETE',
		path: `/subscriptions/${encodeURIComponent(id)}`,
		ignoreNotFound: true,
	});
}

export class DialbirdTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dialbird Trigger',
		name: 'dialbirdTrigger',
		icon: { light: 'file:../../icons/dialbird.png', dark: 'file:../../icons/dialbird.dark.png' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a text or call happens in Dialbird',
		defaults: {
			name: 'Dialbird Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'dialbirdApi',
				required: true,
				displayOptions: { show: { authentication: ['apiKey'] } },
			},
			{
				name: 'dialbirdOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oAuth2'] } },
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			authenticationProperty,
			{
				displayName: 'Trigger On',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				default: 'message.incoming.received',
				options: [
					{
						name: 'Incoming Call Completed',
						value: 'call.incoming.completed',
						description:
							'An inbound call ends. The status says completed, missed, no-answer or failed.',
					},
					{
						name: 'New Incoming Message',
						value: 'message.incoming.received',
						description: 'Someone texts one of your Dialbird numbers',
					},
					{
						name: 'Outgoing Call Completed',
						value: 'call.outgoing.completed',
						description: 'An outbound call ends',
					},
					{
						name: 'Outgoing Message Delivered',
						value: 'message.outgoing.delivered',
						description: 'A text sent from Dialbird is confirmed delivered',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const event = this.getNodeParameter('event') as string;
				const stored = storedSubscriptions(this)[webhookUrl];

				const { data } = (await dialbirdApiRequest.call(this, {
					method: 'GET',
					path: '/subscriptions',
				})) as { data: DialbirdSubscription[] };

				const live = data.filter(
					(sub) =>
						sub.target_url === webhookUrl && sub.event_type === event && sub.status !== 'disabled',
				);
				const ours = live.find((sub) => sub.id === stored?.id);

				// Any other live subscription to this URL is one we can no longer verify (its signing
				// secret was lost). Remove it so Dialbird doesn't deliver every event twice.
				for (const orphan of live.filter((sub) => sub !== ours)) {
					await deleteSubscription.call(this, orphan.id);
				}

				return ours !== undefined;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const event = this.getNodeParameter('event') as string;

				const created = (await dialbirdApiRequest.call(this, {
					method: 'POST',
					path: '/subscriptions',
					body: { event_type: event, target_url: webhookUrl },
				})) as { id: string; signing_secret: string };

				// Dialbird returns the signing secret only on create, so keep it now.
				storedSubscriptions(this)[webhookUrl] = {
					id: created.id,
					signingSecret: created.signing_secret,
				};
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const subscriptions = storedSubscriptions(this);
				const stored = subscriptions[webhookUrl];

				if (stored) {
					await deleteSubscription.call(this, stored.id);
					delete subscriptions[webhookUrl];
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		if (req.rawBody === undefined) {
			await req.readRawBody();
		}
		const rawBody = req.rawBody.toString('utf8');
		const signatureHeader = this.getHeaderData()['x-dialbird-signature'] as string | undefined;
		const nowSeconds = Math.floor(Date.now() / 1000);

		// The request may have come in on the test or the production URL; accept it if it was
		// signed with either subscription's secret.
		const signedByDialbird = Object.values(storedSubscriptions(this)).some(({ signingSecret }) =>
			isValidSignature(signingSecret, signatureHeader, rawBody, nowSeconds),
		);

		if (!signedByDialbird) {
			const res = this.getResponseObject();
			res.status(401).json({ message: 'Invalid or missing X-Dialbird-Signature' });
			return { noWebhookResponse: true };
		}

		return {
			workflowData: [this.helpers.returnJsonArray(this.getBodyData())],
		};
	}
}

import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { dialbirdApiRequest } from '../../shared/transport';

const showForSend = { resource: ['message'], operation: ['send'] };

export const messageDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['message'] } },
		options: [
			{
				name: 'Send',
				value: 'send',
				action: 'Send a text message',
				description: 'Send a text from one of your Dialbird numbers',
			},
		],
		default: 'send',
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+447700900123',
		displayOptions: { show: showForSend },
		description: 'The phone number to text, in international format starting with +',
	},
	{
		displayName: 'Message',
		name: 'body',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: { show: showForSend },
	},
	{
		displayName: 'From Name or ID',
		name: 'from',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getPhoneNumbers' },
		default: '',
		displayOptions: { show: showForSend },
		description:
			'The Dialbird number to send from. Workspaces with one number can leave this on Automatic. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
];

interface PhoneNumber {
	phone_number: string;
	name: string | null;
}

async function listPhoneNumbers(
	this: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<PhoneNumber[]> {
	const { data } = (await dialbirdApiRequest.call(this, {
		method: 'GET',
		path: '/inboxes',
	})) as { data: PhoneNumber[] };
	return data;
}

/**
 * Fills the "From" dropdown. "Automatic" is offered only when the workspace has a single
 * number; with several, Dialbird needs to be told which one to use.
 */
export async function getPhoneNumbers(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const numbers = await listPhoneNumbers.call(this);
	const options = numbers.map(({ phone_number, name }) => ({
		name: name ? `${name} (${phone_number})` : phone_number,
		value: phone_number,
	}));
	return numbers.length === 1
		? [{ name: `Automatic (${numbers[0].phone_number})`, value: '' }, ...options]
		: options;
}

/**
 * Picks the number to send from: the one chosen under "From", or the workspace's only number.
 * Looks the numbers up at most once per run, however many items are sent.
 */
export function makeSenderResolver(context: IExecuteFunctions) {
	let phoneNumbers: Promise<PhoneNumber[]> | undefined;

	return async (itemIndex: number): Promise<string> => {
		const from = context.getNodeParameter('from', itemIndex) as string;
		if (from) {
			return from;
		}

		phoneNumbers ??= listPhoneNumbers.call(context);
		const numbers = await phoneNumbers;
		if (numbers.length === 1) {
			return numbers[0].phone_number;
		}
		throw new NodeOperationError(
			context.getNode(),
			numbers.length === 0
				? 'Your Dialbird workspace has no phone number to send from'
				: 'Your Dialbird workspace has more than one number. Choose one under From.',
			{ itemIndex },
		);
	};
}

export async function executeMessage(
	this: IExecuteFunctions,
	itemIndex: number,
	idempotencyKey: string,
	resolveSender: (itemIndex: number) => Promise<string>,
): Promise<IDataObject> {
	return await dialbirdApiRequest.call(this, {
		method: 'POST',
		path: '/messages',
		body: {
			to: this.getNodeParameter('to', itemIndex) as string,
			body: this.getNodeParameter('body', itemIndex) as string,
			from: await resolveSender(itemIndex),
		},
		idempotencyKey,
	});
}

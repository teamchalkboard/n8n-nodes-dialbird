import {
	NodeConnectionTypes,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { authenticationProperty, toItemError } from '../shared/transport';
import { contactDescription, executeContact } from './resources/contact';
import {
	executeMessage,
	getPhoneNumbers,
	makeSenderResolver,
	messageDescription,
} from './resources/message';

export class Dialbird implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Dialbird',
		name: 'dialbird',
		icon: { light: 'file:../../icons/dialbird.png', dark: 'file:../../icons/dialbird.dark.png' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send texts and manage contacts in Dialbird',
		defaults: {
			name: 'Dialbird',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
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
		properties: [
			authenticationProperty,
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Contact',
						value: 'contact',
					},
					{
						name: 'Message',
						value: 'message',
					},
				],
				default: 'message',
			},
			...contactDescription,
			...messageDescription,
		],
	};

	methods = {
		loadOptions: {
			getPhoneNumbers,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const executionId = this.getExecutionId();
		const nodeId = this.getNode().id;
		const resolveSender = makeSenderResolver(this);

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			// Stable for retries of this item in this execution, so Dialbird applies a write once.
			const idempotencyKey = `n8n:${executionId}:${nodeId}:${itemIndex}`;
			const resource = this.getNodeParameter('resource', itemIndex) as string;
			const operation = this.getNodeParameter('operation', itemIndex) as string;

			try {
				let responseData: IDataObject;
				if (resource === 'contact') {
					responseData = await executeContact.call(this, operation, itemIndex, idempotencyKey);
				} else {
					responseData = await executeMessage.call(this, itemIndex, idempotencyKey, resolveSender);
				}
				returnData.push({ json: responseData, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw toItemError(this.getNode(), error, itemIndex);
			}
		}

		return [returnData];
	}
}

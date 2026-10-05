import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { dialbirdApiRequest } from '../../shared/transport';

const showForContact = { resource: ['contact'] };
const showForCreate = { resource: ['contact'], operation: ['create'] };
const showForUpdate = { resource: ['contact'], operation: ['update'] };

/** Contact fields shared by Create and Update, keyed by their Dialbird API name. */
const contactFields: INodeProperties[] = [
	{
		displayName: 'First Name',
		name: 'first_name',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Last Name',
		name: 'last_name',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Phone Number',
		name: 'primary_phone',
		type: 'string',
		default: '',
		placeholder: '+447700900123',
		description: 'In international format, starting with +',
	},
	{
		displayName: 'Email',
		name: 'primary_email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
	},
];

export const contactDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForContact },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a contact',
				description: 'Add a contact to your Dialbird workspace',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a contact',
				description: 'Change an existing contact',
			},
		],
		default: 'create',
	},
	{
		displayName: 'Contact ID',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: showForUpdate },
		description: 'The ID of the contact, for example from a Dialbird Trigger or a Create step',
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showForCreate },
		description: 'A phone number or an email is required',
		options: contactFields,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: showForUpdate },
		options: contactFields,
	},
];

export async function executeContact(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
	idempotencyKey: string,
): Promise<IDataObject> {
	if (operation === 'create') {
		const fields = this.getNodeParameter('fields', itemIndex) as IDataObject;
		if (!fields.primary_phone && !fields.primary_email) {
			throw new NodeOperationError(this.getNode(), 'Add a phone number or an email', {
				itemIndex,
			});
		}
		return await dialbirdApiRequest.call(this, {
			method: 'POST',
			path: '/contacts',
			body: fields,
			idempotencyKey,
		});
	}

	const contactId = this.getNodeParameter('contactId', itemIndex) as string;
	const updateFields = this.getNodeParameter('updateFields', itemIndex) as IDataObject;
	if (Object.keys(updateFields).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
			itemIndex,
		});
	}
	return await dialbirdApiRequest.call(this, {
		method: 'PATCH',
		path: `/contacts/${encodeURIComponent(contactId)}`,
		body: updateFields,
	});
}

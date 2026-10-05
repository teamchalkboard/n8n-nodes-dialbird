import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class DialbirdApi implements ICredentialType {
	name = 'dialbirdApi';

	displayName = 'Dialbird API';

	icon: Icon = { light: 'file:../icons/dialbird.png', dark: 'file:../icons/dialbird.dark.png' };

	documentationUrl = 'https://github.com/teamchalkboard/n8n-nodes-dialbird#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'db_...',
			description: 'Create one in Dialbird under Settings → API keys',
		},
		{
			displayName: 'Dialbird URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api-prod.dialbird.io',
			required: true,
			description:
				'The address of your Dialbird workspace. Leave as is unless Dialbird support tells you otherwise.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}/api/v1',
			url: '/me',
			method: 'GET',
		},
	};
}

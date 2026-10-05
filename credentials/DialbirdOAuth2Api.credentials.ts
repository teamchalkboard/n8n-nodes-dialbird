import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * "Sign in with Dialbird" for n8n Cloud. Dialbird's `n8n-cloud` OAuth client is public (this
 * package can't keep a secret), so the sign-in uses PKCE and no client secret. Dialbird only
 * accepts n8n Cloud callbacks (`https://<name>.app.n8n.cloud/...`); self-hosted n8n uses the
 * API key credential instead.
 */
export class DialbirdOAuth2Api implements ICredentialType {
	name = 'dialbirdOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Dialbird OAuth2 API';

	icon: Icon = { light: 'file:../icons/dialbird.png', dark: 'file:../icons/dialbird.dark.png' };

	documentationUrl = 'https://github.com/teamchalkboard/n8n-nodes-dialbird#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Dialbird URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api-prod.dialbird.io',
			required: true,
			description:
				'The address of your Dialbird workspace. Leave as is unless Dialbird support tells you otherwise.',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'pkce',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: '={{$self["baseUrl"].replace(/\\/+$/, "")}}/oidc/auth',
			required: true,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: '={{$self["baseUrl"].replace(/\\/+$/, "")}}/oidc/token',
			required: true,
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'hidden',
			default: 'n8n-cloud',
		},
		{
			// Public client: no secret. Sent empty in the body, which Dialbird reads as "none".
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'hidden',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'openid offline_access api:me api:contacts:write api:messages:write api:webhooks',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: 'prompt=consent',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
	];
}

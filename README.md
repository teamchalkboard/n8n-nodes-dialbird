# n8n-nodes-dialbird

Use [Dialbird](https://dialbird.io) in your [n8n](https://n8n.io) workflows: start a workflow when a text or call happens in Dialbird, then send texts and manage contacts.

[Installation](#installation) · [Credentials](#credentials) · [Nodes](#nodes) · [Example workflows](#example-workflows) · [Compatibility](#compatibility)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-dialbird`.

## Credentials

Each Dialbird node has an **Authentication** setting with two options.

### Sign In With Dialbird (n8n Cloud)

1. Choose **Sign In With Dialbird** and create a new **Dialbird OAuth2 API** credential.
2. Click **Connect my account**, log in to Dialbird, and check that the address shown is your own n8n Cloud workspace.
3. Click **Allow**.

This works on every Dialbird plan. It is only available on n8n Cloud (`*.app.n8n.cloud`). You can remove access at any time in Dialbird settings.

### API Key (any n8n, including self-hosted)

API keys are available on Dialbird plans that include API access.

1. In Dialbird, go to **Settings → API keys** and create a key. Only workspace admins and owners can do this.
2. Copy the key straight away. It starts with `db_` and is shown only once.
3. In n8n, choose **API Key** and create a **Dialbird API** credential with the key.

Your n8n must be reachable on a public `https://` address for the Dialbird Trigger to receive events. Dialbird does not send events to `http://` or private network addresses.

## Nodes

### Dialbird Trigger

Starts a workflow when something happens in Dialbird. When you publish the workflow, the node tells Dialbird where to send events. When you unpublish it, the node tells Dialbird to stop. Every event is checked against Dialbird's signature before the workflow runs.

| Trigger on                 | Fires when                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| New Incoming Message       | Someone texts one of your Dialbird numbers                                                 |
| Outgoing Message Delivered | A text sent from Dialbird is confirmed delivered                                           |
| Incoming Call Completed    | An inbound call ends. `data.call.status` is `completed`, `missed`, `no-answer` or `failed` |
| Outgoing Call Completed    | An outbound call ends                                                                      |

Each event looks like this (an incoming text):

```json
{
	"id": "evt_4f9a2c0d7b1e4a6f…",
	"type": "message.incoming.received",
	"api_version": "v1",
	"occurred_at": "2026-10-05T14:02:11.000Z",
	"business_id": "…",
	"data": {
		"message": {
			"id": "…",
			"direction": "incoming",
			"body": "Is the 2pm slot still free?",
			"from_number": "+15551234567",
			"to_number": "+15557654321",
			"status": "received",
			"media_urls": [],
			"created_at": "2026-10-05T14:02:11.000Z"
		},
		"conversation": { "id": "…" },
		"contact": { "id": "…", "name": "Maria Lopez", "phone_number": "+15551234567" },
		"user": null
	}
}
```

### Dialbird

| Resource | Operation | What it does                                           |
| -------- | --------- | ------------------------------------------------------ |
| Contact  | Create    | Adds a contact. A phone number or an email is required |
| Contact  | Update    | Changes an existing contact                            |
| Message  | Send      | Sends a text from one of your Dialbird numbers         |

Create Contact and Send Message are safe to retry: if n8n retries the same item in the same run, Dialbird applies it once.

## Example workflows

**Auto-reply to texts**: Dialbird Trigger (New Incoming Message) → Dialbird (Message → Send) with

- To: `{{ $json.data.message.from_number }}`
- From: `{{ $json.data.message.to_number }}`

**Missed-call text-back**: Dialbird Trigger (Incoming Call Completed) → If (`{{ $json.data.call.status }}` is `missed`) → Dialbird (Message → Send) to `{{ $json.data.call.from_number }}`.

**Save new callers as contacts**: Dialbird Trigger (Incoming Call Completed) → If (`{{ $json.data.contact }}` is empty) → Dialbird (Contact → Create) with Phone Number `{{ $json.data.call.from_number }}`.

## Compatibility

Built with `@n8n/node-cli` against n8n-workflow 2.x.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

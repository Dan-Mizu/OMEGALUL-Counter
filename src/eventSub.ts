// imports
import crypto from "crypto";
import { AppTokenAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import {
	DirectConnectionAdapter,
	EventSubHttpListener,
} from "@twurple/eventsub-http";
import { NgrokAdapter } from "@twurple/eventsub-ngrok";
import tempData from "./utility/temp.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// init auth provider
const authProvider = new AppTokenAuthProvider(
	config.twitch.client_id,
	config.twitch.client_secret
);

// init api client
const apiClient = new ApiClient({ authProvider });

export default {
	authProvider,
	apiClient,
	secret: null,

	async getSecret(): Promise<string> {
		// secret stored in instance
		if (this.secret != null) return this.secret;

		// get secret from temp file
		this.secret = (await tempData.getFromTempFile(
			"eventSubSecret"
		)) as string;

		// secret stored in temp file
		if (this.secret != null) return this.secret;

		// generate secret
		this.secret = crypto
			.randomBytes(32)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");

		// store secret in temp file
		await tempData.writeToTempFile("eventSubSecret", this.secret);

		// return new secret
		return this.secret;
	},

	async init(): Promise<EventSubHttpListener> {
		// init listener
		let listener: EventSubHttpListener;

		// get secret
		const secret = await this.getSecret();

		// dev mode (use ngrok)
		if (process.env.NODE_ENV === "development") {
			// necessary to prevent conflict errors resulting from ngrok assigning a new host name every time
			await apiClient.eventSub.deleteAllSubscriptions();

			// create listener
			listener = new EventSubHttpListener({
				apiClient,
				adapter: new NgrokAdapter(),
				secret,
				legacySecrets: false,
			});
		}

		// production (outward facing http)
		else {
			// init adapter
			const adapter = new DirectConnectionAdapter(config.webhookConfig);

			// create listener
			listener = new EventSubHttpListener({
				apiClient,
				adapter,
				secret: await this.getSecret(),
				legacySecrets: false,
			});
		}

		// start listener
		listener.start();

		return listener;
	},
};

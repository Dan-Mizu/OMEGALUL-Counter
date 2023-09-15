// imports
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { Express } from "express";
import crypto from "crypto";
import { AppTokenAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import {
	DirectConnectionAdapter,
	EventSubHttpListener,
	EventSubMiddleware,
	ReverseProxyAdapter,
} from "@twurple/eventsub-http";
import { NgrokAdapter } from "@twurple/eventsub-ngrok";
import log from "./utility/log.js";
import database from "./utility/database.js";
import utility from "./utility/utility.js";

// config
import config from "../config/config.json" assert { type: "json" };

// init auth provider (twurple)
const twurpleAuthProvider = new AppTokenAuthProvider(
	config.twitch.client_id,
	config.twitch.client_secret
);

// init api client (twurple)
const twurpleApiClient = new ApiClient({ authProvider: twurpleAuthProvider });

// api declarations
let twitchAPI: AxiosInstance = axios.create({
	baseURL: "https://api.twitch.tv/helix/",
});
let kattahAPI: AxiosInstance = axios.create({
	baseURL: "https://api.kattah.me/c/",
});
let streamElementsAPI: AxiosInstance = axios.create({
	baseURL: "https://api.streamelements.com/kappa/v2/chatstats/",
});

// twurple event listener
let listener: EventSubHttpListener | EventSubMiddleware;

// lists
let secrets: Record<string, SecretData | undefined> = {
	twitch: {},
};
let twitchUsers: { [key: string]: { username: string } } = {};

// get access token for twitch api from database or create new one
async function getTwitchAccessToken(): Promise<string> {
	// declare twitch access token refresh method
	let refreshTwitchAccessToken = async (): Promise<void> => {
		// attempt to get new access token from twitch api
		try {
			const response: AxiosResponse = await axios.post(
				"https://id.twitch.tv/oauth2/token",
				{
					client_id: config.twitch.client_id,
					client_secret: config.twitch.client_secret,
					grant_type: "client_credentials",
				}
			);

			// save response locally
			secrets.twitch.access_token = {
				token: response.data.access_token,
				expires_at: Number(response.data.expires_in) + Date.now(),
			};

			// save externally (database)
			database.setValue(
				"secrets/twitch/access_token",
				secrets.twitch.access_token
			);
		} catch (err) {
			log.error(
				"Failed Access Token Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}
	};

	// access token does not exist locally
	if (
		secrets.twitch.access_token == null ||
		secrets.twitch.access_token.token == null ||
		secrets.twitch.access_token.expires_at == null
	) {
		// check for access token in external database
		secrets.twitch.access_token = (await database.getValue(
			"secrets/twitch/access_token"
		)) as AccessToken;

		// token does not exist externally either -> refresh token
		if (
			secrets.twitch.access_token == null ||
			secrets.twitch.access_token.token == null ||
			secrets.twitch.access_token.expires_at == null
		)
			await refreshTwitchAccessToken();
	}

	// access token is expired -> refresh token
	if (secrets.twitch.access_token.expires_at < Date.now())
		await refreshTwitchAccessToken();

	// return token
	return secrets.twitch.access_token.token;
}

// get twitch user data from twitch api
async function getTwitchUserData(userID: string | number): Promise<TwitchUser> {
	// init user data
	let twitchUserData: TwitchUser;

	// attempt to get user data from twitch api
	try {
		const response: AxiosResponse = await twitchAPI.get("users", {
			params: { id: String(userID) },
			headers: {
				"Client-Id": config.twitch.client_id,
				Authorization: "Bearer " + (await getTwitchAccessToken()),
			},
		});

		// save twitch user data
		twitchUserData = response.data.data[0] as TwitchUser;
	} catch (err) {
		log.error("Failed Twitch User Retrieval:", err);
	}

	// return twitch user data
	return twitchUserData ? twitchUserData : null;
}

// get twitch username from twitch user ID
async function getTwitchUsernameFromID(
	userID: string | number
): Promise<string> {
	// user does not exist locally -> get username
	if (twitchUsers[userID] == null)
		twitchUsers[userID] = {
			username: (await getTwitchUserData(String(userID))).display_name,
		};
	// username missing -> get username
	else if (twitchUsers[userID].username == null)
		twitchUsers[userID].username = (
			await getTwitchUserData(String(userID))
		).display_name;

	// return new username
	return twitchUsers[userID].username;
}

// get current stream data of specified user from twitch api
async function getTwitchStreamData(
	userID: number | string
): Promise<TwitchStream | null> {
	// init stream data
	let data: TwitchStream;

	// attempt to get stream data
	try {
		// get response from twitch API
		const response: AxiosResponse = await twitchAPI.get("streams", {
			params: { user_id: String(userID) },
			headers: {
				"Client-Id": config.twitch.client_id,
				Authorization: "Bearer " + (await getTwitchAccessToken()),
			},
		});

		// save data from response
		data = response.data.data[0] as TwitchStream;
	} catch (err) {
		// issue getting stream data
		log.error("Failed Twitch Stream Data Retrieval:", err);
	}

	// return stream data
	return data ? data : null;
}

// get 7tv emote count data from kattah api
async function get7TVEmoteCount(
	userID: string | number,
	desiredEmote: string
): Promise<number> {
	// init emote count
	let emoteCount: number;

	// attempt to get emote count from kattah api
	try {
		const channel: KattahChannel = (
			await kattahAPI.get(await getTwitchUsernameFromID(String(userID)))
		).data;

		// save emote count (from specified emote in config)
		emoteCount = (
			utility.JSON.getObjectsFromKeyValue(
				channel.emotes,
				"emote",
				desiredEmote
			) as KattahEmote[]
		)[0].count;
	} catch (error) {
		// issue getting emote count
		log.message(error);
	}

	// return emote count
	return emoteCount ? emoteCount : null;
}

// get secret for twurple event sub from database or create new one
async function getTwurpleSecret(): Promise<string> {
	// declare twurple event secret refresh method
	let refreshTwurpleSecret = async (): Promise<void> => {
		// generate new secret (and save locally)
		secrets.twitch.event_secret = crypto
			.randomBytes(32)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");

		// save new secret externally (database)
		database.setValue(
			"secrets/twitch/event_secret",
			secrets.twitch.event_secret
		);
	};

	// twurple event secret does not exist locally
	if (secrets.twitch.event_secret == null) {
		// check for twurple event secret in external database
		secrets.twitch.event_secret = (await database.getValue(
			"secrets/twitch/event_secret"
		)) as string;

		// token does not exist externally either -> refresh token
		if (secrets.twitch.event_secret == null) await refreshTwurpleSecret();
	}

	// return token
	return secrets.twitch.event_secret;
}

// get listener for twurple event sub
async function getTwurpleEventListener(
	app?: Express
): Promise<typeof listener> {
	// init listener if not already
	if (listener == null) {
		// get secret
		const secret = await getTwurpleSecret();

		// necessary to prevent conflict errors resulting from assigning a new host name every time
		await twurpleApiClient.eventSub.deleteAllSubscriptions();

		// production (using express middleware with api)
		if (app && config.host.method === "express") {
			// create listener
			listener = new EventSubMiddleware({
				apiClient: twurpleApiClient,
				hostName: config.host.expressConfig.hostName,
				pathPrefix: "/twitch",
				secret,
				legacySecrets: false,
			});

			// apply middleware
			listener.apply(app);
		}

		// dev mode (use ngrok)
		else if (process.env.NODE_ENV === "development") {
			// create listener
			listener = new EventSubHttpListener({
				apiClient: twurpleApiClient,
				adapter: new NgrokAdapter(),
				secret,
				legacySecrets: false,
			});

			// start listener
			listener.start();
		}

		// production (outward facing http)
		else if (config.host.method === "webhook") {
			// create listener
			listener = new EventSubHttpListener({
				apiClient: twurpleApiClient,
				adapter: new DirectConnectionAdapter(config.host.webhookConfig),
				secret,
				legacySecrets: false,
			});

			// start listener
			listener.start();
		}

		// production (using reverse proxy)
		else if (config.host.method === "reverseProxy") {
			// create listener
			listener = new EventSubHttpListener({
				apiClient: twurpleApiClient,
				adapter: new ReverseProxyAdapter(
					config.host.reverseProxyConfig
				),
				secret,
				legacySecrets: false,
			});

			// start listener
			listener.start();
		}
	}

	// return event sub listener
	return listener;
}

export default {
	getStreamData: getTwitchStreamData,
	getEmoteCount: get7TVEmoteCount,
	getEventListener: getTwurpleEventListener,
};

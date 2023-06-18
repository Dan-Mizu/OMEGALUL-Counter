// imports
import axios, { AxiosInstance, AxiosResponse } from "axios";
import crypto from "crypto";
import { AppTokenAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import {
	DirectConnectionAdapter,
	EventSubHttpListener,
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

// types
interface TwitchUser {
	/** An ID that identifies the user. */
	id: string;
	/** The user’s login name. */
	login: string;
	/** The user’s display name. */
	display_name: string;
	/** The type of user. Possible values are:
	 * - admin — Twitch administrator
	 * - global_mod
	 * - staff — Twitch staff
	 * - "" — Normal user
	 */
	type: string;
	/** The type of broadcaster. Possible values are:
	 * - affiliate — An affiliate broadcaster
	 * - partner — A partner broadcaster
	 * - "" — A normal broadcaster
	 */
	broadcaster_type: string;
	/** The user’s description of their channel. */
	description: string;
	/** A URL to the user’s profile image. */
	profile_image_url: string;
	/** A URL to the user’s offline image. */
	offline_image_url: string;
	/** The number of times the user’s channel has been viewed.
	 *
	 * **NOTE**: This field has been deprecated (see [Get Users API endpoint – “view_count” deprecation](https://discuss.dev.twitch.tv/t/get-users-api-endpoint-view-count-deprecation/37777)). Any data in this field is not valid and should not be used.
	 */
	view_count: number;
	/**
	 * The user’s verified email address. The object includes this field only if the user access token includes the **user:read:email** scope.
	 *
	 *	If the request contains more than one user, only the user associated with the access token that provided consent will include an email address — the email address for all other users will be empty.
	 */
	email: string;
	/** The UTC date and time that the user’s account was created. The timestamp is in RFC3339 format. */
	created_at: string;
}
interface TwitchStream {
	/** An ID that identifies the stream. You can use this ID later to look up the video on demand (VOD). */
	id: string;
	/** The ID of the user that’s broadcasting the stream. */
	user_id: string;
	/** The user’s login name. */
	user_login: string;
	/** The user’s display name. */
	user_name: string;
	/** The ID of the category or game being played. */
	game_id: string;
	/** The name of the category or game being played. */
	game_name: string;
	/**
	 * The type of stream. Possible values are:
	 * - live
	 *
	 * If an error occurs, this field is set to an empty string.
	 */
	type: string;
	/**  The stream’s title. Is an empty string if not set. */
	title: string;
	/** The tags applied to the stream. */
	tags: string[];
	/** The number of users watching the stream. */
	viewer_count: number;
	/** The UTC date and time (in RFC3339 format) of when the broadcast began. */
	started_at: string;
	/** The language that the stream uses. This is an ISO 639-1 two-letter language code or other if the stream uses a language not in the list of [supported stream languages].(https://help.twitch.tv/s/article/languages-on-twitch#streamlang) */
	language: string;
	/** A URL to an image of a frame from the last 5 minutes of the stream. Replace the width and height placeholders in the URL (`{width}x{height}`) with the size of the image you want, in pixels. */
	thumbnail_url: string;
	/**
	 * **IMPORTANT** As of February 28, 2023, this field is deprecated and returns only an empty array. If you use this field, please update your code to use the `tags` field.
	 *
	 * The list of tags that apply to the stream. The list contains IDs only when the channel is steaming live. For a list of possible tags, see [List of All Tags](https://www.twitch.tv/directory/all/tags). The list doesn’t include Category Tags.
	 */
	tag_ids: string[];
	/** A Boolean value that indicates whether the stream is meant for mature audiences. */
	is_mature: boolean;
}
interface AccessToken {
	token: string;
	expires_at: number;
}
interface SecretData {
	access_token?: AccessToken;
	event_secret?: string;
}

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
let listener: EventSubHttpListener;

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
	if (twitchUsers[userID] == null || twitchUsers[userID].username == null)
		twitchUsers[userID].username = (
			await getTwitchUserData(String(userID))
		).login;

	// return new username
	return twitchUsers[userID].username;
}

// get current stream data of specified user from twitch api
async function getTwitchStreamData(
	userID: number | string
): Promise<TwitchStream> {
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
async function get7TVEmoteCount(userID: string | number): Promise<number> {
	// init emote count
	let emoteCount: number;

	// attempt to get emote count from kattah api
	try {
		const response: AxiosResponse = await kattahAPI.get(
			await getTwitchUsernameFromID(String(userID))
		);

		// save emote count (from specified emote in config)
		emoteCount = utility.JSON.getObjectsFromKeyValue(
			response.data.emotes,
			"emote",
			config.desiredEmote
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
async function getTwurpleEventListener(): Promise<EventSubHttpListener> {
	// init listener if not already
	if (listener == null) {
		// get secret
		const secret = await getTwurpleSecret();

		// necessary to prevent conflict errors resulting from assigning a new host name every time
		await twurpleApiClient.eventSub.deleteAllSubscriptions();

		// dev mode (use ngrok)
		if (process.env.NODE_ENV === "development") {
			// create listener
			listener = new EventSubHttpListener({
				apiClient: twurpleApiClient,
				adapter: new NgrokAdapter(),
				secret,
				legacySecrets: false,
			});
		}

		// production (outward facing http)
		else if (!config.useProxy) {
			// create listener
			listener = new EventSubHttpListener({
				apiClient: twurpleApiClient,
				adapter: new DirectConnectionAdapter(config.webhookConfig),
				secret,
				legacySecrets: false,
			});
		}

		// production (using proxy)
		else {
			// create listener
			listener = new EventSubHttpListener({
				apiClient: twurpleApiClient,
				adapter: new ReverseProxyAdapter(config.reverseProxyConfig),
				secret,
				legacySecrets: false,
			});
		}

		// start listener
		listener.start();
	}

	// return event sub listener
	return listener;
}

export default {
	getStreamData: getTwitchStreamData,
	getEmoteCount: get7TVEmoteCount,
	getEventListener: getTwurpleEventListener,
};

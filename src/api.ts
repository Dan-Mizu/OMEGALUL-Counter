// imports
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import log from "./utility/log.js";
import database from "./utility/database.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// types
interface AccessTokenData {
	token: string;
	expires_at: number;
}

export default class api {
	readonly userID: string;
	private twitchAccessToken: string;
	private twitchAccessTokenExpiration: number;
	private username: string;

	twitchAPI: AxiosInstance;
	stvAPI: AxiosInstance;
	emoteUsageAPI: AxiosInstance;

	constructor(userID: string) {
		// save user ID
		this.userID = userID;

		// create axios instances
		this.twitchAPI = axios.create({
			baseURL: "https://api.twitch.tv/helix/",
		});
		this.stvAPI = axios.create({
			baseURL: "https://7tv.io/v3/",
		});
		this.emoteUsageAPI = axios.create({
			baseURL: "https://api.kattah.me/c/",
		});
	}

	async getUsername(): Promise<string> {
		// username exists
		if (this.username) return this.username;

		// get username from twitch
		await this.getTwitchUserData(
			{ id: this.userID },
			(response: AxiosResponse) => {
				this.username = response.data.data[0].display_name;
			}
		);

		// return new username
		return this.username;
	}

	async getStreamData(): Promise<any> {
		// init stream data
		let data: any;

		// get stream data from twitch
		await this.getTwitchStreamData(
			{ user_id: this.userID },
			(response: AxiosResponse) => {
				data = response.data.data[0];
			}
		);

		// return data
		return data ? data : null;
	}

	async getTwitchAccessToken(): Promise<string> {
		// access token exists and is not expired
		if (
			this.twitchAccessToken &&
			this.twitchAccessTokenExpiration >= Date.now()
		)
			return this.twitchAccessToken;

		// get access token data from temp file
		const accessTokenData = (await database.getValue(
			"temp/access_token"
		)) as AccessTokenData;

		// check temp file
		if (accessTokenData !== null) {
			// access token found
			if (
				accessTokenData &&
				accessTokenData.token &&
				accessTokenData.expires_at
			) {
				// save expiration
				this.twitchAccessTokenExpiration = Number(
					accessTokenData.expires_at
				);

				// if not expired, set it
				if (this.twitchAccessTokenExpiration >= Date.now()) {
					// save token
					this.twitchAccessToken = accessTokenData.token;

					// save expiration
					this.twitchAccessTokenExpiration = Number(
						accessTokenData.expires_at
					);
					return this.twitchAccessToken;
				}
			}
		}

		// get new access token
		try {
			const response: AxiosResponse = await axios.post(
				"https://id.twitch.tv/oauth2/token",
				{
					client_id: config.twitch.client_id,
					client_secret: config.twitch.client_secret,
					grant_type: "client_credentials",
				}
			);

			// save token
			this.twitchAccessToken = response.data.access_token;

			// save expiration
			this.twitchAccessTokenExpiration =
				Number(response.data.expires_in) + Date.now();

			// save in temp file
			database.setValue("temp/access_token", {
				token: response.data.access_token,
				expires_at: Number(response.data.expires_in) + Date.now(),
			});
		} catch (err) {
			log.error(
				"Failed Access Token Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}

		return this.twitchAccessToken;
	}

	async getTwitchUserData(
		data: {},
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	): Promise<void> {
		try {
			// get access token
			const accessToken = await this.getTwitchAccessToken();
			const response: AxiosResponse = await this.twitchAPI.get("users", {
				params: data,
				headers: {
					"Client-Id": config.twitch.client_id,
					Authorization: "Bearer " + accessToken,
				},
			});
			success(response);
		} catch (err) {
			if (fail) fail(err);
			log.error("Failed Twitch User Retrieval:", err);
		}
	}

	async getTwitchStreamData(
		data: {},
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	): Promise<void> {
		try {
			// get access token
			const accessToken = await this.getTwitchAccessToken();
			const response: AxiosResponse = await this.twitchAPI.get(
				"streams",
				{
					params: data,
					headers: {
						"Client-Id": config.twitch.client_id,
						Authorization: "Bearer " + accessToken,
					},
				}
			);
			success(response);
		} catch (err) {
			if (fail) fail(err);
			log.error("Failed Twitch Stream Data Retrieval:", err);
		}
	}

	async get7tvData(
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	): Promise<void> {
		try {
			const response: AxiosResponse = await this.stvAPI.get(
				"users/twitch/" + this.userID
			);
			success(response);
		} catch (err) {
			if (fail) fail(err);
			log.error(
				"Failed 7TV User Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}
	}

	async getEmoteUsage(
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	): Promise<void> {
		try {
			const response: AxiosResponse = await this.emoteUsageAPI.get(
				await this.getUsername()
			);
			success(response);
		} catch (err) {
			log.error(
				"Failed Twitch User Emotes Data Retrieval:",
				err.response.status,
				err.response.statusText
			);
			if (fail) fail(err);
		}
	}
}

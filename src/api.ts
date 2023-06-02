import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import path from "path";
import fs, { promises as asyncfs } from "fs";

// get data
import config from "../config/config.json" assert { type: "json" };

export default class api {
	private twitchAccessToken: string;
	private twitchAccessTokenExpiration: number;
	readonly userID: string;
	username: string;

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

	async getUsername() {
		// username exists
		if (this.username) return;

		await this.getTwitchData(
			{ id: this.userID },
			(response: AxiosResponse) => {
				this.username = response.data.data[0].display_name;
			}
		);
	}

	async getTwitchAccessToken() {
		// access token exists and is not expired
		if (
			this.twitchAccessToken &&
			this.twitchAccessTokenExpiration >= Date.now()
		)
			return;

		// check temp file
		if (fs.existsSync(path.join(process.cwd(), "temp.json") as string)) {
			// get temp data
			const tempData = await asyncfs.readFile(
				path.join(process.cwd(), "temp.json"),
				"utf-8"
			);

			// get access token data
			const accessTokenData = JSON.parse(tempData)["access_token"];

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
					return;
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
			await asyncfs.writeFile(
				path.join(process.cwd(), "temp.json"),
				JSON.stringify({
					access_token: {
						token: response.data.access_token,
						expires_at:
							Number(response.data.expires_in) + Date.now(),
					},
				}),
				"utf-8"
			);
		} catch (err) {
			console.error(
				"Failed Access Token Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}
	}

	async getTwitchData(
		data: {},
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	) {
		// get access token (if doesn't exist or is expired)
		if (
			!this.twitchAccessToken ||
			this.twitchAccessTokenExpiration <= Date.now()
		)
			await this.getTwitchAccessToken();

		try {
			const response: AxiosResponse = await this.twitchAPI.get("users", {
				params: data,
				headers: {
					"Client-Id": config.twitch.client_id,
					Authorization: "Bearer " + this.twitchAccessToken,
				},
			});
			success(response);
		} catch (err) {
			if (fail) fail(err);
			console.error(
				"Failed Twitch User Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}
	}

	async get7tvData(
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	) {
		try {
			const response: AxiosResponse = await this.stvAPI.get(
				"users/twitch/" + this.userID
			);
			success(response);
		} catch (err) {
			if (fail) fail(err);
			console.error(
				"Failed 7TV User Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}
	}

	async getEmoteUsage(
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	) {
		// make sure username is retrieved
		if (!this.username) await this.getUsername();

		try {
			const response: AxiosResponse = await this.emoteUsageAPI.get(
				this.username
			);
			success(response);
		} catch (err) {
			console.error(
				"Failed Twitch User Emotes Data Retrieval:",
				err.response.status,
				err.response.statusText
			);
			if (fail) fail(err);
		}
	}
}

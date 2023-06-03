import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import path from "path";
import fs, { promises as asyncfs } from "fs";

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

	async getFromTempFile(key: string): Promise<any> {
		return JSON.parse(
			await asyncfs.readFile(
				path.join(process.cwd(), "temp.json"),
				"utf-8"
			)
		)[key];
	}

	async writeToTempFile(key: string, value: any): Promise<void> {
		// get temp data
		const tempData = JSON.parse(
			await asyncfs.readFile(
				path.join(process.cwd(), "temp.json"),
				"utf-8"
			)
		);

		// edit
		tempData[key] = value;

		// save
		await asyncfs.writeFile(
			path.join(process.cwd(), "temp.json"),
			JSON.stringify(tempData),
			"utf-8"
		);
	}

	async getUsername(): Promise<string> {
		// username exists
		if (this.username) return this.username;

		// get username from twitch
		await this.getTwitchData(
			{ id: this.userID },
			(response: AxiosResponse) => {
				this.username = response.data.data[0].display_name;
			}
		);

		// return new username
		return this.username;
	}

	async getTwitchAccessToken(): Promise<string> {
		// access token exists and is not expired
		if (
			this.twitchAccessToken &&
			this.twitchAccessTokenExpiration >= Date.now()
		)
			return this.twitchAccessToken;

		// check temp file
		if (fs.existsSync(path.join(process.cwd(), "temp.json") as string)) {
			// get access token data
			const accessTokenData = (await this.getFromTempFile(
				"access_token"
			)) as AccessTokenData;

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
			await this.writeToTempFile("access_token", {
				token: response.data.access_token,
				expires_at: Number(response.data.expires_in) + Date.now(),
			});
		} catch (err) {
			console.error(
				"Failed Access Token Retrieval:",
				err.response.data.status,
				err.response.data.message
			);
		}

		return this.twitchAccessToken;
	}

	async getTwitchData(
		data: {},
		success: (response: AxiosResponse) => void,
		fail?: (err: AxiosError) => void
	): Promise<void> {
		try {
			const response: AxiosResponse = await this.twitchAPI.get("users", {
				params: data,
				headers: {
					"Client-Id": config.twitch.client_id,
					Authorization:
						"Bearer " + (await this.getTwitchAccessToken()),
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
	): Promise<void> {
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
	): Promise<void> {
		try {
			const response: AxiosResponse = await this.emoteUsageAPI.get(
				await this.getUsername()
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

import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";

export default class stvAPI {
	readonly userID: string;
	api: AxiosInstance;

	constructor(userID: string) {
		// save user ID
		this.userID = userID;

		// create axios instance
		this.api = axios.create({
			baseURL: "https://7tv.io/v3/",
		});
	}

	async get(
		success: (response: AxiosResponse) => void,
		fail: (err: AxiosError) => void
	) {
		try {
			const response = await this.api.get("users/twitch/" + this.userID);
			success(response);
		} catch (err) {
			fail(err);
		}
	}
}

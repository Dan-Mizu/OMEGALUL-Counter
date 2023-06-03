// imports
import log from "./utility/log.js";
import api from "./api.js";
import { AxiosResponse } from "axios";
import utility from "./utility/utility.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// init axios
const twitchAPI = new api(config["7tvUserID"]);

// get emote data
// await twitchAPI.get7tvData(
// 	(response: AxiosResponse) => {
// 		log.message(
// 			`Twitch User ${response.data.display_name} Found: \n` +
// 				utility.JSON.stringify(
// 					utility.JSON.getObjectsFromKeyValue(
// 						response.data.emote_set.emotes,
// 						"name",
// 						config.desiredEmote
// 					)
// 				)
// 		);
// 	},
// 	(err: AxiosError) => {
// 		log.message("Twitch User NOT Found: \n" + err.message);
// 	}
// );

// get emote usage data
const twitchUsername = await twitchAPI.getUsername();
await twitchAPI.getEmoteUsage((response: AxiosResponse) => {
	log.message(
		`Twitch User ${twitchUsername} Found: \n` +
			utility.JSON.stringify(
				utility.JSON.getObjectsFromKeyValue(
					response.data.emotes,
					"emote",
					config.desiredEmote
				)
			)
	);
});

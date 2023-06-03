// imports
import { AxiosResponse } from "axios";
import api from "./api.js";
import eventSub from "./eventSub.js";
import utility from "./utility/utility.js";
import log from "./utility/log.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// init api
const twitchAPI = new api(config.twitchUserID);

// // get emote data
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

// // get emote usage data
// const twitchUsername = await twitchAPI.getUsername();
// await twitchAPI.getEmoteUsage((response: AxiosResponse) => {
// 	log.message(
// 		`Twitch User ${twitchUsername} Found: \n` +
// 			utility.JSON.stringify(
// 				utility.JSON.getObjectsFromKeyValue(
// 					response.data.emotes,
// 					"emote",
// 					config.desiredEmote
// 				)
// 			)
// 	);
// });

// get listener
const listener = await eventSub.init();

// events
const eventStreamOnline = listener.onStreamOnline(config.twitchUserID, (e) => {
	console.log(`${e.broadcasterDisplayName} just went live!`);
});
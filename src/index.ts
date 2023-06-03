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

// get current emote usage
async function getCurrentEmoteUsage(): Promise<number> {
	// const twitchUsername = await twitchAPI.getUsername();
	let emoteUsage: number;
	await twitchAPI.getEmoteUsage((response: AxiosResponse) => {
		emoteUsage = utility.JSON.getObjectsFromKeyValue(
			response.data.emotes,
			"emote",
			config.desiredEmote
		)[0].count;
	});
	return emoteUsage;
}

// get category data
async function categoryChanged(event): Promise<void> {
	// new marker
	let markerData = {
		[Date.now()]: {
			type: "category_changed",
			category: {
				id: event.categoryId,
				name: event.categoryName,
			},
			emoteCount: await getCurrentEmoteUsage(),
		},
	};

	// update previous marker with new data

	// DEBUG
	console.log(markerData);
}

// get listener
const listener = await eventSub.init();

// events
const eventStreamOnline = listener.onStreamOnline(config.twitchUserID, (e) => {
	console.log(`${e.broadcasterDisplayName} just went live!`);
});
const eventStreamOffline = listener.onStreamOffline(
	config.twitchUserID,
	(e) => {
		console.log(`${e.broadcasterDisplayName} just went offline!`);
	}
);
const eventStreamChange = listener.onChannelUpdate(
	config.twitchUserID,
	categoryChanged
);

// DEBUG
console.log(await eventStreamChange.getCliTestCommand());
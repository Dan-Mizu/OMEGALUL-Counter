// imports
import { AxiosResponse } from "axios";
import {
	EventSubStreamOnlineEvent,
	EventSubChannelUpdateEvent,
	EventSubStreamOfflineEvent,
} from "@twurple/eventsub-base";
import { HelixStream, HelixUser } from "@twurple/api/lib";
import api from "./api.js";
import eventSub from "./eventSub.js";
import utility from "./utility/utility.js";
import log from "./utility/log.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// init api
const twitchAPI = new api(config.twitchUserID);

// get current emote usage
async function getCurrentEmoteUsage(): Promise<number> {
	let emoteUsage: number;
	try {
		await twitchAPI.getEmoteUsage((response: AxiosResponse) => {
			emoteUsage = utility.JSON.getObjectsFromKeyValue(
				response.data.emotes,
				"emote",
				config.desiredEmote
			)[0].count;
		});
	} catch (error) {
		console.log(error);
		return null;
	}
	return emoteUsage;
}

async function getCurrentCategoryData(): Promise<Record<string, any>> {
	// get stream info
	let userData: HelixUser;
	try {
		userData = await eventSub.apiClient.users.getUserById(
			config.twitchUserID
		);
	} catch (error) {
		console.log(error);
	}
	let streamData: HelixStream;
	try {
		streamData = await userData.getStream();
	} catch (error) {
		console.log(error);
		return null;
	}

	// return category info
	return streamData
		? {
				id: streamData.gameId ? streamData.gameId : null,
				name: streamData.gameName ? streamData.gameName : null,
		  }
		: null;
}

// init stream data
async function streamStart(_event: EventSubStreamOnlineEvent): Promise<void> {
	// new marker
	let markerData = {
		[Date.now()]: {
			marker: {
				type: "start",
				category: await getCurrentCategoryData(),
				emoteCount: await getCurrentEmoteUsage(),
			},
		},
	};

	// DEBUG
	console.log(markerData);
}

// get category data
async function categoryChanged(
	event: EventSubChannelUpdateEvent
): Promise<void> {
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

// get stream end data
async function streamEnd(_event: EventSubStreamOfflineEvent): Promise<void> {
	// new marker
	let markerData = {
		[Date.now()]: {
			type: "end",
			category: await getCurrentCategoryData(),
			emoteCount: await getCurrentEmoteUsage(),
		},
	};

	// update stream data with final emote usage count

	// DEBUG
	console.log(markerData);
}

// get listener
const listener = await eventSub.init();

// events
const eventStreamOnline = listener.onStreamOnline(
	config.twitchUserID,
	streamStart
);
const eventStreamOffline = listener.onStreamOffline(
	config.twitchUserID,
	streamEnd
);
const eventStreamChange = listener.onChannelUpdate(
	config.twitchUserID,
	categoryChanged
);

// DEBUG
console.log(await eventStreamOnline.getCliTestCommand());
console.log(await eventStreamOffline.getCliTestCommand());
console.log(await eventStreamChange.getCliTestCommand());

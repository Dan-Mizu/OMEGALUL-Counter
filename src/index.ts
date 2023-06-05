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
import database from "./utility/database.js";

// init api
const twitchAPI = new api(config.twitchUserID);

// get current emote usage
async function getCurrentEmoteCount(): Promise<number> {
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
		log.message(error);
		return null;
	}
	return emoteUsage;
}

// get current category data
async function getCurrentCategoryData(): Promise<Record<string, any>> {
	// get stream info
	let userData: HelixUser;
	try {
		userData = await eventSub.apiClient.users.getUserById(
			config.twitchUserID
		);
	} catch (error) {
		log.message(error);
	}
	let streamData: HelixStream;
	try {
		streamData = await userData.getStream();
	} catch (error) {
		log.message(error);
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
	// push to database
	database.setValue("stream/" + [Date.now()], {
		marker: {
			[Date.now()]: {
				type: "start",
				category: await getCurrentCategoryData(),
				emoteCount: await getCurrentEmoteCount(),
			},
		},
	});
}

// get category data
async function categoryChanged(
	event: EventSubChannelUpdateEvent
): Promise<void> {
	// get current emote count
	const currentEmoteCount = await getCurrentEmoteCount();

	// get current stream key
	const currentStream = await database.getLastKey("stream/");

	// get last marker key
	const lastMarker = await database.getLastKey(
		"stream/" + currentStream + "/marker"
	);

	// get last marker's emote count
	const lastEmoteCount = await database.getValue(
		"stream/" + currentStream + "/marker/" + lastMarker + "/emoteCount"
	);

	// update previous marker
	database.updateValue("stream/" + currentStream + "/marker/" + lastMarker, {
		emoteUsage: currentEmoteCount - lastEmoteCount,
	});

	// add new marker
	database.updateValue("stream/" + currentStream + "/marker/" + Date.now(), {
		type: "category_changed",
		category: {
			id: event.categoryId,
			name: event.categoryName,
		},
		emoteCount: currentEmoteCount,
	});
}

// get stream end data
async function streamEnd(_event: EventSubStreamOfflineEvent): Promise<void> {
	// get current emote count
	const currentEmoteCount = await getCurrentEmoteCount();

	// get current stream key
	const currentStream = await database.getLastKey("stream");

	// get first marker key
	const firstMarker = await database.getFirstKey(
		"stream/" + currentStream + "/marker"
	);

	// get first marker's emote count
	const firstEmoteCount = await database.getValue(
		"stream/" + currentStream + "/marker/" + firstMarker + "/emoteCount"
	);

	// get last marker key
	const lastMarker = await database.getLastKey(
		"stream/" + currentStream + "/marker"
	);

	// get last marker's emote count
	const lastEmoteCount = await database.getValue(
		"stream/" + currentStream + "/marker/" + lastMarker + "/emoteCount"
	);

	// update total emote count for this stream
	database.updateValue("stream/" + currentStream, {
		emoteUsage: currentEmoteCount - firstEmoteCount,
	});

	// update previous marker
	database.updateValue("stream/" + currentStream + "/marker/" + lastMarker, {
		emoteUsage: currentEmoteCount - lastEmoteCount,
	});

	// add new marker
	database.updateValue("stream/" + currentStream + "/marker/" + Date.now(), {
		type: "end",
		category: await getCurrentCategoryData(),
		emoteCount: currentEmoteCount,
	});
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
log.message(await eventStreamOnline.getCliTestCommand());
log.message(await eventStreamOffline.getCliTestCommand());
log.message(await eventStreamChange.getCliTestCommand());

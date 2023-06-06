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
async function streamStart(event: EventSubStreamOnlineEvent): Promise<void> {
	// get stream
	const stream = await event.getStream();

	// push to database
	database.setValue(config.twitchUserID + "/" + stream.id, {
		marker: {
			[Date.now()]: {
				type: "start",
				category: await getCurrentCategoryData(),
				emoteCount: await getCurrentEmoteCount(),
			},
		},
	});

	// log
	log.message("[" + stream.id + '] Stream "' + stream.title + '" started.');
}

// get category data
async function categoryChanged(
	event: EventSubChannelUpdateEvent
): Promise<void> {
	// get stream
	const stream = await (await event.getBroadcaster()).getStream();

	// no stream found
	if (!stream) return;

	// get stream ID
	const streamID = stream.id;

	// get last marker key (either stream start or a category change)
	const lastMarker = await database.getLastKey(
		config.twitchUserID + "/" + streamID + "/marker"
	);

	// last marker is missing (aka no stream start), then cancel
	if (!lastMarker) return;

	// get last marker's emote count (either stream start or a category change)
	const lastEmoteCount = await database.getValue(
		config.twitchUserID +
			"/" +
			streamID +
			"/marker/" +
			lastMarker +
			"/emoteCount"
	);

	// get current emote count
	const currentEmoteCount = await getCurrentEmoteCount();

	// update previous marker
	database.updateValue(
		config.twitchUserID + "/" + streamID + "/marker/" + lastMarker,
		{
			emoteUsage: currentEmoteCount - lastEmoteCount,
		}
	);

	// add new marker
	database.updateValue(
		config.twitchUserID + "/" + streamID + "/marker/" + Date.now(),
		{
			type: "category_changed",
			category: {
				id: event.categoryId,
				name: event.categoryName,
			},
			emoteCount: currentEmoteCount,
		}
	);

	// log
	log.message(
		"[" +
			stream.id +
			'] Stream "' +
			stream.title +
			'" category changed to ' +
			event.categoryName
	);
}

// get stream end data
async function streamEnd(event: EventSubStreamOfflineEvent): Promise<void> {
	// get stream
	const stream = await (await event.getBroadcaster()).getStream();

	// no stream found
	if (!stream) return;

	// get first marker key (stream start marker)
	const firstMarker = await database.getFirstKey(
		config.twitchUserID + "/" + stream.id + "/marker"
	);

	// get first marker's emote count (stream start marker)
	const firstEmoteCount = await database.getValue(
		config.twitchUserID +
			"/" +
			stream.id +
			"/marker/" +
			firstMarker +
			"/emoteCount"
	);

	// get last marker key (either stream start or a category change)
	const lastMarker = await database.getLastKey(
		config.twitchUserID + "/" + stream.id + "/marker"
	);

	// get last marker's emote count (either stream start or a category change)
	const lastEmoteCount = await database.getValue(
		config.twitchUserID +
			"/" +
			stream.id +
			"/marker/" +
			lastMarker +
			"/emoteCount"
	);

	// get current emote count
	const currentEmoteCount = await getCurrentEmoteCount();

	// update total emote count for this stream
	database.updateValue(config.twitchUserID + "/" + stream.id, {
		emoteUsage: currentEmoteCount - firstEmoteCount,
	});

	// update previous marker with stream information and total emote usage
	database.updateValue(
		config.twitchUserID + "/" + stream.id + "/marker/" + lastMarker,
		{
			title: stream.title,
			thumbnail: stream.thumbnailUrl,
			startDate: stream.startDate,
			viewers: stream.viewers,
			emoteUsage: currentEmoteCount - lastEmoteCount,
		}
	);

	// add new marker
	database.updateValue(
		config.twitchUserID + "/" + stream.id + "/marker/" + Date.now(),
		{
			type: "end",
			category: await getCurrentCategoryData(),
			emoteCount: currentEmoteCount,
		}
	);

	// log
	log.message(
		"[" +
			stream.id +
			'] Stream "' +
			stream.title +
			'" ended. Total Counted Emotes: ' +
			(currentEmoteCount - firstEmoteCount)
	);
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
log.debug(await eventStreamOnline.getCliTestCommand());
log.debug(await eventStreamOffline.getCliTestCommand());
log.debug(await eventStreamChange.getCliTestCommand());

// Notify start
log.info("Emote Counter initialized.");

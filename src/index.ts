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
import temp from "./utility/temp.js";

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

// // init stream data
// async function streamStart(event: EventSubStreamOnlineEvent): Promise<void> {
// 	// get stream
// 	const stream = await event.getStream();

// 	// push to database
// 	database.setValue(config.twitchUserID + "/" + stream.id, {
// 		marker: {
// 			[Date.now()]: {
// 				type: "start",
// 				category: await getCurrentCategoryData(),
// 				emoteCount: await getCurrentEmoteCount(),
// 			},
// 		},
// 	});

// 	// log
// 	log.message("[" + stream.id + '] Stream "' + stream.title + '" started.');
// }

// // get category data
// async function categoryChanged(
// 	event: EventSubChannelUpdateEvent
// ): Promise<void> {
// 	// get stream
// 	const stream = await (await event.getBroadcaster()).getStream();

// 	// no stream found
// 	if (!stream) return;

// 	// get stream ID
// 	const streamID = stream.id;

// 	// get last marker key (either stream start or a category change)
// 	const lastMarker = await database.getLastKey(
// 		config.twitchUserID + "/" + streamID + "/marker"
// 	);

// 	// last marker is missing (aka no stream start), then cancel
// 	if (!lastMarker) return;

// 	// get last marker's emote count (either stream start or a category change)
// 	const lastEmoteCount = await database.getValue(
// 		config.twitchUserID +
// 			"/" +
// 			streamID +
// 			"/marker/" +
// 			lastMarker +
// 			"/emoteCount"
// 	);

// 	// get current emote count
// 	const currentEmoteCount = await getCurrentEmoteCount();

// 	// update previous marker
// 	database.updateValue(
// 		config.twitchUserID + "/" + streamID + "/marker/" + lastMarker,
// 		{
// 			emoteUsage: currentEmoteCount - lastEmoteCount,
// 		}
// 	);

// 	// add new marker
// 	database.updateValue(
// 		config.twitchUserID + "/" + streamID + "/marker/" + Date.now(),
// 		{
// 			type: "category_changed",
// 			category: {
// 				id: event.categoryId,
// 				name: event.categoryName,
// 			},
// 			emoteCount: currentEmoteCount,
// 		}
// 	);

// 	// log
// 	log.message(
// 		"[" +
// 			stream.id +
// 			'] Stream "' +
// 			stream.title +
// 			'" category changed to ' +
// 			event.categoryName
// 	);
// }

// // get stream end data
// async function streamEnd(streamData?: {
// 	id: string;
// 	title: string;
// 	viewer_count: number;
// 	started_at: Date;
// }): Promise<void> {
// 	// get stream data
// 	if (!streamData) {
// 		// query stream data
// 		const queryData = await eventSub.apiClient.streams.getStreamByUserId(
// 			config.twitchUserID
// 		);

// 		// reformat data
// 		streamData = {
// 			id: queryData.id,
// 			title: queryData.title,
// 			viewer_count: queryData.viewers,
// 			started_at: queryData.startDate,
// 		};
// 	}

// 	// get first marker key (stream start marker)
// 	const firstMarker = await database.getFirstKey(
// 		config.twitchUserID + "/" + streamData.id + "/marker"
// 	);

// 	// get first marker's emote count (stream start marker)
// 	const firstEmoteCount = await database.getValue(
// 		config.twitchUserID +
// 			"/" +
// 			streamData.id +
// 			"/marker/" +
// 			firstMarker +
// 			"/emoteCount"
// 	);

// 	// get last marker key (either stream start or a category change)
// 	const lastMarker = await database.getLastKey(
// 		config.twitchUserID + "/" + streamData.id + "/marker"
// 	);

// 	// get last marker's emote count (either stream start or a category change)
// 	const lastEmoteCount = await database.getValue(
// 		config.twitchUserID +
// 			"/" +
// 			streamData.id +
// 			"/marker/" +
// 			lastMarker +
// 			"/emoteCount"
// 	);

// 	// get current emote count
// 	const currentEmoteCount = await getCurrentEmoteCount();

// 	// update total emote count for this stream
// 	database.updateValue(config.twitchUserID + "/" + streamData.id, {
// 		emoteUsage: currentEmoteCount - firstEmoteCount,
// 	});

// 	// update previous marker with stream information and total emote usage
// 	database.updateValue(
// 		config.twitchUserID + "/" + streamData.id + "/marker/" + lastMarker,
// 		{
// 			title: streamData.title,
// 			startDate: streamData.started_at.getTime(),
// 			viewers: streamData.viewer_count,
// 			emoteUsage: currentEmoteCount - lastEmoteCount,
// 			emotePerHour:
// 				(currentEmoteCount - lastEmoteCount) /
// 				((Date.now() - firstMarker) / (60 * 60 * 1000)), // total emote usage / millisecond difference converted to hours
// 		}
// 	);

// 	// add new marker
// 	database.updateValue(
// 		config.twitchUserID + "/" + streamData.id + "/marker/" + Date.now(),
// 		{
// 			type: "end",
// 			category: await getCurrentCategoryData(),
// 			emoteCount: currentEmoteCount,
// 		}
// 	);

// 	// log
// 	log.message(
// 		"[" +
// 			streamData.id +
// 			'] Stream "' +
// 			streamData.title +
// 			'" ended. Total Counted Emotes: ' +
// 			(currentEmoteCount - firstEmoteCount)
// 	);
// }

// update stream data
async function updateStreamData(
	streamUpdate?:
		| {
				type: "start";
				id: string;
				started_at: Date;
		  }
		| {
				type: "end";
		  }
		| {
				type: "category_changed";
				category_id: string;
				category_name: string;
		  }
) {
	// get local stream data
	let localStreamData = await temp.getFromTempFile("stream")[
		config.twitchUserID
	];

	// query stream data from twitch api
	const queriedStreamData =
		await eventSub.apiClient.streams.getStreamByUserId(config.twitchUserID);

	// compare provided stream data against local stream data
	if (streamUpdate && localStreamData) {
		// stream start event and local data mean there was an issue
		if (streamUpdate.type === "start") {
			// local and event stream ID don't match (restarted stream: end old stream, create new stream)
			if (localStreamData.id !== streamUpdate.id) {
			}
			// local and event stream ID match. routine query caught stream start event first LOL (ignore)
			else return;
		}

		// use local stream data with category change event update
		else if (streamUpdate.type === "category_changed") {
		}

		// compare local and queried stream data for a representation of what happened
		else if (streamUpdate.type === "end") {
			// queried stream data acquired
			if (queriedStreamData) {
				// local and queried stream data match (end stream)
				if (localStreamData.id === queriedStreamData.id) {
				}

				// local and queried stream id do not match (restarted stream: end old stream, create new stream)
				else {
				}
			}

			// no queried data found, go with local state (end stream)
			else {
			}
		}
	}

	// provided stream data but no local stream data found (start stream)
	else if (streamUpdate && !localStreamData) {
		// start stream event caught before my routine query did! (start stream)
		if (streamUpdate.type === "start") {
		}

		// streamer probably changed category before starting stream. typical. (ignore)
		else if (streamUpdate.type === "category_changed") {
			return;
		}

		// crap. stream is ending and I don't even have a reference to the ID. hopefully there was a successful query (end stream)
		else if (streamUpdate.type === "end" && queriedStreamData) {
		}

		// welp. stream is ending without a proper reference to the stream ID. last resort is to check the database.
		else {
			// check for last stream in database without end marker

			// shit. an end event without a stream to pin it to. this can't be good... (ignore)
			return;
		}
	}

	// no provided stream data, but local stream data found (check for updates or end stream)
	else if (!streamUpdate && localStreamData) {
		// check for stream data update
		if (queriedStreamData) {
			// get all local stream data
			let allLocalStreamData = await temp.getFromTempFile("stream")[
				config.twitchUserID
			];

			// update local stream data
			allLocalStreamData[config.twitchUserID] = {
				id: localStreamData.id,
				// new category info?
				game_id: queriedStreamData.gameId,
				game_name: queriedStreamData.gameName,
				// new title?
				title: queriedStreamData.title,
				// keep largest viewer count
				viewer_count:
					queriedStreamData.viewers > localStreamData.viewer_count
						? queriedStreamData.viewers
						: localStreamData.viewer_count,
				started_at: localStreamData.startDate,
			};

			// store updated local stream data
			temp.writeToTempFile("stream", allLocalStreamData);
		}

		// no queried stream data found (end stream)
		else {
			// get current emote count
			const currentEmoteCount = await getCurrentEmoteCount();

			// add new marker
			database.updateValue(
				config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker/" +
					Date.now(),
				{
					type: "end",
					category: {
						id: localStreamData.category_id,
						name: localStreamData.category_name,
					},
					emoteCount: currentEmoteCount,
				}
			);

			// get last marker key (either stream start or a category change)
			const lastMarker = await database.getLastKey(
				config.twitchUserID + "/" + localStreamData.id + "/marker"
			);

			// get last marker's emote count (either stream start or a category change)
			const lastEmoteCount = await database.getValue(
				config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker/" +
					lastMarker +
					"/emoteCount"
			);

			// update previous marker with total emote usage
			database.updateValue(
				config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker/" +
					lastMarker,
				{
					emoteUsage: currentEmoteCount - lastEmoteCount,
				}
			);

			// get first marker key (stream start marker)
			const firstMarker = await database.getFirstKey(
				config.twitchUserID + "/" + localStreamData.id + "/marker"
			);

			// get first marker's emote count (stream start marker)
			const firstEmoteCount = await database.getValue(
				config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker/" +
					firstMarker +
					"/emoteCount"
			);

			// update stream info
			database.updateValue(
				config.twitchUserID + "/" + localStreamData.id,
				{
					title: localStreamData.title,
					startDate: localStreamData.started_at,
					viewers: localStreamData.viewer_count,
					// total emote usage
					emoteUsage: currentEmoteCount - firstEmoteCount,
					// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
					emotePerHour:
						(currentEmoteCount - firstEmoteCount) /
						((Date.now() - firstMarker) / (60 * 60 * 1000)),
				}
			);
		}
	}

	// no provided or local stream data found but queried stream data found (create local stream data and start stream)
	else if (!streamUpdate && !localStreamData && queriedStreamData) {
		// format local stream data
		const streamData = {
			[config.twitchUserID]: {
				id: queriedStreamData.id,
				game_id: queriedStreamData.gameId,
				game_name: queriedStreamData.gameName,
				title: queriedStreamData.title,
				viewer_count: queriedStreamData.viewers,
				started_at: queriedStreamData.startDate,
			},
		};

		// store local stream data
		temp.writeToTempFile("stream", streamData);

		// store stream info and marker
		database.setValue(config.twitchUserID + "/" + queriedStreamData.id, {
			title: queriedStreamData.title,
			startDate: queriedStreamData.startDate,
			viewers: queriedStreamData.viewers,
			marker: {
				[Date.now()]: {
					type: "start",
					category: {
						id: queriedStreamData.gameId,
						name: queriedStreamData.gameName,
					},
					emoteCount: await getCurrentEmoteCount(),
				},
			},
		});

		// log
		log.message(
			"[" +
				queriedStreamData.id +
				'] Stream "' +
				queriedStreamData.title +
				'" started.'
		);
	}

	// no provided stream data, local stream data, or queried stream data? 🏖️🐎 MAN (ignore)
	else if (!streamUpdate && !localStreamData && !queriedStreamData) return;
}

// get listener
const listener = await eventSub.init();

// events
const eventStreamOnline = listener.onStreamOnline(
	config.twitchUserID,
	(event: EventSubStreamOnlineEvent) =>
		updateStreamData({
			type: "start",
			id: event.id,
			started_at: event.startDate,
		})
);
const eventStreamOffline = listener.onStreamOffline(
	config.twitchUserID,
	() => (_event: EventSubStreamOfflineEvent) =>
		updateStreamData({
			type: "end",
		})
);
const eventStreamChange = listener.onChannelUpdate(
	config.twitchUserID,
	(event: EventSubChannelUpdateEvent) =>
		updateStreamData({
			type: "category_changed",
			category_id: event.categoryId,
			category_name: event.categoryName,
		})
);

// DEBUG
log.debug(await eventStreamOnline.getCliTestCommand());
log.debug(await eventStreamOffline.getCliTestCommand());
log.debug(await eventStreamChange.getCliTestCommand());

// Notify start
log.info("Emote Counter initialized.");

// query for stream data every 5 minutes
setInterval(async () => updateStreamData, 5 * 60 * 1000);

// query on startup
updateStreamData();

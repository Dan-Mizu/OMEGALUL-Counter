// imports
import {
	EventSubStreamOnlineEvent,
	EventSubChannelUpdateEvent,
	EventSubStreamOfflineEvent,
} from "@twurple/eventsub-base";
import api, { TwitchStream } from "./api.js";
import log from "./utility/log.js";
import database from "./utility/database.js";

// get data
import config from "../config/config.json" assert { type: "json" };

// types
interface SimpleTwitchStream {
	/** An ID that identifies the stream. You can use this ID later to look up the video on demand (VOD). */
	id: string;
	/** The ID of the category or game being played. */
	game_id: string;
	/** The name of the category or game being played. */
	game_name: string;
	/** The stream’s title. Is an empty string if not set. */
	title: string;
	/** The number of users watching the stream. */
	viewer_count: number;
}

// start stream
async function streamStarted(streamData: TwitchStream): Promise<void> {
	// get current emote count
	const currentEmoteCount = await api.getEmoteCount(config.twitchUserID);

	// format and store local stream data
	database.setValue("temp/stream/" + config.twitchUserID, {
		id: streamData.id,
		game_id: streamData.game_id,
		game_name: streamData.game_name,
		title: streamData.title,
		viewer_count: streamData.viewer_count,
	} as SimpleTwitchStream);

	// store stream info and marker
	database.setValue("stream/" + config.twitchUserID + "/" + streamData.id, {
		// starting title
		title: streamData.title,
		// starting viewers
		viewers: streamData.viewer_count,
		// start time in RFC3339 format
		started_at: streamData.started_at
			? streamData.started_at
			: new Date().toISOString(),
		// start marker
		marker: {
			[Date.now()]: {
				// marker type
				type: "start",
				// current category data
				category: {
					id: streamData.game_id,
					name: streamData.game_name,
				},
				// current title
				title: streamData.title,
				// category start time in RFC3339 format
				started_at: streamData.started_at
					? streamData.started_at
					: new Date().toISOString(),
				// current emote count
				emoteCount: currentEmoteCount,
			},
		},
	});

	// log
	log.message(
		"[" + streamData.id + "]",
		'Stream "' + streamData.title + '" started.'
	);
}

// change category
async function streamChanged(
	streamData: SimpleTwitchStream,
	failure: (message: string) => void
): Promise<void> {
	// get last marker key (either stream start or a category change)
	const lastMarker: string = await database.getLastKey(
		"stream/" + config.twitchUserID + "/" + streamData.id + "/marker"
	);

	// last marker is missing (aka no stream start), then cancel
	if (!lastMarker) {
		failure(
			"Received Category Change Event, but have no record of a stream starting."
		);
		return;
	}

	// check if category actually changed from last marker
	if (
		streamData.game_id ==
		(await database.getValue(
			"stream/" +
				config.twitchUserID +
				"/" +
				streamData.id +
				"/marker" +
				lastMarker +
				"category/id"
		))
	) {
		failure(
			"Received Category Change Event, but the last marker is the same category!"
		);
		return;
	}

	// get last marker's emote count (either stream start or a category change)
	const lastEmoteCount: number = await database.getValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			lastMarker +
			"/emoteCount"
	);

	// get current emote count
	const currentEmoteCount = await api.getEmoteCount(config.twitchUserID);

	// update previous marker
	database.updateValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			lastMarker,
		{
			emoteUsage: currentEmoteCount - lastEmoteCount,
		}
	);

	// add new marker
	database.updateValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			Date.now(),
		{
			// marker type
			type: "category_changed",
			// current category data
			category: {
				id: streamData.game_id,
				name: streamData.game_name,
			},
			// current title
			title: streamData.title,
			// category start time in RFC3339 format
			started_at: new Date().toISOString(),
			// current emote count
			emoteCount: currentEmoteCount,
		}
	);

	// update stream info
	database.updateValue(
		"stream/" + config.twitchUserID + "/" + streamData.id,
		{
			// current title
			title: streamData.title,
			// current highest view count in stream
			viewers: streamData.viewer_count,
		}
	);

	// log
	log.message(
		"[" + streamData.id + "]",
		'Stream "' + streamData.title + '"',
		"category changed to " + streamData.game_name
	);
}

// end stream
async function streamEnded(
	streamData: SimpleTwitchStream,
	failure: (message: string) => void
) {
	// get last marker key (either stream start or a category change)
	const lastMarker: string = await database.getLastKey(
		"stream/" + config.twitchUserID + "/" + streamData.id + "/marker"
	);

	// last marker is missing (aka no stream start), then cancel
	if (!lastMarker) {
		failure(
			"Received End Stream Event, but have no record of a stream starting."
		);
		return;
	}

	// get last marker's emote count (either stream start or a category change)
	const lastEmoteCount = await database.getValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			lastMarker +
			"/emoteCount"
	);

	// get current emote count
	const currentEmoteCount = await api.getEmoteCount(config.twitchUserID);

	// update previous marker with total emote usage
	database.updateValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			lastMarker,
		{
			emoteUsage: currentEmoteCount - lastEmoteCount,
		}
	);

	// end marker
	database.updateValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			Date.now(),
		{
			// marker type
			type: "end",
			// current category data
			category: {
				id: streamData.game_id,
				name: streamData.game_name,
			},
			// current title
			title: streamData.title,
			// category start time in RFC3339 format
			started_at: new Date().toISOString(),
			// current emote count
			emoteCount: currentEmoteCount,
		}
	);

	// get first marker key (stream start marker)
	const firstMarker: string = await database.getFirstKey(
		"stream/" + config.twitchUserID + "/" + streamData.id + "/marker"
	);

	// get first marker's emote count (stream start marker)
	const firstEmoteCount: number = await database.getValue(
		"stream/" +
			config.twitchUserID +
			"/" +
			streamData.id +
			"/marker/" +
			firstMarker +
			"/emoteCount"
	);

	// update stream info
	database.updateValue(
		"stream/" + config.twitchUserID + "/" + streamData.id,
		{
			// ending title
			title: streamData.title,
			// highest view count in stream
			viewers: streamData.viewer_count,
			// end time in RFC3339 format
			ended_at: new Date().toISOString(),
			// uptime in hours
			uptime: (Date.now() - Number(firstMarker)) / (60 * 60 * 1000),
			// total emote usage
			emoteUsage: currentEmoteCount - firstEmoteCount,
			// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
			emotePerHour:
				(currentEmoteCount - firstEmoteCount) /
				((Date.now() - Number(firstMarker)) / (60 * 60 * 1000)),
		}
	);

	// clear local stream data
	database.deletePath("temp/stream/" + config.twitchUserID);

	// log
	log.message(
		"[" + streamData.id + "]",
		'Stream "' + streamData.title + '" ended',
		"Total Counted Emotes:",
		currentEmoteCount - firstEmoteCount,
		"Uptime:",
		(Date.now() - Number(firstMarker)) / (60 * 60 * 1000),
		"hours"
	);
}

// check for other new changes in the stream
async function streamUpdate(
	newStreamData: TwitchStream,
	oldStreamData: SimpleTwitchStream,
	failure: (message: string) => void
) {
	// store updated stream data
	database.setValue("temp/stream/" + config.twitchUserID, {
		id: oldStreamData.id,
		// new category info?
		game_id: newStreamData.game_id,
		game_name: newStreamData.game_name,
		// new title?
		title: newStreamData.title,
		// keep largest viewer count
		viewer_count:
			newStreamData.viewer_count > oldStreamData.viewer_count
				? newStreamData.viewer_count
				: oldStreamData.viewer_count,
	});

	// new stream ID? (end old stream and start new stream)
	if (newStreamData.id !== oldStreamData.id) {
		// end previous stream
		streamEnded(oldStreamData, failure);

		// start new stream
		streamStarted(newStreamData);
	}

	// new category? update database with new category marker
	else if (newStreamData.game_id !== oldStreamData.game_id)
		// stream changed
		streamChanged(
			{
				id: oldStreamData.id,
				game_id: newStreamData.game_id,
				game_name: newStreamData.game_name,
				title: oldStreamData.title,
				viewer_count: oldStreamData.viewer_count,
			},
			failure
		);
}

// update stream data
async function updateStreamData(
	providedStreamData?:
		| {
				type: "start";
				id: string;
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
	let savedStreamData: SimpleTwitchStream = await database.getValue(
		"temp/stream/" + config.twitchUserID
	);

	// query stream data from twitch api
	const queriedStreamData = await api.getStreamData(config.twitchUserID);

	// declare debug callback
	const logFailure = (message: string) => {
		// log
		log.warn(
			message,
			"Provided Data: " + JSON.stringify(providedStreamData),
			"Local Data: " + JSON.stringify(savedStreamData),
			"Queried Data " + JSON.stringify(queriedStreamData)
		);
		return;
	};

	// ignore if provided category ID matches current saved stream state's category ID
	if (
		providedStreamData.type === "category_changed" &&
		providedStreamData.category_id === savedStreamData.game_id
	) {
		logFailure(
			"Received Category Change event, but the new category is the same as the current saved stream state's category!"
		);
		return;
	}

	// compare provided stream data against local stream data
	if (providedStreamData && savedStreamData) {
		// stream start event and local data means my routine query caught it first, or there was a restart
		if (providedStreamData.type === "start") {
			// local and event stream ID don't match (restarted stream: end old stream, create new stream)
			if (savedStreamData.id !== providedStreamData.id) {
				// queried stream data acquired
				if (queriedStreamData) {
					// end previous stream
					streamEnded(savedStreamData, logFailure);

					// start new stream
					streamStarted(queriedStreamData);
				}
				// stream start event where theres local and provided data, but no queried data? wtf? (ignore)
				else
					logFailure(
						"Received Stream Start Event and have local and provided data, but wasn't able to get any data from Twitch API."
					);
			}
			// local and event stream ID match. routine query caught stream start event first LOL (ignore)
			else
				logFailure(
					"Received Stream Start Event, but already caught event with routine query."
				);
		}

		// use local stream data with category change event update (might overlap if routine query caught it first... hmm...)
		else if (providedStreamData.type === "category_changed") {
			// queried stream data acquired (change stream category)
			if (queriedStreamData)
				streamChanged(
					{
						id: savedStreamData.id,
						game_id: queriedStreamData.game_id,
						game_name: queriedStreamData.game_name,
						title: savedStreamData.title,
						viewer_count: savedStreamData.viewer_count,
					},
					logFailure
				);
			// a category change near/after the stream ended or before it began. either way its weird. (ignore)
			else
				logFailure(
					"Received Category Change Event, but there does not seem to be an active stream."
				);
		}

		// compare local and queried stream data for a representation of what happened
		else if (providedStreamData.type === "end") {
			// queried stream data acquired
			if (queriedStreamData) {
				// local and queried stream data match (end stream)
				if (savedStreamData.id === queriedStreamData.id)
					streamEnded(
						{
							id: savedStreamData.id,
							game_id: savedStreamData.game_id,
							game_name: savedStreamData.game_name,
							title: queriedStreamData.title,
							viewer_count: savedStreamData.viewer_count,
						},
						logFailure
					);
				// local and queried stream id do not match (restarted stream: end old stream, create new stream)
				else {
					// end previous stream
					streamEnded(savedStreamData, logFailure);

					// start new stream
					streamStarted(queriedStreamData);
				}
			}

			// no queried data found, go with local state (end stream)
			else streamEnded(savedStreamData, logFailure);
		}
	}

	// provided stream data but no local stream data found (start stream)
	else if (providedStreamData && !savedStreamData) {
		// start stream event with queried stream data, caught before routine query did (start stream)
		if (providedStreamData.type === "start" && queriedStreamData)
			streamStarted(queriedStreamData);
		// streamer probably changed category before starting stream. typical. (ignore)
		else if (providedStreamData.type === "category_changed")
			logFailure(savedStreamData);
		// crap. stream is ending and I don't even have a reference to the ID. hopefully there was a successful query (end stream)
		else if (providedStreamData.type === "end" && queriedStreamData)
			streamEnded(queriedStreamData, logFailure);
		// welp. stream is ending without a proper reference to the stream ID. last resort is to check the database.
		else {
			// check for last stream in database without end marker

			// shit. an end event without a stream to pin it to. this can't be good... (ignore)

			// log
			logFailure(
				"Received End Event, but have no record of current stream."
			);
		}
	}

	// no provided stream data, but local stream data found (check for updates or end stream)
	else if (!providedStreamData && savedStreamData) {
		// check for stream data update
		if (queriedStreamData)
			streamUpdate(queriedStreamData, savedStreamData, logFailure);
		// no queried stream data found (end stream)
		else streamEnded(savedStreamData, logFailure);
	}

	// no provided or local stream data found but queried stream data found (create local stream data and start stream)
	else if (!providedStreamData && !savedStreamData && queriedStreamData)
		streamStarted(queriedStreamData);
	// no provided stream data, local stream data, or queried stream data? 🏖️🐎 MAN (ignore, and wait for streamer to go live SAJ)
	else if (!providedStreamData && !savedStreamData && !queriedStreamData)
		return;
}

// events
const eventStreamOnline = (await api.getEventListener()).onStreamOnline(
	config.twitchUserID,
	(event: EventSubStreamOnlineEvent) =>
		updateStreamData({
			type: "start",
			id: event.id,
		})
);
const eventStreamOffline = (await api.getEventListener()).onStreamOffline(
	config.twitchUserID,
	() => (_event: EventSubStreamOfflineEvent) =>
		updateStreamData({
			type: "end",
		})
);
const eventStreamChange = (await api.getEventListener()).onChannelUpdate(
	config.twitchUserID,
	(event: EventSubChannelUpdateEvent) =>
		updateStreamData({
			type: "category_changed",
			category_id: event.categoryId,
			category_name: event.categoryName,
		})
);

// DEBUG
// log.debug(await eventStreamOnline.getCliTestCommand());
// log.debug(await eventStreamOffline.getCliTestCommand());
// log.debug(await eventStreamChange.getCliTestCommand());

// Notify start
log.info("Emote Counter initialized.");

// query for stream data every 5 minutes
setInterval(updateStreamData, 5 * 60 * 1000);

// query on startup
updateStreamData();

// imports
import { AxiosResponse } from "axios";
import {
	EventSubStreamOnlineEvent,
	EventSubChannelUpdateEvent,
	EventSubStreamOfflineEvent,
} from "@twurple/eventsub-base";
import api from "./api.js";
import eventSub from "./eventSub.js";
import utility from "./utility/utility.js";
import log from "./utility/log.js";
import database from "./utility/database.js";

// get data
import config from "../config/config.json" assert { type: "json" };

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
	let localStreamData = await database.getValue(
		"temp/stream/" + config.twitchUserID
	);

	// query stream data from twitch api
	const queriedStreamData = await twitchAPI.getStreamData();

	// // DEBUG
	// log.warn(
	// 	"Provided Data: " + JSON.stringify(providedStreamData),
	// 	"Local Data: " + JSON.stringify(localStreamData),
	// 	"Queried Data " + JSON.stringify(queriedStreamData)
	// );

	// compare provided stream data against local stream data
	if (providedStreamData && localStreamData) {
		// stream start event and local data means my routine query caught it first, or there was a restart
		if (providedStreamData.type === "start") {
			// local and event stream ID don't match (restarted stream: end old stream, create new stream)
			if (localStreamData.id !== providedStreamData.id) {
				// queried stream data acquired
				if (queriedStreamData) {
					// END STREAM

					// get current emote count
					const currentEmoteCount = await getCurrentEmoteCount();

					// get last marker key (either stream start or a category change)
					const lastMarker = await database.getLastKey(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker"
					);

					// get last marker's emote count (either stream start or a category change)
					const lastEmoteCount = await database.getValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker/" +
							lastMarker +
							"/emoteCount"
					);

					// update previous marker with total emote usage
					database.updateValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
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
							localStreamData.id +
							"/marker/" +
							Date.now(),
						{
							type: "end",
							category: {
								id: localStreamData.game_id,
								name: localStreamData.game_name,
							},
							emoteCount: currentEmoteCount,
						}
					);

					// get first marker key (stream start marker)
					const firstMarker = await database.getFirstKey(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker"
					);

					// get first marker's emote count (stream start marker)
					const firstEmoteCount = await database.getValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker/" +
							firstMarker +
							"/emoteCount"
					);

					// update stream info
					database.updateValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id,
						{
							title: localStreamData.title,
							viewers: localStreamData.viewer_count,
							// total emote usage
							emoteUsage: currentEmoteCount - firstEmoteCount,
							// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
							emotePerHour:
								(currentEmoteCount - firstEmoteCount) /
								((Date.now() - firstMarker) / (60 * 60 * 1000)),
						}
					);

					// clear local stream data
					database.deletePath("temp/stream/" + config.twitchUserID);

					// log
					log.message(
						"[" + localStreamData.id + "]",
						'Stream "' + localStreamData.title + '" ended',
						"Total Counted Emotes:",
						currentEmoteCount - firstEmoteCount,
						"Uptime:",
						(Date.now() - firstMarker) / (60 * 60 * 1000),
						"hours"
					);

					// START STREAM

					// format and store local stream data
					database.setValue("temp/stream/" + config.twitchUserID, {
						id: queriedStreamData.id,
						game_id: queriedStreamData.game_id,
						game_name: queriedStreamData.game_name,
						title: queriedStreamData.title,
						viewer_count: queriedStreamData.viewer_count,
					});

					// store stream info and marker
					database.setValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							queriedStreamData.id,
						{
							title: queriedStreamData.title,
							viewers: queriedStreamData.viewer_count,
							marker: {
								[Date.now()]: {
									type: "start",
									category: {
										id: queriedStreamData.game_id,
										name: queriedStreamData.game_name,
									},
									emoteCount: currentEmoteCount,
								},
							},
						}
					);

					// log
					log.message(
						"[" + queriedStreamData.id + "]",
						'Stream "' + queriedStreamData.title + '" started.'
					);
				}
				// stream start event where theres local and provided data, but no queried data? wtf? (ignore)
				else {
					// log
					log.warn(
						"Received Stream Start Event and have local and provided data, but wasn't able to get any data from Twitch API.",
						"Provided Data: " + JSON.stringify(providedStreamData),
						"Local Data: " + JSON.stringify(localStreamData),
						"Queried Data " + JSON.stringify(queriedStreamData)
					);
					return;
				}
			}
			// local and event stream ID match. routine query caught stream start event first LOL (ignore)
			else {
				// log
				log.warn(
					"Received Stream Start Event, but already caught event with routine query.",
					"Provided Data: " + JSON.stringify(providedStreamData),
					"Local Data: " + JSON.stringify(localStreamData),
					"Queried Data " + JSON.stringify(queriedStreamData)
				);
				return;
			}
		}

		// use local stream data with category change event update (might overlap if routine query caught it first... hmm...)
		else if (providedStreamData.type === "category_changed") {
			// queried stream data acquired
			if (queriedStreamData) {
				// get last marker key (either stream start or a category change)
				const lastMarker = await database.getLastKey(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker"
				);

				// last marker is missing (aka no stream start), then cancel
				if (!lastMarker) {
					// log
					log.warn(
						"Received Category Change Event, but have no record of a stream starting.",
						"Provided Data: " + JSON.stringify(providedStreamData),
						"Local Data: " + JSON.stringify(localStreamData),
						"Queried Data " + JSON.stringify(queriedStreamData)
					);
					return;
				}

				// get last marker's emote count (either stream start or a category change)
				const lastEmoteCount = await database.getValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker/" +
						lastMarker +
						"/emoteCount"
				);

				// get current emote count
				const currentEmoteCount = await getCurrentEmoteCount();

				// update previous marker
				database.updateValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
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
						localStreamData.id +
						"/marker/" +
						Date.now(),
					{
						type: "category_changed",
						category: {
							id: queriedStreamData.game_id,
							name: queriedStreamData.game_name,
						},
						emoteCount: currentEmoteCount,
					}
				);

				// log
				log.message(
					"[" + localStreamData.id + "]",
					'Stream "' + localStreamData.title + '"',
					"category changed to " + queriedStreamData.game_name
				);
			}
			// a category change near/after the stream ended or before it began. either way its weird. (ignore)
			else {
				// log
				log.warn(
					"Received Category Change Event, but there does not seem to be an active stream.",
					"Provided Data: " + JSON.stringify(providedStreamData),
					"Local Data: " + JSON.stringify(localStreamData),
					"Queried Data " + JSON.stringify(queriedStreamData)
				);
				return;
			}
		}

		// compare local and queried stream data for a representation of what happened
		else if (providedStreamData.type === "end") {
			// queried stream data acquired
			if (queriedStreamData) {
				// local and queried stream data match (end stream)
				if (localStreamData.id === queriedStreamData.id) {
					// get current emote count
					const currentEmoteCount = await getCurrentEmoteCount();

					// get last marker key (either stream start or a category change)
					const lastMarker = await database.getLastKey(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker"
					);

					// get last marker's emote count (either stream start or a category change)
					const lastEmoteCount = await database.getValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker/" +
							lastMarker +
							"/emoteCount"
					);

					// update previous marker with total emote usage
					database.updateValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
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
							localStreamData.id +
							"/marker/" +
							Date.now(),
						{
							type: "end",
							category: {
								id: queriedStreamData.game_id,
								name: queriedStreamData.game_name,
							},
							emoteCount: currentEmoteCount,
						}
					);

					// get first marker key (stream start marker)
					const firstMarker = await database.getFirstKey(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker"
					);

					// get first marker's emote count (stream start marker)
					const firstEmoteCount = await database.getValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker/" +
							firstMarker +
							"/emoteCount"
					);

					// update stream info
					database.updateValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id,
						{
							title: queriedStreamData.title,
							viewers: localStreamData.viewer_count,
							// total emote usage
							emoteUsage: currentEmoteCount - firstEmoteCount,
							// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
							emotePerHour:
								(currentEmoteCount - firstEmoteCount) /
								((Date.now() - firstMarker) / (60 * 60 * 1000)),
						}
					);

					// clear local stream data
					database.deletePath("temp/stream/" + config.twitchUserID);

					// log
					log.message(
						"[" + localStreamData.id + "]",
						'Stream "' + queriedStreamData.title + '" ended',
						"Total Counted Emotes:",
						currentEmoteCount - firstEmoteCount,
						"Uptime:",
						(Date.now() - firstMarker) / (60 * 60 * 1000),
						"hours"
					);
				}

				// local and queried stream id do not match (restarted stream: end old stream, create new stream)
				else {
					// END STREAM

					// get current emote count
					const currentEmoteCount = await getCurrentEmoteCount();

					// get last marker key (either stream start or a category change)
					const lastMarker = await database.getLastKey(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker"
					);

					// get last marker's emote count (either stream start or a category change)
					const lastEmoteCount = await database.getValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker/" +
							lastMarker +
							"/emoteCount"
					);

					// update previous marker with total emote usage
					database.updateValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
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
							localStreamData.id +
							"/marker/" +
							Date.now(),
						{
							type: "end",
							category: {
								id: localStreamData.game_id,
								name: localStreamData.game_name,
							},
							emoteCount: currentEmoteCount,
						}
					);

					// get first marker key (stream start marker)
					const firstMarker = await database.getFirstKey(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker"
					);

					// get first marker's emote count (stream start marker)
					const firstEmoteCount = await database.getValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id +
							"/marker/" +
							firstMarker +
							"/emoteCount"
					);

					// update stream info
					database.updateValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							localStreamData.id,
						{
							title: localStreamData.title,
							viewers: localStreamData.viewer_count,
							// total emote usage
							emoteUsage: currentEmoteCount - firstEmoteCount,
							// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
							emotePerHour:
								(currentEmoteCount - firstEmoteCount) /
								((Date.now() - firstMarker) / (60 * 60 * 1000)),
						}
					);

					// clear local stream data
					database.deletePath("temp/stream/" + config.twitchUserID);

					// log
					log.message(
						"[" + localStreamData.id + "]",
						'Stream "' + localStreamData.title + '" ended',
						"Total Counted Emotes:",
						currentEmoteCount - firstEmoteCount,
						"Uptime:",
						(Date.now() - firstMarker) / (60 * 60 * 1000),
						"hours"
					);

					// START STREAM

					// format and store local stream data
					database.setValue("temp/stream/" + config.twitchUserID, {
						id: queriedStreamData.id,
						game_id: queriedStreamData.game_id,
						game_name: queriedStreamData.game_name,
						title: queriedStreamData.title,
						viewer_count: queriedStreamData.viewer_count,
					});

					// store stream info and marker
					database.setValue(
						"stream/" +
							config.twitchUserID +
							"/" +
							queriedStreamData.id,
						{
							title: queriedStreamData.title,
							viewers: queriedStreamData.viewer_count,
							marker: {
								[Date.now()]: {
									type: "start",
									category: {
										id: queriedStreamData.game_id,
										name: queriedStreamData.game_name,
									},
									emoteCount: currentEmoteCount,
								},
							},
						}
					);

					// log
					log.message(
						"[" + queriedStreamData.id + "]",
						'Stream "' + queriedStreamData.title + '" started.'
					);
				}
			}

			// no queried data found, go with local state (end stream)
			else {
				// get current emote count
				const currentEmoteCount = await getCurrentEmoteCount();

				// get last marker key (either stream start or a category change)
				const lastMarker = await database.getLastKey(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker"
				);

				// get last marker's emote count (either stream start or a category change)
				const lastEmoteCount = await database.getValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker/" +
						lastMarker +
						"/emoteCount"
				);

				// update previous marker with total emote usage
				database.updateValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
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
						localStreamData.id +
						"/marker/" +
						Date.now(),
					{
						type: "end",
						category: {
							id: queriedStreamData.game_id,
							name: localStreamData.gameName,
						},
						emoteCount: currentEmoteCount,
					}
				);

				// get first marker key (stream start marker)
				const firstMarker = await database.getFirstKey(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker"
				);

				// get first marker's emote count (stream start marker)
				const firstEmoteCount = await database.getValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker/" +
						firstMarker +
						"/emoteCount"
				);

				// update stream info
				database.updateValue(
					"stream/" + config.twitchUserID + "/" + localStreamData.id,
					{
						title: localStreamData.title,
						viewers: queriedStreamData.viewer_count,
						// total emote usage
						emoteUsage: currentEmoteCount - firstEmoteCount,
						// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
						emotePerHour:
							(currentEmoteCount - firstEmoteCount) /
							((Date.now() - firstMarker) / (60 * 60 * 1000)),
					}
				);

				// clear local stream data
				database.deletePath("temp/stream/" + config.twitchUserID);

				// log
				log.message(
					"[" + localStreamData.id + "]",
					'Stream "' + localStreamData.title + '" ended',
					"Total Counted Emotes:",
					currentEmoteCount - firstEmoteCount,
					"Uptime:",
					(Date.now() - firstMarker) / (60 * 60 * 1000),
					"hours"
				);
			}
		}
	}

	// provided stream data but no local stream data found (start stream)
	else if (providedStreamData && !localStreamData) {
		// start stream event with queried stream data, caught before routine query did (start stream)
		if (providedStreamData.type === "start" && queriedStreamData) {
			// format and store local stream data
			database.setValue("temp/stream/" + config.twitchUserID, {
				id: providedStreamData.id,
				game_id: queriedStreamData.game_id,
				game_name: queriedStreamData.game_name,
				title: queriedStreamData.title,
				viewer_count: queriedStreamData.viewer_count,
			});

			// store stream info and marker
			database.setValue(
				"stream/" + config.twitchUserID + "/" + providedStreamData.id,
				{
					title: queriedStreamData.title,
					viewers: queriedStreamData.viewer_count,
					marker: {
						[Date.now()]: {
							type: "start",
							category: {
								id: queriedStreamData.game_id,
								name: queriedStreamData.game_name,
							},
							emoteCount: await getCurrentEmoteCount(),
						},
					},
				}
			);

			// log
			log.message(
				"[" + queriedStreamData.id + "]",
				'Stream "' + queriedStreamData.title + '" started.'
			);
		}

		// streamer probably changed category before starting stream. typical. (ignore)
		else if (providedStreamData.type === "category_changed") {
			// log
			log.warn(
				"Received Category Changed Event with no local data, and therefore no record of a stream starting.",
				"Provided Data: " + JSON.stringify(providedStreamData),
				"Local Data: " + JSON.stringify(localStreamData),
				"Queried Data " + JSON.stringify(queriedStreamData)
			);
			return;
		}
		// crap. stream is ending and I don't even have a reference to the ID. hopefully there was a successful query (end stream)
		else if (providedStreamData.type === "end" && queriedStreamData) {
			// get current emote count
			const currentEmoteCount = await getCurrentEmoteCount();

			// get last marker key (either stream start or a category change)
			const lastMarker = await database.getLastKey(
				"stream/" +
					config.twitchUserID +
					"/" +
					queriedStreamData.id +
					"/marker"
			);

			// get last marker's emote count (either stream start or a category change)
			const lastEmoteCount = await database.getValue(
				"stream/" +
					config.twitchUserID +
					"/" +
					queriedStreamData.id +
					"/marker/" +
					lastMarker +
					"/emoteCount"
			);

			// update previous marker with total emote usage
			database.updateValue(
				"stream/" +
					config.twitchUserID +
					"/" +
					queriedStreamData.id +
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
					queriedStreamData.id +
					"/marker/" +
					Date.now(),
				{
					type: "end",
					category: {
						id: queriedStreamData.game_id,
						name: queriedStreamData.game_name,
					},
					emoteCount: currentEmoteCount,
				}
			);

			// get first marker key (stream start marker)
			const firstMarker = await database.getFirstKey(
				"stream/" +
					config.twitchUserID +
					"/" +
					queriedStreamData.id +
					"/marker"
			);

			// get first marker's emote count (stream start marker)
			const firstEmoteCount = await database.getValue(
				"stream/" +
					config.twitchUserID +
					"/" +
					queriedStreamData.id +
					"/marker/" +
					firstMarker +
					"/emoteCount"
			);

			// update stream info
			database.updateValue(
				"stream/" + config.twitchUserID + "/" + queriedStreamData.id,
				{
					title: queriedStreamData.title,
					viewers: queriedStreamData.viewer_count,
					// total emote usage
					emoteUsage: currentEmoteCount - firstEmoteCount,
					// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
					emotePerHour:
						(currentEmoteCount - firstEmoteCount) /
						((Date.now() - firstMarker) / (60 * 60 * 1000)),
				}
			);

			// clear local stream data
			database.deletePath("temp/stream/" + config.twitchUserID);

			// log
			log.message(
				"[" + queriedStreamData.id + "]",
				'Stream "' + queriedStreamData.title + '" ended',
				"Total Counted Emotes:",
				currentEmoteCount - firstEmoteCount,
				"Uptime:",
				(Date.now() - firstMarker) / (60 * 60 * 1000),
				"hours"
			);
		}

		// welp. stream is ending without a proper reference to the stream ID. last resort is to check the database.
		else {
			// check for last stream in database without end marker

			// shit. an end event without a stream to pin it to. this can't be good... (ignore)

			// log
			log.warn(
				"Received End Event, but have no record of current stream.",
				"Provided Data: " + JSON.stringify(providedStreamData),
				"Local Data: " + JSON.stringify(localStreamData),
				"Queried Data " + JSON.stringify(queriedStreamData)
			);
			return;
		}
	}

	// no provided stream data, but local stream data found (check for updates or end stream)
	else if (!providedStreamData && localStreamData) {
		// check for stream data update
		if (queriedStreamData) {
			// get all local stream data
			let allLocalStreamData = await database.getValue(
				"temp/stream/" + config.twitchUserID
			);

			// update local stream data
			allLocalStreamData = {
				id: localStreamData.id,
				// new category info?
				game_id: queriedStreamData.game_id,
				game_name: queriedStreamData.game_name,
				// new title?
				title: queriedStreamData.title,
				// keep largest viewer count
				viewer_count:
					queriedStreamData.viewer_count >
					localStreamData.viewer_count
						? queriedStreamData.viewer_count
						: localStreamData.viewer_count,
			};

			// store updated local stream data
			database.setValue(
				"temp/stream/" + config.twitchUserID,
				allLocalStreamData
			);

			// new stream ID? (end old stream and start new stream)
			if (queriedStreamData.id !== localStreamData.id) {
				// END STREAM

				// get current emote count
				const currentEmoteCount = await getCurrentEmoteCount();

				// get last marker key (either stream start or a category change)
				const lastMarker = await database.getLastKey(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker"
				);

				// get last marker's emote count (either stream start or a category change)
				const lastEmoteCount = await database.getValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker/" +
						lastMarker +
						"/emoteCount"
				);

				// update previous marker with total emote usage
				database.updateValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
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
						localStreamData.id +
						"/marker/" +
						Date.now(),
					{
						type: "end",
						category: {
							id: localStreamData.game_id,
							name: localStreamData.game_name,
						},
						emoteCount: currentEmoteCount,
					}
				);

				// get first marker key (stream start marker)
				const firstMarker = await database.getFirstKey(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker"
				);

				// get first marker's emote count (stream start marker)
				const firstEmoteCount = await database.getValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker/" +
						firstMarker +
						"/emoteCount"
				);

				// clear local stream data
				database.deletePath("temp/stream/" + config.twitchUserID);

				// log
				log.message(
					"[" + localStreamData.id + "]",
					'Stream "' + localStreamData.title + '" ended',
					"Total Counted Emotes:",
					currentEmoteCount - firstEmoteCount,
					"Uptime:",
					(Date.now() - firstMarker) / (60 * 60 * 1000),
					"hours"
				);

				// START STREAM

				// format and store local stream data
				database.setValue("temp/stream/" + config.twitchUserID, {
					id: queriedStreamData.id,
					game_id: queriedStreamData.game_id,
					game_name: queriedStreamData.game_name,
					title: queriedStreamData.title,
					viewer_count: queriedStreamData.viewer_count,
				});

				// store stream info and marker
				database.setValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						queriedStreamData.id,
					{
						title: queriedStreamData.title,
						viewers: queriedStreamData.viewer_count,
						marker: {
							[Date.now()]: {
								type: "start",
								category: {
									id: queriedStreamData.game_id,
									name: queriedStreamData.game_name,
								},
								emoteCount: currentEmoteCount,
							},
						},
					}
				);

				// log
				log.message(
					"[" + queriedStreamData.id + "]",
					'Stream "' + queriedStreamData.title + '" started.'
				);
			}

			// new category? update database with new category marker
			else if (queriedStreamData.game_id !== localStreamData.game_id) {
				// get last marker key (either stream start or a category change)
				const lastMarker = await database.getLastKey(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker"
				);

				// last marker is missing (aka no stream start), then cancel
				if (!lastMarker) {
					// log
					log.warn(
						"It looks like the category has changed, but I do not have a reference to a previous category or stream start marker.",
						"Provided Data: " + JSON.stringify(providedStreamData),
						"Local Data: " + JSON.stringify(localStreamData),
						"Queried Data " + JSON.stringify(queriedStreamData)
					);
					return;
				}

				// get last marker's emote count (either stream start or a category change)
				const lastEmoteCount = await database.getValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
						"/marker/" +
						lastMarker +
						"/emoteCount"
				);

				// get current emote count
				const currentEmoteCount = await getCurrentEmoteCount();

				// update previous marker
				database.updateValue(
					"stream/" +
						config.twitchUserID +
						"/" +
						localStreamData.id +
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
						localStreamData.id +
						"/marker/" +
						Date.now(),
					{
						type: "category_changed",
						category: {
							id: queriedStreamData.game_id,
							name: queriedStreamData.game_name,
						},
						emoteCount: currentEmoteCount,
					}
				);

				// log
				log.message(
					"[" + localStreamData.id + "]",
					'Stream "' + localStreamData.title + '"',
					"category changed to " + queriedStreamData.game_name
				);
			}
		}

		// no queried stream data found (end stream)
		else {
			// get current emote count
			const currentEmoteCount = await getCurrentEmoteCount();

			// get last marker key (either stream start or a category change)
			const lastMarker = await database.getLastKey(
				"stream/" +
					config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker"
			);

			// get last marker's emote count (either stream start or a category change)
			const lastEmoteCount = await database.getValue(
				"stream/" +
					config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker/" +
					lastMarker +
					"/emoteCount"
			);

			// update previous marker with total emote usage
			database.updateValue(
				"stream/" +
					config.twitchUserID +
					"/" +
					localStreamData.id +
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
					localStreamData.id +
					"/marker/" +
					Date.now(),
				{
					type: "end",
					category: {
						id: localStreamData.game_id,
						name: localStreamData.game_name,
					},
					emoteCount: currentEmoteCount,
				}
			);

			// get first marker key (stream start marker)
			const firstMarker = await database.getFirstKey(
				"stream/" +
					config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker"
			);

			// get first marker's emote count (stream start marker)
			const firstEmoteCount = await database.getValue(
				"stream/" +
					config.twitchUserID +
					"/" +
					localStreamData.id +
					"/marker/" +
					firstMarker +
					"/emoteCount"
			);

			// update stream info
			database.updateValue(
				"stream/" + config.twitchUserID + "/" + localStreamData.id,
				{
					title: localStreamData.title,
					viewers: localStreamData.viewer_count,
					// total emote usage
					emoteUsage: currentEmoteCount - firstEmoteCount,
					// calculate emotes per hour (total emote usage / stream length in milliseconds converted to hours)
					emotePerHour:
						(currentEmoteCount - firstEmoteCount) /
						((Date.now() - firstMarker) / (60 * 60 * 1000)),
				}
			);

			// clear local stream data
			database.deletePath("temp/stream/" + config.twitchUserID);

			// log
			log.message(
				"[" + localStreamData.id + "]",
				'Stream "' + localStreamData.title + '" ended',
				"Total Counted Emotes:",
				currentEmoteCount - firstEmoteCount,
				"Uptime:",
				(Date.now() - firstMarker) / (60 * 60 * 1000),
				"hours"
			);
		}
	}

	// no provided or local stream data found but queried stream data found (create local stream data and start stream)
	else if (!providedStreamData && !localStreamData && queriedStreamData) {
		// format and store local stream data
		database.setValue("temp/stream/" + config.twitchUserID, {
			id: queriedStreamData.id,
			game_id: queriedStreamData.game_id,
			game_name: queriedStreamData.game_name,
			title: queriedStreamData.title,
			viewer_count: queriedStreamData.viewer_count,
		});

		// store stream info and marker
		database.setValue(
			"stream/" + config.twitchUserID + "/" + queriedStreamData.id,
			{
				title: queriedStreamData.title,
				viewers: queriedStreamData.viewer_count,
				marker: {
					[Date.now()]: {
						type: "start",
						category: {
							id: queriedStreamData.game_id,
							name: queriedStreamData.game_name,
						},
						emoteCount: await getCurrentEmoteCount(),
					},
				},
			}
		);

		// log
		log.message(
			"[" + queriedStreamData.id + "]",
			'Stream "' + queriedStreamData.title + '" started.'
		);
	}

	// no provided stream data, local stream data, or queried stream data? 🏖️🐎 MAN (ignore, and wait for streamer to go live saj)
	else if (!providedStreamData && !localStreamData && !queriedStreamData)
		return;
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
setInterval(updateStreamData, 5 * 60 * 1000);

// query on startup
updateStreamData();

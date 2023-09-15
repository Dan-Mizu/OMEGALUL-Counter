/** Simplified Version of the Twitch Helix API Stream Data Response */
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

/** Twitch Helix API User Data Response */
interface TwitchUser {
	/** An ID that identifies the user. */
	id: string;
	/** The user’s login name. */
	login: string;
	/** The user’s display name. */
	display_name: string;
	/** The type of user. Possible values are:
	 * - admin — Twitch administrator
	 * - global_mod
	 * - staff — Twitch staff
	 * - "" — Normal user
	 */
	type: string;
	/** The type of broadcaster. Possible values are:
	 * - affiliate — An affiliate broadcaster
	 * - partner — A partner broadcaster
	 * - "" — A normal broadcaster
	 */
	broadcaster_type: string;
	/** The user’s description of their channel. */
	description: string;
	/** A URL to the user’s profile image. */
	profile_image_url: string;
	/** A URL to the user’s offline image. */
	offline_image_url: string;
	/** The number of times the user’s channel has been viewed.
	 *
	 * **NOTE**: This field has been deprecated (see [Get Users API endpoint – “view_count” deprecation](https://discuss.dev.twitch.tv/t/get-users-api-endpoint-view-count-deprecation/37777)). Any data in this field is not valid and should not be used.
	 */
	view_count: number;
	/**
	 * The user’s verified email address. The object includes this field only if the user access token includes the **user:read:email** scope.
	 *
	 *	If the request contains more than one user, only the user associated with the access token that provided consent will include an email address — the email address for all other users will be empty.
	 */
	email: string;
	/** The UTC date and time that the user’s account was created. The timestamp is in RFC3339 format. */
	created_at: string;
}

/** Twitch Helix API Stream Data Response */
interface TwitchStream {
	/** An ID that identifies the stream. You can use this ID later to look up the video on demand (VOD). */
	id: string;
	/** The ID of the user that’s broadcasting the stream. */
	user_id: string;
	/** The user’s login name. */
	user_login: string;
	/** The user’s display name. */
	user_name: string;
	/** The ID of the category or game being played. */
	game_id: string;
	/** The name of the category or game being played. */
	game_name: string;
	/**
	 * The type of stream. Possible values are:
	 * - live
	 *
	 * If an error occurs, this field is set to an empty string.
	 */
	type: string;
	/** The stream’s title. Is an empty string if not set. */
	title: string;
	/** The tags applied to the stream. */
	tags: string[];
	/** The number of users watching the stream. */
	viewer_count: number;
	/** The UTC date and time (in RFC3339 format) of when the broadcast began. */
	started_at: string;
	/** The language that the stream uses. This is an ISO 639-1 two-letter language code or other if the stream uses a language not in the list of [supported stream languages].(https://help.twitch.tv/s/article/languages-on-twitch#streamlang) */
	language: string;
	/** A URL to an image of a frame from the last 5 minutes of the stream. Replace the width and height placeholders in the URL (`{width}x{height}`) with the size of the image you want, in pixels. */
	thumbnail_url: string;
	/**
	 * **IMPORTANT** As of February 28, 2023, this field is deprecated and returns only an empty array. If you use this field, please update your code to use the `tags` field.
	 *
	 * The list of tags that apply to the stream. The list contains IDs only when the channel is steaming live. For a list of possible tags, see [List of All Tags](https://www.twitch.tv/directory/all/tags). The list doesn’t include Category Tags.
	 */
	tag_ids: string[];
	/** A Boolean value that indicates whether the stream is meant for mature audiences. */
	is_mature: boolean;
}

/** Kattah API User Data Response */
interface KattahUser {
	id: number;
	twitch_username: string;
	stv_id: string;
	tracking_since: string;
	tracking: boolean;
}

/** Kattah API Emote Data Response */
interface KattahEmote {
	emote: string;
	emote_id: string;
	count: number;
	added: string;
}

/** Kattah API Channel Data Response */
interface KattahChannel {
	success: boolean;
	user: KattahUser;
	emotes: {
		[key: number]: KattahEmote;
	};
}

/** Twitch Access Token Data */
interface AccessToken {
	token: string;
	expires_at: number;
}

/** Secret Data for API Access */
interface SecretData {
	access_token?: AccessToken;
	event_secret?: string;
}

// imports
import firebase from "firebase-admin";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// config
import config from "../../config/config.json" assert { type: "json" };

// init
initializeApp({
	credential: cert(config.firebase as firebase.ServiceAccount),
	databaseURL: config.database.databaseURL,
});
const realtimeDatabase = firebase.database();
const firestoreDatabase = getFirestore();

export default {
	// set value in database
	setValue: function (
		path: string,
		value: any,
		databaseType: string = "realtime"
	): void {
		// database write disabled
		if (!config.writeToDatabase) return;

		// realtime database
		if (databaseType === "realtime") realtimeDatabase.ref(path).set(value);
		// firestore database
		else if (databaseType === "firestore") {
			// set value
			firestoreDatabase.collection(path).doc().set(value);
		}
	},

	// update value (merging) in database
	updateValue: function (
		path: string,
		value: any,
		databaseType: string = "realtime"
	): void {
		// database write disabled
		if (!config.writeToDatabase) return;

		// realtime database
		if (databaseType === "realtime")
			realtimeDatabase.ref(path).update(value);
		// firestore database
		else if (databaseType === "firestore") {
			// set value
			firestoreDatabase.collection(path).doc().set(value);
		}
	},

	// get value in database
	getValue: async function (
		path: string,
		databaseType: string = "realtime"
	): Promise<any> {
		// init value
		let value: any;

		// realtime database
		if (databaseType === "realtime")
			// get value
			await realtimeDatabase
				.ref(path)
				.orderByKey()
				.once("value", async (data: any) => {
					value = await data.val();
				});
		// firestore database
		else if (databaseType === "firestore") {
			// separate last spot in the path
			let pathList = path.split("/");
			let doc = pathList.pop() as string;
			path = pathList.join("/");

			// get value
			firestoreDatabase.collection(path).doc(doc).get();
		}

		return value;
	},

	// get latest key in database
	getLastKey: async function (
		path: string,
		databaseType: string = "realtime"
	): Promise<any> {
		// init value
		let key: string;

		// realtime database
		if (databaseType === "realtime")
			// get value
			await realtimeDatabase
				.ref()
				.child(path)
				.orderByKey()
				.limitToLast(1)
				.get()
				.then((snapshot: firebase.database.DataSnapshot) => {
					key =
						snapshot.val() != null
							? Object.keys(snapshot.val())[0]
							: null;
				});
		// firestore database
		else if (databaseType === "firestore") {
		}

		return key;
	},

	// get latest key in database
	getFirstKey: async function (
		path: string,
		databaseType: string = "realtime"
	): Promise<any> {
		// init value
		let key: string;

		// realtime database
		if (databaseType === "realtime")
			// get value
			await realtimeDatabase
				.ref()
				.child(path)
				.orderByKey()
				.limitToFirst(1)
				.get()
				.then((snapshot: firebase.database.DataSnapshot) => {
					key =
						snapshot.val() != null
							? Object.keys(snapshot.val())[0]
							: null;
				});
		// firestore database
		else if (databaseType === "firestore") {
		}

		return key;
	},

	// delete entire path in database
	deletePath: async function (
		path: string,
		databaseType: string = "realtime"
	): Promise<void> {
		// database write disabled
		if (!config.writeToDatabase) return;

		// realtime database
		if (databaseType === "realtime") {
			// get value
			realtimeDatabase.ref(path).remove();
		}
		// firestore database
		else if (databaseType === "firestore") {
			await firestoreDatabase.recursiveDelete(
				firestoreDatabase.collection(path)
			);
		}
	},

	// check to see if a path in the database exists
	pathExists: async function (
		path: string,
		databaseType: string = "realtime"
	): Promise<boolean> {
		// init exists
		let exists: boolean = false;

		// realtime database
		if (databaseType === "realtime")
			// check for path
			exists = await realtimeDatabase
				.ref(path)
				.orderByKey()
				.limitToFirst(1)
				.once("value")
				.then((res: any) => res.exists());
		// firestore database
		else if (databaseType === "firestore") {
		}

		return exists;
	},
};

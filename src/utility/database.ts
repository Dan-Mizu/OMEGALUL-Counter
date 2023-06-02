// Database Utility

//dependencies
import { ServiceAccount, database } from "firebase-admin";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

//get config values
const config = await import (`${process.cwd()}/config/config.json`)

//init database
initializeApp({
	credential: cert(config.firebase as ServiceAccount),
	databaseURL: config.database.databaseURL,
});
const realtimeDatabase = database();
const firestoreDatabase = getFirestore();

export default {
	//set value in database
	setValue: function (
		path: string,
		value: any,
		databaseType: string = "firestore"
	) {
		// realtime database
		if (databaseType === "realtime") realtimeDatabase.ref(path).set(value);
		// firestore database
		else if (databaseType === "firestore") {
			// set value
			firestoreDatabase.collection(path).doc().set(value);
		}
	},

	//get value in database
	getValue: async function (path: string, databaseType: string = "realtime") {
		//init value
		let value;

		// realtime database
		if (databaseType === "realtime")
			//get value
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

	deletePath: async function (
		path: string,
		databaseType: string = "firestore"
	) {
		// realtime database
		if (databaseType === "realtime") {
		}
		// firestore database
		else if (databaseType === "firestore") {
			await firestoreDatabase.recursiveDelete(
				firestoreDatabase.collection(path)
			);
		}
	},

	//check to see if a path in the database exists
	pathExists: async function (
		path: string,
		databaseType: string = "realtime"
	) {
		// init exists
		let exists: boolean = false;

		// realtime database
		if (databaseType === "realtime")
			//check for path
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

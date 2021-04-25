import { adminDB } from "../../../utils/admin-db";
import admin from "../../../utils/firebase-admin";
import firebaseAdmin from "firebase-admin";
import { Arg, Mutation, Resolver } from "type-graphql";
import { ApolloError } from "apollo-server-errors";

@Resolver()
export default class AuthenticateResolver {
  @Mutation(() => Boolean!)
  async authenticate(@Arg("idToken") idToken: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      const res = await fetch(
        `https://api.github.com/user/${decodedToken.firebase.identities["github.com"][0]}`
      );
      const githubData = await res.json();

      const docRef = adminDB.doc(`users/${decodedToken.uid}`);
      const doc = await docRef.get();

      const docData: FirebaseFirestore.DocumentData = {
        email: decodedToken,
        posts: [],
        repos: [],
        username: githubData.login,
      };

      if (!doc.exists)
        docData.createdAt = firebaseAdmin.firestore.Timestamp.now();

      await docRef.set(docData, { merge: true });

      return true;
    } catch (e) {
      console.error(e);
      throw new ApolloError(
        "Internal server error, please notify a maintainer of this API!"
      );
    }
  }
}

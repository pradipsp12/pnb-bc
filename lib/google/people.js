import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const people = google.people({
  version: "v1",
  auth: oauth2Client,
});

export async function createGoogleContact(name, phone) {
  if (!phone) return;

  await people.people.createContact({
    requestBody: {
      names: [
        {
          givenName: name,
        },
      ],
      phoneNumbers: [
        {
          value: phone,
        },
      ],
    },
  });
}
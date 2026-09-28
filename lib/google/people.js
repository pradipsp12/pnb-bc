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

export async function createGoogleContact(customer) {
  return await people.people.createContact({
    requestBody: {
      names: [
        {
          givenName: `${customer.customerName} - PNB Customer`,
        },
      ],

      phoneNumbers: [
        {
          value: customer.mobileNo,
          type: "mobile",
        },
      ],

      organizations: [
        {
          name: "Punjab National Bank",
          title: "Customer",
        },
      ],

      biographies: [
        {
          value:
            `Account No: ${customer.accountNo}\n` +
            `Aadhaar No: ${customer.adharNo}`,
        },
      ],
    },
  });
}
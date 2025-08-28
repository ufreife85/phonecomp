// functions/index.js

const {onRequest} = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
// const cors = require("cors")({origin: true}); <-- THIS LINE IS REMOVED
const {defineString} = require("firebase-functions/params");

// Define parameters for email and password
const gmailEmail = defineString("GMAIL_EMAIL");
const gmailPassword = defineString("GMAIL_PASSWORD");

const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail.value(),
    pass: gmailPassword.value(),
  },
});

// The {cors: true} option handles CORS automatically in 2nd Gen functions
exports.sendReportEmail = onRequest({cors: true}, (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const {students, recipientEmail} = req.body;

  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).send("Student data is missing or empty.");
  }

  if (!recipientEmail || !/\S+@\S+\.\S+/.test(recipientEmail)) {
    return res.status(400).send("Recipient email is missing or invalid.");
  }

  const studentListHtml = students.map((s) => {
    return `<li>${s.fullName} (ID: ${s.studentId}, Grade: ${s.grade})</li>`;
  }).join("");

  const mailOptions = {
    from: `"Phone Collection App" <${gmailEmail.value()}>`,
    to: recipientEmail,
    subject: `Phone Collection Report - ${new Date().toLocaleDateString()}`,
    html: `
      <p>The following students had empty phone cases today:</p>
      <ul>
        ${studentListHtml}
      </ul>
      <p>Total: ${students.length}</p>
    `,
  };

  return mailTransport.sendMail(mailOptions)
      .then(() => {
        console.log(`Report email sent successfully to ${recipientEmail}!`);
        return res.status(200).send("Email sent successfully.");
      })
      .catch((error) => {
        console.error("There was an error while sending the email:", error);
        return res.status(500).send("Error sending email.");
      });
});

// Bootstrap script: writes admin doc using open Firestore rules (no auth needed)
const PROJECT_ID = "dg-proposal-repo";
const ADMIN_UID = "MCsZ09glDdc4hm5eSIs6hP1CqRa2";

async function main() {
  console.log("📝 Writing admin document to Firestore (unauthenticated, open rules)...");

  const fsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${ADMIN_UID}`;

  const body = {
    fields: {
      displayName:  { stringValue: "Admin" },
      designation:  { stringValue: "System Administrator" },
      contact:      { stringValue: "" },
      department:   { stringValue: "IT Administration" },
      organization: { stringValue: "DG Infotech" },
      email:        { stringValue: "admin@dginfotech.com" },
      photoURL:     { stringValue: "" },
      role:         { stringValue: "admin" },
      createdAt:    { stringValue: new Date().toISOString() },
    },
  };

  const fsRes = await fetch(fsUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const fsData = await fsRes.json();

  if (!fsRes.ok) {
    console.error("❌ Firestore write failed:", JSON.stringify(fsData.error || fsData, null, 2));
    process.exit(1);
  }

  console.log("\n🎉 SUCCESS! Admin document written to Firestore.");
  console.log("   Collection : users");
  console.log(`   Document ID: ${ADMIN_UID}`);
  console.log("   role       : admin");
  console.log("\nRestoring secure Firestore rules now...");
}

main().catch(err => {
  console.error("❌ Unexpected error:", err.message);
  process.exit(1);
});

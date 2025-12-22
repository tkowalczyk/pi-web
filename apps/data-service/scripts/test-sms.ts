import { sendSms, formatWasteNotification } from "../src/services/sms";

async function testSms() {
  const apiToken = process.env.SERWERSMS_API_TOKEN;

  if (!apiToken) {
    console.error("❌ SERWERSMS_API_TOKEN not found");
    process.exit(1);
  }

  // CHANGE THIS to your test phone number
  const testPhone = "+48606181071";

  // Sender name required for FULL SMS (without it sends ECO)
  const senderName = process.env.SERWERSMS_SENDER_NAME || "2waySMS";

  console.log("📱 SMS Test");
  console.log("===========");
  console.log(`Phone: ${testPhone}`);
  console.log(`Sender: ${senderName} (FULL SMS)`);
  console.log();

  // Test 1: Simple message
  console.log("Test 1: Simple message...");
  const result1 = await sendSms(
    apiToken,
    testPhone,
    "Test - SMS działa! 🎉",
    senderName
  );

  if ("error" in result1) {
    console.error("❌", result1.error);
  } else {
    console.log("✅ Sent!");
    console.log(`   ID: ${result1.messageId}, Parts: ${result1.parts}, Status: ${result1.status}`);
  }

  console.log();
  console.log("Done!");
}

testSms().catch(console.error);
